import { isAddress, hexlify, randomBytes } from "ethers";
import { useChainWallet } from "@/lib/wallet";
import { dustBalance, dustTxUrl, sendDust } from "@/lib/web3/transfers";
import { web3Error } from "@/lib/web3/bsc-testnet";
import type { SendResult } from "@/lib/onchain";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Gift,
  Plus,
  Rocket,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell, EmptyState, StatCard, TokenAvatar } from "@/components/memex/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actions,
  formatNumber,
  isValidAddress,
  randomAddress,
  shortAddress,
  timeAgo,
  tokenStats,
  useMemex,
} from "@/lib/memex-store";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/airdrop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Bulk Airdrop — Send Tokens to One or Many Wallets | MemeX" },
      {
        name: "description",
        content:
          "Airdrop a token you launched to a single wallet or thousands of addresses in bulk, with live validation and per-wallet amounts.",
      },
      { property: "og:title", content: "Bulk Airdrop — MemeX" },
      {
        property: "og:description",
        content: "Send your memecoin to one address or a bulk list with validation and receipts.",
      },
    ],
  }),
  component: AirdropPage,
});

type Mode = "single" | "bulk";

function AirdropPage() {
  const state = useMemex();
  const wallet = useChainWallet();
  const [receipts, setReceipts] = useState<SendResult[]>([]);
  const [balance, setBalance] = useState<string>();
  useEffect(() => {
    if (wallet.address)
      void dustBalance(wallet.address)
        .then(setBalance)
        .catch(() => setBalance(undefined));
  }, [wallet.address, receipts]);
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [tokenId, setTokenId] = useState("tk_dust_testnet");
  const [mode, setMode] = useState<Mode>("single");
  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!tokenId && state.tokens.length) setTokenId(state.tokens[0]!.id);
  }, [state.tokens, tokenId]);

  const token = state.tokens.find((t) => t.id === tokenId);
  const stats = token ? tokenStats(state, token) : null;

  const parsed = useMemo(() => {
    const lines = (mode === "single" ? single : bulk)
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const rows = lines.map((line) => {
      const [addr, amt] = line.split(/[\s|:=]+/);
      const address = (addr ?? "").trim();
      const dup = seen.has(address.toLowerCase());
      seen.add(address.toLowerCase());
      return {
        address,
        amount: amt || amount,
        valid: isAddress(address) && !dup,
        duplicate: dup,
      };
    });
    return {
      rows,
      valid: rows.filter((r) => r.valid),
      invalid: rows.filter((r) => !r.valid),
    };
  }, [mode, single, bulk, amount]);

  const totalTokens = parsed.valid.reduce((s, r) => s + Number(r.amount || 0), 0);

  const send = async () => {
    if (sending) return;
    if (!wallet.connected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!token) {
      toast.error("Create a token first");
      return;
    }
    if (!parsed.valid.length) {
      toast.error("Add at least one valid wallet address");
      return;
    }
    if (Number(amount) <= 0) {
      toast.error("Amount per wallet must be above zero");
      return;
    }

    setSending(true);
    setProgress(4);
    try {
      toast.info("Approve the transfers in your wallet");
      setReceipts([]);
      const completed: SendResult[] = [];
      const batchId = `ad_${crypto.randomUUID()}`;
      const results = await sendDust(
        parsed.valid.map((r) => ({ address: r.address, amount: r.amount })),
        (result, done) => {
          setReceipts((previous) => [...previous, result]);
          completed.push(result);
          actions.recordAirdrop(token.id, completed, note || "BSC Testnet DUST transfer", batchId);
          setProgress(Math.round((done / parsed.valid.length) * 100));
        },
      );
      const drop = { recipients: results };
      const failed = results.filter((r) => r.status !== "confirmed").length;
      setSingle("");
      setBulk("");
      setNote("");
      if (failed) {
        toast.warning(`${drop.recipients.length - failed} confirmed · ${failed} incomplete`, {
          description: `$${token.ticker} · see Transactions for receipts`,
        });
      } else {
        toast.success(`Airdropped to ${drop.recipients.length} wallets`, {
          description: `$${token.ticker} · view it in Transactions`,
        });
      }
    } catch (err) {
      toast.error("Airdrop failed", { description: web3Error(err) });
    } finally {
      setSending(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  if (!state.tokens.length) {
    return (
      <AppShell title="Airdrop" subtitle="Step 2 — send your launched token to holder wallets.">
        <EmptyState
          title="No token to airdrop yet"
          body="Launch a memecoin first. It will appear here automatically and be ready to distribute."
          action={
            <Button className="gap-2" onClick={() => navigate({ to: "/" })}>
              <Rocket className="size-4" /> Launch a token
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Airdrop"
      subtitle="Step 2 — send to one wallet or paste thousands of addresses for a bulk distribution."
      actions={
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => navigate({ to: "/transactions" })}
        >
          <Users className="size-4" /> View history
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="panel p-5 lg:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="label-caps">Token to airdrop</Label>
              <Select value={tokenId} onValueChange={setTokenId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>
                <SelectContent>
                  {state.tokens
                    .filter((t) => t.id === "tk_dust_testnet")
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        ${t.ticker} — {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-caps">Amount per wallet</Label>
              <Input
                className="num mt-1.5"
                value={amount}
                inputMode="numeric"
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </div>

          <div className="mt-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="w-full">
                <TabsTrigger value="single" className="flex-1">
                  Single wallet
                </TabsTrigger>
                <TabsTrigger value="bulk" className="flex-1">
                  Bulk wallets
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-4">
              {mode === "single" ? (
                <>
                  <Label className="label-caps">Recipient wallet address</Label>
                  <Input
                    className="num mt-1.5"
                    placeholder="Paste a wallet address"
                    value={single}
                    onChange={(e) => setSingle(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="label-caps">
                      Wallet list — one per line, optional `address 500` amount
                    </Label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            setBulk((b) => (b ? `${b}\n${text}` : text));
                            toast.success("Pasted from clipboard");
                          } catch {
                            toast.error("Clipboard access blocked");
                          }
                        }}
                      >
                        <ClipboardPaste className="size-3.5" /> Paste
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() =>
                          setBulk((b) => {
                            const demo = Array.from({ length: 25 }, () =>
                              hexlify(randomBytes(20)),
                            ).join("\n");
                            return b ? `${b}\n${demo}` : demo;
                          })
                        }
                      >
                        <Plus className="size-3.5" /> Demo 25
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    rows={9}
                    className="num mt-1.5 text-xs"
                    placeholder={"7xKq…\n9Bd2… 2500\n4Fh8…, 1000"}
                    value={bulk}
                    onChange={(e) => setBulk(e.target.value)}
                  />
                </>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Label className="label-caps">Batch label (optional)</Label>
            <Input
              className="mt-1.5"
              placeholder="e.g. Early holders round 2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Summary
              label="Valid wallets"
              value={formatNumber(parsed.valid.length)}
              tone="primary"
            />
            <Summary label="Rejected" value={formatNumber(parsed.invalid.length)} tone="danger" />
            <Summary label="Tokens required" value={formatNumber(totalTokens)} />
          </div>

          {parsed.invalid.length ? (
            <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-danger">
                <AlertTriangle className="size-3.5" /> {parsed.invalid.length} entries skipped
                (invalid format or duplicates)
              </p>
              <div className="num mt-2 max-h-24 space-y-1 overflow-auto text-[11px] text-muted-foreground">
                {parsed.invalid.slice(0, 12).map((r, i) => (
                  <p key={i} className="truncate">
                    {r.address || "(empty)"} — {r.duplicate ? "duplicate" : "invalid address"}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {progress > 0 ? (
            <div className="mt-4">
              <Progress value={progress} />
              <p className="label-caps mt-2">
                {progress < 100 ? "Broadcasting transactions…" : "Batch confirmed"}
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" className="gap-2 font-semibold" onClick={send} disabled={sending}>
              <Gift className="size-4" />
              {sending
                ? "Sending…"
                : `Airdrop to ${parsed.valid.length} wallet${parsed.valid.length === 1 ? "" : "s"}`}
            </Button>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => {
                setSingle("");
                setBulk("");
              }}
            >
              <Trash2 className="size-4" /> Clear list
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {token ? (
            <div className="panel p-5">
              <div className="flex items-center gap-3">
                <TokenAvatar ticker={token.ticker} logoUrl={token.logoUrl} />
                <div>
                  <p className="font-semibold">${token.ticker}</p>
                  <p className="num text-xs text-muted-foreground">
                    {shortAddress(token.address, 6)}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto capitalize">
                  {token.chain}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatCard
                  label="Wallets sent"
                  value={formatNumber(stats?.wallets ?? 0)}
                  tone="primary"
                />
                <StatCard label="Batches" value={stats?.drops ?? 0} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Last batch: {stats?.lastDropAt ? timeAgo(stats.lastDropAt) : "never"}
              </p>
            </div>
          ) : null}

          <div className="panel p-5">
            <h3 className="font-display text-sm font-bold">Preview queue</h3>
            <p className="num mt-3 text-xs">Wallet balance: {balance ?? "—"} DUST</p>
            {receipts.map((r, i) => (
              <div key={i} className="mt-2 text-xs">
                <span>
                  {shortAddress(r.address)} · {r.status}
                </span>
                {r.txHash ? (
                  <a
                    className="ml-2 text-primary"
                    href={dustTxUrl(r.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {shortAddress(r.txHash, 8)}
                  </a>
                ) : null}
                {r.error ? <p className="text-danger">{r.error}</p> : null}
              </div>
            ))}
            {parsed.valid.length ? (
              <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
                {parsed.valid.slice(0, 60).map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2"
                  >
                    <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                    <span className="num truncate text-xs text-muted-foreground">
                      {shortAddress(r.address, 6)}
                    </span>
                    <span className="num ml-auto text-xs font-semibold">
                      {formatNumber(Number(r.amount))}
                    </span>
                  </div>
                ))}
                {parsed.valid.length > 60 ? (
                  <p className="label-caps">+{parsed.valid.length - 60} more</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Addresses you enter will be validated and queued here before sending.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated p-3">
      <p className="label-caps">{label}</p>
      <p
        className={`num mt-1 text-xl font-bold ${
          tone === "primary" ? "text-primary" : tone === "danger" ? "text-danger" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
