export type ChainKind = "solana" | "evm";

export type ChainConfig = {
  id: string;
  name: string;
  kind: ChainKind;
  symbol: string;
  decimals: number;
  rpc: string;
  explorer: string;
  /** EVM only */
  evmChainId?: number;
};

/** Public, keyless RPC endpoints. */
export const CHAINS: Record<string, ChainConfig> = {
  "bsc-testnet": {
    id: "bsc-testnet",
    name: "BSC Testnet",
    kind: "evm",
    symbol: "BNB",
    decimals: 18,
    rpc: "https://bsc-testnet-rpc.publicnode.com",
    explorer: "https://testnet.bscscan.com",
    evmChainId: 97,
  },
  solana: {
    id: "solana",
    name: "Solana",
    kind: "solana",
    symbol: "SOL",
    decimals: 9,
    rpc: "https://api.mainnet-beta.solana.com",
    explorer: "https://solscan.io",
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    kind: "evm",
    symbol: "ETH",
    decimals: 18,
    rpc: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
    evmChainId: 1,
  },
  base: {
    id: "base",
    name: "Base",
    kind: "evm",
    symbol: "ETH",
    decimals: 18,
    rpc: "https://base-rpc.publicnode.com",
    explorer: "https://basescan.org",
    evmChainId: 8453,
  },
  bsc: {
    id: "bsc",
    name: "BNB Chain",
    kind: "evm",
    symbol: "BNB",
    decimals: 18,
    rpc: "https://bsc-rpc.publicnode.com",
    explorer: "https://bscscan.com",
    evmChainId: 56,
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    kind: "evm",
    symbol: "POL",
    decimals: 18,
    rpc: "https://polygon-bor-rpc.publicnode.com",
    explorer: "https://polygonscan.com",
    evmChainId: 137,
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    kind: "evm",
    symbol: "ETH",
    decimals: 18,
    rpc: "https://arbitrum-one-rpc.publicnode.com",
    explorer: "https://arbiscan.io",
    evmChainId: 42161,
  },
};

export const CHAIN_LIST = [CHAINS["bsc-testnet"]!];
export const EVM_CHAINS = CHAIN_LIST.filter((c) => c.kind === "evm");

export function getChain(id: string): ChainConfig {
  return CHAINS[id] ?? CHAINS["solana"]!;
}

export function chainByEvmId(evmChainId: number): ChainConfig | undefined {
  return EVM_CHAINS.find((c) => c.evmChainId === evmChainId);
}

export function txUrl(chainId: string, hash: string) {
  const chain = getChain(chainId);
  return chain.kind === "solana" ? `${chain.explorer}/tx/${hash}` : `${chain.explorer}/tx/${hash}`;
}

export function addressUrl(chainId: string, address: string) {
  const chain = getChain(chainId);
  return chain.kind === "solana"
    ? `${chain.explorer}/token/${address}`
    : `${chain.explorer}/address/${address}`;
}
