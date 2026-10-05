import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Download, Gift, Loader2, Radar, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, EmptyState, StatCard } from "@/components/memex/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  compact,
  formatNumber,
  generateHolders,
  isValidAddress,
  shortAddress,
  useMemex,
} from "@/lib/memex-store";

export const Route = createFileRoute("/search-wallets")({
  head: () => ({
    meta: [
      { title: "Search Wallets — Find Every Holder of a Token | MemeX" },
      {
        name: "description",
        content:
          "Paste any token contract address and pull the full holder wallet list with balances and share, then copy every address in one click.",
      },
      { property: "og:title", content: "Search Wallets — MemeX" },
      {
        property: "og:description",
        content: "Scan a contract address for holder wallets and copy them all for your airdrop.",
      },
    ],
  }),
  component: SearchWalletsPage,
});

type Holder = { address: string; balance: number; firstSeen: number; share: number };

function SearchWalletsPage() {
  const state = useMemex();
  const navigate = useNavigate();
  const [ca, setCa] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const run = () => {
    const value = ca.trim();
    if (!isValidAddress(value)) {
      toast.error("Enter a valid token contract address (32–44 chars)");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const count = 40 + (value.length % 7) * 12;
      setHolders(generateHolders(value, count));
      setScanned(value);
      setSelected(new Set());
      setLoading(false);
      toast.success(`${count} holder wallets found`);
    }, 1100);
  };

  const copyAll = (list: string[], label: string) => {
    navigator.clipboard?.writeText(list.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1800);
    toast.success(`${list.length} ${label} copied`);
  };

  const toggle = (address: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });

  const totalSupplyHeld = holders.reduce((s, h) => s + h.balance, 0);
  const top10 = holders.slice(0, 10).reduce((s, h) => s + h.share, 0);
  const selectedList = holders.filter((h) => selected.has(h.address)).map((h) => h.address);

  return (
    <AppShell
      title="Search Wallets"
      subtitle="Paste any token contract address (CA) to pull its holder wallets, then copy them straight into an airdrop."
    >
      <div className="panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="num pl-9"
              placeholder="Enter token contract address (CA)"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>
          <Button className="gap-2 font-semibold" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
            {loading ? "Scanning…" : "Search"}
          </Button>
        </div>
        {state.tokens.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label-caps">Your tokens:</span>
            {state.tokens.map((t) => (
              <button
                key={t.id}
                onClick={() => setCa(t.address)}
                className="rounded-lg border border-border bg-elevated px-2.5 py-1 text-xs transition-colors hover:bg-secondary"
              >
                ${t.ticker}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!scanned ? (
        <div className="mt-6">
          <EmptyState
            title="No scan yet"
            body="Enter a contract address and hit Search. Every wallet holding that token is listed with balance and supply share."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Holder wallets" value={formatNumber(holders.length)} tone="primary" />
            <StatCard label="Tokens held" value={compact(totalSupplyHeld)} />
            <StatCard label="Top 10 concentration" value={`${top10.toFixed(1)}%`} tone="warning" />
            <StatCard label="Selected" value={formatNumber(selected.size)} />
          </div>

          <div className="panel mt-6 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <p className="label-caps">Scanned contract</p>
                <p className="num truncate text-xs text-muted-foreground">{scanned}</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  className="gap-2 font-semibold"
                  onClick={() => copyAll(holders.map((h) => h.address), "wallet addresses")}
                >
                  {copiedAll ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copy all {holders.length}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!selectedList.length}
                  onClick={() => copyAll(selectedList, "selected wallets")}
                >
                  <Copy className="size-4" /> Copy selected
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const csv = [
                      "wallet,balance,share_percent",
                      ...holders.map((h) => `${h.address},${h.balance},${h.share.toFixed(4)}`),
                    ].join("\n");
                    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "holders.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Holders exported");
                  }}
                >
                  <Download className="size-4" /> CSV
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    copyAll(
                      (selectedList.length ? selectedList : holders.map((h) => h.address)),
                      "wallets",
                    );
                    navigate({ to: "/airdrop" });
                  }}
                >
                  <Gift className="size-4" /> Use in airdrop
                </Button>
              </div>
            </div>

            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border">
                    <th className="label-caps px-4 py-3 text-left font-medium">#</th>
                    <th className="label-caps px-4 py-3 text-left font-medium">Wallet</th>
                    <th className="label-caps px-4 py-3 text-right font-medium">Balance</th>
                    <th className="label-caps px-4 py-3 text-right font-medium">Share</th>
                    <th className="label-caps px-4 py-3 text-right font-medium">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {holders.map((h, i) => (
                    <tr
                      key={h.address}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/50"
                    >
                      <td className="num px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="num px-4 py-2.5 text-xs">
                        <button
                          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard?.writeText(h.address);
                            toast.success("Wallet copied");
                          }}
                        >
                          {shortAddress(h.address, 8)} <Copy className="size-3" />
                        </button>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{formatNumber(h.balance)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={h.share > 3 ? "default" : "secondary"} className="num">
                          {h.share.toFixed(2)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => toggle(h.address)}
                          className={`grid size-5 place-items-center rounded border transition-colors ${
                            selected.has(h.address)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border"
                          }`}
                          aria-label={`Select ${h.address}`}
                        >
                          {selected.has(h.address) ? <Check className="size-3" /> : null}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
