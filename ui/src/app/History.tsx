import { Icon } from "../components/Icon";
import { useBatch, type HistoryItem } from "../lib/batch";
import { Link } from "../lib/router";
import { explorerTx, timeAgo } from "../lib/stellar";
import { useWallet } from "../lib/wallet";

export function HistoryList(props: { items: HistoryItem[]; compact?: boolean }) {
  const { net } = useWallet();
  if (props.items.length === 0) {
    return (
      <div className="empty-state small">
        <Icon name="activity" size={26} />
        <p>No batches yet. Batches you run from this browser show up here.</p>
        <Link to="/app/compose" className="btn small primary">
          Build your first batch
        </Link>
      </div>
    );
  }
  return (
    <ol className="batch-list">
      {props.items.map((h) => {
        const link = explorerTx(net, h.hash);
        return (
          <li key={h.id} className={h.ok ? "batch ok" : "batch fail"}>
            <span className="batch-icon">
              <Icon name={h.ok ? "check" : "x"} size={16} />
            </span>
            <div className="batch-main">
              <div className="batch-title">
                {h.steps.length} step{h.steps.length === 1 ? "" : "s"}
                <span className={h.ok ? "pill green" : "pill red"}>{h.ok ? "Landed" : "Rolled back"}</span>
              </div>
              <div className="batch-steps mono">{h.steps.join("  →  ")}</div>
              {!props.compact && (
                <ul className="batch-guarantees">
                  {h.guarantees.map((g) => (
                    <li key={g}>
                      <Icon name="lock" size={13} /> {g}
                    </li>
                  ))}
                  {h.error && <li className="err">{h.error}</li>}
                </ul>
              )}
            </div>
            <div className="batch-meta">
              <span title={new Date(h.at).toLocaleString()}>{timeAgo(h.at)}</span>
              {h.fee && !props.compact && <span>{h.fee} XLM fee</span>}
              {link && (
                <a href={link} target="_blank" rel="noreferrer">
                  Transaction <Icon name="external" size={13} />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function History() {
  const { history, clearHistory } = useBatch();
  const { demo } = useWallet();
  return (
    <div className="page">
      <div className="page-bar">
        <p className="page-lede">Batches you signed or tried from this browser. History is stored only on this device.</p>
        {history.length > 0 && !demo && (
          <button className="btn small ghost" onClick={clearHistory}>
            Clear history
          </button>
        )}
      </div>
      <section className="card">
        <HistoryList items={history} />
      </section>
    </div>
  );
}
