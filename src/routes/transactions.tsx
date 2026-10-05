import { Loader2 } from "lucide-react";
import { formatUnits } from "ethers";
import { claimDust, dustTxUrl } from "@/lib/web3/transfers";
import { readDust, web3Error } from "@/lib/web3/bsc-testnet";
import { actions } from "@/lib/memex-store";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Gift,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, EmptyState, StatCard, TokenAvatar } from "@/components/memex/shell";
import { StatusPill } from "./tokens.$tokenId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, shortAddress, useMemex } from "@/lib/memex-store";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transaction History — Airdrop Receipts | MemeX" },
      {
        name: "description",
        content:
          "Step 3 — every airdrop transaction with recipient wallet, amount, status and hash, filterable by token.",
      },
      { property: "og:title", content: "Transaction History — MemeX" },
      {
        property: "og:description",
        content: "Full airdrop receipt log across every token you launched on MemeX.",
      },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const state = useMemex();
  const navigate = useNavigate();
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [claiming, setClaiming] = useState("");
  const [pendingClaims, setPendingClaims] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const addresses = [
    ...new Set(
      state.airdrops
        .filter((a) => a.tokenId === "tk_dust_testnet")
        .flatMap((a) => a.recipients.map((r) => r.address)),
    ),
  ].join(",");
  useEffect(() => {
    let active = true;
    setBalances({});
    if (addresses)
      void (async () => {
        try {
          const { provider, token, decimals } = await readDust();
          try {
            const results = await Promise.allSettled(
              addresses.split(",").map(async (address) => {
                const balance = formatUnits(
                  await token.getFunction("balanceOf")(address),
                  decimals,
                );
                if (active) setBalances((old) => ({ ...old, [address]: balance }));
              }),
            );
            if (active && results.some((result) => result.status === "rejected"))
              toast.error("Some wallet balances could not be loaded. Please try again.");
          } finally {
            provider.destroy();
          }
        } catch {
          if (active) toast.error("Unable to connect to BSC Testnet. Please try again.");
        }
      })();
    return () => {
      active = false;
    };
  }, [addresses, refresh]);
  const claim = async (address: string) => {
    setClaiming(address);
    try {
      const result = await claimDust(address, balances[address]!);
      actions.recordClaim(address, result.txHash);
      toast.success("Assets Claimed Successfully");
      setRefresh((value) => value + 1);
    } catch (error) {
      const hash = (error as { txHash?: string }).txHash;
      if (hash) setPendingClaims((old) => ({ ...old, [address]: hash }));
      toast.error(web3Error(error));
    } finally {
      setClaiming("");
    }
  };
  const [tokenFilter, setTokenFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"recent" | "large">("recent");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const list = state.airdrops
      .filter((a) => a.tokenId === "tk_dust_testnet")
      .filter((a) => tokenFilter === "all" || a.tokenId === tokenFilter)
      .flatMap((a) =>
        a.recipients.map((r) => ({
          ...r,
          batchId: a.id,
          note: a.note,
          createdAt: a.createdAt,
          token: state.tokens.find((t) => t.id === a.tokenId),
        })),
      )
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => (q.trim() ? r.address.toLowerCase().includes(q.trim().toLowerCase()) : true));
    return list.sort((a, b) =>
      view === "large" ? Number(b.amount || 0) - Number(a.amount || 0) : b.createdAt - a.createdAt,
    );
  }, [state, tokenFilter, statusFilter, q, view]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const transacted = rows.filter((r) => r.claimed).length;
  const volume = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const exportCsv = () => {
    const csv = [
      "token,wallet,amount,status,transacted,tx_hash,sent_at",
      ...rows.map((r) =>
        [
          r.token?.ticker ?? "",
          r.address,
          r.amount,
          r.status,
          r.claimed ? "yes" : "no",
          r.txHash,
          new Date(r.createdAt).toISOString(),
        ].join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "memex-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <AppShell
      title="Transaction History"
      subtitle="Step 3 — every airdrop send, which wallet received it, and whether that wallet has since transacted."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!rows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button className="gap-2" onClick={() => navigate({ to: "/airdrop" })}>
            <Gift className="size-4" /> New airdrop
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Transactions" value={formatNumber(rows.length)} tone="primary" />
        <StatCard label="Confirmed" value={formatNumber(confirmed)} />
        <StatCard label="Wallets transacted" value={formatNumber(transacted)} tone="warning" />
        <StatCard label="Tokens distributed" value={formatNumber(volume)} />
      </div>

      <div className="panel mt-6 flex flex-col gap-3 p-3 xl:flex-row xl:items-center">
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant={view === "recent" ? "default" : "outline"}
            onClick={() => {
              setView("recent");
              setPage(1);
            }}
          >
            Recent transactions
          </Button>
          <Button
            size="sm"
            variant={view === "large" ? "default" : "outline"}
            onClick={() => {
              setView("large");
              setPage(1);
            }}
          >
            Large balance
          </Button>
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="num pl-9"
            placeholder="Search wallet"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={tokenFilter}
          onValueChange={(value) => {
            setTokenFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="xl:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tokens</SelectItem>
            {state.tokens
              .filter((t) => t.id === "tk_dust_testnet")
              .map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  ${t.ticker}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="xl:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal className="size-4" /> Filter
        </Button>
      </div>

      {!rows.length ? (
        <div className="mt-6">
          <EmptyState
            title="No transactions yet"
            body="Run an airdrop and every send will be logged here with its status and hash."
            action={<Button onClick={() => navigate({ to: "/airdrop" })}>Go to airdrop</Button>}
          />
        </div>
      ) : (
        <div className="panel mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/40">
                  {[
                    "Token",
                    "Wallet",
                    "Airdropped",
                    "Status",
                    "Wallet activity",
                    "Total balance (asset)",
                    "Claim",
                  ].map((h) => (
                    <th
                      key={h}
                      className="label-caps whitespace-nowrap px-4 py-3 text-left font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => {
                  const assetBalance = balances[r.address];
                  return (
                    <tr
                      key={`${r.batchId}-${i}`}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TokenAvatar
                            ticker={r.token?.ticker ?? "?"}
                            logoUrl={r.token?.logoUrl}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold">${r.token?.ticker ?? "—"}</p>
                            <p className="label-caps mt-0.5">{r.token?.chain ?? "chain"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="num px-4 py-3 text-xs text-muted-foreground">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard?.writeText(r.address);
                            toast.success("Wallet copied");
                          }}
                        >
                          {shortAddress(r.address, 6)} <Copy className="size-3" />
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="num font-medium">{formatNumber(Number(r.amount))}</p>
                        <p className="label-caps mt-0.5">${r.token?.ticker ?? "token"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                        {r.txHash ? (
                          <a
                            className="block mt-1 text-xs text-primary"
                            href={dustTxUrl(r.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {shortAddress(r.txHash, 6)}
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.claimed ? (
                          <span className="font-medium text-primary">Transacted</span>
                        ) : (
                          <span className="text-muted-foreground">Holding / idle</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="num font-medium">{assetBalance ?? "—"}</p>
                        <p className="label-caps mt-0.5">{r.token?.ticker ?? "asset"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={
                            !!claiming ||
                            !!pendingClaims[r.address] ||
                            !assetBalance ||
                            Number(assetBalance) <= 0
                          }
                          onClick={() => void claim(r.address)}
                        >
                          {claiming === r.address ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Gift className="size-3.5" />
                          )}{" "}
                          Claim
                        </Button>
                        {r.claimTxHash ? (
                          <a
                            className="block mt-1 text-xs text-primary"
                            href={dustTxUrl(r.claimTxHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {shortAddress(r.claimTxHash, 6)}
                          </a>
                        ) : null}
                        {pendingClaims[r.address] ? (
                          <a
                            className="block mt-1 text-xs text-primary"
                            href={dustTxUrl(pendingClaims[r.address]!)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Check pending claim
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {rows.length ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, rows.length)} of {formatNumber(rows.length)}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              {Array.from({ length: Math.min(pageCount, 3) }, (_, index) => index + 1).map(
                (number) => (
                  <Button
                    key={number}
                    variant={number === currentPage ? "default" : "outline"}
                    size="icon"
                    className="size-7 text-xs"
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                disabled={currentPage === pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
