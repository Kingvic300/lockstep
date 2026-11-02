import { useMemo, useState } from "react";
import { contract } from "@stellar/stellar-sdk";
import { Icon } from "../components/Icon";
import {
  ERRORS,
  MANUAL_TYPES,
  activeGuarantees,
  buildExecuteArgs,
  describeGuarantee,
  describeStep,
  newGuarantee,
  newStep,
  typeName,
  useBatch,
  type FnInfo,
  type Guarantee,
  type ManualType,
  type Step,
} from "../lib/batch";
import { Link } from "../lib/router";
import { describeError, fromUnits, isAddress, isContractId, read, short, simulate, toUnits, write, type Stage } from "../lib/stellar";
import { useWallet } from "../lib/wallet";
import { Notice, stringify, type Msg } from "./shared";

export function Compose() {
  const { address, net, signer, demo } = useWallet();
  const { steps, setSteps, guarantees, setGuarantees, minutes, setMinutes, addHistory, config, reset } = useBatch();
  const [busy, setBusy] = useState<"" | "simulate" | "submit">("");
  const [stage, setStage] = useState<Stage | "">("");
  const [msg, setMsg] = useState<Msg | null>(null);

  const updateStep = (key: number, patch: Partial<Step>) => setSteps((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const updateG = (key: number, patch: Partial<Guarantee>) => setGuarantees((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));

  async function loadInterface(step: Step) {
    if (!isContractId(step.contractId)) {
      updateStep(step.key, { loadState: "failed", loadError: "Enter a contract ID that starts with C." });
      return;
    }
    updateStep(step.key, { loadState: "loading", loadError: undefined });
    try {
      const client = await contract.Client.from({ contractId: step.contractId.trim(), networkPassphrase: net.passphrase, rpcUrl: net.rpcUrl });
      const fns: FnInfo[] = client.spec
        .funcs()
        .map((f) => ({ name: f.name.toString(), inputs: f.inputs.map((i) => ({ name: i.name.toString(), type: i.type })) }))
        .filter((f) => !f.name.startsWith("__"));
      const keep = fns.find((f) => f.name === step.func);
      updateStep(step.key, {
        spec: client.spec,
        fns,
        loadState: "loaded",
        func: keep ? step.func : "",
        args: keep ? keep.inputs.map((i) => ({ name: i.name, spec: i.type, manual: "string" as ManualType, value: i.type.type === "scSpecTypeAddress" && /from|user|owner|caller/.test(i.name) ? address ?? "" : "" })) : [],
      });
    } catch (e) {
      updateStep(step.key, {
        loadState: "failed",
        loadError: `Could not read this contract's interface. Enter the function and arguments by hand. (${describeError(e)})`,
        spec: undefined,
        fns: undefined,
      });
    }
  }

  function chooseFunc(step: Step, name: string) {
    const fn = step.fns?.find((f) => f.name === name);
    updateStep(step.key, {
      func: name,
      args: fn
        ? fn.inputs.map((i) => ({
            name: i.name,
            spec: i.type,
            manual: "string" as ManualType,
            value: i.type.type === "scSpecTypeAddress" && /from|user|owner|caller|sender/.test(i.name) ? address ?? "" : "",
          }))
        : step.args,
    });
  }

  async function loadToken(g: Guarantee) {
    if (!isContractId(g.token)) return;
    try {
      const [symbol, decimals] = await Promise.all([read(net, g.token.trim(), "symbol") as Promise<string>, read(net, g.token.trim(), "decimals") as Promise<number>]);
      updateG(g.key, { symbol: symbol === "native" ? "XLM" : symbol, decimals: Number(decimals) });
    } catch {
      updateG(g.key, { symbol: undefined, decimals: undefined });
    }
  }

  async function run(mode: "simulate" | "submit") {
    setMsg(null);
    if (demo) return setMsg({ ok: false, text: "This is the demo. Connect a wallet to dry run or sign a batch." });
    if (!address) return setMsg({ ok: false, text: "Connect a wallet first." });
    if (!config.contractId) return setMsg({ ok: false, text: "Set the Lockstep contract ID in Settings first." });
    let args;
    try {
      args = buildExecuteArgs(address, steps, guarantees, minutes);
    } catch (e) {
      return setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(mode);
    const stepText = steps.map(describeStep);
    const gText = activeGuarantees(guarantees).map((g) => describeGuarantee(g, address));
    try {
      if (mode === "simulate") {
        const r = await simulate(net, address, config.contractId, "execute", args);
        setMsg({
          ok: true,
          text: `Dry run passed. Every step ran and every guarantee held. Estimated fee ${fromUnits(BigInt(r.fee), 7, 4)} XLM.`,
          detail: stringify(r.value),
        });
      } else {
        const r = await write(net, address, signer, config.contractId, "execute", args, setStage);
        setMsg({ ok: true, text: "Batch landed. Every step ran and every guarantee held.", hash: r.hash, detail: stringify(r.value) });
        addHistory({ id: r.hash, at: new Date().toISOString(), hash: r.hash, network: net.network, ok: true, steps: stepText, guarantees: gText });
      }
    } catch (e) {
      const text = describeError(e, ERRORS);
      setMsg({ ok: false, text: mode === "simulate" ? `Dry run failed. ${text}` : text, detail: e instanceof Error ? e.message : String(e) });
      if (mode === "submit") {
        addHistory({ id: String(Date.now()), at: new Date().toISOString(), hash: "", network: net.network, ok: false, steps: stepText, guarantees: gText, error: text });
      }
    } finally {
      setBusy("");
      setStage("");
    }
  }

  const submitLabel =
    busy === "submit" ? (stage === "signing" ? "Approve in wallet…" : stage === "confirming" || stage === "submitting" ? "Waiting for ledger…" : "Preparing…") : "Sign and run";

  const deadlineText = useMemo(() => new Date(Date.now() + minutes * 60_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), [minutes]);
  const ready = steps.filter((s) => s.func);
  const gs = activeGuarantees(guarantees);

  return (
    <div className="composer">
      <div className="compose-main">
        <div className="page-bar">
          <p className="page-lede">Steps run top to bottom. If any fails, nothing happens.</p>
          <button className="btn small ghost" onClick={() => reset()}>
            Clear batch
          </button>
        </div>
        <ol className="rail" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s.key} className="step">
              <span className="knot" aria-hidden="true">
                {i + 1}
              </span>
              <div className="step-body card">
                <div className="step-head">
                  <h2>Step {i + 1}</h2>
                  <div className="row tight">
                    {s.func && <span className="pill indigo mono">{s.func}()</span>}
                    {steps.length > 1 && (
                      <button className="icon-btn" onClick={() => setSteps((ss) => ss.filter((x) => x.key !== s.key))} aria-label={`Remove step ${i + 1}`}>
                        <Icon name="x" size={16} />
                      </button>
                    )}
                  </div>
                </div>
                {s.note && <p className="hint">{s.note}</p>}
                <div className="contract-row">
                  <label className="field">
                    Contract
                    <input
                      className="mono"
                      value={s.contractId}
                      placeholder="C…"
                      spellCheck={false}
                      onChange={(e) => updateStep(s.key, { contractId: e.target.value, loadState: "idle" })}
                      onBlur={() => {
                        if (s.contractId && s.loadState === "idle") void loadInterface(s);
                      }}
                    />
                  </label>
                  <button className="btn ghost" onClick={() => void loadInterface(s)} disabled={s.loadState === "loading" || demo}>
                    {s.loadState === "loading" ? "Reading…" : "Read functions"}
                  </button>
                </div>
                {s.loadError && <p className="hint warn">{s.loadError}</p>}

                {s.fns ? (
                  <label className="field">
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
                  (s.loadState === "failed" || s.func) && (
                    <label className="field">
                      Function name
                      <input className="mono" value={s.func} onChange={(e) => updateStep(s.key, { func: e.target.value })} />
                    </label>
                  )
                )}

                {s.args.length > 0 && (
                  <div className="args">
                    {s.args.map((a, ai) => (
                      <div key={ai} className={a.spec ? "arg" : "arg manual"}>
                        <label className="field">
                          <span>
                            {a.name} <span className="type">{a.spec ? typeName(a.spec) : a.manual}</span>
                          </span>
                          <input
                            className="mono"
                            value={a.value}
                            spellCheck={false}
                            onChange={(e) => updateStep(s.key, { args: s.args.map((x, xi) => (xi === ai ? { ...x, value: e.target.value } : x)) })}
                          />
                        </label>
                        {!a.spec && (
                          <select
                            aria-label={`Type of ${a.name}`}
                            value={a.manual}
                            onChange={(e) => updateStep(s.key, { args: s.args.map((x, xi) => (xi === ai ? { ...x, manual: e.target.value as ManualType } : x)) })}
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
                {(s.loadState === "failed" || (!s.spec && s.func)) && (
                  <button className="btn small ghost add-row" onClick={() => updateStep(s.key, { args: [...s.args, { name: `arg ${s.args.length + 1}`, manual: "address", value: "" }] })}>
                    <Icon name="plus" size={14} /> Add argument
                  </button>
                )}
              </div>
            </li>
          ))}
          <li className="step add">
            <span className="knot" aria-hidden="true">
              <Icon name="plus" size={16} />
            </span>
            <button className="btn ghost" onClick={() => setSteps((ss) => [...ss, newStep()])} disabled={steps.length >= 16}>
              Add step
            </button>
          </li>
        </ol>
      </div>

      <aside className="gate card" aria-labelledby="gate-title">
        <div className="gate-head">
          <span className="gate-icon">
            <Icon name="lock" size={18} />
          </span>
          <div>
            <h2 id="gate-title">Guarantees</h2>
            <p className="muted">Checked after the last step.</p>
          </div>
        </div>

        {guarantees.map((g, i) => (
          <fieldset key={g.key} className="guarantee">
            <legend className="sr-only">Guarantee {i + 1}</legend>
            <div className="g-line">
              <select aria-label="Direction" value={g.direction} onChange={(e) => updateG(g.key, { direction: e.target.value as Guarantee["direction"] })}>
                <option value="receive">Receive at least</option>
                <option value="spend">Spend at most</option>
              </select>
              <span className="input-unit">
                <input aria-label="Amount" inputMode="decimal" value={g.amount} placeholder="0.00" onChange={(e) => updateG(g.key, { amount: e.target.value })} />
                <span>{g.symbol ?? "token"}</span>
              </span>
              {guarantees.length > 1 && (
                <button className="icon-btn" onClick={() => setGuarantees((x) => x.filter((y) => y.key !== g.key))} aria-label={`Remove guarantee ${i + 1}`}>
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
            <label className="field">
              Token contract
              <input
                className="mono"
                value={g.token}
                placeholder="C…"
                spellCheck={false}
                onChange={(e) => updateG(g.key, { token: e.target.value, symbol: undefined, decimals: undefined })}
                onBlur={() => void loadToken(g)}
              />
            </label>
            <label className="field">
              Account
              <input className="mono" value={g.account} spellCheck={false} onChange={(e) => updateG(g.key, { account: e.target.value })} />
              {address && g.account && g.account !== address && isAddress(g.account) && <span className="hint">Watching {short(g.account)}, not your account.</span>}
            </label>
          </fieldset>
        ))}
        <button className="btn small ghost add-row" onClick={() => setGuarantees((x) => [...x, newGuarantee(address ?? "")])} disabled={guarantees.length >= 16}>
          <Icon name="plus" size={14} /> Add guarantee
        </button>

        <label className="field">
          Refuse to run after
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[2, 5, 10, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutes from signing
              </option>
            ))}
          </select>
        </label>

        {(ready.length > 0 || gs.length > 0) && (
          <div className="receipt">
            <p className="receipt-title">You are signing</p>
            <ol>
              {ready.map((s) => (
                <li key={s.key}>
                  <code>{s.func}</code> on {short(s.contractId || "?")}
                </li>
              ))}
            </ol>
            <ul>
              {gs.map((g) => {
                let amt = g.amount;
                try {
                  if (g.decimals !== undefined) amt = fromUnits(toUnits(g.amount, g.decimals), g.decimals, g.decimals);
                } catch {
                  /* show as typed */
                }
                return (
                  <li key={g.key}>
                    <Icon name="check" size={14} /> {describeGuarantee({ ...g, amount: amt }, address)}
                  </li>
                );
              })}
              <li>
                <Icon name="check" size={14} /> Nothing runs after {deadlineText}
              </li>
            </ul>
          </div>
        )}

        <div className="gate-actions">
          <button className="btn ghost" onClick={() => void run("simulate")} disabled={!!busy}>
            {busy === "simulate" ? "Running…" : "Dry run"}
          </button>
          <button className="btn primary" onClick={() => void run("submit")} disabled={!!busy}>
            {submitLabel}
          </button>
        </div>
        {!config.contractId && !demo && (
          <p className="hint">
            No Lockstep contract set. <Link to="/app/settings">Add it in Settings</Link>.
          </p>
        )}
        <Notice msg={msg} />
      </aside>
    </div>
  );
}
