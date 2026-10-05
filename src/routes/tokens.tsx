import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Gift, Rocket, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, EmptyState, StatCard, TokenAvatar } from "@/components/memex/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  actions,
  allStats,
  compact,
  formatNumber,
  shortAddress,
  timeAgo,
  useMemex,
} from "@/lib/memex-store";

export const Route = createFileRoute("/tokens")({
  head: () => ({
    meta: [
      { title: "My Tokens — Created Coins & Airdrop Reach | MemeX" },
      {
        name: "description",
        content:
          "Every coin you created on MemeX with the number of wallets airdropped, unique holders and wallets that transacted.",
      },
      { property: "og:title", content: "My Tokens — MemeX" },
      {
        property: "og:description",
        content: "Created coin list with airdrop wallet counts and on-chain activity per token.",
      },
    ],
  }),
  component: TokensPage,
});

function TokensPage() {
  const state = useMemex();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const all = allStats(state);
    const needle = q.trim().toLowerCase();
    return needle
      ? all.filter(
          (s) =>
            s.token.name.toLowerCase().includes(needle) ||
            s.token.ticker.toLowerCase().includes(needle) ||
            s.token.address.toLowerCase().includes(needle),
        )
      : all;
  }, [state, q]);

  const totals = stats.reduce(
    (acc, s) => ({
      wallets: acc.wallets + s.wallets,
      unique: acc.unique + s.uniqueWallets,
      active: acc.active + s.activeWallets,
      sent: acc.sent + s.totalSent,
    }),
    { wallets: 0, unique: 0, active: 0, sent: 0 },
  );

  return (
    <AppShell
      title="Created Coins"
      subtitle="Step 2 overview — each token you launched, how many wallets it was airdropped to, and how many of those wallets moved it."
      actions={
        <Button className="gap-2" onClick={() => navigate({ to: "/" })}>
          <Rocket className="size-4" /> New token
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Coins created" value={state.tokens.length} tone="primary" />
        <StatCard label="Airdrop sends" value={formatNumber(totals.wallets)} />
        <StatCard label="Unique wallets" value={formatNumber(totals.unique)} />
        <StatCard
          label="Wallets that transacted"
          value={formatNumber(totals.active)}
          hint="Claimed or moved the token"
          tone="warning"
        />
      </div>

      <div className="panel mt-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, ticker or contract address"
            className="pl-9"
          />
        </div>
      </div>

      {!stats.length ? (
        <div className="mt-6">
          <EmptyState
            title={q ? "No matching tokens" : "No tokens created yet"}
            body={
              q
                ? "Try a different name, ticker or contract address."
                : "Launch your first memecoin on the launchpad, then come back to track airdrop reach."
            }
            action={
              <Button className="gap-2" onClick={() => navigate({ to: "/" })}>
                <Rocket className="size-4" /> Go to launchpad
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Table for wide screens */}
          <div className="panel mt-6 hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Token",
                    "Contract",
                    "Supply",
                    "Batches",
                    "Wallets sent",
                    "Unique",
                    "Transacted",
                    "Last drop",
                    "",
                  ].map((h) => (
                    <th key={h} className="label-caps px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.token.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/tokens/$tokenId"
                        params={{ tokenId: s.token.id }}
                        className="flex items-center gap-3"
                      >
                        <TokenAvatar ticker={s.token.ticker} logoUrl={s.token.logoUrl} size="sm" />
                        <span>
                          <span className="block font-semibold">${s.token.ticker}</span>
                          <span className="block text-xs text-muted-foreground">
                            {s.token.name}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="num px-4 py-3 text-xs text-muted-foreground">
                      <button
                        className="inline-flex items-center gap-1.5 hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard?.writeText(s.token.address);
                          toast.success("Contract copied");
                        }}
                      >
                        {shortAddress(s.token.address, 6)} <Copy className="size-3" />
                      </button>
                    </td>
                    <td className="num px-4 py-3">{compact(Number(s.token.supply))}</td>
                    <td className="num px-4 py-3">{s.drops}</td>
                    <td className="num px-4 py-3 font-semibold text-primary">
                      {formatNumber(s.wallets)}
                    </td>
                    <td className="num px-4 py-3">{formatNumber(s.uniqueWallets)}</td>
                    <td className="num px-4 py-3 text-warning">{formatNumber(s.activeWallets)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.lastDropAt ? timeAgo(s.lastDropAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() =>
                            navigate({ to: "/airdrop", search: { token: s.token.id } })
                          }
                        >
                          <Gift className="size-3.5" /> Airdrop
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${s.token.ticker}`}
                          onClick={() => {
                            actions.deleteToken(s.token.id);
                            toast(`$${s.token.ticker} removed`);
                          }}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards for mobile */}
          <div className="mt-6 space-y-4 lg:hidden">
            {stats.map((s) => (
              <div key={s.token.id} className="panel p-4">
                <div className="flex items-center gap-3">
                  <TokenAvatar ticker={s.token.ticker} logoUrl={s.token.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">${s.token.ticker}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.token.name}</p>
                  </div>
                  <Badge variant="secondary" className="num">
                    {s.drops} drops
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Sent" value={formatNumber(s.wallets)} tone="primary" />
                  <MiniStat label="Unique" value={formatNumber(s.uniqueWallets)} />
                  <MiniStat label="Active" value={formatNumber(s.activeWallets)} tone="warning" />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => navigate({ to: "/airdrop", search: { token: s.token.id } })}
                  >
                    <Gift className="size-3.5" /> Airdrop
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link to="/tokens/$tokenId" params={{ tokenId: s.token.id }}>
                      Details
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-2">
      <p className="label-caps">{label}</p>
      <p
        className={`num mt-0.5 text-base font-bold ${
          tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
