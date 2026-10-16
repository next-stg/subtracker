"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, PieChart as PieChartIcon } from "lucide-react";
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

import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import {
  annualEquivalent,
  CATEGORY_COLORS,
  formatMoney,
  monthlyEquivalent,
} from "@/lib/constants";
import type { Subscription } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useExchangeRates } from "@/lib/use-exchange-rates";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(
    null
  );
  const currency = user?.currency ?? "XOF";
  const { convert, isLoading: ratesLoading, error: ratesError } =
    useExchangeRates(currency);

  useEffect(() => {
    api
      .getSubscriptions({ status: "active" })
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }, []);
  const categoryData = useMemo(() => {
    if (!subscriptions) return [];
    const map = new Map<string, number>();
    for (const sub of subscriptions) {
      const key = sub.category_name || "Sans catégorie";
      const monthly = convert(
          monthlyEquivalent(sub.amount, sub.frequency),
          sub.currency,
          currency
        );
      map.set(key, (map.get(key) ?? 0) + monthly);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [subscriptions, convert, currency]);
  const yearlyCost = useMemo(
    () =>
      (subscriptions ?? []).reduce(
        (total, sub) =>
          total +
          convert(
            annualEquivalent(sub.amount, sub.frequency),
            sub.currency,
            currency
          ),
        0
      ),
    [subscriptions, convert, currency]
  );
  const monthlyTrend = useMemo(() => {
    if (!subscriptions) return [];
    const now = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("fr-FR", {
          month: "short",
          year: "2-digit",
        }),
        total: 0,
      });
    }
    for (const sub of subscriptions) {
      const monthly = convert(
        monthlyEquivalent(sub.amount, sub.frequency),
        sub.currency,
        currency
      );
      for (const m of months) {
        const [y, mo] = m.key.split("-").map(Number);
        const monthEnd = `${y}-${String(mo + 1).padStart(2, "0")}-${String(
          new Date(y, mo + 1, 0).getDate()
        ).padStart(2, "0")}`;
        if (sub.start_date <= monthEnd) {
          m.total += monthly;
        }
      }
    }
    return months.map((m) => ({
      month: m.label,
      amount: Math.round(m.total * 100) / 100,
    }));
  }, [subscriptions, convert, currency]);

  const needsConversion =
    subscriptions?.some((sub) => sub.currency !== currency) ?? false;
  const isLoading =
    subscriptions === null || (needsConversion && ratesLoading);
  const conversionError = needsConversion && ratesError;
  const hasData = (subscriptions?.length ?? 0) > 0;

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analyses</h1>
          <p className="text-muted-foreground">
            Projection des coûts de vos abonnements actifs en {currency}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversionError ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
            Conversion des devises indisponible. Les montants ne peuvent pas
            être comparés dans {currency} pour le moment.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Moyenne mensuelle estimée</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatMoney(yearlyCost / 12, currency)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Coût annuel estimé</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatMoney(yearlyCost, currency)}
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Coût mensuel par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {!hasData ? (
                  <EmptyChart icon={PieChartIcon} />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={2}
                        >
                          {categoryData.map((entry, i) => (
                            <Cell
                              key={entry.name}
                              fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: unknown) =>
                            formatMoney(Number((value as number) ?? 0), currency)
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {hasData && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {categoryData.map((entry, i) => (
                      <div
                        key={entry.name}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="truncate text-muted-foreground">
                          {entry.name}
                        </span>
                        <span className="ml-auto shrink-0 font-medium">
                          {formatMoney(entry.value, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Évolution du coût mensuel estimé</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Projection des abonnements actifs depuis leur date de début,
                  pas un historique des paiements.
                </p>
              </CardHeader>
              <CardContent>
                {!hasData ? (
                  <EmptyChart icon={BarChart3} />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyTrend}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: unknown) =>
                            formatMoney(Number((value as number) ?? 0), currency)
                          }
                        />
                        <Bar
                          dataKey="amount"
                          fill="oklch(0.55 0.22 280)"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
function EmptyChart({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className="size-8 opacity-40" />
      <p className="text-sm">Aucune donnée disponible pour l&apos;analyse</p>
    </div>
  );
}
