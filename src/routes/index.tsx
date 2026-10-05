import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChainWallet } from "@/lib/wallet";
import { createClientOnlyFn } from "@tanstack/react-start";
import { getChain } from "@/lib/chains";
const loadDeployment = createClientOnlyFn(() => import("@/lib/onchain"));
import {
  BadgeCheck,
  Coins,
  Flame,
  Gift,
  ImageIcon,
  Info,
  Link2,
  Rocket,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, StatCard, TokenAvatar } from "@/components/memex/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actions,
  allStats,
  compact,
  formatNumber,
  isValidWalletAddress,
  shortAddress,
  timeAgo,
  useMemex,
  type TokenDraft,
} from "@/lib/memex-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MemeX — Memecoin Launchpad, Airdrops & Holder Scanner" },
      {
        name: "description",
        content:
          "Launch a memecoin in minutes: token name, ticker, logo, banner, socials and supply. Then bulk-airdrop holders and scan any contract for wallet addresses.",
      },
      { property: "og:title", content: "MemeX — Memecoin Launchpad" },
      {
        property: "og:description",
        content:
          "Create a token, bulk airdrop it, and track every recipient wallet in one console.",
      },
    ],
  }),
  component: LaunchpadPage,
});

const empty: TokenDraft = {
  name: "",
  ticker: "",
  logoUrl: "",
  bannerUrl: "",
  description: "",
  supply: "1000000000",
  decimals: "9",
  chain: "bsc-testnet",
  website: "",
  twitter: "",
  telegram: "",
  discord: "",
  revokeMint: true,
  freezeAuthority: false,
  burnLp: true,
  taxEnabled: false,
  taxWallet: "",
};

function LaunchpadPage() {
  const state = useMemex();
  const wallet = useChainWallet();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<TokenDraft>(empty);
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "ticker" | "logoUrl" | "supply" | "taxWallet", string>>
  >({});
  const [launching, setLaunching] = useState(false);
  const [taxWalletSaved, setTaxWalletSaved] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => allStats(state), [state]);
  const totalWallets = stats.reduce((s, t) => s + t.wallets, 0);
  const totalSupply = state.tokens.reduce((s, t) => s + Number(t.supply || 0), 0);

  const set = <K extends keyof TokenDraft>(key: K, value: TokenDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const readFile = (file: File | undefined, key: "logoUrl" | "bannerUrl") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set(key, String(reader.result));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e: Partial<Record<"name" | "ticker" | "logoUrl" | "supply" | "taxWallet", string>> = {};
    if (draft.name.trim().length < 2) e.name = "Token name is required";
    if (!/^[A-Za-z0-9]{2,10}$/.test(draft.ticker.trim()))
      e.ticker = "2–10 letters or numbers, no spaces";
    if (!draft.logoUrl) e.logoUrl = "Logo upload is required";
    if (!Number(draft.supply) || Number(draft.supply) <= 0) e.supply = "Enter a supply above zero";
    if (draft.taxEnabled && !isValidWalletAddress(draft.taxWallet)) {
      e.taxWallet = "Enter a valid master wallet address";
    } else if (draft.taxEnabled && !taxWalletSaved) {
      e.taxWallet = "Save the master wallet before deploying";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const launch = async () => {
    if (!wallet.connected) {
      toast.error("Connect your wallet to deploy");
      return;
    }
    if (!validate()) {
      toast.error("Fix the highlighted fields");
      return;
    }
    const ticker = draft.ticker.toUpperCase().replace("$", "");
    setLaunching(true);
    try {
      toast.info("Approve the deployment in your wallet");
      if (wallet.chainId !== "bsc-testnet")
        throw new Error("Please switch your wallet to BSC Testnet.");
      const { deployToken } = await loadDeployment();
      const result = await deployToken({
        chainId: wallet.chainId,
        name: draft.name.trim(),
        symbol: ticker,
        decimals: Number(draft.decimals) || 9,
        supply: draft.supply,
        revokeMint: draft.revokeMint,
        keepFreeze: draft.freezeAuthority,
        taxEnabled: draft.taxEnabled,
        taxWallet: draft.taxWallet,
        taxPercent: Number(state.settings.feePercent) || 0,
      });
      const token = actions.createToken(
        { ...draft, ticker, chain: wallet.chainId },
        result.address,
      );
      setDraft(empty);
      setTaxWalletSaved(false);
      toast.success(`$${token.ticker} is live on ${getChain(wallet.chainId).name}`, {
        description: shortAddress(result.address, 6),
      });
      navigate({ to: "/tokens" });
    } catch (err) {
      toast.error("Deployment failed", { description: (err as Error).message });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <AppShell
      title="Memecoin Launchpad"
      subtitle="Configure metadata, upload branding, set supply and authorities, then deploy. Step 1 of 3 — launch, airdrop, then track."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/airdrop" })} className="gap-2">
            <Gift className="size-4" /> Go to airdrop
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tokens launched" value={state.tokens.length} tone="primary" />
        <StatCard label="Airdrop batches" value={state.airdrops.length} />
        <StatCard label="Wallets reached" value={formatNumber(totalWallets)} />
        <StatCard
          label="Total supply minted"
          value={compact(totalSupply)}
          hint="Across all tokens"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="panel p-5 lg:p-6">
          <SectionHeading icon={Coins} title="Token identity" step="01" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Token name" error={errors.name}>
              <Input
                value={draft.name}
                placeholder="Frogz Coin"
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Ticker / symbol" error={errors.ticker}>
              <Input
                value={draft.ticker}
                placeholder="FROGZ"
                className="num uppercase"
                onChange={(e) => set("ticker", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description" className="mt-4">
            <Textarea
              rows={3}
              value={draft.description}
              placeholder="What is the meme? Keep it punchy — this shows on explorers and aggregators."
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label-caps">Logo upload {errors.logoUrl ? "· required" : ""}</p>
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                className={`mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-colors hover:bg-secondary ${
                  errors.logoUrl ? "border-danger" : "border-border"
                }`}
              >
                {draft.logoUrl ? (
                  <img
                    src={draft.logoUrl}
                    alt="Token logo preview"
                    className="size-12 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="grid size-12 place-items-center rounded-full border border-border bg-elevated">
                    <Upload className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {draft.logoUrl ? "Replace logo" : "PNG / JPG · square · 512×512"}
                </span>
              </button>
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0], "logoUrl")}
              />
            </div>

            <div>
              <p className="label-caps">Banner upload</p>
              <button
                type="button"
                onClick={() => bannerInput.current?.click()}
                className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3 text-left transition-colors hover:bg-secondary"
              >
                {draft.bannerUrl ? (
                  <img
                    src={draft.bannerUrl}
                    alt="Banner preview"
                    className="h-12 w-24 rounded-md border border-border object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-24 place-items-center rounded-md border border-border bg-elevated">
                    <ImageIcon className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {draft.bannerUrl ? "Replace banner" : "1500×500 recommended"}
                </span>
              </button>
              <input
                ref={bannerInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0], "bannerUrl")}
              />
            </div>
          </div>

          <div className="my-6 h-px bg-border" />
          <SectionHeading icon={Flame} title="Supply & network" step="02" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Total supply" error={errors.supply}>
              <Input
                value={draft.supply}
                inputMode="numeric"
                className="num"
                onChange={(e) => set("supply", e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
            <Field label="Decimals">
              <Select value={draft.decimals} onValueChange={(v) => set("decimals", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["6", "8", "9", "18"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Network">
              <Select value={draft.chain} onValueChange={(v) => set("chain", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bsc-testnet">BSC Testnet</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="my-6 h-px bg-border" />
          <SectionHeading icon={Link2} title="Social links" step="03" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Website">
              <Input
                value={draft.website}
                placeholder="https://frogz.fun"
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
            <Field label="X / Twitter">
              <Input
                value={draft.twitter}
                placeholder="https://x.com/frogz"
                onChange={(e) => set("twitter", e.target.value)}
              />
            </Field>
            <Field label="Telegram">
              <Input
                value={draft.telegram}
                placeholder="https://t.me/frogz"
                onChange={(e) => set("telegram", e.target.value)}
              />
            </Field>
            <Field label="Discord">
              <Input
                value={draft.discord}
                placeholder="https://discord.gg/frogz"
                onChange={(e) => set("discord", e.target.value)}
              />
            </Field>
          </div>

          <div className="my-6 h-px bg-border" />
          <SectionHeading icon={ShieldCheck} title="Authorities & safety" step="04" />
          <div className="mt-4 space-y-3">
            <ToggleRow
              label="Revoke mint authority"
              hint="No more tokens can ever be minted — the classic anti-rug signal."
              checked={draft.revokeMint}
              onChange={(v) => set("revokeMint", v)}
            />
            <ToggleRow
              label="Keep freeze authority"
              hint="Lets you freeze accounts. Most holders read this as a red flag."
              checked={draft.freezeAuthority}
              onChange={(v) => set("freezeAuthority", v)}
            />
            <ToggleRow
              label="Burn LP tokens on launch"
              hint="Permanently locks liquidity after the pool is seeded."
              checked={draft.burnLp}
              onChange={(v) => set("burnLp", v)}
            />
            <ToggleRow
              label="Enable Tax"
              hint="Route token tax fees to a master wallet after launch."
              checked={draft.taxEnabled}
              onChange={(v) => {
                set("taxEnabled", v);
                if (!v) setTaxWalletSaved(false);
              }}
            />
            {draft.taxEnabled ? (
              <div className="rounded-xl border border-primary/30 bg-elevated p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Master fee wallet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      All enabled token tax fees will be sent to this wallet.
                    </p>
                  </div>
                  {taxWalletSaved ? <span className="label-caps text-primary">Saved</span> : null}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="num flex-1"
                    placeholder="Enter master wallet address"
                    value={draft.taxWallet}
                    onChange={(e) => {
                      set("taxWallet", e.target.value);
                      setTaxWalletSaved(false);
                    }}
                    aria-invalid={Boolean(errors.taxWallet)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!isValidWalletAddress(draft.taxWallet)) {
                        setErrors((current) => ({
                          ...current,
                          taxWallet: "Enter a valid master wallet address",
                        }));
                        toast.error("Enter a valid master wallet address");
                        return;
                      }
                      setErrors((current) => ({ ...current, taxWallet: "" }));
                      setTaxWalletSaved(true);
                      toast.success("Master fee wallet saved");
                    }}
                  >
                    Save wallet
                  </Button>
                </div>
                {errors.taxWallet ? (
                  <p className="mt-2 text-xs text-danger">{errors.taxWallet}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" className="gap-2 font-semibold" onClick={launch} disabled={launching}>
              <Rocket className="size-4" />
              {launching ? "Deploying…" : "Deploy token"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(empty);
                setTaxWalletSaved(false);
              }}
            >
              Reset form
            </Button>
            <p className="text-xs text-muted-foreground">
              Deploy fee {state.settings.feePercent}% · priority {state.settings.priorityFee} SOL
            </p>
          </div>
        </div>

        {/* Live preview + recent launches */}
        <div className="space-y-6">
          <div className="panel overflow-hidden">
            <div className="signal-wash h-24 w-full border-b border-border">
              {draft.bannerUrl ? (
                <img
                  src={draft.bannerUrl}
                  alt="Token banner"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="p-5">
              <div className="-mt-10 flex items-end gap-3">
                <TokenAvatar ticker={draft.ticker || "NEW"} logoUrl={draft.logoUrl} size="lg" />
                <div className="pb-1">
                  <p className="font-display text-lg font-bold leading-none">
                    {draft.name || "Your token name"}
                  </p>
                  <p className="num text-sm text-primary">
                    ${draft.ticker ? draft.ticker.toUpperCase() : "TICKER"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {draft.description || "Your token description will appear here for holders."}
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Supply" value={draft.supply ? compact(Number(draft.supply)) : "—"} />
                <Row label="Decimals" value={draft.decimals} />
                <Row label="Network" value={draft.chain} />
                <Row
                  label="Mint authority"
                  value={draft.revokeMint ? "Revoked" : "Retained"}
                  tone={draft.revokeMint ? "good" : "warn"}
                />
                <Row
                  label="Liquidity"
                  value={draft.burnLp ? "LP burned" : "LP retained"}
                  tone={draft.burnLp ? "good" : "warn"}
                />
                <Row
                  label="Token tax"
                  value={
                    draft.taxEnabled ? (taxWalletSaved ? "Enabled" : "Needs wallet") : "Disabled"
                  }
                  tone={draft.taxEnabled && !taxWalletSaved ? "warn" : "good"}
                />
              </dl>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-elevated p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Front-end demo: deployments are simulated locally so you can walk the full launch →
                airdrop → history flow.
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold">Recent launches</h3>
              <Button variant="link" size="sm" onClick={() => navigate({ to: "/tokens" })}>
                View all
              </Button>
            </div>
            <div className="mt-3 space-y-3">
              {stats.slice(0, 4).map((s) => (
                <div key={s.token.id} className="flex items-center gap-3">
                  <TokenAvatar ticker={s.token.ticker} logoUrl={s.token.logoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">${s.token.ticker}</p>
                    <p className="label-caps">{timeAgo(s.token.createdAt)}</p>
                  </div>
                  <p className="num flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {s.wallets}
                  </p>
                </div>
              ))}
              {!stats.length ? (
                <p className="text-sm text-muted-foreground">No tokens yet — deploy your first.</p>
              ) : null}
            </div>
          </div>

          <div className="panel flex items-start gap-3 p-5">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              Every token you deploy is instantly selectable on the Airdrop page and tracked in
              Transactions.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  step,
}: {
  icon: typeof Coins;
  title: string;
  step: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 place-items-center rounded-lg border border-primary/30 bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <h2 className="font-display text-base font-bold">{title}</h2>
      <span className="label-caps ml-auto">{step}</span>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="label-caps">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-elevated p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-1.5 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`num text-xs font-semibold capitalize ${
          tone === "good" ? "text-primary" : tone === "warn" ? "text-warning" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
