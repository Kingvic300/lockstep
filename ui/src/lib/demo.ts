import type { HistoryItem } from "./batch";

export const DEMO_ADDRESS = "GDEMOLOCKSTEPUSERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

/** Sample history so the dashboard can be explored without a wallet. */
export function demoHistory(): HistoryItem[] {
  return [
    {
      id: "d1",
      at: ago(12),
      hash: "",
      network: "testnet",
      ok: true,
      steps: ["swap on CDLZ…CYSC", "deposit on CBQH…7NWA"],
      guarantees: ["You receive at least 95 USDC", "You spend at most 100 XLM"],
      fee: "0.0214",
    },
    {
      id: "d2",
      at: ago(95),
      hash: "",
      network: "testnet",
      ok: true,
      steps: ["transfer on CDLZ…CYSC", "transfer on CDLZ…CYSC", "transfer on CDLZ…CYSC"],
      guarantees: ["You spend at most 1,500 XLM"],
      fee: "0.0187",
    },
    {
      id: "d3",
      at: ago(380),
      hash: "",
      network: "testnet",
      ok: false,
      steps: ["swap on CAS3…J7SK", "swap on CB64…QMZ2"],
      guarantees: ["You receive at least 2,000 USDC"],
      error: "A guarantee was not met, so nothing ran.",
    },
    {
      id: "d4",
      at: ago(1500),
      hash: "",
      network: "testnet",
      ok: true,
      steps: ["approve on CCW6…MI75", "supply on CDVQ…P3R2"],
      guarantees: ["You spend at most 250 USDC"],
      fee: "0.0302",
    },
  ];
}
