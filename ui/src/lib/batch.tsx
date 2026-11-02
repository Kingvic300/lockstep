import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { contract } from "@stellar/stellar-sdk";
import { addr, i128, isAddress, loadJSON, loadList, nativeToScVal, saveJSON, short, sym, toUnits, u64, xdr } from "./stellar";
import { demoHistory } from "./demo";
import { useWallet } from "./wallet";

export const ERRORS: Record<number, string> = {
  1: "The deadline passed before the batch ran. Sign it again.",
  2: "Add at least one step.",
  3: "A batch can hold at most 16 steps.",
  4: "A batch can hold at most 16 guarantees.",
  5: "A step cannot call Lockstep itself.",
  6: "A guarantee was not met, so nothing ran. Check the amounts, or the steps did not produce what you expected.",
};

export type ManualType = "address" | "i128" | "u64" | "u32" | "bool" | "symbol" | "string";
export const MANUAL_TYPES: ManualType[] = ["address", "i128", "u64", "u32", "bool", "symbol", "string"];

export interface ArgField {
  name: string;
  spec?: xdr.ScSpecTypeDef;
  manual: ManualType;
  value: string;
}

export interface FnInfo {
  name: string;
  inputs: { name: string; type: xdr.ScSpecTypeDef }[];
}

export interface Step {
  key: number;
  contractId: string;
  spec?: contract.Spec;
  fns?: FnInfo[];
  loadState: "idle" | "loading" | "loaded" | "failed";
  loadError?: string;
  func: string;
  args: ArgField[];
  note?: string;
}

export type Direction = "receive" | "spend";

export interface Guarantee {
  key: number;
  token: string;
  account: string;
  direction: Direction;
  amount: string;
  symbol?: string;
  decimals?: number;
}

export interface HistoryItem {
  id: string;
  at: string;
  hash: string;
  network: string;
  ok: boolean;
  steps: string[];
  guarantees: string[];
  fee?: string;
  error?: string;
}

let nextKey = 1;
export const newStep = (p: Partial<Step> = {}): Step => ({ key: nextKey++, contractId: "", loadState: "idle", func: "", args: [], ...p });
export const newGuarantee = (account: string, p: Partial<Guarantee> = {}): Guarantee => ({
  key: nextKey++,
  token: "",
  account,
  direction: "receive",
  amount: "",
  ...p,
});

export function typeName(t: xdr.ScSpecTypeDef): string {
  switch (t.type) {
    case "scSpecTypeUdt":
      return t.udt.name.toString();
    case "scSpecTypeVec":
      return `Vec<${typeName(t.vec.elementType)}>`;
    case "scSpecTypeOption":
      return `Option<${typeName(t.option.valueType)}>`;
    default: {
      const n = t.type.replace(/^scSpecType/, "");
      return n.charAt(0).toLowerCase() + n.slice(1);
    }
  }
}

function parseForSpec(raw: string, t: xdr.ScSpecTypeDef): unknown {
  const n = t.type;
  const v = raw.trim();
  if (/(I|U)(64|128|256)$/.test(n)) return BigInt(v);
  if (/(I|U)32$/.test(n)) return Number(v);
  if (n === "scSpecTypeBool") return v === "true";
  if (["scSpecTypeAddress", "scSpecTypeMuxedAddress", "scSpecTypeString", "scSpecTypeSymbol"].includes(n)) return v;
  if (n === "scSpecTypeVoid") return undefined;
  return JSON.parse(v, (_k, val) => (typeof val === "string" && /^-?\d+n$/.test(val) ? BigInt(val.slice(0, -1)) : val));
}

function argToScVal(a: ArgField, spec?: contract.Spec): xdr.ScVal {
  if (a.spec && spec) return spec.nativeToScVal(parseForSpec(a.value, a.spec), a.spec);
  const v = a.value.trim();
  switch (a.manual) {
    case "address":
      return addr(v);
    case "i128":
      return i128(BigInt(v));
    case "u64":
      return u64(BigInt(v));
    case "u32":
      return nativeToScVal(Number(v), { type: "u32" });
    case "bool":
      return xdr.ScVal.scvBool(v === "true");
    case "symbol":
      return sym(v);
    case "string":
      return nativeToScVal(v, { type: "string" });
  }
}

const field = (name: string, val: xdr.ScVal) => new xdr.ScMapEntry({ key: sym(name), val });

/** Encode the `execute` arguments: caller, calls, checks, deadline. */
export function buildExecuteArgs(caller: string, steps: Step[], guarantees: Guarantee[], minutes: number): xdr.ScVal[] {
  const calls = steps.map((s, i) => {
    if (!isAddress(s.contractId)) throw new Error(`Step ${i + 1}: enter a contract ID.`);
    if (!s.func.trim()) throw new Error(`Step ${i + 1}: choose a function.`);
    let args: xdr.ScVal[];
    try {
      args = s.args.map((a) => argToScVal(a, s.spec));
    } catch (e) {
      throw new Error(`Step ${i + 1}: an argument has the wrong format. ${e instanceof Error ? e.message : ""}`);
    }
    return xdr.ScVal.scvMap([
      field("args", xdr.ScVal.scvVec(args)),
      field("contract", addr(s.contractId)),
      field("func", sym(s.func.trim())),
    ]);
  });
  const checks = activeGuarantees(guarantees).map((g, i) => {
    if (!isAddress(g.token)) throw new Error(`Guarantee ${i + 1}: enter the token contract ID.`);
    if (!isAddress(g.account)) throw new Error(`Guarantee ${i + 1}: enter the account to watch.`);
    if (g.decimals === undefined) throw new Error(`Guarantee ${i + 1}: the token could not be read. Check its contract ID.`);
    const units = toUnits(g.amount, g.decimals);
    return xdr.ScVal.scvMap([
      field("account", addr(g.account)),
      field("min_delta", i128(g.direction === "receive" ? units : -units)),
      field("token", addr(g.token)),
    ]);
  });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
  return [addr(caller), xdr.ScVal.scvVec(calls), xdr.ScVal.scvVec(checks), u64(deadline)];
}

export function activeGuarantees(gs: Guarantee[]): Guarantee[] {
  return gs.filter((g) => g.token.trim() || g.amount.trim());
}

export function describeStep(s: Step): string {
  return `${s.func || "?"} on ${short(s.contractId || "?")}`;
}

export function describeGuarantee(g: Guarantee, me?: string): string {
  const who = g.account === me ? "You" : short(g.account || "?");
  const you = who === "You";
  const verb = g.direction === "receive" ? (you ? "receive" : "receives") : you ? "spend" : "spends";
  return `${who} ${verb} ${g.direction === "receive" ? "at least" : "at most"} ${g.amount || "?"} ${g.symbol ?? "tokens"}`;
}

// ---------- demo batch ----------

const DEMO_POOL = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const DEMO_VAULT = "CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K";
const DEMO_USDC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const DEMO_XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function demoSteps(me: string): Step[] {
  return [
    newStep({
      contractId: DEMO_POOL,
      func: "swap",
      loadState: "failed",
      note: "Sample step: swap 100 XLM for USDC in a pool.",
      args: [
        { name: "user", manual: "address", value: me },
        { name: "amount_in", manual: "i128", value: "1000000000" },
        { name: "min_out", manual: "i128", value: "0" },
      ],
    }),
    newStep({
      contractId: DEMO_VAULT,
      func: "deposit",
      loadState: "failed",
      note: "Sample step: deposit the USDC into a vault.",
      args: [
        { name: "from", manual: "address", value: me },
        { name: "amount", manual: "i128", value: "950000000" },
      ],
    }),
  ];
}

function demoGuarantees(me: string): Guarantee[] {
  return [
    newGuarantee(me, { token: DEMO_XLM, direction: "spend", amount: "100", symbol: "XLM", decimals: 7 }),
    newGuarantee(DEMO_VAULT, { token: DEMO_USDC, direction: "receive", amount: "95", symbol: "USDC", decimals: 7 }),
  ];
}

// ---------- context ----------

interface Config {
  contractId: string;
}

interface BatchContextValue {
  steps: Step[];
  setSteps: React.Dispatch<React.SetStateAction<Step[]>>;
  guarantees: Guarantee[];
  setGuarantees: React.Dispatch<React.SetStateAction<Guarantee[]>>;
  minutes: number;
  setMinutes: (m: number) => void;
  reset: (steps?: Step[], guarantees?: Guarantee[]) => void;
  history: HistoryItem[];
  addHistory: (h: HistoryItem) => void;
  clearHistory: () => void;
  config: Config;
  setConfig: (c: Config) => void;
}

const Ctx = createContext<BatchContextValue | null>(null);

export function BatchProvider(props: { children: ReactNode }) {
  const { address, demo } = useWallet();
  const envId = (import.meta.env.VITE_CONTRACT_ID as string | undefined) ?? "";
  const [config, setConfigState] = useState<Config>(() => loadJSON<Config>("lockstep.config", { contractId: envId }));
  const [steps, setSteps] = useState<Step[]>(() => (demo ? demoSteps(address ?? "") : [newStep()]));
  const [guarantees, setGuarantees] = useState<Guarantee[]>(() => (demo ? demoGuarantees(address ?? "") : [newGuarantee(address ?? "")]));
  const [minutes, setMinutes] = useState(10);
  const histKey = `lockstep.history.${address ?? "none"}`;
  const [history, setHistory] = useState<HistoryItem[]>(() => (demo ? demoHistory() : loadList<HistoryItem>(histKey)));

  useEffect(() => {
    setHistory(demo ? demoHistory() : loadList<HistoryItem>(histKey));
  }, [histKey, demo]);

  useEffect(() => {
    if (!address) return;
    setGuarantees((gs) => gs.map((g) => (g.account ? g : { ...g, account: address })));
  }, [address]);

  const addHistory = useCallback(
    (h: HistoryItem) =>
      setHistory((list) => {
        const next = [h, ...list].slice(0, 100);
        if (!demo) saveJSON(histKey, next);
        return next;
      }),
    [histKey, demo],
  );

  const value = useMemo<BatchContextValue>(
    () => ({
      steps,
      setSteps,
      guarantees,
      setGuarantees,
      minutes,
      setMinutes,
      reset: (s, g) => {
        setSteps(s && s.length ? s : [newStep()]);
        setGuarantees(g && g.length ? g : [newGuarantee(address ?? "")]);
      },
      history,
      addHistory,
      clearHistory: () => {
        setHistory([]);
        if (!demo) saveJSON(histKey, []);
      },
      config,
      setConfig: (c) => {
        setConfigState(c);
        saveJSON("lockstep.config", c);
      },
    }),
    [steps, guarantees, minutes, history, addHistory, config, address, demo, histKey],
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useBatch(): BatchContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBatch outside BatchProvider");
  return v;
}
