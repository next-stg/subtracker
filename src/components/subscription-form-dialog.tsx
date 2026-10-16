"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES, FREQUENCY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { ApiError } from "@/lib/types";
import type { Category, Subscription, SubscriptionPayload } from "@/lib/types";

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextBillingDate(startDate: string, frequency: SubscriptionPayload["frequency"]) {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return startDate;

  if (frequency === "weekly") {
    return new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
  }

  const monthsToAdd = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  const monthIndex = year * 12 + month - 1 + monthsToAdd;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function createEmptyForm(defaultCurrency: string): SubscriptionPayload {
  const startDate = formatDateInput(new Date());
  return {
  name: "",
  description: "",
  amount: "",
  currency: defaultCurrency,
  frequency: "monthly",
  start_date: startDate,
  billing_date: nextBillingDate(startDate, "monthly"),
  status: "active",
  category: null,
  website: "",
  notes: "",
  };
}

export function SubscriptionFormDialog({
  open,
  onOpenChange,
  categories,
  defaultCurrency,
  editing,
  onSubmit,
  onCreateCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  defaultCurrency: string;
  editing: Subscription | null;
  onSubmit: (payload: SubscriptionPayload) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
}) {
  const [form, setForm] = useState<SubscriptionPayload>(() => createEmptyForm(defaultCurrency));
  const [billingDateManuallySet, setBillingDateManuallySet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialisation du formulaire à chaque ouverture
    setError(null);
    setCategoryError(null);
    setCategoryName("");
    setIsCategoryFormOpen(false);
    setBillingDateManuallySet(false);
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        amount: editing.amount,
        currency: editing.currency,
        frequency: editing.frequency,
        start_date: editing.start_date,
        billing_date: editing.billing_date,
        status: editing.status,
        category: editing.category,
        website: editing.website ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm(createEmptyForm(defaultCurrency));
    }
  }, [open, editing, defaultCurrency]);
  function update<K extends keyof SubscriptionPayload>(
    key: K,
    value: SubscriptionPayload[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer l'abonnement."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handleCreateCategory() {
    const name = categoryName.trim();
    if (!name) return;
    setCategoryError(null);
    setIsCreatingCategory(true);
    try {
      const category = await onCreateCategory(name);
      update("category", category.id);
      setCategoryName("");
      setIsCategoryFormOpen(false);
    } catch (err) {
      setCategoryError(
        err instanceof ApiError ? err.message : "Impossible de créer la catégorie."
      );
    } finally {
      setIsCreatingCategory(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader
        title={editing ? "Modifier l'abonnement" : "Nouvel abonnement"}
        onClose={() => onOpenChange(false)}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nom</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Netflix, Spotify, …"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Montant</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="currency">Devise</Label>
            <Select
              id="currency"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="frequency">Fréquence</Label>
            <Select
              id="frequency"
              value={form.frequency}
              onChange={(e) => {
                const frequency = e.target.value as SubscriptionPayload["frequency"];
                setForm((current) => ({
                  ...current,
                  frequency,
                  ...(!editing
                    ? { billing_date: nextBillingDate(current.start_date, frequency) }
                    : {}),
                }));
                setBillingDateManuallySet(false);
              }}
            >
              {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Statut</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) =>
                update(
                  "status",
                  e.target.value as SubscriptionPayload["status"]
                )
              }
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="start_date">Date de début</Label>
            <Input
              id="start_date"
              type="date"
              required
              value={form.start_date}
              onChange={(e) => {
                const startDate = e.target.value;
                setForm((current) => ({
                  ...current,
                  start_date: startDate,
                  ...(!editing && !billingDateManuallySet
                    ? { billing_date: nextBillingDate(startDate, current.frequency) }
                    : {}),
                }));
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="billing_date">Prochain prélèvement</Label>
            <Input
              id="billing_date"
              type="date"
              required
              value={form.billing_date}
              onChange={(e) => {
                setBillingDateManuallySet(true);
                update("billing_date", e.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Catégorie</Label>
          <div className="flex gap-2">
            <Select
              id="category"
              className="flex-1"
              value={form.category ?? ""}
              onChange={(e) =>
                update(
                  "category",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">Aucune</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Ajouter une catégorie"
              title="Ajouter une catégorie"
              onClick={() => {
                setCategoryError(null);
                setIsCategoryFormOpen((isOpen) => !isOpen);
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {isCategoryFormOpen && (
            <div className="flex gap-2">
              <Input
                aria-label="Nom de la nouvelle catégorie"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex. Streaming"
                maxLength={80}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!categoryName.trim() || isCreatingCategory}
                onClick={handleCreateCategory}
              >
                {isCreatingCategory && <Loader2 className="size-4 animate-spin" />}
                Créer
              </Button>
            </div>
          )}
          {categoryError && (
            <p className="text-sm text-destructive">{categoryError}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="website">Site web (optionnel)</Label>
          <Input
            id="website"
            type="url"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notes (optionnel)</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
          />
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
