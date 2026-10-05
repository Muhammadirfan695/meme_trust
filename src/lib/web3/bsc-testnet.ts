import { Contract, JsonRpcProvider, MaxUint256, parseUnits } from "ethers";

export const BSC_CHAIN_ID = 97;
export const BSC_RPC =
  import.meta.env["VITE_BSC_TESTNET_RPC"] || "https://bsc-testnet-rpc.publicnode.com";
export const DUST_ADDRESS =
  import.meta.env["VITE_BSC_TESTNET_CONTRACT"] || "0x07Ed50C61B81cbC8bbC8F701E7371563179e9675";
export const BSC_EXPLORER = "https://testnet.bscscan.com";
export const MASTER_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function masterWallet() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
  "function executeTransfer(address,address,uint256)",
  "function setMasterWallet(address)",
];

export async function readDust() {
  const provider = new JsonRpcProvider(BSC_RPC);
  try {
    if ((await provider.getNetwork()).chainId !== 97n)
      throw new Error("Please use BSC Testnet RPC.");
    const token = new Contract(DUST_ADDRESS, MASTER_ABI, provider);
    const decimals = Number(await token.getFunction("decimals")());
    return { provider, token, decimals };
  } catch (error) {
    provider.destroy();
    throw error;
  }
}

export function tokenAmount(amount: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(amount) || amount.length > 100)
    throw new Error("Enter a valid token amount.");
  const units = parseUnits(amount, decimals);
  if (units <= 0n) throw new Error("Amount must be above zero.");
  if (units > MaxUint256) throw new Error("Token amount is too large.");
  return units;
}

export function claimMessage(origin: string, address: string, amount: string, nonce: string) {
  return `MemeX BSC Testnet Claim\nOrigin: ${origin}\nChain: 97\nContract: ${DUST_ADDRESS.toLowerCase()}\nFrom: ${address.toLowerCase()}\nAmount: ${amount}\nNonce: ${nonce}\nDestination: contract masterWallet()`;
}

export function web3Error(error: unknown) {
  const e = error as {
    code?: string | number;
    message?: string;
    info?: { error?: { code?: number } };
  };
  if (e.code === 4001 || e.code === "ACTION_REJECTED" || e.info?.error?.code === 4001)
    return "Transaction rejected by user";
  if (e.code === "INSUFFICIENT_FUNDS") return "Insufficient testnet BNB for gas.";
  if (e.code === "NETWORK_ERROR" || e.code === "SERVER_ERROR" || e.code === "TIMEOUT")
    return "Unable to connect to BSC Testnet. Please try again.";
  if (e.code === "CALL_EXCEPTION")
    return "Contract rejected the transfer. Check balance and wallet permissions.";
  return e.message || "Unable to connect to BSC Testnet. Please try again.";
}
