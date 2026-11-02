import { useEffect, useMemo, useState } from "react";
import { contract } from "@stellar/stellar-sdk";
import {
  PRESETS,
  type NetSettings,
  addr,
  connectWallet,
  describeError,
  fromUnits,
  i128,
  isAddress,
  loadSettings,
  nativeToScVal,
  read,
  saveSettings,
  short,
  simulate,
  sym,
  toUnits,
  u64,
  write,
  xdr,
} from "./stellar";

const STORE_KEY = "lockstep.settings";

const ERRORS: Record<number, string> = {
  1: "The deadline passed before the batch ran. Sign it again.",
  2: "Add at least one step.",
  3: "A batch can hold at most 16 steps.",
  4: "A batch can hold at most 16 guarantees.",
  5: "A step cannot call Lockstep itself.",
  6: "A guarantee was not met, so nothing ran. Check the amounts, or the steps did not produce what you expected.",
};

const defaults: NetSettings = {
  ...PRESETS.testnet,
  contractId: (import.meta.env.VITE_CONTRACT_ID as string | undefined) ?? "",
};

// ---------- model ----------

interface ArgField {
  name: string;
  /** Spec type when the contract interface is loaded, else a manual type. */
  spec?: xdr.ScSpecTypeDef;
  manual: ManualType;
  value: string;
}

type ManualType = "address" | "i128" | "u64" | "u32" | "bool" | "symbol" | "string";
const MANUAL_TYPES: ManualType[] = ["address", "i128", "u64", "u32", "bool", "symbol", "string"];

interface FnInfo {
  name: string;
  inputs: { name: string; type: xdr.ScSpecTypeDef }[];
}

interface Step {
  key: number;
  contractId: string;
  spec?: contract.Spec;
  fns?: FnInfo[];
  loadState: "idle" | "loading" | "loaded" | "failed";
  loadError?: string;
  func: string;
  args: ArgField[];
}

type Direction = "receive" | "spend";

interface Guarantee {
  key: number;
  token: string;
  account: string;
  direction: Direction;
  amount: string;
  symbol?: string;
  decimals?: number;
}

let nextKey = 1;
const newStep = (): Step => ({ key: nextKey++, contractId: "", loadState: "idle", func: "", args: [] });
const newGuarantee = (account: string): Guarantee => ({
  key: nextKey++,
  token: "",
  account,
  direction: "receive",
  amount: "",
});

function typeName(t: xdr.ScSpecTypeDef): string {
  switch (t.type) {
    case "scSpecTypeUdt":
      return t.udt.name.toString();
    case "scSpecTypeVec":
      return `Vec<${typeName(t.vec.elementType)}>`;
    case "scSpecTypeOption":
      return `Option<${typeName(t.option.valueType)}>`;
    default: {
      const n = t.type.replace(/^scSpecType/, "");
      return n.charAt(0).toLowerCase() + n.slice(1);
    }
  }
}

function parseForSpec(raw: string, t: xdr.ScSpecTypeDef): unknown {
  const n = t.type;
  const v = raw.trim();
  if (/(I|U)(64|128|256)$/.test(n)) return BigInt(v);
  if (/(I|U)32$/.test(n)) return Number(v);
  if (n === "scSpecTypeBool") return v === "true";
  if (["scSpecTypeAddress", "scSpecTypeMuxedAddress", "scSpecTypeString", "scSpecTypeSymbol"].includes(n)) return v;
  if (n === "scSpecTypeVoid") return undefined;
  return JSON.parse(v, (_k, val) => (typeof val === "string" && /^-?\d+n$/.test(val) ? BigInt(val.slice(0, -1)) : val));
}

function argToScVal(a: ArgField, spec?: contract.Spec): xdr.ScVal {
  if (a.spec && spec) return spec.nativeToScVal(parseForSpec(a.value, a.spec), a.spec);
  const v = a.value.trim();
  switch (a.manual) {
    case "address":
      return addr(v);
    case "i128":
      return i128(BigInt(v));
    case "u64":
      return u64(BigInt(v));
    case "u32":
      return nativeToScVal(Number(v), { type: "u32" });
    case "bool":
      return xdr.ScVal.scvBool(v === "true");
    case "symbol":
      return sym(v);
    case "string":
      return nativeToScVal(v, { type: "string" });
  }
}

function field(name: string, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({ key: sym(name), val });
}

function stringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2) ?? "null";
}

// ---------- app ----------

export default function App() {
  const [net, setNet] = useState<NetSettings>(() => loadSettings(STORE_KEY, defaults));
  const [showSettings, setShowSettings] = useState(!net.contractId);
  const [wallet, setWallet] = useState("");
  const [steps, setSteps] = useState<Step[]>(() => [newStep()]);
  const [guarantees, setGuarantees] = useState<Guarantee[]>(() => [newGuarantee("")]);
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<{ ok: boolean; title: string; body?: string } | null>(null);

  // Fill empty guarantee accounts with the wallet once connected.
  useEffect(() => {
    if (!wallet) return;
    setGuarantees((gs) => gs.map((g) => (g.account ? g : { ...g, account: wallet })));
  }, [wallet]);

  const updateStep = (key: number, patch: Partial<Step>) =>
    setSteps((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const updateGuarantee = (key: number, patch: Partial<Guarantee>) =>
    setGuarantees((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));

  async function loadInterface(step: Step) {
    if (!isAddress(step.contractId) || !step.contractId.trim().startsWith("C")) {
      updateStep(step.key, { loadState: "failed", loadError: "Enter a contract ID that starts with C." });
      return;
    }
    updateStep(step.key, { loadState: "loading", loadError: undefined });
    try {
      const client = await contract.Client.from({
        contractId: step.contractId.trim(),
        networkPassphrase: net.passphrase,
        rpcUrl: net.rpcUrl,
      });
      const fns: FnInfo[] = client.spec
        .funcs()
        .map((f) => ({
          name: f.name.toString(),
          inputs: f.inputs.map((i) => ({ name: i.name.toString(), type: i.type })),
        }))
        .filter((f) => !f.name.startsWith("__"));
      updateStep(step.key, { spec: client.spec, fns, loadState: "loaded", func: "", args: [] });
    } catch (e) {
      updateStep(step.key, {
        loadState: "failed",
        loadError: `Could not read this contract's interface. Enter the function and arguments by hand. (${describeError(e, {})})`,
        spec: undefined,
        fns: undefined,
      });
    }
  }

  function chooseFunc(step: Step, name: string) {
    const fn = step.fns?.find((f) => f.name === name);
    updateStep(step.key, {
      func: name,
      args: fn ? fn.inputs.map((i) => ({ name: i.name, spec: i.type, manual: "string", value: "" })) : step.args,
    });
  }

  async function loadToken(g: Guarantee) {
    if (!isAddress(g.token)) return;
    try {
      const [symbol, decimals] = await Promise.all([
        read(net, g.token.trim(), "symbol") as Promise<string>,
        read(net, g.token.trim(), "decimals") as Promise<number>,
      ]);
      updateGuarantee(g.key, { symbol, decimals: Number(decimals) });
    } catch {
      updateGuarantee(g.key, { symbol: undefined, decimals: undefined });
    }
  }

  function buildArgs(): xdr.ScVal[] {
    if (!wallet) throw new Error("Connect Freighter first. The connected account signs the batch.");
    if (!net.contractId) throw new Error("Set the Lockstep contract ID in settings.");
    const calls = steps.map((s, i) => {
      if (!isAddress(s.contractId)) throw new Error(`Step ${i + 1}: enter a contract ID.`);
      if (!s.func.trim()) throw new Error(`Step ${i + 1}: choose a function.`);
      let args: xdr.ScVal[];
      try {
        args = s.args.map((a) => argToScVal(a, s.spec));
      } catch (e) {
        throw new Error(`Step ${i + 1}: an argument has the wrong format. ${e instanceof Error ? e.message : ""}`);
      }
      return xdr.ScVal.scvMap([
        field("args", xdr.ScVal.scvVec(args)),
        field("contract", addr(s.contractId)),
        field("func", sym(s.func.trim())),
      ]);
    });
    const checks = guarantees
      .filter((g) => g.token.trim() || g.amount.trim())
      .map((g, i) => {
        if (!isAddress(g.token)) throw new Error(`Guarantee ${i + 1}: enter the token contract ID.`);
        if (!isAddress(g.account)) throw new Error(`Guarantee ${i + 1}: enter the account to watch.`);
        if (g.decimals === undefined) throw new Error(`Guarantee ${i + 1}: the token could not be read. Check its contract ID.`);
        const units = toUnits(g.amount, g.decimals);
        return xdr.ScVal.scvMap([
          field("account", addr(g.account)),
          field("min_delta", i128(g.direction === "receive" ? units : -units)),
          field("token", addr(g.token)),
        ]);
      });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
    return [addr(wallet), xdr.ScVal.scvVec(calls), xdr.ScVal.scvVec(checks), u64(deadline)];
  }

  async function run(mode: "simulate" | "submit") {
    setResult(null);
    let args: xdr.ScVal[];
    try {
      args = buildArgs();
    } catch (e) {
      setResult({ ok: false, title: e instanceof Error ? e.message : String(e) });
      return;
    }
    setBusy(mode);
    try {
      const out =
        mode === "simulate"
          ? await simulate(net, wallet, net.contractId, "execute", args)
          : await write(net, wallet, net.contractId, "execute", args, (stage) => setBusy(`submit:${stage}`));
      setResult({
        ok: true,
        title: mode === "simulate" ? "Dry run passed. Every step ran and every guarantee held." : "Batch done. Every step ran and every guarantee held.",
        body: stringify(out),
      });
    } catch (e) {
      setResult({
        ok: false,
        title: mode === "simulate" ? `Dry run failed. ${describeError(e, ERRORS)}` : describeError(e, ERRORS),
        body: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy("");
    }
  }

  const submitLabel = busy.startsWith("submit")
    ? busy.endsWith("signing")
      ? "Confirm in Freighter…"
      : busy.endsWith("confirming")
        ? "Waiting for ledger…"
        : "Preparing…"
    : "Sign and run";

  const deadlineText = useMemo(() => {
    const d = new Date(Date.now() + minutes * 60_000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [minutes]);

  return (
    <div className="shell">
      <header className="bar">
        <div className="brand">
          <span className="brand-name">Lockstep</span>
          {net.contractId && (
            <button className="link" onClick={() => setShowSettings(true)} title={net.contractId}>
              {short(net.contractId)} on {networkName(net)}
            </button>
          )}
        </div>
        <div className="bar-actions">
          <button className="ghost" onClick={() => setShowSettings(true)}>
            Settings
          </button>
          {wallet ? (
            <span className="wallet" title={wallet}>
              {short(wallet)}
            </span>
          ) : (
            <button
              className="primary"
              onClick={() =>
                connectWallet()
                  .then(setWallet)
                  .catch((e) => setResult({ ok: false, title: describeError(e, ERRORS) }))
              }
            >
              Connect Freighter
            </button>
          )}
        </div>
      </header>

      <section className="intro">
        <h1>All steps run, or none do.</h1>
        <p>
          Add the contract calls you want, in order. Then say what must be true at the end. You sign once. If any step fails
          or any guarantee is missed, the network rolls everything back.
        </p>
      </section>

      <div className="composer">
        <ol className="rail" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s.key} className="step">
              <span className="knot" aria-hidden="true">
                {i + 1}
              </span>
              <div className="step-body">
                <div className="step-head">
                  <h2>Step {i + 1}</h2>
                  {steps.length > 1 && (
                    <button
                      className="link"
                      onClick={() => setSteps((ss) => ss.filter((x) => x.key !== s.key))}
                      aria-label={`Remove step ${i + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="contract-row">
                  <label>
                    Contract
                    <input
                      className="mono"
                      value={s.contractId}
                      placeholder="C…"
                      spellCheck={false}
                      onChange={(e) => updateStep(s.key, { contractId: e.target.value, loadState: "idle" })}
                      onBlur={() => s.contractId && s.loadState === "idle" && void loadInterface(s)}
                    />
                  </label>
                  <button className="ghost" onClick={() => void loadInterface(s)} disabled={s.loadState === "loading"}>
                    {s.loadState === "loading" ? "Reading…" : "Read functions"}
                  </button>
                </div>
                {s.loadError && <p className="hint warn">{s.loadError}</p>}

                {s.fns ? (
                  <label>
                    Function
                    <select value={s.func} onChange={(e) => chooseFunc(s, e.target.value)}>
                      <option value="">Choose a function</option>
                      {s.fns.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}({f.inputs.map((x) => x.name).join(", ")})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  s.loadState === "failed" && (
                    <label>
                      Function name
                      <input className="mono" value={s.func} onChange={(e) => updateStep(s.key, { func: e.target.value })} />
                    </label>
                  )
                )}

                {s.args.length > 0 && (
                  <div className="args">
                    {s.args.map((a, ai) => (
                      <div key={ai} className="arg">
                        <label>
                          <span>
                            {a.name} <span className="type">{a.spec ? typeName(a.spec) : a.manual}</span>
                          </span>
                          <input
                            className="mono"
                            value={a.value}
                            spellCheck={false}
                            placeholder={a.spec && typeName(a.spec) === "address" && wallet ? short(wallet) : ""}
                            onChange={(e) =>
                              updateStep(s.key, {
                                args: s.args.map((x, xi) => (xi === ai ? { ...x, value: e.target.value } : x)),
                              })
                            }
                          />
                        </label>
                        {a.spec && typeName(a.spec) === "address" && wallet && !a.value && (
                          <button
                            className="link small-link"
                            onClick={() =>
                              updateStep(s.key, {
                                args: s.args.map((x, xi) => (xi === ai ? { ...x, value: wallet } : x)),
                              })
                            }
                          >
                            Use my address
                          </button>
                        )}
                        {!a.spec && (
                          <select
                            aria-label={`Type of argument ${ai + 1}`}
                            value={a.manual}
                            onChange={(e) =>
                              updateStep(s.key, {
                                args: s.args.map((x, xi) => (xi === ai ? { ...x, manual: e.target.value as ManualType } : x)),
                              })
                            }
                          >
                            {MANUAL_TYPES.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {s.loadState === "failed" && (
                  <button
                    className="link"
                    onClick={() =>
                      updateStep(s.key, {
                        args: [...s.args, { name: `arg ${s.args.length + 1}`, manual: "address", value: "" }],
                      })
                    }
                  >
                    Add argument
                  </button>
                )}
              </div>
            </li>
          ))}
          <li className="step add">
            <span className="knot" aria-hidden="true">
              +
            </span>
            <button className="ghost" onClick={() => setSteps((ss) => [...ss, newStep()])} disabled={steps.length >= 16}>
              Add step
            </button>
          </li>
        </ol>

        <aside className="gate" aria-labelledby="gate-title">
          <h2 id="gate-title">Guarantees</h2>
          <p className="gate-lede">Checked after the last step. If one fails, nothing happens.</p>

          {guarantees.map((g, i) => (
            <fieldset key={g.key} className="guarantee">
              <legend className="sr-only">Guarantee {i + 1}</legend>
              <div className="g-line">
                <select
                  aria-label="Direction"
                  value={g.direction}
                  onChange={(e) => updateGuarantee(g.key, { direction: e.target.value as Direction })}
                >
                  <option value="receive">Receive at least</option>
                  <option value="spend">Spend at most</option>
                </select>
                <input
                  aria-label="Amount"
                  inputMode="decimal"
                  value={g.amount}
                  placeholder="0.00"
                  onChange={(e) => updateGuarantee(g.key, { amount: e.target.value })}
                />
                <span className="g-symbol">{g.symbol ?? "token"}</span>
              </div>
              <label>
                Token contract
                <input
                  className="mono"
                  value={g.token}
                  placeholder="C…"
                  spellCheck={false}
                  onChange={(e) => updateGuarantee(g.key, { token: e.target.value, symbol: undefined, decimals: undefined })}
                  onBlur={() => void loadToken(g)}
                />
              </label>
              <label>
                Account
                <input
                  className="mono"
                  value={g.account}
                  placeholder={wallet ? "" : "Connect Freighter to fill this in"}
                  spellCheck={false}
                  onChange={(e) => updateGuarantee(g.key, { account: e.target.value })}
                />
              </label>
              {guarantees.length > 1 && (
                <button className="link" onClick={() => setGuarantees((gs) => gs.filter((x) => x.key !== g.key))}>
                  Remove guarantee
                </button>
              )}
            </fieldset>
          ))}
          <button className="link" onClick={() => setGuarantees((gs) => [...gs, newGuarantee(wallet)])}>
            Add guarantee
          </button>

          <label className="deadline">
            Refuse to run after
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[2, 5, 10, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes ({m === minutes ? deadlineText : "from signing"})
                </option>
              ))}
            </select>
          </label>

          <Summary steps={steps} guarantees={guarantees} wallet={wallet} deadline={deadlineText} />

          <div className="row">
            <button className="ghost" onClick={() => void run("simulate")} disabled={!!busy}>
              {busy === "simulate" ? "Running…" : "Dry run"}
            </button>
            <button className="primary" onClick={() => void run("submit")} disabled={!!busy}>
              {submitLabel}
            </button>
          </div>

          {result && (
            <div className={result.ok ? "result ok" : "result err"} role="status">
              <p>{result.title}</p>
              {result.body && (
                <details>
                  <summary>{result.ok ? "Return values" : "Details"}</summary>
                  <pre>{result.body}</pre>
                </details>
              )}
            </div>
          )}
        </aside>
      </div>

      {showSettings && (
        <Settings
          value={net}
          onClose={() => setShowSettings(false)}
          onSave={(s) => {
            saveSettings(STORE_KEY, s);
            setNet(s);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}

function Summary(props: { steps: Step[]; guarantees: Guarantee[]; wallet: string; deadline: string }) {
  const ready = props.steps.filter((s) => s.func);
  const gs = props.guarantees.filter((g) => g.amount.trim() && g.token.trim());
  if (ready.length === 0 && gs.length === 0) return null;
  return (
    <div className="summary">
      <p className="summary-title">You are signing this</p>
      <ul>
        {ready.map((s, i) => (
          <li key={s.key}>
            Run <code>{s.func}</code> on {short(s.contractId)}
            {i === 0 ? " first" : ""}
          </li>
        ))}
        {gs.map((g) => {
          let amt = g.amount;
          try {
            if (g.decimals !== undefined) amt = fromUnits(toUnits(g.amount, g.decimals), g.decimals, g.decimals);
          } catch {
            /* show as typed */
          }
          const who = g.account === props.wallet ? "you" : short(g.account || "?");
          return (
            <li key={g.key} className="must">
              {who === "you" ? "You" : who} {g.direction === "receive" ? (who === "you" ? "receive" : "receives") : who === "you" ? "spend" : "spends"}{" "}
              {g.direction === "receive" ? "at least" : "at most"} {amt} {g.symbol ?? "tokens"}
            </li>
          );
        })}
        <li className="must">Nothing runs after {props.deadline}</li>
      </ul>
    </div>
  );
}

function networkName(net: NetSettings): string {
  if (net.passphrase === PRESETS.testnet.passphrase) return "testnet";
  if (net.passphrase === PRESETS.mainnet.passphrase) return "mainnet";
  return "custom network";
}

function Settings(props: { value: NetSettings; onSave: (s: NetSettings) => void; onClose: () => void }) {
  const [s, setS] = useState(props.value);
  const preset = s.passphrase === PRESETS.testnet.passphrase ? "testnet" : s.passphrase === PRESETS.mainnet.passphrase ? "mainnet" : "custom";
  return (
    <div className="scrim" role="presentation" onClick={props.onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave({ ...s, contractId: s.contractId.trim(), rpcUrl: s.rpcUrl.trim() });
        }}
      >
        <h2 id="settings-title">Settings</h2>
        <label>
          Network
          <select
            value={preset}
            onChange={(e) => {
              const p = PRESETS[e.target.value];
              if (p) setS({ ...s, ...p });
            }}
          >
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
            {preset === "custom" && <option value="custom">Custom</option>}
          </select>
        </label>
        <label>
          RPC URL
          <input value={s.rpcUrl} onChange={(e) => setS({ ...s, rpcUrl: e.target.value })} placeholder="https://…" required />
          {preset === "mainnet" && <span className="hint">Mainnet has no public SDF RPC. Use your own or a provider's URL.</span>}
        </label>
        <label>
          Lockstep contract ID
          <input
            className="mono"
            value={s.contractId}
            onChange={(e) => setS({ ...s, contractId: e.target.value })}
            placeholder="C…"
            spellCheck={false}
            required
          />
        </label>
        <div className="row end">
          <button type="button" className="ghost" onClick={props.onClose}>
            Cancel
          </button>
          <button className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}
