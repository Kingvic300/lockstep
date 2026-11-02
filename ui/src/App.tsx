import { useEffect, type ReactElement } from "react";
import { Compose } from "./app/Compose";
import { Dashboard } from "./app/Dashboard";
import { History } from "./app/History";
import { SettingsPage } from "./app/Settings";
import { Shell } from "./app/Shell";
import { PayForm, Templates } from "./app/Templates";
import { Brand } from "./components/Brand";
import { BatchProvider } from "./lib/batch";
import { navigate, useRoute } from "./lib/router";
import { WalletProvider, useWallet } from "./lib/wallet";
import { Connect } from "./pages/Connect";
import { Landing } from "./pages/Landing";

const PAGES: Record<string, { title: string; el: () => ReactElement }> = {
  "/app": { title: "Dashboard", el: Dashboard },
  "/app/compose": { title: "New batch", el: Compose },
  "/app/templates": { title: "Templates", el: Templates },
  "/app/templates/pay-many": { title: "Pay several people", el: () => <PayForm mode="pay-many" /> },
  "/app/templates/send-confirm": { title: "Send and confirm receipt", el: () => <PayForm mode="send-confirm" /> },
  "/app/history": { title: "History", el: History },
  "/app/settings": { title: "Settings", el: SettingsPage },
};

function Routes() {
  const route = useRoute();
  const { address } = useWallet();
  const page = PAGES[route];

  useEffect(() => {
    if (route.startsWith("/app") && !address) navigate("/connect");
  }, [route, address]);

  if (route === "/connect") {
    return (
      <Connect
        brand={<Brand />}
        title="Build a batch you can trust"
        lede="Chain contract calls, set the result you expect, and sign once. Everything lands, or nothing does."
        points={[
          "Dry runs are free and need no signature.",
          "One signature covers every step and every guarantee.",
          "Works on testnet and mainnet.",
        ]}
      />
    );
  }
  if (page && address) {
    const El = page.el;
    const nav = route.startsWith("/app/templates") ? "/app/templates" : route;
    return (
      <BatchProvider>
        <Shell route={nav} title={page.title}>
          <El />
        </Shell>
      </BatchProvider>
    );
  }
  return <Landing />;
}

export default function App() {
  return (
    <WalletProvider storageKey="lockstep.session">
      <Routes />
    </WalletProvider>
  );
}
