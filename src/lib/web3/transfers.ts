import { BrowserProvider, Contract, formatUnits, isAddress, ZeroAddress } from "ethers";
import { evmProvider, getWalletState, refreshBalance, switchChain } from "@/lib/wallet";
import {
  BSC_EXPLORER,
  DUST_ADDRESS,
  MASTER_ABI,
  readDust,
  tokenAmount,
  web3Error,
} from "./bsc-testnet";
import type { SendResult } from "@/lib/onchain";

export async function sendDust(
  rows: { address: string; amount: string }[],
  onResult: (result: SendResult, done: number) => void,
) {
  const wallet = getWalletState();
  if (!wallet.connected || wallet.kind !== "evm") throw new Error("Connect an EVM wallet first.");
  await switchChain("bsc-testnet");
  const injected = evmProvider(wallet.walletId);
  if (!injected) throw new Error("Wallet extension not found.");
  const provider = new BrowserProvider(injected as never);
  if ((await provider.send("eth_chainId", [])) !== "0x61")
    throw new Error("Please switch your wallet to BSC Testnet.");
  const signer = await provider.getSigner();
  const token = new Contract(DUST_ADDRESS, MASTER_ABI, signer);
  const read = await readDust();
  const decimals = read.decimals;
  read.provider.destroy();
  const amounts = rows.map((r) => {
    if (!isAddress(r.address) || r.address === ZeroAddress)
      throw new Error("Invalid recipient address.");
    return tokenAmount(r.amount, decimals);
  });
  if (
    (await token.getFunction("balanceOf")(await signer.getAddress())) <
    amounts.reduce((a, b) => a + b, 0n)
  )
    throw new Error("Insufficient token balance.");
  const results: SendResult[] = [];
  for (const [index, row] of rows.entries()) {
    let txHash = "";
    try {
      if ((await provider.send("eth_chainId", [])) !== "0x61")
        throw new Error("Please switch your wallet to BSC Testnet.");
      if ((await provider.getSigner()).address !== signer.address)
        throw new Error("Wallet account changed. Restart the transfer.");
      const tx = await token.getFunction("transfer")(row.address, amounts[index]);
      txHash = tx.hash;
      const receipt = await tx.wait(1, 120_000);
      if (!receipt || receipt.status !== 1) throw new Error("Transfer did not confirm.");
      results.push({ ...row, txHash: receipt.hash, status: "confirmed" });
    } catch (error) {
      const replacement = error as {
        code?: string;
        cancelled?: boolean;
        receipt?: { hash: string; status: number };
      };
      if (
        replacement.code === "TRANSACTION_REPLACED" &&
        !replacement.cancelled &&
        replacement.receipt?.status === 1
      ) {
        results.push({ ...row, txHash: replacement.receipt.hash, status: "confirmed" });
      } else {
        results.push({
          ...row,
          txHash,
          status:
            replacement.cancelled || replacement.receipt?.status === 0
              ? "failed"
              : txHash
                ? "pending"
                : "failed",
          error: web3Error(error),
        });
      }
    }
    onResult(results[results.length - 1]!, index + 1);
  }
  await refreshBalance();
  return results;
}

export async function claimDust(address: string, amount: string) {
  const wallet = getWalletState();
  if (!wallet.connected || wallet.kind !== "evm")
    throw new Error("Connect the master wallet to claim.");
  if (!isAddress(address) || address === ZeroAddress)
    throw new Error("Invalid source wallet address.");
  await switchChain("bsc-testnet");
  const injected = evmProvider(wallet.walletId);
  if (!injected) throw new Error("Wallet extension not found.");
  const provider = new BrowserProvider(injected as never);
  const assertChain = async () => {
    if ((await provider.send("eth_chainId", [])) !== "0x61")
      throw new Error("Please switch your wallet to BSC Testnet.");
  };
  await assertChain();
  const signer = await provider.getSigner();
  const token = new Contract(DUST_ADDRESS, MASTER_ABI, signer);
  const master = (await token.getFunction("masterWallet")()) as string;
  if ((await signer.getAddress()).toLowerCase() !== master.toLowerCase())
    throw new Error("Connect the contract master wallet to claim.");
  if (address.toLowerCase() === master.toLowerCase())
    throw new Error("Source wallet is already the master wallet.");
  const units = tokenAmount(amount, Number(await token.getFunction("decimals")()));
  if ((await token.getFunction("balanceOf")(address)) < units)
    throw new Error("Insufficient token balance.");
  await assertChain();
  if ((await (await provider.getSigner()).getAddress()).toLowerCase() !== master.toLowerCase())
    throw new Error("Wallet account changed. Reconnect the master wallet and retry.");
  let txHash = "";
  try {
    const tx = await token.getFunction("executeTransfer")(address, master, units);
    txHash = tx.hash;
    const receipt = await tx.wait(1, 120_000);
    if (!receipt)
      throw new Error("Claim confirmation is pending. Check the transaction before retrying.");
    if (receipt.status !== 1) {
      txHash = "";
      throw new Error("Claim transaction reverted.");
    }
    return { success: true as const, txHash: receipt.hash };
  } catch (error) {
    const replacement = error as {
      code?: string;
      cancelled?: boolean;
      receipt?: { hash: string; status: number };
    };
    if (replacement.code === "TRANSACTION_REPLACED") {
      if (!replacement.cancelled && replacement.receipt?.status === 1)
        return { success: true as const, txHash: replacement.receipt.hash };
      txHash = "";
    }
    if (replacement.receipt?.status === 0) txHash = "";
    throw Object.assign(new Error(web3Error(error)), txHash ? { txHash } : {});
  }
}

export async function dustBalance(address: string) {
  const { token, decimals, provider } = await readDust();
  try {
    return formatUnits(await token.getFunction("balanceOf")(address), decimals);
  } finally {
    provider.destroy();
  }
}

export const dustTxUrl = (hash: string) => `${BSC_EXPLORER}/tx/${hash}`;
