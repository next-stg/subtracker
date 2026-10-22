import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  annualEquivalent,
  DELETED_SUBSCRIPTION_RETENTION_DAYS,
} from "@/lib/constants";
import {
  hashPassword,
  readStore,
  type StoredCategory,
  type StoredNotification,
  type StoredSubscription,
  type StoredUser,
  updateStore,
  verifyPassword,
} from "@/lib/server-store";
import { createSmtpTransporter, sendPasswordResetEmail, sendRenewalEmail } from "@/lib/email";

const secret = process.env.AUTH_SECRET || "subtracker-development-secret";
const allowedCurrencies = ["XOF", "EUR", "USD", "GBP"] as const;
const allowedFrequencies = ["monthly", "yearly", "quarterly", "weekly"] as const;
const allowedStatuses = ["active", "paused", "cancelled"] as const;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function error(message: string, status = 400, field = "detail") {
  return json({ [field]: [message] }, status);
}

function token(userId: number, kind: "access" | "refresh") {
  const payload = Buffer.from(JSON.stringify({ sub: userId, kind, exp: Date.now() + (kind === "access" ? 900000 : 2592000000) })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function tokenUserId(value: string | null, kind: "access" | "refresh") {
  if (!value) return null;
  try {
    const [payload, signature] = value.split(".");
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    if (!signature || signature !== expected) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.kind === kind && decoded.exp > Date.now() ? Number(decoded.sub) : null;
  } catch {
    return null;
  }
}

async function authenticatedUser(request: NextRequest) {
  const userId = tokenUserId(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null, "access");
  if (!userId) return null;
  const store = await readStore();
  return store.users.find((user) => user.id === userId) || null;
}

function publicUser(user: StoredUser) {
  return { id: user.id, email: user.email, username: user.username, currency: user.display_currency || user.currency, language: user.language, notification_enabled: user.notification_enabled, created_at: user.created_at };
}

function authResponse(user: StoredUser, refresh: string) {
  return { user: publicUser(user), access: token(user.id, "access"), refresh };
}

function categoryResponse(category: StoredCategory, subscriptions: StoredSubscription[]) {
  return { id: category.id, name: category.name, color: category.color, subscription_count: subscriptions.filter((subscription) => subscription.deleted_at == null && subscription.category === category.id).length };
}

function subscriptionResponse(subscription: StoredSubscription, categories: StoredCategory[]) {
  const category = categories.find((item) => item.id === subscription.category);
  const yearlyCost = annualEquivalent(subscription.amount, subscription.frequency);
  return { ...subscription, category_name: category?.name || null, category_color: category?.color || null, yearly_cost: yearlyCost.toFixed(2), monthly_amount_converted: null };
}

function validSubscription(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim()) return "Le nom est obligatoire.";
  if (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0) return "Le montant est invalide.";
  if (typeof body.currency !== "string" || body.currency.length !== 3) return "La devise est invalide.";
  if (!allowedFrequencies.includes(body.frequency as typeof allowedFrequencies[number])) return "La fréquence est invalide.";
  if (!allowedStatuses.includes(body.status as typeof allowedStatuses[number])) return "Le statut est invalide.";
  if (typeof body.start_date !== "string" || typeof body.billing_date !== "string") return "Les dates sont obligatoires.";
  return null;
}

function isAuthorizedCronRequest(request: NextRequest, cronSecret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function purgeExpiredSubscriptions(store: {
  subscriptions: StoredSubscription[];
  notifications: StoredNotification[];
}) {
  const expiration = Date.now() - DELETED_SUBSCRIPTION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expiredIds = new Set(
    store.subscriptions
      .filter((subscription) =>
        subscription.deleted_at && Date.parse(subscription.deleted_at) <= expiration
      )
      .map((subscription) => subscription.id)
  );
  if (expiredIds.size === 0) return 0;

  store.subscriptions = store.subscriptions.filter(
    (subscription) => !expiredIds.has(subscription.id)
  );
  store.notifications = store.notifications.filter(
    (notification) => !expiredIds.has(notification.subscription_id)
  );
  return expiredIds.size;
}

async function cleanExpiredSubscriptions(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return error("CRON_SECRET n'est pas configuré.", 503);
  if (!isAuthorizedCronRequest(request, cronSecret)) return error("Authentification requise.", 401);

  const deleted = await updateStore((store) => purgeExpiredSubscriptions(store));
  return json({ deleted });
}

async function sendDueRenewalEmails(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return error("CRON_SECRET n'est pas configuré.", 503);
  if (!isAuthorizedCronRequest(request, cronSecret)) return error("Authentification requise.", 401);
  await updateStore((store) => purgeExpiredSubscriptions(store));

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASS?.replace(/\s/g, "");
  const sender = process.env.EMAIL_FROM || smtpUser;
  const appUrl = process.env.APP_URL;
  if (!smtpHost || !smtpUser || !smtpPassword || !sender || !appUrl) {
    return error("SMTP_HOST, SMTP_USER, SMTP_PASS et APP_URL doivent être configurés.", 503);
  }
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    return error("SMTP_PORT est invalide.", 503);
  }
  try {
    const parsedAppUrl = new URL(appUrl);
    if (parsedAppUrl.protocol !== "https:" && parsedAppUrl.protocol !== "http:") {
      return error("APP_URL doit utiliser HTTP ou HTTPS.", 503);
    }
  } catch {
    return error("APP_URL est invalide.", 503);
  }
  const transporter = createSmtpTransporter({
    host: smtpHost,
    port: smtpPort,
    user: smtpUser,
    password: smtpPassword,
  });
  try {
    await transporter.verify();
  } catch {
    return error("Connexion Gmail SMTP impossible. Vérifiez SMTP_USER et le mot de passe d'application.", 502);
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const initialStore = await readStore();
  const candidates = initialStore.subscriptions.filter((subscription) => {
    if (subscription.deleted_at || subscription.status !== "active") return false;
    const user = initialStore.users.find((item) => item.id === subscription.user_id);
    if (!user?.email_notifications || !user.email) return false;
    const dueTime = Date.parse(`${subscription.billing_date.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(dueTime)) return false;
    const daysUntil = Math.floor((dueTime - todayUtc) / 86400000);
    return daysUntil >= 0 && daysUntil <= Math.max(0, user.renewal_reminder_days ?? 3);
  });

  let sent = 0;
  let failed = 0;
  for (const subscription of candidates) {
    const billingDate = subscription.billing_date.slice(0, 10);
    const notificationId = `renewal-${subscription.id}-${billingDate}`;
    const reservation = await updateStore((store) => {
      const user = store.users.find((item) => item.id === subscription.user_id);
      const currentSubscription = store.subscriptions.find((item) =>
        item.id === subscription.id &&
        item.user_id === subscription.user_id &&
        !item.deleted_at &&
        item.status === "active" &&
        item.billing_date.slice(0, 10) === billingDate
      );
      if (!user?.email_notifications || !user.email || !currentSubscription) return null;
      const currentDueTime = Date.parse(`${billingDate}T00:00:00Z`);
      const currentDaysUntil = Math.floor((currentDueTime - todayUtc) / 86400000);
      if (currentDaysUntil < 0 || currentDaysUntil > Math.max(0, user.renewal_reminder_days ?? 3)) return null;

      let notification = store.notifications.find((item) => item.id === notificationId);
      if (!notification) {
        notification = {
          id: notificationId,
          user_id: user.id,
          subscription_id: currentSubscription.id,
          subscription_name: currentSubscription.name,
          billing_date: billingDate,
          created_at: new Date().toISOString(),
          read_at: null,
          dismissed_at: null,
        };
        store.notifications.push(notification);
      }
      if (notification.email_sent_at) return null;
      const previousClaim = notification.email_sending_at
        ? Date.parse(notification.email_sending_at)
        : NaN;
      if (Number.isFinite(previousClaim) && Date.now() - previousClaim < 15 * 60 * 1000) return null;

      notification.email_sending_at = new Date().toISOString();
      return {
        id: notification.id,
        email: user.email,
        username: user.username,
        subscriptionName: currentSubscription.name,
        amount: currentSubscription.amount,
        currency: currentSubscription.currency,
        billingDate,
      };
    });
    if (!reservation) continue;

    try {
      await sendRenewalEmail(transporter, sender, {
        to: reservation.email,
        username: reservation.username,
        subscriptionName: reservation.subscriptionName,
        amount: reservation.amount,
        currency: reservation.currency,
        billingDate: reservation.billingDate,
        appUrl,
      });
      await updateStore((store) => {
        const notification = store.notifications.find((item) => item.id === reservation.id);
        if (notification) {
          notification.email_sent_at = new Date().toISOString();
          notification.email_sending_at = null;
        }
      });
      sent += 1;
    } catch {
      await updateStore((store) => {
        const notification = store.notifications.find((item) => item.id === reservation.id);
        if (notification && !notification.email_sent_at) notification.email_sending_at = null;
      });
      failed += 1;
    }
  }

  return json({ checked: candidates.length, sent, failed }, failed ? 502 : 200);
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  if (route === "cron/reminders") return sendDueRenewalEmails(request);
  if (route === "cron/subscription-cleanup") return cleanExpiredSubscriptions(request);
  const user = await authenticatedUser(request);
  if (!user) return error("Authentification requise.", 401);
  if (route === "notifications") {
    return updateStore((currentStore) => {
      const currentUser = currentStore.users.find((item) => item.id === user.id);
      if (!currentUser) return error("Authentification requise.", 401);
      const today = new Date();
      const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      const reminderDays = Math.max(0, currentUser.renewal_reminder_days ?? 3);

      for (const subscription of currentStore.subscriptions) {
        if (subscription.user_id !== user.id || subscription.deleted_at || subscription.status !== "active") continue;
        const billingDate = subscription.billing_date.slice(0, 10);
        const dueTime = Date.parse(`${billingDate}T00:00:00Z`);
        if (!Number.isFinite(dueTime)) continue;
        const daysUntil = Math.floor((dueTime - todayUtc) / 86400000);
        if (daysUntil < 0 || daysUntil > reminderDays) continue;

        const id = `renewal-${subscription.id}-${billingDate}`;
        if (currentStore.notifications.some((notification) => notification.id === id)) continue;
        const notification: StoredNotification = {
          id,
          user_id: user.id,
          subscription_id: subscription.id,
          subscription_name: subscription.name,
          billing_date: billingDate,
          created_at: new Date().toISOString(),
          read_at: null,
          dismissed_at: null,
        };
        currentStore.notifications.push(notification);
      }

      return json(currentStore.notifications
        .filter((notification) => notification.user_id === user.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((notification) => ({
          id: notification.id,
          user_id: notification.user_id,
          subscription_id: notification.subscription_id,
          subscription_name: notification.subscription_name,
          billing_date: notification.billing_date,
          created_at: notification.created_at,
          read_at: notification.read_at,
          dismissed_at: notification.dismissed_at,
          days_until: Math.floor((Date.parse(`${notification.billing_date}T00:00:00Z`) - todayUtc) / 86400000),
        })));
    });
  }
  const store = await readStore();

  if (route === "auth/profile") return json(publicUser(user));
  if (route === "auth/preferences") return json({ display_currency: user.display_currency || user.currency, email_notifications: user.email_notifications, renewal_reminder_days: user.renewal_reminder_days, language: user.language });
  if (route === "categories") return json(store.categories.filter((category) => category.user_id === user.id).map((category) => categoryResponse(category, store.subscriptions)));
  if (route === "subscriptions/deleted") {
    return updateStore((currentStore) => {
      purgeExpiredSubscriptions(currentStore);
      return json(currentStore.subscriptions
        .filter((subscription) => subscription.user_id === user.id && subscription.deleted_at)
        .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""))
        .map((subscription) => subscriptionResponse(subscription, currentStore.categories)));
    });
  }
  if (route === "subscriptions") {
    const status = request.nextUrl.searchParams.get("status");
    const category = request.nextUrl.searchParams.get("category");
    return json(store.subscriptions.filter((subscription) => subscription.user_id === user.id && !subscription.deleted_at && (!status || subscription.status === status) && (!category || subscription.category === Number(category))).map((subscription) => subscriptionResponse(subscription, store.categories)));
  }
  if (route === "subscriptions/stats") {
    const active = store.subscriptions.filter((subscription) => subscription.user_id === user.id && !subscription.deleted_at && subscription.status === "active");
    const yearly = active.reduce((sum, subscription) => sum + annualEquivalent(subscription.amount, subscription.frequency), 0);
    const monthly = yearly / 12;
    const now = Date.now();
    const upcoming = active.filter((subscription) => { const days = (new Date(subscription.billing_date).getTime() - now) / 86400000; return days >= 0 && days <= 7; }).length;
    return json({ total_monthly: Number(monthly.toFixed(2)), total_yearly: Number(yearly.toFixed(2)), subscription_count: active.length, upcoming_renewals: upcoming, currency: user.display_currency || user.currency });
  }
  return error("Ressource introuvable.", 404);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  if (route === "auth/register") {
    if (typeof body.email !== "string" || !body.email.includes("@")) return error("L'adresse e-mail est invalide.", 400, "email");
    if (typeof body.username !== "string" || body.username.trim().length < 2) return error("Le nom d'utilisateur est trop court.", 400, "username");
    if (typeof body.password !== "string" || body.password.length < 8) return error("Le mot de passe doit contenir au moins 8 caractères.", 400, "password");
    if (body.password !== body.password_confirm) return error("Les mots de passe ne correspondent pas.", 400, "password_confirm");
    return updateStore((store) => {
      if (store.users.some((user) => user.email.toLowerCase() === String(body.email).toLowerCase())) return error("Cette adresse e-mail est déjà utilisée.", 409, "email");
      const now = new Date().toISOString();
      const user: StoredUser = { id: store.next_ids.users++, email: String(body.email).toLowerCase(), username: String(body.username).trim(), password_hash: hashPassword(String(body.password)), currency: typeof body.currency === "string" ? body.currency : "XOF", language: typeof body.language === "string" ? body.language : "fr", notification_enabled: true, created_at: now, display_currency: typeof body.currency === "string" ? body.currency : "XOF", email_notifications: true, renewal_reminder_days: 3 };
      store.users.push(user);
      const refresh = token(user.id, "refresh");
      store.refresh_tokens.push({ token: refresh, user_id: user.id });
      return json(authResponse(user, refresh), 201);
    });
  }

  if (route === "auth/password/forgot") {
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return error("L'adresse e-mail est invalide.", 400, "email");
    }
    const normalizedEmail = body.email.trim().toLowerCase();
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || "465");
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASS?.replace(/\s/g, "");
    const sender = process.env.EMAIL_FROM || smtpUser;
    const appUrl = process.env.APP_URL;
    if (!smtpHost || !smtpUser || !smtpPassword || !sender || !appUrl) {
      return error("Le service d'e-mail n'est pas configuré.", 503);
    }
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      return error("SMTP_PORT est invalide.", 503);
    }
    let parsedAppUrl: URL;
    try {
      parsedAppUrl = new URL(appUrl);
      if (parsedAppUrl.protocol !== "https:" && parsedAppUrl.protocol !== "http:") {
        return error("APP_URL doit utiliser HTTP ou HTTPS.", 503);
      }
    } catch {
      return error("APP_URL est invalide.", 503);
    }
    const transporter = createSmtpTransporter({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      password: smtpPassword,
    });
    try {
      await transporter.verify();
    } catch {
      return error("Connexion au serveur SMTP impossible.", 502);
    }

    const user = (await readStore()).users.find(
      (item) => item.email === normalizedEmail
    );
    if (!user) {
      return json({ message: "Si un compte correspond à cette adresse, un e-mail a été envoyé." });
    }

    const resetToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(resetToken).digest("hex");
    const createdAt = new Date();
    await updateStore((store) => {
      store.password_reset_tokens = store.password_reset_tokens.filter(
        (item) => item.user_id !== user.id
      );
      store.password_reset_tokens.push({
        token_hash: tokenHash,
        user_id: user.id,
        expires_at: new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString(),
        created_at: createdAt.toISOString(),
      });
    });
    const resetUrl = new URL("/reset-password", parsedAppUrl);
    resetUrl.searchParams.set("token", resetToken);
    try {
      await sendPasswordResetEmail(
        transporter,
        sender,
        user.email,
        user.username,
        resetUrl.toString()
      );
    } catch {
      await updateStore((store) => {
        store.password_reset_tokens = store.password_reset_tokens.filter(
          (item) => item.token_hash !== tokenHash
        );
      });
      return error("Impossible d'envoyer l'e-mail de réinitialisation.", 502);
    }
    return json({ message: "Si un compte correspond à cette adresse, un e-mail a été envoyé." });
  }

  if (route === "auth/password/reset") {
    if (typeof body.token !== "string" || !/^[a-f\d]{64}$/i.test(body.token)) {
      return error("Le lien de réinitialisation est invalide ou expiré.", 400);
    }
    if (typeof body.password !== "string" || body.password.length < 8) {
      return error("Le mot de passe doit contenir au moins 8 caractères.", 400, "password");
    }
    if (body.password !== body.password_confirm) {
      return error("Les mots de passe ne correspondent pas.", 400, "password_confirm");
    }
    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    return updateStore((store) => {
      const resetTokenIndex = store.password_reset_tokens.findIndex(
        (item) => item.token_hash === tokenHash && Date.parse(item.expires_at) > Date.now()
      );
      if (resetTokenIndex < 0) {
        store.password_reset_tokens = store.password_reset_tokens.filter(
          (item) => Date.parse(item.expires_at) > Date.now()
        );
        return error("Le lien de réinitialisation est invalide ou expiré.", 400);
      }
      const resetToken = store.password_reset_tokens[resetTokenIndex];
      const user = store.users.find((item) => item.id === resetToken.user_id);
      store.password_reset_tokens = store.password_reset_tokens.filter(
        (item) => item.user_id !== resetToken.user_id
      );
      if (!user) return error("Le lien de réinitialisation est invalide ou expiré.", 400);
      user.password_hash = hashPassword(body.password as string);
      store.refresh_tokens = store.refresh_tokens.filter(
        (item) => item.user_id !== user.id
      );
      return json({ message: "Le mot de passe a été modifié. Vous pouvez vous connecter." });
    });
  }

  if (route === "auth/login") {
    const store = await readStore();
    const user = store.users.find((item) => item.email === String(body.email || "").toLowerCase());
    if (!user || typeof body.password !== "string" || !verifyPassword(body.password, user.password_hash)) return error("E-mail ou mot de passe incorrect.", 401);
    const refresh = token(user.id, "refresh");
    await updateStore((nextStore) => nextStore.refresh_tokens.push({ token: refresh, user_id: user.id }));
    return json(authResponse(user, refresh));
  }

  if (route === "auth/token/refresh") {
    const refresh = typeof body.refresh === "string" ? body.refresh : "";
    const userId = tokenUserId(refresh, "refresh");
    const store = await readStore();
    if (!userId || !store.refresh_tokens.some((item) => item.token === refresh && item.user_id === userId)) return error("Le token de renouvellement est invalide.", 401);
    return json({ access: token(userId, "access") });
  }

  const user = await authenticatedUser(request);
  if (!user) return error("Authentification requise.", 401);
  const restoreMatch = route.match(/^subscriptions\/(\d+)\/restore$/);
  if (restoreMatch) {
    return updateStore((store) => {
      purgeExpiredSubscriptions(store);
      const subscription = store.subscriptions.find(
        (item) => item.id === Number(restoreMatch[1]) && item.user_id === user.id
      );
      if (!subscription?.deleted_at) return error("Abonnement supprimé introuvable.", 404);
      subscription.deleted_at = null;
      subscription.updated_at = new Date().toISOString();
      return json(subscriptionResponse(subscription, store.categories));
    });
  }
  if (route === "auth/logout") {
    const refresh = typeof body.refresh_token === "string" ? body.refresh_token : "";
    await updateStore((store) => { store.refresh_tokens = store.refresh_tokens.filter((item) => item.token !== refresh); });
    return new NextResponse(null, { status: 204 });
  }
  if (route === "auth/account/email") {
    if (typeof body.email !== "string" || !body.email.trim().includes("@")) {
      return error("L'adresse e-mail est invalide.", 400, "email");
    }
    if (typeof body.current_password !== "string" || !body.current_password) {
      return error("Saisissez votre mot de passe actuel.", 400, "current_password");
    }
    const email = body.email.trim().toLowerCase();
    return updateStore((store) => {
      const current = store.users.find((item) => item.id === user.id);
      if (!current || !verifyPassword(body.current_password as string, current.password_hash)) {
        return error("Le mot de passe actuel est incorrect.", 400, "current_password");
      }
      if (store.users.some((item) => item.id !== user.id && item.email.toLowerCase() === email)) {
        return error("Cette adresse e-mail est déjà utilisée.", 409, "email");
      }
      current.email = email;
      return json(publicUser(current));
    });
  }
  if (route === "auth/account/password") {
    if (typeof body.current_password !== "string" || !body.current_password) {
      return error("Saisissez votre mot de passe actuel.", 400, "current_password");
    }
    if (typeof body.password !== "string" || body.password.length < 8) {
      return error("Le mot de passe doit contenir au moins 8 caractères.", 400, "password");
    }
    if (body.password !== body.password_confirm) {
      return error("Les mots de passe ne correspondent pas.", 400, "password_confirm");
    }
    return updateStore((store) => {
      const current = store.users.find((item) => item.id === user.id);
      if (!current || !verifyPassword(body.current_password as string, current.password_hash)) {
        return error("Le mot de passe actuel est incorrect.", 400, "current_password");
      }
      current.password_hash = hashPassword(body.password as string);
      store.refresh_tokens = store.refresh_tokens.filter((item) => item.user_id !== user.id);
      const refresh = token(current.id, "refresh");
      store.refresh_tokens.push({ token: refresh, user_id: current.id });
      return json(authResponse(current, refresh));
    });
  }
  if (route === "categories") {
    if (typeof body.name !== "string" || !body.name.trim()) return error("Le nom est obligatoire.", 400, "name");
    return updateStore((store) => { const category: StoredCategory = { id: store.next_ids.categories++, user_id: user.id, name: body.name as string, color: typeof body.color === "string" ? body.color : "#6366f1" }; store.categories.push(category); return json(categoryResponse(category, store.subscriptions), 201); });
  }
  if (route === "subscriptions") {
    const validationError = validSubscription(body);
    if (validationError) return error(validationError);
    return updateStore((store) => { const now = new Date().toISOString(); const subscription: StoredSubscription = { id: store.next_ids.subscriptions++, user_id: user.id, name: String(body.name).trim(), description: typeof body.description === "string" ? body.description : null, amount: Number(body.amount).toFixed(2), currency: body.currency as string, frequency: body.frequency as StoredSubscription["frequency"], start_date: body.start_date as string, billing_date: body.billing_date as string, status: body.status as StoredSubscription["status"], category: body.category ? Number(body.category) : null, website: typeof body.website === "string" && body.website ? body.website : null, notes: typeof body.notes === "string" && body.notes ? body.notes : null, deleted_at: null, created_at: now, updated_at: now }; store.subscriptions.push(subscription); return json(subscriptionResponse(subscription, store.categories), 201); });
  }
  return error("Ressource introuvable.", 404);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const user = await authenticatedUser(request);
  if (!user) return error("Authentification requise.", 401);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (route !== "auth/preferences") return error("Ressource introuvable.", 404);
  if (typeof body.display_currency === "string" && !allowedCurrencies.includes(body.display_currency as typeof allowedCurrencies[number])) {
    return error("La devise sélectionnée n'est pas prise en charge.", 400, "display_currency");
  }
  return updateStore((store) => { const current = store.users.find((item) => item.id === user.id)!; if (typeof body.display_currency === "string") current.display_currency = body.display_currency; if (typeof body.email_notifications === "boolean") current.email_notifications = body.email_notifications; if (typeof body.renewal_reminder_days === "number") current.renewal_reminder_days = Math.max(0, Math.round(body.renewal_reminder_days)); if (typeof body.language === "string") current.language = body.language; return json({ display_currency: current.display_currency, email_notifications: current.email_notifications, renewal_reminder_days: current.renewal_reminder_days, language: current.language }); });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const notificationMatch = route.match(/^notifications\/([^/]+)$/);
  if (notificationMatch) {
    const user = await authenticatedUser(request);
    if (!user) return error("Authentification requise.", 401);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action !== "read" && body.action !== "dismiss") return error("Action invalide.");
    return updateStore((store) => {
      const notification = store.notifications.find((item) => item.id === notificationMatch[1] && item.user_id === user.id);
      if (!notification) return error("Notification introuvable.", 404);
      if (body.action === "read") notification.read_at ??= new Date().toISOString();
      else notification.dismissed_at ??= new Date().toISOString();
      return json({
        id: notification.id,
        subscription_id: notification.subscription_id,
        subscription_name: notification.subscription_name,
        billing_date: notification.billing_date,
        created_at: notification.created_at,
        read_at: notification.read_at,
        dismissed_at: notification.dismissed_at,
      });
    });
  }
  const match = route.match(/^subscriptions\/(\d+)$/);
  if (!match) return error("Ressource introuvable.", 404);
  const user = await authenticatedUser(request);
  if (!user) return error("Authentification requise.", 401);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  return updateStore((store) => { const subscription = store.subscriptions.find((item) => item.id === Number(match[1]) && item.user_id === user.id); if (!subscription) return error("Abonnement introuvable.", 404); const validationError = validSubscription({ ...subscription, ...body }); if (validationError) return error(validationError); Object.assign(subscription, body, { amount: Number(body.amount ?? subscription.amount).toFixed(2), category: body.category === null || body.category === "" ? null : Number(body.category), updated_at: new Date().toISOString() }); return json(subscriptionResponse(subscription, store.categories)); });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const match = route.match(/^subscriptions\/(\d+)(\/permanent)?$/);
  if (!match) return error("Ressource introuvable.", 404);
  const user = await authenticatedUser(request);
  if (!user) return error("Authentification requise.", 401);
  return updateStore((store) => {
    const index = store.subscriptions.findIndex(
      (item) => item.id === Number(match[1]) && item.user_id === user.id
    );
    if (index < 0) return error("Abonnement introuvable.", 404);
    const subscription = store.subscriptions[index];
    if (match[2]) {
      if (!subscription.deleted_at) return error("Cet abonnement n'est pas dans l'historique.", 400);
      store.subscriptions.splice(index, 1);
    } else {
      if (subscription.deleted_at) return error("Abonnement introuvable.", 404);
      subscription.deleted_at = new Date().toISOString();
    }
    store.notifications = store.notifications.filter(
      (notification) => notification.subscription_id !== subscription.id
    );
    return new NextResponse(null, { status: 204 });
  });
}