"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  ExternalLink,
  LayoutGrid,
  Loader2,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ServiceLogo } from "@/components/service-logo";
import { SubscriptionFormDialog } from "@/components/subscription-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  CATEGORY_COLORS,
  FREQUENCY_LABELS,
  STATUS_LABELS,
  formatMoney,
} from "@/lib/constants";
import type { Category, Subscription, SubscriptionPayload } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(
    null
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [subs, cats] = await Promise.all([
        api.getSubscriptions({
          status: statusFilter,
          category:
            categoryFilter !== "all" ? Number(categoryFilter) : undefined,
        }),
        api.getCategories(),
      ]);
      setSubscriptions(subs);
      setCategories((current) => {
        const loadedIds = new Set(cats.map((category) => category.id));
        return [
          ...cats,
          ...current.filter((category) => !loadedIds.has(category.id)),
        ];
      });
    } catch {
      setError("Impossible de charger les abonnements.");
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial des données depuis l'API
    load();
  }, [load]);

  async function handleSubmit(payload: SubscriptionPayload) {
    if (editing) {
      await api.updateSubscription(editing.id, payload);
    } else {
      await api.createSubscription(payload);
    }
    await load();
  }

  async function handleCreateCategory(name: string) {
    const category = await api.createCategory({
      name,
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
    });
    setCategories((current) =>
      current.some((item) => item.id === category.id)
        ? current
        : [...current, category]
    );
    await load();
    return category;
  }

  async function handleDelete(subscription: Subscription) {
    if (
      !window.confirm(
        `Supprimer « ${subscription.name} » ? Cette action est définitive.`
      )
    )
      return;
    await api.deleteSubscription(subscription.id);
    await load();
  }
   return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Mes Abonnements
            </h1>
            <p className="text-muted-foreground">
              Gérez tous vos abonnements en un seul endroit
            </p>
          </div>
          <Button
            variant="gradient"
            onClick={() => {
              setEditing(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Nouvel abonnement
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="px-3 py-1.5 text-sm">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
            {subscriptions?.length ?? 0} abonnement(s)
          </Badge>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              className="w-44"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              className="w-44"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div
              className="inline-flex rounded-md border bg-background p-1"
              role="group"
              aria-label="Type d'affichage"
            >
              <Button
                type="button"
                size="icon"
                variant={displayMode === "list" ? "secondary" : "ghost"}
                aria-label="Affichage en liste"
                aria-pressed={displayMode === "list"}
                title="Affichage en liste"
                onClick={() => setDisplayMode("list")}
              >
                <List className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={displayMode === "grid" ? "secondary" : "ghost"}
                aria-label="Affichage en grille"
                aria-pressed={displayMode === "grid"}
                title="Affichage en grille"
                onClick={() => setDisplayMode("grid")}
              >
                <LayoutGrid className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!subscriptions ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : subscriptions.length === 0 ? (
          <Card className="items-center py-16 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="size-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Aucun abonnement</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Commencez par ajouter votre premier abonnement pour suivre vos
              dépenses.
            </p>
          </Card>
        ) : (
          <div
            className={
              displayMode === "list"
                ? "divide-y overflow-hidden rounded-md border"
                : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {subscriptions.map((sub) =>
              displayMode === "list" ? (
                <article
                  key={sub.id}
                  className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                    <ServiceLogo
                      name={sub.name}
                      color={sub.category_color}
                      className="size-10 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate font-semibold leading-tight">
                          {sub.name}
                        </p>
                        <Badge
                          variant={
                            sub.status === "active" ? "success" : "secondary"
                          }
                        >
                          {STATUS_LABELS[sub.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sub.category_name || "Sans catégorie"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
                    <div>
                      <p className="font-semibold">
                        {formatMoney(sub.amount, sub.currency)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          / {FREQUENCY_LABELS[sub.frequency].toLowerCase()}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Prochain prélèvement :{" "}
                        {new Date(sub.billing_date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {sub.website && (
                        <a
                          href={sub.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={`Ouvrir le site de ${sub.name}`}
                          title="Ouvrir le site"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Modifier ${sub.name}`}
                        title="Modifier"
                        onClick={() => {
                          setEditing(sub);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Supprimer ${sub.name}`}
                        title="Supprimer"
                        onClick={() => handleDelete(sub)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </article>
              ) : (
                <Card key={sub.id} className="gap-3 py-5">
                  <div className="flex items-start justify-between px-6">
                    <div className="flex items-center gap-3">
                      <ServiceLogo
                        name={sub.name}
                        color={sub.category_color}
                        className="size-10"
                      />
                      <div>
                        <p className="font-semibold leading-tight">
                          {sub.name}
                        </p>
                        {sub.category_name && (
                          <p className="text-xs text-muted-foreground">
                            {sub.category_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={sub.status === "active" ? "success" : "secondary"}
                    >
                      {STATUS_LABELS[sub.status]}
                    </Badge>
                  </div>

                  <div className="px-6">
                    <p className="text-2xl font-bold">
                      {formatMoney(sub.amount, sub.currency)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        / {FREQUENCY_LABELS[sub.frequency].toLowerCase()}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prochain prélèvement :{" "}
                      {new Date(sub.billing_date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 border-t px-6 pt-3">
                    {sub.website && (
                      <a
                        href={sub.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Ouvrir le site de ${sub.name}`}
                        title="Ouvrir le site"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <div className="ml-auto flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Modifier ${sub.name}`}
                        title="Modifier"
                        onClick={() => {
                          setEditing(sub);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Supprimer ${sub.name}`}
                        title="Supprimer"
                        onClick={() => handleDelete(sub)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            )}
          </div>
        )}
      </div>

      <SubscriptionFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categories={categories}
        defaultCurrency={user?.currency ?? "XOF"}
        editing={editing}
        onSubmit={handleSubmit}
        onCreateCategory={handleCreateCategory}
      />
    </DashboardShell>
  );
}
