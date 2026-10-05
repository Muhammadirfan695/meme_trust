import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Copy, Gift, Globe, MessageCircle, Send, Twitter } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState, StatCard, TokenAvatar } from "@/components/memex/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  compact,
  formatNumber,
  shortAddress,
  timeAgo,
  tokenStats,
  useMemex,
} from "@/lib/memex-store";

export const Route = createFileRoute("/tokens/$tokenId")({
  head: () => ({
    meta: [
      { title: "Token Details — Airdrop Reach & Holders | MemeX" },
      {
        name: "description",
        content:
          "Full metadata, socials, airdrop batches and recipient wallets for a token launched on MemeX.",
      },
      { property: "og:title", content: "Token Details — MemeX" },
      {
        property: "og:description",
        content: "Metadata, airdrop batches and recipient wallets for your MemeX token.",
      },
    ],
  }),
  component: TokenDetailPage,
});

function TokenDetailPage() {
  const { tokenId } = useParams({ from: "/tokens/$tokenId" });
  const state = useMemex();
  const navigate = useNavigate();
  const token = state.tokens.find((t) => t.id === tokenId);

  if (!token) {
    return (
      <AppShell title="Token not found" subtitle="This token is no longer in your workspace.">
        <EmptyState
          title="Nothing here"
          body="The token may have been removed. Head back to your created coins list."
          action={
            <Button asChild>
              <Link to="/tokens">Back to tokens</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const s = tokenStats(state, token);
  const drops = state.airdrops.filter((a) => a.tokenId === token.id);
  const socials = [
    { label: "Website", url: token.website, icon: Globe },
    { label: "X", url: token.twitter, icon: Twitter },
    { label: "Telegram", url: token.telegram, icon: Send },
    { label: "Discord", url: token.discord, icon: MessageCircle },
  ].filter((x) => x.url);

  return (
    <AppShell
      title={`$${token.ticker}`}
      subtitle={token.name}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/tokens">
              <ArrowLeft className="size-4" /> All tokens
            </Link>
          </Button>
          <Button
            className="gap-2"
            onClick={() => navigate({ to: "/airdrop", search: { token: token.id } })}
          >
            <Gift className="size-4" /> Airdrop this token
          </Button>
        </div>
      }
    >
      <div className="panel overflow-hidden">
        <div className="signal-wash h-28">
          {token.bannerUrl ? (
            <img src={token.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="p-5">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <TokenAvatar ticker={token.ticker} logoUrl={token.logoUrl} size="lg" />
            <div className="pb-1">
              <p className="font-display text-xl font-bold leading-none">{token.name}</p>
              <button
                className="num mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  navigator.clipboard?.writeText(token.address);
                  toast.success("Contract copied");
                }}
              >
                {shortAddress(token.address, 8)} <Copy className="size-3" />
              </button>
            </div>
            <div className="ml-auto flex flex-wrap gap-2 pb-1">
              <Badge variant="secondary" className="capitalize">
                {token.chain}
              </Badge>
              <Badge variant={token.revokeMint ? "default" : "outline"}>
                {token.revokeMint ? "Mint revoked" : "Mint open"}
              </Badge>
              <Badge variant={token.burnLp ? "default" : "outline"}>
                {token.burnLp ? "LP burned" : "LP live"}
              </Badge>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{token.description}</p>
          {socials.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {socials.map((sc) => (
                <a
                  key={sc.label}
                  href={sc.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
                >
                  <sc.icon className="size-3.5" /> {sc.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Supply" value={compact(Number(token.supply))} hint={`${token.decimals} decimals`} />
        <StatCard label="Wallets airdropped" value={formatNumber(s.wallets)} tone="primary" />
        <StatCard label="Unique wallets" value={formatNumber(s.uniqueWallets)} />
        <StatCard label="Wallets transacted" value={formatNumber(s.activeWallets)} tone="warning" />
      </div>

      <h2 className="mt-8 font-display text-lg font-bold">Airdrop batches</h2>
      {!drops.length ? (
        <div className="mt-3">
          <EmptyState
            title="No airdrops yet"
            body="Send this token to one wallet or thousands in bulk from the airdrop page."
            action={
              <Button onClick={() => navigate({ to: "/airdrop", search: { token: token.id } })}>
                Start an airdrop
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {drops.map((d) => (
            <div key={d.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold">{d.note || "Untitled batch"}</p>
                <span className="label-caps">{timeAgo(d.createdAt)}</span>
                <Badge variant="secondary" className="num ml-auto">
                  {d.recipients.length} wallets
                </Badge>
              </div>
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <tbody>
                    {d.recipients.map((r, i) => (
                      <tr key={`${d.id}-${i}`} className="border-b border-border/50 last:border-0">
                        <td className="num px-3 py-2 text-muted-foreground">
                          {shortAddress(r.address, 6)}
                        </td>
                        <td className="num px-3 py-2 text-right">{formatNumber(Number(r.amount))}</td>
                        <td className="px-3 py-2 text-right">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {r.claimed ? "Transacted" : "Idle"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export function StatusPill({ status }: { status: "confirmed" | "pending" | "failed" }) {
  const map = {
    confirmed: "border-primary/40 bg-accent text-accent-foreground",
    pending: "border-warning/40 bg-warning/10 text-warning",
    failed: "border-danger/40 bg-danger/10 text-danger",
  } as const;
  return (
    <span
      className={`num inline-flex rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status]}`}
    >
      {status}
    </span>
  );
}
