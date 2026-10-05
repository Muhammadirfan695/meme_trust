import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { isAddress, ZeroAddress, parseUnits } from "ethers";

// Exercise the real Claim implementation with a wallet/contract double; no funds move.
const master = "0x45BC98d04Db12410cC4bC2F410DE5d2404b0e65e";
const source = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}`;
let state;
const reset = () => {
  state = {
    connected: true,
    account: master,
    chain: "0x61",
    balance: parseUnits("1000", 18),
    calls: [],
    receipt: { status: 1, hash },
  };
};
globalThis.__claimTest = {
  isAddress,
  ZeroAddress,
  tokenAmount: (amount, decimals) => {
    const units = parseUnits(amount, decimals);
    if (units <= 0n) throw new Error("Amount must be above zero.");
    return units;
  },
  web3Error: (error) => error.message,
  getWalletState: () => ({ connected: state.connected, kind: "evm", walletId: "metamask" }),
  evmProvider: () => ({}),
  switchChain: async (chain) => {
    assert.equal(chain, "bsc-testnet");
  },
  BrowserProvider: class {
    async send() {
      return state.chain;
    }
    async getSigner() {
      return { getAddress: async () => state.account };
    }
  },
  Contract: class {
    getFunction(name) {
      return async (...args) => {
        if (name === "masterWallet") return master;
        if (name === "decimals") return 18;
        if (name === "balanceOf") return state.balance;
        assert.equal(name, "executeTransfer");
        state.calls.push(args);
        if (state.submitError) throw state.submitError;
        return {
          hash,
          wait: async (confirmations, timeout) => {
            assert.equal(confirmations, 1);
            assert.equal(timeout, 120_000);
            if (state.waitError) throw state.waitError;
            return state.receipt;
          },
        };
      };
    }
  },
};
const sourceCode = readFileSync(new URL("../src/lib/web3/transfers.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(sourceCode, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const isolated = compiled.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "");
const prelude =
  "const { BrowserProvider, Contract, isAddress, ZeroAddress, tokenAmount, web3Error, getWalletState, evmProvider, switchChain } = globalThis.__claimTest; const DUST_ADDRESS = 'test-contract'; const MASTER_ABI = [];\n";
const { claimDust } = await import(
  `data:text/javascript;base64,${Buffer.from(prelude + isolated).toString("base64")}`
);
reset();
assert.deepEqual(await claimDust(source, "1000"), { success: true, txHash: hash });
assert.deepEqual(state.calls, [[source, master, parseUnits("1000", 18)]]);
for (const [setup, address, amount, message] of [
  [
    () => {
      state.connected = false;
    },
    source,
    "1",
    /Connect the master/,
  ],
  [
    () => {
      state.account = source;
    },
    source,
    "1",
    /contract master/,
  ],
  [
    () => {
      state.chain = "0x38";
    },
    source,
    "1",
    /BSC Testnet/,
  ],
  [() => {}, "invalid", "1", /Invalid source/],
  [() => {}, master, "1", /already the master/],
  [
    () => {
      state.balance = 0n;
    },
    source,
    "1",
    /Insufficient token/,
  ],
  [() => {}, source, "0", /above zero/],
]) {
  reset();
  setup();
  await assert.rejects(claimDust(address, amount), message);
  assert.equal(state.calls.length, 0);
}
reset();
state.submitError = new Error("User rejected transaction");
await assert.rejects(claimDust(source, "1"), (error) => error.txHash === undefined);
reset();
state.receipt = null;
await assert.rejects(claimDust(source, "1"), (error) => error.txHash === hash);
reset();
state.receipt = { hash, status: 0 };
await assert.rejects(
  claimDust(source, "1"),
  (error) => /reverted/.test(error.message) && error.txHash === undefined,
);
reset();
state.waitError = Object.assign(new Error("replaced"), {
  code: "TRANSACTION_REPLACED",
  cancelled: false,
  receipt: { hash: "replacement", status: 1 },
});
assert.equal((await claimDust(source, "1")).txHash, "replacement");
reset();
state.waitError = Object.assign(new Error("cancelled"), {
  code: "TRANSACTION_REPLACED",
  cancelled: true,
  receipt: { hash: "cancel", status: 1 },
});
await assert.rejects(claimDust(source, "1"), (error) => error.txHash === undefined);
delete globalThis.__claimTest;
console.log(
  "Passed: Claim submission, permissions, chain, amount, balance, rejection, pending, revert, replacement and cancellation checks.",
);
