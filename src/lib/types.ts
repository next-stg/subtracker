export interface User {
  id: number;
  email: string;
  username: string;
  currency: string;
  language: string;
  notification_enabled: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  subscription_count: number;
}

export type SubscriptionFrequency =
  | "monthly"
  | "yearly"
  | "quarterly"
  | "weekly";

export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface Subscription {
  id: number;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  frequency: SubscriptionFrequency;
  start_date: string;
  billing_date: string;
  status: SubscriptionStatus;
  category: number | null;
  category_name: string | null;
  category_color: string | null;
  website: string | null;
  notes: string | null;
  yearly_cost: string;
  monthly_amount_converted: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayload {
  name: string;
  description?: string;
  amount: string;
  currency: string;
  frequency: SubscriptionFrequency;
  start_date: string;
  billing_date: string;
  status: SubscriptionStatus;
  category?: number | null;
  website?: string;
  notes?: string;
}

export interface SubscriptionStats {
  total_monthly: number;
  total_yearly: number;
  subscription_count: number;
  upcoming_renewals: number;
  currency: string;
}

export interface UserPreferences {
  display_currency: string;
  email_notifications: boolean;
  renewal_reminder_days: number;
  language: string;
}

export interface SiteNotification {
  id: string;
  subscription_id: number;
  subscription_name: string;
  billing_date: string;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  days_until: number;
}

export interface AuthResponse {
  user: User;
  refresh: string;
  access: string;
}

export interface ApiErrorBody {
  [field: string]: string[] | string;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(flattenErrors(body));
    this.status = status;
    this.body = body;
  }
}

export function flattenErrors(body: ApiErrorBody): string {
  if (typeof body === "string") return body;
  const messages: string[] = [];
  for (const key of Object.keys(body)) {
    const value = body[key];
    if (Array.isArray(value)) {
      messages.push(...value);
    } else if (typeof value === "string") {
      messages.push(value);
    }
  }
  return messages.length > 0
    ? messages.join(" ")
    : "Une erreur est survenue. Veuillez réessayer.";
}
