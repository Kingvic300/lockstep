import { useState } from "react";
import { Icon, type IconName } from "../components/Icon";
import { newGuarantee, newStep, useBatch } from "../lib/batch";
import { Link, navigate } from "../lib/router";
import { fromUnits, isAddress, isContractId, nativeTokenId, read, toUnits } from "../lib/stellar";
import { useWallet } from "../lib/wallet";
import { Notice, type Msg } from "./shared";

export const TEMPLATES: { id: string; icon: IconName; title: string; blurb: string; detail: string }[] = [
  {
    id: "pay-many",
    icon: "wallet",
    title: "Pay several people",
    blurb: "Up to 16 transfers, one signature, a cap on the total.",
    detail: "Builds one transfer per recipient on the token you pick, plus a guarantee that you spend no more than the total.",
  },
  {
    id: "swap-min",
    icon: "releases",
    title: "Swap with a minimum",
    blurb: "Call any pool, then require what you get back.",
    detail: "One swap step on the pool you choose, with a minimum-received and a maximum-spent guarantee.",
  },
  {
    id: "send-confirm",
    icon: "check",
    title: "Send and confirm receipt",
    blurb: "Fail the payment unless the recipient's balance rises.",
    detail: "A transfer plus a guarantee on the recipient's balance. Useful for tokens with transfer fees or hooks.",
  },
  {
    id: "custom",
    icon: "plus",
    title: "Blank batch",
    blurb: "Start from scratch with any contract.",
    detail: "An empty step and an empty guarantee.",
  },
];

export function useApplyTemplate() {
  const { reset } = useBatch();
  const { address } = useWallet();
  return (id: string) => {
    if (id === "pay-many" || id === "send-confirm") return navigate(`/app/templates/${id}`);
    if (id === "swap-min") {
      reset(
        [newStep({ func: "swap", note: "Enter the pool contract and press Read functions." })],
        [newGuarantee(address ?? "", { direction: "receive" }), newGuarantee(address ?? "", { direction: "spend" })],
      );
    } else {
      reset();
    }
    navigate("/app/compose");
  };
}

export function Templates() {
  const apply = useApplyTemplate();
  return (
    <div className="page">
      <p className="page-lede">Start from a common shape. Every template opens in the composer, where you can change anything before signing.</p>
      <div className="tpl-grid">
        {TEMPLATES.map((t) => (
          <article key={t.id} className="card tpl">
            <span className="tpl-icon">
              <Icon name={t.icon} size={20} />
            </span>
            <h2>{t.title}</h2>
            <p className="muted">{t.detail}</p>
            <button className="btn ghost" onClick={() => apply(t.id)}>
              Use template
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

interface Row {
  to: string;
  amount: string;
}

/** Form for the payment templates. Builds transfer steps with exact token units. */
export function PayForm(props: { mode: "pay-many" | "send-confirm" }) {
  const { address, net, demo } = useWallet();
  const { reset } = useBatch();
  const single = props.mode === "send-confirm";
  const [token, setToken] = useState<"native" | "custom">("native");
  const [custom, setCustom] = useState("");
  const [rows, setRows] = useState<Row[]>([{ to: "", amount: "" }]);
  const [capTotal, setCapTotal] = useState(true);
  const [confirmEach, setConfirmEach] = useState(single);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);

  async function build() {
    setMsg(null);
    const me = address ?? "";
    const tokenId = token === "native" ? nativeTokenId(net) : custom.trim();
    if (!isContractId(tokenId)) return setMsg({ ok: false, text: "Enter the token's contract ID (starts with C)." });
    setBusy(true);
    try {
      let decimals = 7;
      let symbol = "XLM";
      if (token === "custom" && !demo) {
        decimals = Number(await read(net, tokenId, "decimals"));
        symbol = String(await read(net, tokenId, "symbol"));
      }
      let total = 0n;
      const steps = rows.map((r, i) => {
        if (!isAddress(r.to)) throw new Error(`Row ${i + 1}: enter a valid recipient address.`);
        const units = toUnits(r.amount, decimals);
        total += units;
        return newStep({
          contractId: tokenId,
          func: "transfer",
          loadState: "failed",
          loadError: undefined,
          note: `Send ${r.amount} ${symbol} to the recipient.`,
          args: [
            { name: "from", manual: "address", value: me },
            { name: "to", manual: "address", value: r.to.trim() },
            { name: "amount", manual: "i128", value: units.toString() },
          ],
        });
      });
      const gs = [];
      if (capTotal) {
        gs.push(newGuarantee(me, { token: tokenId, direction: "spend", amount: fromUnits(total, decimals, decimals).replace(/,/g, ""), symbol, decimals }));
      }
      if (confirmEach) {
        for (const r of rows) {
          gs.push(newGuarantee(r.to.trim(), { token: tokenId, direction: "receive", amount: r.amount.trim(), symbol, decimals }));
        }
      }
      reset(steps, gs);
      navigate("/app/compose");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow-page">
      <Link to="/app/templates" className="text-link back">
        ← All templates
      </Link>
      <section className="card">
        <h2>{single ? "Send and confirm receipt" : "Pay several people"}</h2>
        <p className="muted">
          {single
            ? "One transfer, and the batch fails unless the recipient's balance goes up by the amount."
            : "Each row becomes a transfer step. Amounts are in whole tokens."}
        </p>
        <div className="segmented" role="radiogroup" aria-label="Token">
          <button role="radio" aria-checked={token === "native"} className={token === "native" ? "on" : ""} onClick={() => setToken("native")}>
            XLM
          </button>
          <button role="radio" aria-checked={token === "custom"} className={token === "custom" ? "on" : ""} onClick={() => setToken("custom")}>
            Other token
          </button>
        </div>
        {token === "custom" && (
          <label className="field">
            Token contract ID
            <input className="mono" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="C…" spellCheck={false} />
          </label>
        )}
        <div className="pay-rows">
          {rows.map((r, i) => (
            <div key={i} className="pay-row">
              <label className="field">
                Recipient {single ? "" : i + 1}
                <input
                  className="mono"
                  value={r.to}
                  placeholder="G… or C…"
                  spellCheck={false}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}
                />
              </label>
              <label className="field">
                Amount
                <input inputMode="decimal" value={r.amount} placeholder="0.00" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              </label>
              {rows.length > 1 && (
                <button className="icon-btn" aria-label={`Remove recipient ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!single && (
          <button className="btn small ghost add-row" disabled={rows.length >= 16} onClick={() => setRows([...rows, { to: "", amount: "" }])}>
            <Icon name="plus" size={14} /> Add recipient
          </button>
        )}
        <div className="opts">
          <label className="check">
            <input type="checkbox" checked={capTotal} onChange={(e) => setCapTotal(e.target.checked)} />
            Guarantee I spend no more than the total
          </label>
          <label className="check">
            <input type="checkbox" checked={confirmEach} onChange={(e) => setConfirmEach(e.target.checked)} />
            Guarantee each recipient receives the full amount
          </label>
        </div>
        <Notice msg={msg} />
        <button className="btn primary" onClick={() => void build()} disabled={busy}>
          {busy ? "Reading token…" : "Open in composer"}
        </button>
      </section>
    </div>
  );
}
