# BSC Testnet client testing

The existing TanStack Start app uses the deployed MemeX Dust Token at
`0x07Ed50C61B81cbC8bbC8F701E7371563179e9675`, chain 97. The contract reports
18 decimals. Both transfer flows read decimals from the contract before converting amounts.
Read-only RPC verification returned name `MemeX Dust Token`, symbol `DUST`, supply
`1000000000`, and master wallet `0x45BC98d04Db12410cC4bC2F410DE5d2404b0e65e`.
At verification time, that wallet held the entire supply.

1. Install dependencies (`npm install --legacy-peer-deps`).
2. Copy `.env.example` to `.env.local` if necessary. Claim uses the connected
   wallet and does not require `MASTER_WALLET_PRIVATE_KEY` on the server.
3. Run `npm run dev`. Connect MetaMask using the existing Connect Wallet button.
   Only BSC Testnet is offered. Fund the sender and master wallet with testnet BNB for gas.
4. Open Airdrop. DUST is registered automatically, including for existing local data.
   Send to one recipient or paste a bulk list. Each transfer requires wallet approval;
   transfers run sequentially and receipts are saved after each result. The queue
   shows real hashes, status and BscScan links. The connected DUST balance refreshes.
5. Open Transactions to see the DUST recipients' current on-chain balances.
   Connect the contract's master wallet and click Claim. Approve the BSC Testnet
   transaction in MetaMask. The connected wallet calls `executeTransfer`,
   transferring the displayed amount to the contract's master wallet. After confirmation,
   the claim hash appears and balances reload.

Claim checks the connected account against `masterWallet()`, verifies chain 97,
reads token decimals and checks the source balance before submitting. Success is
recorded only after a successful receipt. Unconfirmed submissions retain their hash
for checking before retrying. The existing server API remains available separately.

`VITE_BSC_TESTNET_*` are the public Vite equivalents of the requested
`NEXT_PUBLIC_BSC_TESTNET_*` variables. Only public RPC and contract configuration
use that prefix. The separate server API requires its own private key and RPC as
runtime environment variables only if that API is used.

Historical demo data remains in unrelated screens. Transactions and Airdrop select
only the configured DUST testnet token and do not show demo receipts as testnet transfers.
Local receipts record this browser's operations; they are not a complete blockchain index.
If a submitted transfer cannot be confirmed, follow its actual hash before retrying.

Validation: `npm exec tsc -- --noEmit`, `npm run build`, and `npm run dev`.
With the dev server running, `node scripts/check-testnet-api.mjs` verifies page responses,
origin protection, signature validation, single-use nonces and safe authorization errors.
`node scripts/check-claim.mjs` verifies the wallet Claim flow using contract doubles.
End-to-end Claim transactions require the connected master wallet, testnet BNB for
gas, a recipient with DUST, and wallet approval.
