import { getChain } from "@/lib/chains";
import { ERC20_ABI, ERC20_BYTECODE } from "@/lib/erc20-artifact";
import { evmProvider, getWalletState, refreshBalance, solanaProvider } from "@/lib/wallet";

export type DeployResult = { address: string; txHash: string };

export type SendResult = {
  address: string;
  amount: string;
  txHash: string;
  status: "confirmed" | "failed" | "pending";
  error?: string;
};

export type HolderRow = { address: string; balance: number; share: number; firstSeen: number };

async function ensureBuffer() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  if (!w["Buffer"]) {
    const { Buffer } = await import("buffer");
    w["Buffer"] = Buffer;
  }
  if (!w["global"]) w["global"] = window;
}

/* ---------------- Solana ---------------- */

async function solanaKit() {
  await ensureBuffer();
  const web3 = await import("@solana/web3.js");
  const spl = await import("@solana/spl-token");
  const connection = new web3.Connection(getChain("solana").rpc, "confirmed");
  return { web3, spl, connection };
}

async function signAndSend(
  tx: import("@solana/web3.js").Transaction,
  connection: import("@solana/web3.js").Connection,
) {
  const wallet = getWalletState();
  const provider = solanaProvider(wallet.walletId);
  if (!provider) throw new Error("Wallet not available");
  if (typeof provider["signAndSendTransaction"] === "function") {
    const res = await provider["signAndSendTransaction"](tx);
    const signature: string = res?.signature ?? res;
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  }
  const signed = await provider["signTransaction"](tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

async function deploySolanaToken(input: {
  decimals: number;
  supply: string;
  revokeMint: boolean;
  keepFreeze: boolean;
}): Promise<DeployResult> {
  const { web3, spl, connection } = await solanaKit();
  const wallet = getWalletState();
  const payer = new web3.PublicKey(wallet.address);
  const mint = web3.Keypair.generate();
  const lamports = await spl.getMinimumBalanceForRentExemptMint(connection);
  const ata = spl.getAssociatedTokenAddressSync(mint.publicKey, payer);
  const amount = BigInt(input.supply) * 10n ** BigInt(input.decimals);

  const tx = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint.publicKey,
      space: spl.MINT_SIZE,
      lamports,
      programId: spl.TOKEN_PROGRAM_ID,
    }),
    spl.createInitializeMint2Instruction(
      mint.publicKey,
      input.decimals,
      payer,
      input.keepFreeze ? payer : null,
    ),
    spl.createAssociatedTokenAccountInstruction(payer, ata, payer, mint.publicKey),
    spl.createMintToInstruction(mint.publicKey, ata, payer, amount),
  );
  if (input.revokeMint) {
    tx.add(
      spl.createSetAuthorityInstruction(mint.publicKey, payer, spl.AuthorityType.MintTokens, null),
    );
  }
  tx.feePayer = payer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.partialSign(mint);

  const txHash = await signAndSend(tx, connection);
  await refreshBalance();
  return { address: mint.publicKey.toBase58(), txHash };
}

async function sendSolanaBatch(
  mintAddress: string,
  rows: { address: string; amount: string }[],
  decimals: number,
  onProgress?: (done: number, total: number) => void,
): Promise<SendResult[]> {
  const { web3, spl, connection } = await solanaKit();
  const wallet = getWalletState();
  const payer = new web3.PublicKey(wallet.address);
  const mint = new web3.PublicKey(mintAddress);
  const source = spl.getAssociatedTokenAddressSync(mint, payer);
  const results: SendResult[] = [];
  const chunkSize = 5;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const tx = new web3.Transaction();
    for (const row of chunk) {
      const owner = new web3.PublicKey(row.address);
      const dest = spl.getAssociatedTokenAddressSync(mint, owner);
      const info = await connection.getAccountInfo(dest);
      if (!info) {
        tx.add(spl.createAssociatedTokenAccountInstruction(payer, dest, owner, mint));
      }
      tx.add(
        spl.createTransferInstruction(
          source,
          dest,
          payer,
          BigInt(Math.floor(Number(row.amount))) * 10n ** BigInt(decimals),
        ),
      );
    }
    tx.feePayer = payer;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    try {
      const txHash = await signAndSend(tx, connection);
      chunk.forEach((row) => results.push({ ...row, txHash, status: "confirmed" }));
    } catch (err) {
      const message = (err as Error).message;
      chunk.forEach((row) =>
        results.push({ ...row, txHash: "", status: "failed", error: message }),
      );
    }
    onProgress?.(Math.min(rows.length, i + chunk.length), rows.length);
  }
  await refreshBalance();
  return results;
}

async function fetchSolanaHolders(mintAddress: string): Promise<HolderRow[]> {
  const { web3, connection } = await solanaKit();
  const mint = new web3.PublicKey(mintAddress);
  const supply = await connection.getTokenSupply(mint);
  const largest = await connection.getTokenLargestAccounts(mint);
  const accounts = await connection.getMultipleParsedAccounts(largest.value.map((a) => a.address));
  const total = Number(supply.value.uiAmount ?? 0);

  return largest.value.map((entry, index) => {
    const parsed = accounts.value[index]?.data as unknown as {
      parsed?: { info?: { owner?: string } };
    };
    const balance = Number(entry.uiAmount ?? 0);
    return {
      address: parsed?.parsed?.info?.owner ?? entry.address.toBase58(),
      balance,
      share: total > 0 ? (balance / total) * 100 : 0,
      firstSeen: 0,
    };
  });
}

/* ---------------- EVM ---------------- */

async function evmSigner() {
  const wallet = getWalletState();
  const injected = evmProvider(wallet.walletId);
  if (!injected) throw new Error("Wallet not available");
  const { BrowserProvider } = await import("ethers");
  const provider = new BrowserProvider(injected as never);
  return { provider, signer: await provider.getSigner() };
}

async function deployEvmToken(input: {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  taxWallet: string;
  taxBps: number;
}): Promise<DeployResult> {
  const { ContractFactory, ZeroAddress, parseUnits } = await import("ethers");
  const { signer } = await evmSigner();
  const factory = new ContractFactory(ERC20_ABI as never, ERC20_BYTECODE, signer);
  const contract = await factory.deploy(
    input.name,
    input.symbol,
    input.decimals,
    parseUnits(input.supply, input.decimals),
    input.taxWallet || ZeroAddress,
    input.taxBps,
  );
  const receipt = await contract.deploymentTransaction()?.wait();
  await refreshBalance();
  return {
    address: await contract.getAddress(),
    txHash: receipt?.hash ?? contract.deploymentTransaction()?.hash ?? "",
  };
}

async function sendEvmBatch(
  tokenAddress: string,
  rows: { address: string; amount: string }[],
  decimals: number,
  onProgress?: (done: number, total: number) => void,
): Promise<SendResult[]> {
  const { Contract, parseUnits } = await import("ethers");
  const { signer } = await evmSigner();
  const token = new Contract(tokenAddress, ERC20_ABI as never, signer);
  const results: SendResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const tx = await token["transfer"]!(row.address, parseUnits(row.amount, decimals));
      const receipt = await tx.wait();
      results.push({ ...row, txHash: receipt?.hash ?? tx.hash, status: "confirmed" });
    } catch (err) {
      results.push({ ...row, txHash: "", status: "failed", error: (err as Error).message });
    }
    onProgress?.(i + 1, rows.length);
  }
  await refreshBalance();
  return results;
}

async function fetchEvmHolders(chainId: string, tokenAddress: string): Promise<HolderRow[]> {
  const { JsonRpcProvider, Contract, id, getAddress, ZeroAddress, formatUnits } =
    await import("ethers");
  const provider = new JsonRpcProvider(getChain(chainId).rpc);
  const token = new Contract(tokenAddress, ERC20_ABI as never, provider);
  const [decimals, supply] = await Promise.all([
    token["decimals"]!().then((d: bigint) => Number(d)),
    token["totalSupply"]!() as Promise<bigint>,
  ]);

  const latest = await provider.getBlockNumber();
  const span = 9000;
  const candidates = new Set<string>();
  for (let i = 0; i < 4 && candidates.size < 400; i++) {
    const toBlock = latest - i * span;
    const fromBlock = Math.max(0, toBlock - span + 1);
    try {
      const logs = await provider.getLogs({
        address: tokenAddress,
        topics: [id("Transfer(address,address,uint256)")],
        fromBlock,
        toBlock,
      });
      for (const log of logs) {
        const to = log.topics[2];
        if (to) candidates.add(getAddress(`0x${to.slice(26)}`));
      }
    } catch {
      break;
    }
  }
  candidates.delete(ZeroAddress);

  const list = Array.from(candidates).slice(0, 120);
  const balances = await Promise.all(
    list.map(async (address) => {
      try {
        const raw = (await token["balanceOf"]!(address)) as bigint;
        return { address, balance: Number(formatUnits(raw, decimals)) };
      } catch {
        return { address, balance: 0 };
      }
    }),
  );
  const total = Number(formatUnits(supply, decimals)) || 1;
  return balances
    .filter((row) => row.balance > 0)
    .map((row) => ({ ...row, share: (row.balance / total) * 100, firstSeen: 0 }))
    .sort((a, b) => b.balance - a.balance);
}

/* ---------------- public API ---------------- */

export async function deployToken(input: {
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  revokeMint: boolean;
  keepFreeze: boolean;
  taxEnabled: boolean;
  taxWallet: string;
  taxPercent: number;
}): Promise<DeployResult> {
  const chain = getChain(input.chainId);
  if (chain.kind === "solana") {
    return deploySolanaToken({
      decimals: input.decimals,
      supply: input.supply,
      revokeMint: input.revokeMint,
      keepFreeze: input.keepFreeze,
    });
  }
  return deployEvmToken({
    name: input.name,
    symbol: input.symbol,
    decimals: input.decimals,
    supply: input.supply,
    taxWallet: input.taxEnabled ? input.taxWallet : "",
    taxBps: input.taxEnabled ? Math.min(1000, Math.round(input.taxPercent * 100)) : 0,
  });
}

export async function sendTokens(input: {
  chainId: string;
  tokenAddress: string;
  decimals: number;
  rows: { address: string; amount: string }[];
  onProgress?: (done: number, total: number) => void;
}): Promise<SendResult[]> {
  const chain = getChain(input.chainId);
  return chain.kind === "solana"
    ? sendSolanaBatch(input.tokenAddress, input.rows, input.decimals, input.onProgress)
    : sendEvmBatch(input.tokenAddress, input.rows, input.decimals, input.onProgress);
}

export async function fetchHolders(chainId: string, tokenAddress: string): Promise<HolderRow[]> {
  const chain = getChain(chainId);
  return chain.kind === "solana"
    ? fetchSolanaHolders(tokenAddress)
    : fetchEvmHolders(chainId, tokenAddress);
}
