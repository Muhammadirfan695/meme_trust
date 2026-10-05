import { createFileRoute } from "@tanstack/react-router";
import {
  Copy,
  KeyRound,
  LockKeyhole,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/memex/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { actions, isValidWalletAddress, useMemex } from "@/lib/memex-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Fee Wallet & Account | MemeX" },
      {
        name: "description",
        content:
          "Set the wallet address that collects launch fees, tune priority fees, and register a MemeX account with your email.",
      },
      { property: "og:title", content: "Settings — MemeX" },
      {
        property: "og:description",
        content: "Fee wallet, network defaults and account registration for your MemeX workspace.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const state = useMemex();
  const s = state.settings;

  const [feeWallets, setFeeWallets] = useState(s.feeWallets);
  const [autoFeeReceive, setAutoFeeReceive] = useState(s.autoFeeReceive);
  const [autoConnectWallets, setAutoConnectWallets] = useState(s.autoConnectWallets);
  const [editingNetwork, setEditingNetwork] = useState<string | null>(null);
  const [name, setName] = useState(s.accountName);
  const [email, setEmail] = useState(s.email);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setFeeWallets(s.feeWallets);
    setAutoFeeReceive(s.autoFeeReceive);
    setAutoConnectWallets(s.autoConnectWallets);
    setName(s.accountName);
    setEmail(s.email);
  }, [s]);

  const saveFees = () => {
    const invalid = feeWallets.find((wallet) => wallet.address && !isValidWalletAddress(wallet.address));
    if (invalid) {
      toast.error(`${invalid.chain} wallet address looks invalid`);
      return;
    }
    actions.updateSettings({
      feeWallets,
      feeWallet: feeWallets.find((wallet) => wallet.address)?.address ?? "",
      autoFeeReceive,
      autoConnectWallets,
    });
    setEditingNetwork(null);
    toast.success("All receiving wallets saved");
  };

  const updateWallet = (chain: string, address: string) => {
    setFeeWallets((wallets) =>
      wallets.map((wallet) => (wallet.chain === chain ? { ...wallet, address } : wallet)),
    );
  };

  const addNetwork = () => {
    if (feeWallets.some((wallet) => wallet.chain === "Avalanche")) {
      setEditingNetwork("Avalanche");
      toast("Avalanche is already available");
      return;
    }
    setFeeWallets((wallets) => [
      ...wallets,
      { chain: "Avalanche", symbol: "AVAX", address: "" },
    ]);
    setEditingNetwork("Avalanche");
    toast.success("Avalanche wallet added");
  };

  const register = () => {
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Enter your display name");
      return;
    }

    actions.updateSettings({ email, accountName: name, registered: true });
    setPassword("");
    toast.success("Account created", { description: email });
  };

  return (
    <AppShell
      title="Settings"
      subtitle="Fee collection wallet, network defaults and your MemeX account."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg border border-primary/30 bg-accent text-accent-foreground">
              <Wallet className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold">Fees Receiving Wallets</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set and manage the wallet addresses where platform fees will be sent.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-elevated p-3">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/20 bg-accent text-primary">
                <Zap className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Auto fee receive</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Automatically receive and distribute fees to your wallets.
                </p>
              </div>
              <div className="text-right">
                <Switch checked={autoFeeReceive} onCheckedChange={setAutoFeeReceive} />
                <p className="mt-1 text-[11px] text-primary">{autoFeeReceive ? "Enabled" : "Disabled"}</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-dashed border-primary/40 p-3">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">Auto connect from connected wallet</p>
                    <Badge variant="secondary" className="text-primary">Recommended</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Automatically detect wallet addresses across all supported networks.
                  </p>
                </div>
                <div className="text-right">
                  <Switch checked={autoConnectWallets} onCheckedChange={setAutoConnectWallets} />
                  <p className="mt-1 text-[11px] text-primary">
                    {autoConnectWallets ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" /> Your connected wallet is scanned locally and added automatically.
            </p>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Wallet Addresses</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Add or edit an address for each network.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addNetwork}>
              <Plus className="size-4 text-primary" /> Add Network
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            {feeWallets.map((wallet, index) => {
              const isEditing = editingNetwork === wallet.chain;
              const displayAddress = wallet.address ||
                (state.wallet.connected && autoConnectWallets ? state.wallet.address : "");
              return (
                <div
                  key={wallet.chain}
                  className="grid gap-3 border-b border-border p-3 last:border-0 sm:grid-cols-[11rem_1fr_auto] sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background font-display text-xs font-bold text-primary">
                      {wallet.symbol.slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{wallet.chain}</p>
                      <p className="text-xs text-muted-foreground">({wallet.symbol})</p>
                    </div>
                  </div>
                  <div>
                    {displayAddress ? <Badge variant="secondary" className="mb-1 text-primary">Connected</Badge> : null}
                    <Input
                      className="num h-8 text-xs"
                      placeholder="Enter wallet address"
                      value={displayAddress}
                      readOnly={!isEditing}
                      onChange={(e) => updateWallet(wallet.chain, e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    {displayAddress ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Copy ${wallet.chain} wallet`}
                        onClick={() => {
                          navigator.clipboard?.writeText(displayAddress);
                          toast.success(`${wallet.chain} wallet copied`);
                        }}
                      >
                        <Copy className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant={isEditing ? "secondary" : "outline"}
                      size="icon"
                      aria-label={`Edit ${wallet.chain} wallet`}
                      onClick={() => {
                        if (!wallet.address && displayAddress) updateWallet(wallet.chain, displayAddress);
                        setEditingNetwork(isEditing ? null : wallet.chain);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-primary/40 p-3 text-left transition-colors hover:bg-accent"
            onClick={addNetwork}
          >
            <span className="grid size-9 place-items-center rounded-full border border-primary/30 bg-accent text-primary">
              <Plus className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-primary">Add More Networks</span>
              <span className="block text-xs text-muted-foreground">Add more supported networks to manage receiving wallets.</span>
            </span>
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button className="gap-2 font-semibold" onClick={saveFees}>
              <Save className="size-4" /> Save All Wallets
            </Button>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" /> All changes are saved securely in this workspace.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-5 lg:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg border border-primary/30 bg-accent text-accent-foreground">
                <Mail className="size-4" />
              </span>
              <h2 className="font-display text-base font-bold">Account</h2>
              {s.registered ? (
                <Badge className="ml-auto">Registered</Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto">
                  Guest
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {s.registered
                ? `Signed in as ${s.email}. Update your details below.`
                : "Create an account with your email to save launches and receive airdrop receipts."}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <Label className="label-caps">Display name</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Meme Dev"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label className="label-caps">Email address</Label>
                <Input
                  className="mt-1.5"
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label className="label-caps">Password</Label>
                <Input
                  className="mt-1.5"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-elevated p-3">
                <div>
                  <p className="text-sm font-medium">Email me airdrop receipts</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A summary after every batch completes.
                  </p>
                </div>
                <Switch
                  checked={s.notifyEmail}
                  onCheckedChange={(v) => actions.updateSettings({ notifyEmail: v })}
                />
              </div>
              <Button className="gap-2 font-semibold" onClick={register}>
                <KeyRound className="size-4" />
                {s.registered ? "Update account" : "Create account"}
              </Button>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="font-display text-base font-bold">Workspace data</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tokens, airdrops and settings are stored in this browser. Reset to the demo dataset at
              any time.
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => {
                actions.resetAll();
                toast("Workspace reset to demo data");
              }}
            >
              <RotateCcw className="size-4" /> Reset workspace
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
