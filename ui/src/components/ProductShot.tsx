import { Icon } from "./Icon";

const STEPS = [
  { n: 1, fn: "swap", on: "XLM/USDC pool", detail: "100 XLM in" },
  { n: 2, fn: "swap", on: "USDC/EURC pool", detail: "route remainder" },
  { n: 3, fn: "deposit", on: "USDC lending pool", detail: "supply all USDC" },
];

/** Hero product card: a batch, its guarantees and two floating details. Static sample data. */
export function ProductShot() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="pcard">
        <div className="pcard-head">
          <div>
            <div className="pcard-kicker">Batch ready to sign</div>
            <div className="pcard-title">
              3 steps, <mark>one signature</mark>, all or nothing
            </div>
          </div>
          <span className="pill indigo">
            <span className="dot" /> Dry run passed
          </span>
        </div>
        <ol className="rail-mini">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="rail-knot">{s.n}</span>
              <span className="rail-fn mono">{s.fn}</span>
              <span className="rail-on">{s.on}</span>
              <span className="rail-detail">{s.detail}</span>
            </li>
          ))}
        </ol>
        <div className="gate-mini">
          <div className="gate-mini-title">
            <Icon name="lock" size={16} /> Checked after the last step
          </div>
          <ul>
            <li>
              <Icon name="check" size={15} /> You receive at least <strong>95.00 USDC</strong> in the pool
            </li>
            <li>
              <Icon name="check" size={15} /> You spend at most <strong>100 XLM</strong>
            </li>
            <li>
              <Icon name="check" size={15} /> Nothing runs after <strong>14:32</strong>
            </li>
          </ul>
        </div>
      </div>

      <div className="float float-left">
        <span className="float-icon">
          <Icon name="wallet" size={18} />
        </span>
        <div>
          <div className="float-title">Signed once in Freighter</div>
          <div className="float-sub">Fee 0.0214 XLM, simulated first</div>
        </div>
      </div>

      <div className="float float-right">
        <div className="float-kicker">If a check fails</div>
        <div className="float-title">Every step rolls back</div>
        <div className="float-sub">Your balances end exactly where they started. No half-finished swaps.</div>
      </div>
    </div>
  );
}
