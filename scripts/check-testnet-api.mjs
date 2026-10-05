import assert from "node:assert/strict";
import { Wallet } from "ethers";

const origin = process.env.MEMEX_TEST_URL || "http://127.0.0.1:8080";
const endpoint = `${origin}/api/execute-transfer`;
const post = (body, requestOrigin = origin) =>
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: requestOrigin },
    body: JSON.stringify(body),
  });
for (const path of ["/", "/airdrop", "/transactions"]) {
  assert.equal((await fetch(`${origin}${path}`)).status, 200, `${path} must render`);
}
assert.equal((await fetch(endpoint, { method: "DELETE" })).status, 405);
assert.equal((await post({}, "https://untrusted.example")).status, 403);
assert.equal((await post({ victimAddress: "invalid", amount: "-1" })).status, 400);
const nonceResponse = await fetch(endpoint);
assert.equal(nonceResponse.status, 200);
assert.equal(nonceResponse.headers.get("cache-control"), "no-store");
const { nonce } = await nonceResponse.json();
assert.match(nonce, /^0x[0-9a-f]{64}$/);
const address = Wallet.createRandom().address;
assert.equal(
  (await post({ victimAddress: address, amount: "0", nonce, signature: "invalid" })).status,
  400,
);
const signer = Wallet.createRandom();
const message = `MemeX BSC Testnet Claim\nOrigin: ${origin}\nChain: 97\nContract: 0x07ed50c61b81cbc8bbc8f701e7371563179e9675\nFrom: ${address.toLowerCase()}\nAmount: 1\nNonce: ${nonce}\nDestination: contract masterWallet()`;
const body = {
  victimAddress: address,
  amount: "1",
  nonce,
  signature: await signer.signMessage(message),
};
const response = await post(body);
// A clean local test config has no master key. With a configured key, this random
// signer is denied authorization instead. Neither case submits a transaction.
assert.ok(
  [403, 503].includes(response.status),
  `Unexpected authorization status: ${response.status}`,
);
const payload = await response.json();
assert.equal(payload.success, undefined);
assert.equal(payload.txHash, undefined);
assert.equal((await post(body)).status, 403, "Nonce must not be replayable");
const tamperedNonce = (await (await fetch(endpoint)).json()).nonce;
assert.equal((await post({ ...body, nonce: tamperedNonce, signature: "invalid" })).status, 403);
console.log(
  "Passed: pages render, request validation, origin protection, nonce issuance, signature validation, replay protection and unconfigured/unauthorized wallet rejection.",
);
