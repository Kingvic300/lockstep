import { useState, type ReactNode } from "react";
import { Brand } from "../components/Brand";
import { Icon, type IconName } from "../components/Icon";
import { useBatch } from "../lib/batch";
import { Link, navigate } from "../lib/router";
import { short } from "../lib/stellar";
import { useWallet } from "../lib/wallet";
import { Copy } from "./shared";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/app", label: "Dashboard", icon: "overview" },
  { to: "/app/compose", label: "New batch", icon: "plus" },
  { to: "/app/templates", label: "Templates", icon: "copy" },
  { to: "/app/history", label: "History", icon: "activity" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];

export function Shell(props: { route: string; title: string; children: ReactNode; action?: ReactNode }) {
  const { address, wallet, disconnect, net, demo } = useWallet();
  const { config } = useBatch();
  const [menu, setMenu] = useState(false);

  return (
    <div className="shell">
      <aside className="side">
        <Brand to="/" />
        <nav className="side-nav" aria-label="App">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={props.route === n.to ? "side-link on" : "side-link"} aria-current={props.route === n.to ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <span className={`net-pill ${net.network}`}>{net.network === "mainnet" ? "Mainnet" : net.network === "testnet" ? "Testnet" : "Custom"}</span>
          <span className="side-status">
            <span className={config.contractId || demo ? "dot" : "dot off"} aria-hidden="true" />
            {demo ? "Demo contract" : config.contractId ? `Lockstep ${short(config.contractId)}` : "No contract set"}
          </span>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <div className="top-left">
            <h1>{props.title}</h1>
          </div>
          <div className="top-right">
            {props.action}
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
  return `linear-gradient(135deg, hsl(${hue} 55% 50%), hsl(${(hue + 60) % 360} 65% 62%))`;
}
