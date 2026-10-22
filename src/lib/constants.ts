import type {
  SubscriptionFrequency,
  SubscriptionStatus,
} from "@/lib/types";

export const CURRENCIES = [
  { value: "XOF", label: "Franc CFA (XOF)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "Dollar US ($)" },
  { value: "GBP", label: "Livre sterling (£)" },
];

export const DELETED_SUBSCRIPTION_RETENTION_DAYS = 30;

export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  monthly: "Mensuel",
  yearly: "Annuel",
  quarterly: "Trimestriel",
  weekly: "Hebdomadaire",
};

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Actif",
  paused: "En pause",
  cancelled: "Annulé",
};

export const CATEGORY_COLORS = [
  "#6D28D9",
  "#DB2777",
  "#0EA5E9",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
];

export function annualEquivalent(
  amount: number | string,
  frequency: SubscriptionFrequency
) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return 0;
  switch (frequency) {
    case "monthly":
      return value * 12;
    case "quarterly":
      return value * 4;
    case "weekly":
      return value * 52;
    case "yearly":
      return value;
  }
}

export function monthlyEquivalent(
  amount: number | string,
  frequency: SubscriptionFrequency
) {
  return annualEquivalent(amount, frequency) / 12;
}

export function formatMoney(amount: number | string, currency: string) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  if (currency === "XOF") {
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(value)} fcfa`;
  }
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
