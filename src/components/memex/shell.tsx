import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Coins,
  Gift,
  LayoutDashboard,
  Menu,
  Radar,
  Rocket,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { ConnectWalletButton } from "@/components/memex/wallet-connect";
import { cn } from "@/lib/utils";
import { useMemex } from "@/lib/memex-store";

const NAV = [
  { to: "/", label: "Launchpad", icon: Rocket },
  { to: "/tokens", label: "My Tokens", icon: Coins },
  { to: "/airdrop", label: "Airdrop", icon: Gift },
  { to: "/transactions", label: "Transactions", icon: Activity },
  { to: "/search-wallets", label: "Search Wallets", icon: Radar },
  { to: "/analytics", label: "Analytics", icon: LayoutDashboard },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function WalletButton() {
  return <ConnectWalletButton />;
}

export function AppShell({
  children,
  title,
  subtitle,
  actions: headerActions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const { tokens, airdrops } = useMemex();

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setMenuOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(item.to)
              ? "bg-accent text-accent-foreground glow-ring"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar p-4 lg:flex">
          <BrandMark />
          <div className="mt-6 flex-1">{nav}</div>
          <div className="panel signal-wash mt-4 p-3">
            <p className="label-caps">Workspace</p>
            <p className="num mt-1 text-sm">
              {tokens.length} tokens · {airdrops.length} drops
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
              <button
                className="rounded-lg border border-border p-2 lg:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </button>
              <div className="lg:hidden">
                <BrandMark compact />
              </div>
              <div className="ml-auto">
                <WalletButton />
              </div>
            </div>
          </header>

          {menuOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-background/80"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute left-0 top-0 h-full w-72 border-r border-border bg-sidebar p-4">
                <div className="flex items-center justify-between">
                  <BrandMark />
                  <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="mt-6">{nav}</div>
              </div>
            </div>
          ) : null}

          <main className="px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
                  {subtitle ? (
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
                  ) : null}
                </div>
                {headerActions}
              </div>
              <div className="mt-6">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl border border-primary/40 bg-accent text-accent-foreground glow-ring">
        <Rocket className="size-4" />
      </span>
      <span className={cn(compact && "hidden sm:block")}>
        <span className="block font-display text-base font-bold leading-none">MemeX</span>
        <span className="label-caps">Launch · Airdrop</span>
      </span>
    </Link>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "warning";
}) {
  return (
    <div className="panel p-4">
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          "num mt-2 text-2xl font-bold",
          tone === "primary" && "text-primary",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TokenAvatar({
  ticker,
  logoUrl,
  size = "md",
}: {
  ticker: string;
  logoUrl?: string | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const cls = size === "lg" ? "size-14 text-lg" : size === "sm" ? "size-8 text-[11px]" : "size-10 text-sm";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${ticker} logo`}
        className={cn(cls, "rounded-full border border-border object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        cls,
        "grid shrink-0 place-items-center rounded-full border border-primary/30 bg-accent font-display font-bold text-accent-foreground",
      )}
    >
      {ticker.replace("$", "").slice(0, 3).toUpperCase()}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-border bg-elevated">
        <Coins className="size-5 text-muted-foreground" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
