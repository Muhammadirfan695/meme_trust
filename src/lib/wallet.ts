import { useEffect, useState } from "react";

import { CHAINS, chainByEvmId, getChain, type ChainKind } from "@/lib/chains";
import { actions as memexActions } from "@/lib/memex-store";

/* ---------- types ---------- */

export type WalletOption = {
  id: string;
  name: string;
  kind: ChainKind;
  installed: boolean;
  installUrl: string;
};

export type ChainWalletState = {
  connected: boolean;
  connecting: boolean;
  kind: ChainKind | null;
  walletId: string;
  walletName: string;
  chainId: string;
  address: string;
  balance: string;
  symbol: string;
  signature: string;
  loadingBalance: boolean;
  error: string;
};

const initial: ChainWalletState = {
  connected: false,
  connecting: false,
  kind: null,
  walletId: "",
  walletName: "",
  chainId: "solana",
  address: "",
  balance: "0",
  symbol: "SOL",
  signature: "",
  loadingBalance: false,
  error: "",
};

let state: ChainWalletState = initial;
const listeners = new Set<() => void>();

function set(patch: Partial<ChainWalletState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  memexActions.setWallet({
    connected: state.connected,
    address: state.address,
    balance: Number(state.balance) || 0,
  });
}

export function useChainWallet() {
  const [snap, setSnap] = useState(state);
  useEffect(() => {
    const l = () => setSnap(state);
    listeners.add(l);
    l();
    return () => listeners.delete(l) as unknown as void;
  }, []);
  return snap;
}

export function getWalletState() {
  return state;
}

/* ---------- provider detection ---------- */

// Wallet extensions expose vendor-specific methods; this is the existing adapter boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProvider = Record<string, any>;

function win(): AnyProvider | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as AnyProvider);
}

export function solanaProvider(id: string): AnyProvider | undefined {
  const w = win();
  if (!w) return undefined;
  if (id === "phantom")
    return w["phantom"]?.solana ?? (w["solana"]?.isPhantom ? w["solana"] : undefined);
  if (id === "solflare")
    return w["solflare"] ?? (w["solana"]?.isSolflare ? w["solana"] : undefined);
  if (id === "backpack") return w["backpack"]?.solana ?? w["xnft"]?.solana;
  return w["solana"];
}

export function evmProvider(id: string): AnyProvider | undefined {
  const w = win();
  if (!w) return undefined;
  const eth = w["ethereum"] as AnyProvider | undefined;
  if (!eth) return undefined;
  const providers: AnyProvider[] = Array.isArray(eth["providers"]) ? eth["providers"] : [eth];
  const match = (p: AnyProvider) => {
    if (id === "metamask") return Boolean(p["isMetaMask"]) && !p["isRabby"];
    if (id === "coinbase") return Boolean(p["isCoinbaseWallet"]);
    if (id === "rabby") return Boolean(p["isRabby"]);
    if (id === "trust") return Boolean(p["isTrust"] ?? p["isTrustWallet"]);
    return true;
  };
  return providers.find(match) ?? (id === "injected" ? eth : undefined);
}

export function walletOptions(): WalletOption[] {
  const list: WalletOption[] = [
    {
      id: "phantom",
      name: "Phantom",
      kind: "solana",
      installed: false,
      installUrl: "https://phantom.app/download",
    },
    {
      id: "solflare",
      name: "Solflare",
      kind: "solana",
      installed: false,
      installUrl: "https://solflare.com/download",
    },
    {
      id: "backpack",
      name: "Backpack",
      kind: "solana",
      installed: false,
      installUrl: "https://backpack.app/download",
    },
    {
      id: "metamask",
      name: "MetaMask",
      kind: "evm",
      installed: false,
      installUrl: "https://metamask.io/download/",
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      kind: "evm",
      installed: false,
      installUrl: "https://www.coinbase.com/wallet/downloads",
    },
    { id: "rabby", name: "Rabby", kind: "evm", installed: false, installUrl: "https://rabby.io/" },
    {
      id: "trust",
      name: "Trust Wallet",
      kind: "evm",
      installed: false,
      installUrl: "https://trustwallet.com/download",
    },
    {
      id: "injected",
      name: "Browser wallet",
      kind: "evm",
      installed: false,
      installUrl: "https://ethereum.org/en/wallets/find-wallet/",
    },
  ];
  return list.map((o) => ({
    ...o,
    installed: Boolean(o.kind === "solana" ? solanaProvider(o.id) : evmProvider(o.id)),
  }));
}

/* ---------- helpers ---------- */

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loginMessage(address: string) {
  return `MemeX wants you to sign in with your wallet.\n\nAddress: ${address}\nIssued: ${new Date().toISOString()}\n\nSigning is free and proves you own this wallet. It never moves funds.`;
}

async function solanaRpc<T>(chainId: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(getChain(chainId).rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

/* ---------- connect ---------- */

export async function connectSolanaWallet(walletId: string) {
  const provider = solanaProvider(walletId);
  if (!provider) throw new Error("Wallet extension not found");
  set({ connecting: true, error: "" });
  try {
    const resp = await provider["connect"]();
    const address: string =
      resp?.publicKey?.toString?.() ?? provider["publicKey"]?.toString?.() ?? "";
    if (!address) throw new Error("Wallet did not return an address");

    let signature = "";
    if (typeof provider["signMessage"] === "function") {
      const encoded = new TextEncoder().encode(loginMessage(address));
      const signed = await provider["signMessage"](encoded, "utf8");
      const bytes: Uint8Array = signed?.signature ?? signed;
      signature = toHex(bytes);
    }

    set({
      connected: true,
      connecting: false,
      kind: "solana",
      walletId,
      walletName: walletOptions().find((w) => w.id === walletId)?.name ?? walletId,
      chainId: "solana",
      address,
      symbol: CHAINS["solana"]!.symbol,
      signature,
    });
    provider["on"]?.("disconnect", () => disconnectWallet());
    provider["on"]?.("accountChanged", (pk: unknown) => {
      const next = (pk as { toString?: () => string })?.toString?.();
      if (next) set({ address: next });
      else disconnectWallet();
      void refreshBalance();
    });
    await refreshBalance();
  } catch (err) {
    set({ connecting: false, error: (err as Error).message });
    throw err;
  }
}

export async function connectEvmWallet(walletId: string, chainId = "bsc-testnet") {
  const provider = evmProvider(walletId);
  if (!provider) throw new Error("Wallet extension not found");
  set({ connecting: true, error: "" });
  try {
    const accounts = (await provider["request"]({ method: "eth_requestAccounts" })) as string[];
    const address = accounts?.[0];
    if (!address) throw new Error("Wallet did not return an address");

    await ensureEvmChain(provider, chainId);
    const message = loginMessage(address);
    const signature = (await provider["request"]({
      method: "personal_sign",
      params: [message, address],
    })) as string;

    const current = (await provider["request"]({ method: "eth_chainId" })) as string;
    const resolved = chainByEvmId(Number(current))?.id ?? chainId;

    set({
      connected: true,
      connecting: false,
      kind: "evm",
      walletId,
      walletName: walletOptions().find((w) => w.id === walletId)?.name ?? walletId,
      chainId: resolved,
      address,
      symbol: getChain(resolved).symbol,
      signature,
    });
    provider["on"]?.("accountsChanged", (accs: string[]) => {
      if (accs?.[0]) {
        set({ address: accs[0] });
        void refreshBalance();
      } else disconnectWallet();
    });
    provider["on"]?.("chainChanged", (hex: string) => {
      const next = chainByEvmId(Number(hex));
      if (next) {
        set({ chainId: next.id, symbol: next.symbol });
        void refreshBalance();
      } else set({ chainId: "unsupported", error: "Please switch your wallet to BSC Testnet." });
    });
    await refreshBalance();
  } catch (err) {
    set({ connecting: false, error: (err as Error).message });
    throw err;
  }
}

async function ensureEvmChain(provider: AnyProvider, chainId: string) {
  if (chainId !== "bsc-testnet") throw new Error("Please switch your wallet to BSC Testnet.");
  const chain = getChain(chainId);
  if (chain.kind !== "evm" || !chain.evmChainId) return;
  const hex = `0x${chain.evmChainId.toString(16)}`;
  try {
    await provider["request"]({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4902 || code === -32603) {
      await provider["request"]({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: chain.name,
            nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: 18 },
            rpcUrls: [chain.rpc],
            blockExplorerUrls: [chain.explorer],
          },
        ],
      });
    } else throw err;
  }
}

export async function switchChain(chainId: string) {
  const chain = getChain(chainId);
  if (chain.kind === "solana") {
    if (state.kind !== "solana") throw new Error("Connect a Solana wallet to use Solana");
    set({ chainId: "solana", symbol: chain.symbol });
  } else {
    if (state.kind !== "evm") throw new Error("Connect an EVM wallet to use this network");
    const provider = evmProvider(state.walletId);
    if (!provider) throw new Error("Wallet extension not found");
    await ensureEvmChain(provider, chainId);
    set({ chainId, symbol: chain.symbol });
  }
  await refreshBalance();
}

export function disconnectWallet() {
  if (state.kind === "solana") {
    try {
      solanaProvider(state.walletId)?.["disconnect"]?.();
    } catch {
      /* ignore */
    }
  }
  state = { ...initial };
  listeners.forEach((l) => l());
  memexActions.setWallet({ connected: false, address: "", balance: 0 });
}

/* ---------- balances ---------- */

export async function refreshBalance() {
  if (!state.connected || !state.address) return;
  set({ loadingBalance: true });
  try {
    if (state.kind === "solana") {
      const result = await solanaRpc<{ value: number }>("solana", "getBalance", [state.address]);
      set({ balance: (result.value / 1e9).toFixed(4) });
    } else {
      const provider = evmProvider(state.walletId);
      const hex = (await provider?.["request"]({
        method: "eth_getBalance",
        params: [state.address, "latest"],
      })) as string;
      const wei = BigInt(hex ?? "0x0");
      set({ balance: (Number(wei) / 1e18).toFixed(5) });
    }
  } catch (err) {
    set({ error: (err as Error).message });
  } finally {
    set({ loadingBalance: false });
  }
}

/** Signs an arbitrary message with the connected wallet and returns a hex signature. */
export async function signMessage(message: string) {
  if (!state.connected) throw new Error("Connect a wallet first");
  if (state.kind === "solana") {
    const provider = solanaProvider(state.walletId);
    const signed = await provider?.["signMessage"](new TextEncoder().encode(message), "utf8");
    return toHex(signed?.signature ?? signed);
  }
  const provider = evmProvider(state.walletId);
  return (await provider?.["request"]({
    method: "personal_sign",
    params: [message, state.address],
  })) as string;
}
