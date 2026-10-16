"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Plus,
  Wallet,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ServiceLogo } from "@/components/service-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { annualEquivalent, formatMoney } from "@/lib/constants";
import { useExchangeRates } from "@/lib/use-exchange-rates";
import type { Subscription, SubscriptionStats } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(
    null
  );
  const displayCurrency = user?.currency ?? "XOF";
  const { convert } = useExchangeRates(displayCurrency);
  useEffect(() => {
    Promise.all([api.getStats(), api.getSubscriptions({ status: "active" })])
      .then(([s, subs]) => {
        setStats(s);
        setSubscriptions(subs);
      })
      .catch(() => {
        setStats(null);
        setSubscriptions([]);
      });
  }, []);

  const [now] = useState(() => Date.now());

  const totals = useMemo(() => {
    if (!subscriptions) return null;
    const yearly = subscriptions.reduce(
      (sum, sub) =>
        sum +
        convert(
          annualEquivalent(sub.amount, sub.frequency),
          sub.currency,
          displayCurrency
        ),
      0
    );
    return { monthly: yearly / 12, yearly };
  }, [subscriptions, convert, displayCurrency]);

  const recent = [...(subscriptions ?? [])]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  const upcoming = [...(subscriptions ?? [])]
    .filter((s) => {
      const days = (new Date(s.billing_date).getTime() - now) / 86_400_000;
      return days >= 0 && days <= 30;
    })
    .sort(
      (a, b) =>
        new Date(a.billing_date).getTime() - new Date(b.billing_date).getTime()
    )
    .slice(0, 5);

  const nextRenewal = upcoming[0];
  const daysUntilNextRenewal = nextRenewal
    ? Math.ceil((new Date(nextRenewal.billing_date).getTime() - now) / 86_400_000)
    : null;
  const isLoading = stats === null && subscriptions === null;

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Bannière hero */}
            <Card className="overflow-hidden border-none py-0">
              <div className="relative bg-linear-to-br from-[oklch(0.5_0.22_280)] via-[oklch(0.5_0.2_300)] to-[oklch(0.55_0.2_330)] px-6 py-8 text-white sm:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <Badge className="mb-3 border-white/20 bg-white/15 text-white">
                      Résumé
                    </Badge>
                    <h1 className="max-w-md text-2xl font-bold sm:text-3xl">
                      Prenez le contrôle de vos dépenses numériques
                    </h1>
                    <p className="mt-2 max-w-md text-white/85">
                      Vous avez {stats?.subscription_count ?? 0} abonnement(s)
                      actif(s) pour{" "}
                      {formatMoney(totals?.monthly ?? 0, displayCurrency)} par
                      mois.
                      {nextRenewal &&
                        ` Le prochain renouvellement est ${
                          (daysUntilNextRenewal ?? 0) <= 0
                            ? "aujourd'hui"
                            : `dans ${daysUntilNextRenewal} jours`
                        }.`}
                    </p>
                    <div className="mt-5 flex gap-3">
                      <Button variant="secondary" asChild>
                        <Link href="/subscriptions">
                          <Plus className="size-4" />
                          Ajouter un abonnement
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                        asChild
                      >
                        <Link href="/analytics">Voir les analyses</Link>
                      </Button>
                    </div>
                  </div>

                  {nextRenewal && (
                    <div className="w-full max-w-xs rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                      <p className="mb-2 text-xs uppercase tracking-wide text-white/70">
                        Prochain renouvellement
                      </p>
                      <div className="flex items-center gap-3">
                        <ServiceLogo
                          name={nextRenewal.name}
                          color={nextRenewal.category_color}
                          className="size-10"
                        />
                        <div>
                          <p className="font-semibold">{nextRenewal.name}</p>
                          <p className="text-sm text-white/80">
                            {formatMoney(
                              nextRenewal.amount,
                              nextRenewal.currency
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Wallet}
                label="Coût mensuel"
                value={formatMoney(totals?.monthly ?? 0, displayCurrency)}
                accent="text-primary bg-primary/10"
              />
              <StatCard
                icon={Banknote}
                label="Coût annuel"
                value={formatMoney(totals?.yearly ?? 0, displayCurrency)}
                accent="text-emerald-600 bg-emerald-500/10"
              />
              <StatCard
                icon={CheckCircle2}
                label="Abonnements actifs"
                value={String(stats?.subscription_count ?? 0)}
                accent="text-violet-600 bg-violet-500/10"
              />
              <StatCard
                icon={Clock}
                label="Renouvellements"
                value={String(stats?.upcoming_renewals ?? 0)}
                sub="dans les 7 prochains jours"
                accent="text-amber-600 bg-amber-500/10"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="gap-0 overflow-hidden py-0">
                <div className="border-b px-6 py-4">
                  <p className="font-semibold">Abonnements récents</p>
                  <p className="text-sm text-muted-foreground">
                    Vos derniers abonnements ajoutés
                  </p>
                </div>
                <CardContent className="flex flex-col gap-1 py-4">
                  {recent.length === 0 ? (
                    <EmptyRow />
                  ) : (
                    recent.map((sub) => (
                      <SubRow
                        key={sub.id}
                        sub={sub}
                        currency={displayCurrency}
                        convert={convert}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="gap-0 overflow-hidden py-0">
                <div className="border-b px-6 py-4">
                  <p className="font-semibold">Prochains renouvellements</p>
                  <p className="text-sm text-muted-foreground">
                    À venir dans les 30 jours
                  </p>
                </div>
                <CardContent className="flex flex-col gap-1 py-4">
                  {upcoming.length === 0 ? (
                    <EmptyRow label="Aucun renouvellement à venir" />
                  ) : (
                    upcoming.map((sub) => (
                      <SubRow
                        key={sub.id}
                        sub={sub}
                        currency={displayCurrency}
                        convert={convert}
                        showDate
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Link
                href="/subscriptions"
                className="text-sm font-medium text-primary hover:underline"
              >
                Voir tous les abonnements →
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <Card className="py-5">
      <CardContent className="flex items-start gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SubRow({
  sub,
  currency,
  convert,
  showDate,
}: {
  sub: Subscription;
  currency: string;
  convert: (amount: number, from: string, to: string) => number;
  showDate?: boolean;
}) {
  const amount = convert(parseFloat(sub.amount), sub.currency, currency);
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
      <ServiceLogo
        name={sub.name}
        color={sub.category_color}
        className="size-8 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{sub.name}</p>
        {showDate && (
          <p className="text-xs text-muted-foreground">
            {new Date(sub.billing_date).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>
      <p className="shrink-0 text-sm font-semibold">
        {formatMoney(amount, currency)}
      </p>
    </div>
  );
}

function EmptyRow({ label = "Rien à afficher pour le moment" }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <Inbox className="size-6" />
      {label}
    </div>
  );
}
