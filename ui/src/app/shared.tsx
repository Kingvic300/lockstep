import { useState } from "react";
import { Icon } from "../components/Icon";
import { explorerTx } from "../lib/stellar";
import { useWallet } from "../lib/wallet";

export interface Msg {
  ok: boolean;
  text: string;
  hash?: string;
  detail?: string;
}

export function Notice(props: { msg: Msg | null; onClose?: () => void }) {
  const { net } = useWallet();
  if (!props.msg) return null;
  const link = props.msg.hash ? explorerTx(net, props.msg.hash) : undefined;
  return (
    <div className={props.msg.ok ? "note ok" : "note err"} role={props.msg.ok ? "status" : "alert"}>
      <Icon name={props.msg.ok ? "check" : "x"} size={18} />
      <span>{props.msg.text}</span>
      {link && (
        <a href={link} target="_blank" rel="noreferrer">
          View transaction <Icon name="external" size={14} />
        </a>
      )}
      {props.onClose && (
        <button className="icon-btn" onClick={props.onClose} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      )}
      {props.msg.detail && (
        <details className="note-detail">
          <summary>{props.msg.ok ? "Return values" : "Details"}</summary>
          <pre>{props.msg.detail}</pre>
        </details>
      )}
    </div>
  );
}

export function Copy(props: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="icon-btn"
      aria-label={props.label ?? "Copy"}
      title={props.label ?? "Copy"}
      onClick={() => {
        void navigator.clipboard?.writeText(props.text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
    >
      <Icon name={done ? "check" : "copy"} size={16} />
    </button>
  );
}

export function stringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2) ?? "null";
}
