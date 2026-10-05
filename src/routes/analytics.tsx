import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell, EmptyState, StatCard, TokenAvatar } from "@/components/memex/shell";
import { Progress } from "@/components/ui/progress";
import { allStats, compact, formatNumber, timeAgo, useMemex } from "@/lib/memex-store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Airdrop Reach & Wallet Activity | MemeX" },
      {
        name: "description",
        content:
          "Compare airdrop reach across your launched tokens: wallets reached, activity rate and distribution split.",
      },
      { property: "og:title", content: "Analytics — MemeX" },
      {
        property: "og:description",
        content: "Wallet reach, activity rate and distribution charts for every token you launched.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function AnalyticsPage() {
  const state = useMemex();
  const stats = useMemo(() => allStats(state), [state]);

  const barData = stats.map((s) => ({
    name: `$${s.token.ticker}`,
    wallets: s.wallets,
    active: s.activeWallets,
  }));
  const pieData = stats
    .filter((s) => s.totalSent > 0)
    .map((s) => ({ name: `$${s.token.ticker}`, value: s.totalSent }));

  const totals = stats.reduce(
    (a, s) => ({
      wallets: a.wallets + s.wallets,
      active: a.active + s.activeWallets,
      sent: a.sent + s.totalSent,
    }),
    { wallets: 0, active: 0, sent: 0 },
  );
  const rate = totals.wallets ? (totals.active / totals.wallets) * 100 : 0;

  if (!stats.length) {
    return (
      <AppShell title="Analytics" subtitle="Reach and activity across your launches.">
        <EmptyState title="Nothing to chart yet" body="Launch a token and run an airdrop first." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Analytics"
      subtitle="How far each launch travelled and how many recipient wallets actually moved the token."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tokens" value={stats.length} tone="primary" />
        <StatCard label="Wallets reached" value={formatNumber(totals.wallets)} />
        <StatCard label="Active wallets" value={formatNumber(totals.active)} tone="warning" />
        <StatCard label="Activity rate" value={`${rate.toFixed(1)}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-base font-bold">Wallets per token</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="wallets" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-base font-bold">Distribution split</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel mt-6 p-5">
        <h2 className="font-display text-base font-bold">Per-token activity</h2>
        <div className="mt-4 space-y-4">
          {stats.map((s) => {
            const pct = s.wallets ? (s.activeWallets / s.wallets) * 100 : 0;
            return (
              <div key={s.token.id} className="flex items-center gap-4">
                <TokenAvatar ticker={s.token.ticker} logoUrl={s.token.logoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold">${s.token.ticker}</p>
                    <p className="num text-xs text-muted-foreground">
                      {formatNumber(s.activeWallets)}/{formatNumber(s.wallets)} ·{" "}
                      {compact(s.totalSent)} sent
                    </p>
                  </div>
                  <Progress value={pct} className="mt-2" />
                  <p className="label-caps mt-1">
                    {s.lastDropAt ? `last drop ${timeAgo(s.lastDropAt)}` : "no drops yet"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
