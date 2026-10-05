import { DUST_ADDRESS } from "./web3/bsc-testnet";
import { useCallback, useEffect, useState } from "react";

export type TokenDraft = {
  name: string;
  ticker: string;
  logoUrl: string;
  bannerUrl: string;
  description: string;
  supply: string;
  decimals: string;
  chain: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  revokeMint: boolean;
  freezeAuthority: boolean;
  burnLp: boolean;
  taxEnabled: boolean;
  taxWallet: string;
};

export type Token = TokenDraft & {
  id: string;
  address: string;
  createdAt: number;
};

export type AirdropRecipient = {
  address: string;
  amount: string;
  status: "confirmed" | "pending" | "failed";
  txHash: string;
  claimed: boolean;
  claimTxHash?: string;
};

export type Airdrop = {
  id: string;
  tokenId: string;
  createdAt: number;
  note: string;
  recipients: AirdropRecipient[];
};

export type Settings = {
  feeWallet: string;
  feePercent: string;
  priorityFee: string;
  defaultChain: string;
  email: string;
  accountName: string;
  registered: boolean;
  notifyEmail: boolean;
  autoFeeReceive: boolean;
  autoConnectWallets: boolean;
  feeWallets: { chain: string; symbol: string; address: string }[];
};

export type WalletState = {
  connected: boolean;
  address: string;
  balance: number;
};

export type MemexState = {
  tokens: Token[];
  airdrops: Airdrop[];
  settings: Settings;
  wallet: WalletState;
};

const KEY = "memex-state-v1";

const defaultState: MemexState = {
  tokens: [],
  airdrops: [],
  settings: {
    feeWallet: "",
    feePercent: "1.0",
    priorityFee: "0.0005",
    defaultChain: "bsc-testnet",
    email: "",
    accountName: "",
    registered: false,
    notifyEmail: true,
    autoFeeReceive: true,
    autoConnectWallets: true,
    feeWallets: [
      { chain: "Solana", symbol: "SOL", address: "" },
      { chain: "BNB Chain", symbol: "BNB", address: "" },
      { chain: "Ethereum", symbol: "ETH", address: "" },
      { chain: "Polygon", symbol: "POL", address: "" },
      { chain: "Arbitrum", symbol: "ARB", address: "" },
      { chain: "Base", symbol: "ETH", address: "" },
    ],
  },
  wallet: { connected: false, address: "", balance: 0 },
};

let state: MemexState = defaultState;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MemexState>;
      state = {
        ...defaultState,
        ...parsed,
        settings: { ...defaultState.settings, ...(parsed.settings ?? {}) },
        wallet: { ...defaultState.wallet, ...(parsed.wallet ?? {}) },
        tokens: parsed.tokens ?? [],
        airdrops: parsed.airdrops ?? [],
      };
    } else {
      state = seed();
      persist();
    }
  } catch {
    state = defaultState;
  }
  if (!state.tokens.some((t) => t.id === "tk_dust_testnet")) {
    const dust = seed().tokens.find((t) => t.id === "tk_dust_testnet")!;
    state = { ...state, tokens: [dust, ...state.tokens] };
    persist();
  }
  emit();
}

function setState(next: Partial<MemexState>) {
  state = { ...state, ...next };
  persist();
  emit();
}

/* ---------- helpers ---------- */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function randomAddress(len = 44) {
  let out = "";
  for (let i = 0; i < len; i++) out += B58[Math.floor(Math.random() * B58.length)];
  return out;
}

export function shortAddress(a: string, n = 4) {
  if (!a) return "—";
  return a.length <= n * 2 + 3 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function isValidAddress(a: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim());
}

export function isValidWalletAddress(a: string) {
  const value = a.trim();
  return isValidAddress(value) || /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function formatNumber(n: number, digits = 0) {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function compact(n: number) {
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}

export function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function seed(): MemexState {
  const now = Date.now();
  const mkToken = (name: string, ticker: string, supply: string, minutesAgo: number): Token => ({
    id: `tk_${ticker.toLowerCase()}`,
    address: randomAddress(),
    createdAt: now - minutesAgo * 60_000,
    name,
    ticker,
    logoUrl: "",
    bannerUrl: "",
    description: `${name} is a community-first memecoin launched on MemeX.`,
    supply,
    decimals: "9",
    chain: "solana",
    website: `https://${ticker.toLowerCase()}.fun`,
    twitter: `https://x.com/${ticker.toLowerCase()}`,
    telegram: `https://t.me/${ticker.toLowerCase()}`,
    discord: "",
    revokeMint: true,
    freezeAuthority: false,
    burnLp: true,
    taxEnabled: false,
    taxWallet: "",
  });

  const tokens = [
    {
      ...mkToken("MemeX Dust Token", "DUST", "1000000000", 0),
      id: "tk_dust_testnet",
      address: DUST_ADDRESS,
      decimals: "18",
      chain: "bsc-testnet",
    },
    mkToken("Frogz", "FROGZ", "1000000000", 220),
    mkToken("Nuke Inu", "NUKE", "420690000", 900),
    mkToken("Wojak Nine", "WOJAK9", "88000000", 2600),
  ];

  const mkDrop = (tokenId: string, count: number, minutesAgo: number, note: string): Airdrop => ({
    id: `ad_${tokenId}_${minutesAgo}`,
    tokenId,
    createdAt: now - minutesAgo * 60_000,
    note,
    recipients: Array.from({ length: count }, () => {
      const roll = Math.random();
      const status: AirdropRecipient["status"] =
        roll > 0.94 ? "failed" : roll > 0.88 ? "pending" : "confirmed";
      return {
        address: randomAddress(),
        amount: String(1000 + Math.floor(Math.random() * 9000)),
        status,
        txHash: randomAddress(64),
        claimed: status === "confirmed" && Math.random() > 0.45,
      };
    }),
  });

  return {
    ...defaultState,
    tokens,
    airdrops: [
      mkDrop("tk_frogz", 24, 180, "Early holders round 1"),
      mkDrop("tk_frogz", 12, 40, "Discord raid rewards"),
      mkDrop("tk_nuke", 31, 700, "Presale allocation"),
      mkDrop("tk_wojak9", 9, 2400, "OG list"),
    ],
    wallet: { connected: false, address: "", balance: 0 },
  };
}

/* ---------- actions ---------- */

export const actions = {
  recordClaim(address: string, txHash: string) {
    setState({
      airdrops: state.airdrops.map((a) =>
        a.tokenId !== "tk_dust_testnet"
          ? a
          : {
              ...a,
              recipients: a.recipients.map((r) =>
                r.address.toLowerCase() === address.toLowerCase()
                  ? { ...r, claimed: true, claimTxHash: txHash }
                  : r,
              ),
            },
      ),
    });
  },
  connectWallet() {
    setState({
      wallet: {
        connected: true,
        address: randomAddress(),
        balance: Number((2 + Math.random() * 40).toFixed(2)),
      },
    });
  },
  disconnectWallet() {
    setState({ wallet: { connected: false, address: "", balance: 0 } });
  },
  /** Mirrors the real on-chain wallet connection into the app state. */
  setWallet(wallet: WalletState) {
    setState({ wallet });
  },
  createToken(draft: TokenDraft, address?: string): Token {
    const token: Token = {
      ...draft,
      id: `tk_${Date.now().toString(36)}`,
      address: address ?? randomAddress(),
      createdAt: Date.now(),
    };
    setState({ tokens: [token, ...state.tokens] });
    return token;
  },
  deleteToken(id: string) {
    setState({
      tokens: state.tokens.filter((t) => t.id !== id),
      airdrops: state.airdrops.filter((a) => a.tokenId !== id),
    });
  },
  createAirdrop(tokenId: string, rows: { address: string; amount: string }[], note: string) {
    const drop: Airdrop = {
      id: `ad_${Date.now().toString(36)}`,
      tokenId,
      createdAt: Date.now(),
      note,
      recipients: rows.map((r) => {
        const roll = Math.random();
        const status: AirdropRecipient["status"] = roll > 0.96 ? "failed" : "confirmed";
        return {
          address: r.address,
          amount: r.amount,
          status,
          txHash: randomAddress(64),
          claimed: status === "confirmed" && Math.random() > 0.6,
        };
      }),
    };
    setState({ airdrops: [drop, ...state.airdrops] });
    return drop;
  },
  /** Records the result of a real on-chain distribution. */
  recordAirdrop(
    tokenId: string,
    results: {
      address: string;
      amount: string;
      txHash: string;
      status: "confirmed" | "failed" | "pending";
    }[],
    note: string,
    batchId?: string,
  ) {
    const drop: Airdrop = {
      id: batchId ?? `ad_${Date.now().toString(36)}`,
      tokenId,
      createdAt: state.airdrops.find((a) => a.id === batchId)?.createdAt ?? Date.now(),
      note,
      recipients: results.map((r) => ({
        address: r.address,
        amount: r.amount,
        status: r.status,
        txHash: r.txHash,
        claimed: false,
      })),
    };
    setState({ airdrops: [drop, ...state.airdrops.filter((a) => a.id !== drop.id)] });
    return drop;
  },
  updateSettings(patch: Partial<Settings>) {
    setState({ settings: { ...state.settings, ...patch } });
  },
  resetAll() {
    state = seed();
    persist();
    emit();
  },
};

/* ---------- react binding ---------- */

export function useMemex() {
  const [snapshot, setSnapshot] = useState<MemexState>(state);

  useEffect(() => {
    hydrate();
    const listener = () => setSnapshot(state);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return snapshot;
}

/* ---------- derived ---------- */

export type TokenStats = {
  token: Token;
  drops: number;
  wallets: number;
  uniqueWallets: number;
  activeWallets: number;
  totalSent: number;
  lastDropAt: number | null;
};

export function tokenStats(s: MemexState, token: Token): TokenStats {
  const drops = s.airdrops.filter((a) => a.tokenId === token.id);
  const recipients = drops.flatMap((d) => d.recipients);
  const unique = new Set(recipients.map((r) => r.address));
  return {
    token,
    drops: drops.length,
    wallets: recipients.length,
    uniqueWallets: unique.size,
    activeWallets: new Set(
      recipients.filter((r) => r.claimed || r.status === "confirmed").map((r) => r.address),
    ).size,
    totalSent: recipients.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    lastDropAt: drops.length ? Math.max(...drops.map((d) => d.createdAt)) : null,
  };
}

export function allStats(s: MemexState) {
  return s.tokens.map((t) => tokenStats(s, t));
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (text: string, key = "default") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  }, []);
  return { copied, copy };
}

/** Deterministic pseudo-holder generator for the wallet scanner page. */
export function generateHolders(ca: string, count: number) {
  let h = 0;
  for (let i = 0; i < ca.length; i++) h = (h * 31 + ca.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const addr = (len: number) => {
    let out = "";
    for (let i = 0; i < len; i++) out += B58[Math.floor(rand() * B58.length)];
    return out;
  };
  const rows = Array.from({ length: count }, () => ({
    address: addr(44),
    balance: Math.floor(rand() * 9_000_000) + 1_000,
    firstSeen: Date.now() - Math.floor(rand() * 90) * 86_400_000,
  }));
  const total = rows.reduce((s, r) => s + r.balance, 0);
  return rows
    .map((r) => ({ ...r, share: (r.balance / total) * 100 }))
    .sort((a, b) => b.balance - a.balance);
}
