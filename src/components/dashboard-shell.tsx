"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  Loader2,
  LineChart,
  LogOut,
  Settings,
  HelpCircle,
} from "lucide-react";

import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subscriptions", label: "Abonnements", icon: CreditCard },
  { href: "/analytics", label: "Analyses", icon: LineChart },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Vue d'ensemble",
  "/subscriptions": "Abonnements",
  "/analytics": "Analyses",
  "/settings": "Paramètres",
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card px-4 py-6 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-[oklch(0.55_0.22_280)] to-[oklch(0.6_0.2_320)] text-white shadow-md">
            <CreditCard className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">SubTracker</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t pt-3">
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() =>
              window.open("mailto:support@subtracker.app", "_blank")
            }
          >
            <HelpCircle className="size-4" />
            Support
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={async () => {
              await logout();
              router.push("/");
            }}
          >
            <LogOut className="size-4" />
            Déconnexion
          </button>
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-[oklch(0.55_0.22_280)] to-[oklch(0.6_0.2_320)] text-white">
              <CreditCard className="size-4" />
            </div>
            <span className="text-sm font-semibold">SubTracker</span>
          </div>
          <p className="hidden text-sm text-muted-foreground lg:block">
            <span className="text-foreground">Dashboard</span> /{" "}
            {PAGE_TITLES[pathname] ?? "Vue d'ensemble"}
          </p>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <NotificationBell />
            <div className="hidden items-center gap-2 pl-2 sm:flex">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium">{user.username}</p>
              </div>
            </div>
          </div>
        </header>
        <nav className="flex items-center gap-1 overflow-x-auto border-b bg-card px-3 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                pathname === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
