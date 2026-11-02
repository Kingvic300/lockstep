import { useEffect, useState, type ReactNode } from "react";
import { Brand } from "../components/Brand";
import { Icon, type IconName } from "../components/Icon";
import { Link, navigate } from "../lib/router";
import { short } from "../lib/stellar";
import { useBatch } from "../lib/batch";
import { useWallet } from "../lib/wallet";
import { Copy } from "./shared";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/app", label: "Dashboard", icon: "overview" },
  { to: "/app/compose", label: "New batch", icon: "plus" },
  { to: "/app/templates", label: "Templates", icon: "copy" },
  { to: "/app/history", label: "History", icon: "activity" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];

/** Number keys 1–5 jump between pages when focus is not in a field. */
function useShortcuts() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName))) return;
      const i = Number(e.key) - 1;
      if (NAV[i]) navigate(NAV[i].to);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

export function Shell(props: { route: string; title: string; children: ReactNode }) {
  const { address, wallet, disconnect, net, demo } = useWallet();
  const { config, history, steps } = useBatch();
  const [menu, setMenu] = useState(false);
  useShortcuts();

  const ready = demo || !!config.contractId;
  const landed = history.filter((h) => h.ok).length;
  const rate = history.length ? Math.round((landed / history.length) * 100) : 0;
  const drafted = steps.filter((s) => s.func).length;

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-glow" aria-hidden="true" />
        <Brand to="/" />

        <nav className="side-nav" aria-label="App">
          {NAV.map((n, i) => {
            const on = props.route === n.to;
            return (
              <Link key={n.to} to={n.to} className={on ? "side-link on" : "side-link"} aria-current={on ? "page" : undefined}>
                <span className="side-ico">
                  <Icon name={n.icon} size={17} />
                </span>
                <span className="side-label">{n.label}</span>
                {n.to === "/app/compose" && drafted > 0 && props.route !== n.to ? <span className="side-badge">{drafted}</span> : <kbd>{i + 1}</kbd>}
              </Link>
            );
          })}
        </nav>

        <div className="side-card">
          <div className="side-card-row">
            <span className={ready ? "pulse" : "pulse off"} aria-hidden="true" />
            <span className="side-card-title">{demo ? "Demo contract" : config.contractId ? `Lockstep ${short(config.contractId)}` : "No contract set"}</span>
            <span className={`net-chip ${net.network}`}>{net.network === "mainnet" ? "Mainnet" : net.network === "testnet" ? "Testnet" : "Custom"}</span>
          </div>
          <div className="side-meter" aria-label={`${rate}% of batches landed`}>
            <span style={{ width: `${rate}%` }} />
          </div>
          <div className="side-card-meta">
            <span>{history.length ? `${landed} of ${history.length} batches landed` : "No batches yet"}</span>
            <span className="mono">{rate}%</span>
          </div>
        </div>

        <div className="side-user">
          <span className="wallet-avatar" aria-hidden="true" style={{ background: avatar(address ?? "") }} />
          <div className="side-user-text">
            <span className="mono">{address ? short(address, 5) : "No wallet"}</span>
            <span>{demo ? "Demo session" : wallet?.name ?? "Wallet"}</span>
          </div>
          <button
            className="side-out"
            aria-label={demo ? "Leave demo" : "Disconnect"}
            title={demo ? "Leave demo" : "Disconnect"}
            onClick={() => {
              disconnect();
              navigate("/");
            }}
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <div className="top-left">
            <h1>{props.title}</h1>
          </div>
          <div className="top-right">
            <div className="wallet-menu">
              <button className="wallet-chip" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="true">
                <span className="wallet-avatar" aria-hidden="true" style={{ background: avatar(address ?? "") }} />
                {address ? short(address) : "No wallet"}
              </button>
              {menu && address && (
                <div className="menu" role="menu">
                  <p className="menu-head">{demo ? "Demo session" : `${wallet?.name ?? "Wallet"} on ${net.network}`}</p>
                  <p className="menu-addr mono">
                    {short(address, 8)} <Copy text={address} label="Copy address" />
                  </p>
                  <button
                    role="menuitem"
                    className="menu-item"
                    onClick={() => {
                      disconnect();
                      navigate("/");
                    }}
                  >
                    <Icon name="logout" size={16} /> {demo ? "Leave demo" : "Disconnect"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {demo && (
          <div className="demo-bar">
            <span>
              <strong>Demo mode.</strong> You are exploring sample data. Dry runs and signing need a connected wallet.
            </span>
            <button
              className="btn small primary"
              onClick={() => {
                disconnect();
                navigate("/connect");
              }}
            >
              Connect a wallet
            </button>
          </div>
        )}
        <main className="content">{props.children}</main>
      </div>
    </div>
  );
}

function avatar(a: string): string {
  let h = 0;
  for (const c of a) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 60) % 360} 80% 65%))`;
}
