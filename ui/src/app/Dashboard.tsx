import { useEffect, useState } from "react";
import { Icon, type IconName } from "../components/Icon";
import { useBatch } from "../lib/batch";
import { Link } from "../lib/router";
import { addr, fromUnits, nativeTokenId, read } from "../lib/stellar";
import { useWallet } from "../lib/wallet";
import { HistoryList } from "./History";
import { TEMPLATES, useApplyTemplate } from "./Templates";

export function Dashboard() {
  const { history, config } = useBatch();
  const { address, net, demo } = useWallet();
  const [xlm, setXlm] = useState<string>();
  const apply = useApplyTemplate();

  useEffect(() => {
    if (demo) {
      setXlm("12,450.20");
      return;
    }
    if (!address || !net.rpcUrl) return;
    let live = true;
    read(net, nativeTokenId(net), "balance", [addr(address)])
      .then((b) => live && setXlm(fromUnits(BigInt(b as bigint), 7)))
      .catch(() => live && setXlm(undefined));
    return () => {
      live = false;
    };
  }, [address, net, demo]);

  const ok = history.filter((h) => h.ok);
  const rate = history.length ? Math.round((ok.length / history.length) * 100) : 0;
  const steps = ok.reduce((s, h) => s + h.steps.length, 0);
  const checks = history.reduce((s, h) => s + h.guarantees.length, 0);

  return (
    <div className="page">
      {!config.contractId && !demo && (
        <div className="setup card">
          <div>
            <h2>Set the Lockstep contract</h2>
            <p className="muted">Paste the contract ID of a deployed Lockstep contract to start building batches.</p>
          </div>
          <Link to="/app/settings" className="btn primary">
            Open settings
          </Link>
        </div>
      )}

      <section className="welcome card">
        <div>
          <p className="welcome-kicker">Your balance</p>
          <p className="welcome-figure">
            {xlm ?? "—"} <span>XLM</span>
          </p>
          <p className="muted">Read live from the native asset contract on {net.network}.</p>
        </div>
        <div className="welcome-actions">
          <Link to="/app/compose" className="btn primary big">
            <Icon name="plus" size={18} /> New batch
          </Link>
          <Link to="/app/templates" className="btn ghost big">
            Start from a template
          </Link>
        </div>
      </section>

      <div className="kpi-row">
        <Kpi icon="releases" label="Batches run" value={String(history.length)} sub="From this browser" />
        <Kpi icon="check" label="Success rate" value={history.length ? `${rate}%` : "—"} sub={`${ok.length} landed, ${history.length - ok.length} rolled back`} tone="green" />
        <Kpi icon="overview" label="Steps executed" value={String(steps)} sub="Across successful batches" />
        <Kpi icon="lock" label="Guarantees signed" value={String(checks)} sub="Balance checks and caps" tone="indigo" />
      </div>

      <div className="two-col">
        <section className="card">
          <div className="panel-head">
            <h2>Recent batches</h2>
            <Link to="/app/history" className="text-link">
              See all
            </Link>
          </div>
          <HistoryList items={history.slice(0, 5)} compact />
        </section>
        <section className="card">
          <div className="panel-head">
            <h2>Quick start</h2>
          </div>
          <div className="quick-list">
            {TEMPLATES.slice(0, 3).map((t) => (
              <button key={t.id} className="quick-item" onClick={() => apply(t.id)}>
                <span className="quick-icon">
                  <Icon name={t.icon} size={18} />
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <span className="muted">{t.blurb}</span>
                </span>
                <Icon name="releases" size={16} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi(props: { icon: IconName; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`card kpi ${props.tone ?? ""}`}>
      <span className="kpi-icon">
        <Icon name={props.icon} size={18} />
      </span>
      <span className="kpi-label">{props.label}</span>
      <span className="kpi-value">{props.value}</span>
      {props.sub && <span className="kpi-sub">{props.sub}</span>}
    </div>
  );
}
