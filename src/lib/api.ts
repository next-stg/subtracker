import { ApiError, type ApiErrorBody, type AuthResponse, type SiteNotification, type User } from "@/lib/types";
import type {
  Category,
  Subscription,
  SubscriptionPayload,
  SubscriptionStats,
  UserPreferences,
} from "@/lib/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "";

const ACCESS_KEY = "subtracker_access";
const REFRESH_KEY = "subtracker_refresh";

export const tokenStorage = {
  getAccess(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess(access: string) {
    window.localStorage.setItem(ACCESS_KEY, access);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  { auth = false, retry = true }: { auth?: boolean; retry?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const access = tokenStorage.getAccess();
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && auth && retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, options, { auth, retry: false });
    }
    tokenStorage.clear();
  }

  const body = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(response.status, body as ApiErrorBody);
  }

  return body as T;
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_URL}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data.access) return false;
    tokenStorage.setAccess(data.access);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  register(payload: {
    email: string;
    username: string;
    password: string;
    password_confirm: string;
    currency?: string;
    language?: string;
  }) {
    return request<AuthResponse>("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  },

  requestPasswordReset(email: string) {
    return request<{ message: string }>("/api/auth/password/forgot/", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(payload: { token: string; password: string; password_confirm: string }) {
    return request<{ message: string }>("/api/auth/password/reset/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  logout(refresh: string) {
    return request<void>(
      "/api/auth/logout/",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: refresh }),
      },
      { auth: true }
    );
  },

  getProfile() {
    return request<User>("/api/auth/profile/", { method: "GET" }, { auth: true });
  },

  getPreferences() {
    return request<UserPreferences>(
      "/api/auth/preferences/",
      { method: "GET" },
      { auth: true }
    );
  },

  getNotifications() {
    return request<SiteNotification[]>("/api/notifications/", { method: "GET" }, { auth: true });
  },

  updateNotification(id: string, action: "read" | "dismiss") {
    return request<SiteNotification>(
      `/api/notifications/${encodeURIComponent(id)}/`,
      { method: "PATCH", body: JSON.stringify({ action }) },
      { auth: true }
    );
  },

  updatePreferences(payload: Partial<UserPreferences>) {
    return request<UserPreferences>(
      "/api/auth/preferences/",
      { method: "PUT", body: JSON.stringify(payload) },
      { auth: true }
    );
  },

  getCategories() {
    return request<Category[] | { results: Category[] }>(
      "/api/categories/",
      { method: "GET" },
      { auth: true }
    ).then(unwrapList<Category>);
  },

  createCategory(payload: { name: string; color: string }) {
    return request<Category>(
      "/api/categories/",
      { method: "POST", body: JSON.stringify(payload) },
      { auth: true }
    );
  },

  getSubscriptions(params?: { status?: string; category?: number }) {
    const search = new URLSearchParams();
    if (params?.status && params.status !== "all")
      search.set("status", params.status);
    if (params?.category) search.set("category", String(params.category));
    const qs = search.toString();
    return request<Subscription[] | { results: Subscription[] }>(
      `/api/subscriptions/${qs ? `?${qs}` : ""}`,
      { method: "GET" },
      { auth: true }
    ).then(unwrapList<Subscription>);
  },

  createSubscription(payload: SubscriptionPayload) {
    return request<Subscription>(
      "/api/subscriptions/",
      { method: "POST", body: JSON.stringify(payload) },
      { auth: true }
    );
  },

  updateSubscription(id: number, payload: Partial<SubscriptionPayload>) {
    return request<Subscription>(
      `/api/subscriptions/${id}/`,
      { method: "PATCH", body: JSON.stringify(payload) },
      { auth: true }
    );
  },

  deleteSubscription(id: number) {
    return request<void>(
      `/api/subscriptions/${id}/`,
      { method: "DELETE" },
      { auth: true }
    );
  },

  getStats() {
    return request<SubscriptionStats>(
      "/api/subscriptions/stats/",
      { method: "GET" },
      { auth: true }
    );
  },
};

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results;
}
