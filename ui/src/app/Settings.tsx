import { useState } from "react";
import { Icon } from "../components/Icon";
import { useBatch } from "../lib/batch";
import { navigate } from "../lib/router";
import { PRESETS, contractExists, explorerContract, isContractId, short } from "../lib/stellar";
import { useWallet } from "../lib/wallet";
import { Copy, Notice, type Msg } from "./shared";

export function SettingsPage() {
  const { net, setNet, address, wallet, disconnect, demo } = useWallet();
  const { config, setConfig } = useBatch();
  const [id, setId] = useState(config.contractId);
  const [rpc, setRpc] = useState(net.rpcUrl);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [checking, setChecking] = useState(false);
  const link = config.contractId ? explorerContract(net, config.contractId) : undefined;

  async function saveContract() {
    setMsg(null);
    if (!isContractId(id)) return setMsg({ ok: false, text: "Enter a contract ID that starts with C." });
    setChecking(true);
    try {
      if (!(await contractExists(net, id))) throw new Error("missing");
      setConfig({ contractId: id.trim() });
      setMsg({ ok: true, text: "Lockstep contract saved." });
    } catch {
      setMsg({ ok: false, text: `No contract answered at that ID on ${net.network}.` });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="page narrow-page">
      <section className="card">
        <h2>Lockstep contract</h2>
        <p className="muted">The deployed Lockstep contract that runs your batches. Deploy your own from the repo or use a shared one.</p>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveContract();
          }}
        >
          <label className="field">
            Contract ID
            <input className="mono" value={id} onChange={(e) => setId(e.target.value)} placeholder="C…" spellCheck={false} />
          </label>
          <button className="btn primary" disabled={checking}>
            {checking ? "Checking…" : "Save"}
          </button>
        </form>
        {config.contractId && (
          <p className="hint">
            Current: <span className="mono">{short(config.contractId, 8)}</span> <Copy text={config.contractId} />
            {link && (
              <a href={link} target="_blank" rel="noreferrer">
                {" "}
                Explorer <Icon name="external" size={12} />
              </a>
            )}
          </p>
        )}
        <Notice msg={msg} />
      </section>

      <section className="card">
        <h2>Network</h2>
        <div className="segmented" role="radiogroup" aria-label="Network">
          {(["testnet", "mainnet"] as const).map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={net.network === n}
              className={net.network === n ? "on" : ""}
              onClick={() => {
                const next = n === "testnet" ? PRESETS.testnet : { ...PRESETS.mainnet, rpcUrl: net.network === "mainnet" ? net.rpcUrl : "" };
                setNet(next);
                setRpc(next.rpcUrl);
              }}
            >
              {n === "testnet" ? "Testnet" : "Mainnet"}
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            setNet({ ...net, rpcUrl: rpc.trim() });
          }}
        >
          <label className="field">
            RPC URL
            <input value={rpc} onChange={(e) => setRpc(e.target.value)} placeholder="https://…" />
          </label>
          <button className="btn ghost">Save</button>
        </form>
        <p className="hint">Your wallet must be set to the same network.</p>
      </section>

      <section className="card">
        <h2>Wallet</h2>
        {address && (
          <p>
            {demo ? "Demo session" : `${wallet?.name ?? "Wallet"} connected as`} <span className="mono">{short(address, 8)}</span>
          </p>
        )}
        <button
          className="btn ghost"
          onClick={() => {
            disconnect();
            navigate("/connect");
          }}
        >
          <Icon name="logout" size={16} /> {demo ? "Leave demo" : "Disconnect"}
        </button>
      </section>
    </div>
  );
}
