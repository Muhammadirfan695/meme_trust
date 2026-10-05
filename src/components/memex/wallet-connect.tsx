import { ChevronDown, Copy, ExternalLink, Loader2, LogOut, RefreshCw, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHAIN_LIST, getChain } from "@/lib/chains";
import { cn } from "@/lib/utils";
import { shortAddress } from "@/lib/memex-store";
import {
  connectEvmWallet,
  connectSolanaWallet,
  disconnectWallet,
  refreshBalance,
  switchChain,
  useChainWallet,
  walletOptions,
  type WalletOption,
} from "@/lib/wallet";

export function ConnectWalletButton() {
  const wallet = useChainWallet();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [pending, setPending] = useState("");
  const [evmChain, setEvmChain] = useState("bsc-testnet");

  useEffect(() => {
    setOptions(walletOptions());
  }, [pickerOpen]);

  const connect = async (option: WalletOption) => {
    if (!option.installed) {
      window.open(option.installUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setPending(option.id);
    try {
      if (option.kind === "solana") await connectSolanaWallet(option.id);
      else await connectEvmWallet(option.id, evmChain);
      setPickerOpen(false);
      toast.success(`${option.name} connected`, { description: "Wallet signature verified" });
    } catch (err) {
      toast.error("Connection failed", { description: (err as Error).message });
    } finally {
      setPending("");
    }
  };

  if (!wallet.connected) {
    return (
      <>
        <Button className="gap-2 font-semibold" onClick={() => setPickerOpen(true)}>
          <Wallet className="size-4" />
          Connect Wallet
        </Button>
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Connect a wallet</DialogTitle>
              <DialogDescription>
                You will be asked to sign a free message that proves you own the wallet. Balances
                and token data are then read live from the chain.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="label-caps">BSC Testnet</p>
                  <select
                    value={evmChain}
                    onChange={(e) => setEvmChain(e.target.value)}
                    className="num rounded-md border border-border bg-elevated px-2 py-1 text-xs"
                  >
                    {CHAIN_LIST.filter((c) => c.kind === "evm").map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 space-y-2">
                  {options
                    .filter((o) => o.kind === "evm")
                    .map((o) => (
                      <WalletRow
                        key={o.id}
                        option={o}
                        pending={pending === o.id}
                        onPick={connect}
                      />
                    ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const chain = getChain(wallet.chainId);

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-primary/40 bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/70"
      >
        <span className="size-2 rounded-full bg-primary" />
        <span className="num">{shortAddress(wallet.address)}</span>
        <ChevronDown className="size-3.5 opacity-70" />
      </button>
      {menuOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <p className="label-caps">{wallet.walletName} · verified signature</p>
          <p className="num mt-1 break-all text-xs text-muted-foreground">{wallet.address}</p>

          <div className="mt-3">
            <p className="label-caps">Network</p>
            <select
              value={wallet.chainId}
              onChange={async (e) => {
                try {
                  await switchChain(e.target.value);
                  toast.success("Network switched");
                } catch (err) {
                  toast.error("Switch failed", { description: (err as Error).message });
                }
              }}
              className="num mt-1 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs"
            >
              {CHAIN_LIST.filter((c) =>
                wallet.kind === "solana" ? c.kind === "solana" : c.kind === "evm",
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-3 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">On-chain balance</span>
            <span className="num font-semibold text-primary">
              {wallet.loadingBalance ? "…" : `${wallet.balance} ${chain.symbol}`}
            </span>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard?.writeText(wallet.address);
                toast.success("Address copied");
              }}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => void refreshBalance()}
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                window.open(
                  chain.kind === "solana"
                    ? `${chain.explorer}/account/${wallet.address}`
                    : `${chain.explorer}/address/${wallet.address}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <ExternalLink className="size-3.5" /> Explorer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                disconnectWallet();
                setMenuOpen(false);
                toast("Wallet disconnected");
              }}
            >
              <LogOut className="size-3.5" /> Disconnect
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WalletRow({
  option,
  pending,
  onPick,
}: {
  option: WalletOption;
  pending: boolean;
  onPick: (option: WalletOption) => void;
}) {
  return (
    <button
      onClick={() => onPick(option)}
      disabled={pending}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border bg-elevated px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary",
        pending && "opacity-60",
      )}
    >
      <span className="grid size-8 place-items-center rounded-lg border border-border">
        <Wallet className="size-4" />
      </span>
      <span className="font-medium">{option.name}</span>
      <span className="ml-auto text-xs text-muted-foreground">
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : option.installed ? (
          "Detected"
        ) : (
          "Install"
        )}
      </span>
    </button>
  );
}
