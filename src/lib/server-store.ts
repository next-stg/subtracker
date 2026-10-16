import "server-only";

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type StoredUser = {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  currency: string;
  language: string;
  notification_enabled: boolean;
  created_at: string;
  display_currency: string;
  email_notifications: boolean;
  renewal_reminder_days: number;
};

export type StoredCategory = {
  id: number;
  user_id: number;
  name: string;
  color: string;
};

export type StoredSubscription = {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  frequency: "monthly" | "yearly" | "quarterly" | "weekly";
  start_date: string;
  billing_date: string;
  status: "active" | "paused" | "cancelled";
  category: number | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredNotification = {
  id: string;
  user_id: number;
  subscription_id: number;
  subscription_name: string;
  billing_date: string;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  email_sent_at?: string | null;
  email_sending_at?: string | null;
};

export type StoredPasswordEntry = {
  id: string;
  user_id: number;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
};

type Store = {
  users: StoredUser[];
  categories: StoredCategory[];
  subscriptions: StoredSubscription[];
  notifications: StoredNotification[];
  password_entries: StoredPasswordEntry[];
  refresh_tokens: { token: string; user_id: number }[];
  password_reset_tokens: {
    token_hash: string;
    user_id: number;
    expires_at: string;
    created_at: string;
  }[];
  next_ids: { users: number; categories: number; subscriptions: number };
};

const dataDirectory = path.join(process.cwd(), ".data");
const databasePath = path.join(dataDirectory, "subtracker.sqlite");
const legacyStorePath = path.join(dataDirectory, "subtracker.json");

const emptyStore: Store = {
  users: [],
  categories: [],
  subscriptions: [],
  notifications: [],
  password_entries: [],
  refresh_tokens: [],
  password_reset_tokens: [],
  next_ids: { users: 1, categories: 1, subscriptions: 1 },
};

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    currency TEXT NOT NULL,
    language TEXT NOT NULL,
    notification_enabled INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    display_currency TEXT NOT NULL,
    email_notifications INTEGER NOT NULL,
    renewal_reminder_days INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    frequency TEXT NOT NULL,
    start_date TEXT NOT NULL,
    billing_date TEXT NOT NULL,
    status TEXT NOT NULL,
    category INTEGER,
    website TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER NOT NULL,
    subscription_name TEXT NOT NULL,
    billing_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT,
    dismissed_at TEXT,
    email_sent_at TEXT,
    email_sending_at TEXT
  );
  CREATE TABLE IF NOT EXISTS password_entries (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS next_ids (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY
  );
  CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);
  CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS password_entries_user_id_idx ON password_entries(user_id);
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadLegacyStore(): Store {
  const parsed: unknown = JSON.parse(readFileSync(legacyStorePath, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error("The existing JSON data store has an invalid format.");
  }
  const legacy = parsed;

  function collection<T>(name: string): T[] {
    const value = legacy[name];
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      throw new Error(`The existing JSON data store has an invalid ${name} collection.`);
    }
    return value as T[];
  }

  const nextIds = isRecord(legacy.next_ids) ? legacy.next_ids : {};
  return {
    users: collection<StoredUser>("users"),
    categories: collection<StoredCategory>("categories"),
    subscriptions: collection<StoredSubscription>("subscriptions"),
    notifications: collection<StoredNotification>("notifications"),
    password_entries: collection<StoredPasswordEntry>("password_entries"),
    refresh_tokens: collection<Store["refresh_tokens"][number]>("refresh_tokens"),
    password_reset_tokens: collection<Store["password_reset_tokens"][number]>("password_reset_tokens"),
    next_ids: {
      users: typeof nextIds.users === "number" ? nextIds.users : 1,
      categories: typeof nextIds.categories === "number" ? nextIds.categories : 1,
      subscriptions: typeof nextIds.subscriptions === "number" ? nextIds.subscriptions : 1,
    },
  };
}

function replaceStore(database: DatabaseSync, store: Store) {
  database.exec(`
    DELETE FROM refresh_tokens;
    DELETE FROM password_reset_tokens;
    DELETE FROM password_entries;
    DELETE FROM notifications;
    DELETE FROM subscriptions;
    DELETE FROM categories;
    DELETE FROM users;
    DELETE FROM next_ids;
  `);

  const insertUser = database.prepare(`
    INSERT INTO users (
      id, email, username, password_hash, currency, language,
      notification_enabled, created_at, display_currency,
      email_notifications, renewal_reminder_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const user of store.users) {
    insertUser.run(
      user.id, user.email, user.username, user.password_hash, user.currency,
      user.language, Number(user.notification_enabled), user.created_at,
      user.display_currency, Number(user.email_notifications),
      user.renewal_reminder_days
    );
  }

  const insertCategory = database.prepare(
    "INSERT INTO categories (id, user_id, name, color) VALUES (?, ?, ?, ?)"
  );
  for (const category of store.categories) {
    insertCategory.run(category.id, category.user_id, category.name, category.color);
  }

  const insertSubscription = database.prepare(`
    INSERT INTO subscriptions (
      id, user_id, name, description, amount, currency, frequency,
      start_date, billing_date, status, category, website, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const subscription of store.subscriptions) {
    insertSubscription.run(
      subscription.id, subscription.user_id, subscription.name,
      subscription.description, subscription.amount, subscription.currency,
      subscription.frequency, subscription.start_date, subscription.billing_date,
      subscription.status, subscription.category, subscription.website,
      subscription.notes, subscription.created_at, subscription.updated_at
    );
  }

  const insertNotification = database.prepare(`
    INSERT INTO notifications (
      id, user_id, subscription_id, subscription_name, billing_date,
      created_at, read_at, dismissed_at, email_sent_at, email_sending_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const notification of store.notifications) {
    insertNotification.run(
      notification.id, notification.user_id, notification.subscription_id,
      notification.subscription_name, notification.billing_date,
      notification.created_at, notification.read_at, notification.dismissed_at,
      notification.email_sent_at ?? null, notification.email_sending_at ?? null
    );
  }

  const insertPasswordEntry = database.prepare(`
    INSERT INTO password_entries (id, user_id, encrypted_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const entry of store.password_entries) {
    insertPasswordEntry.run(
      entry.id, entry.user_id, entry.encrypted_data, entry.created_at, entry.updated_at
    );
  }

  const insertRefreshToken = database.prepare(
    "INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)"
  );
  for (const token of store.refresh_tokens) {
    insertRefreshToken.run(token.token, token.user_id);
  }

  const insertPasswordResetToken = database.prepare(`
    INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  for (const token of store.password_reset_tokens) {
    insertPasswordResetToken.run(token.token_hash, token.user_id, token.expires_at, token.created_at);
  }

  const insertNextId = database.prepare(
    "INSERT INTO next_ids (name, value) VALUES (?, ?)"
  );
  for (const [name, value] of Object.entries(store.next_ids)) {
    insertNextId.run(name, value);
  }
}

const globalStore = globalThis as typeof globalThis & {
  subtrackerDatabase?: DatabaseSync;
};

function getDatabase(): DatabaseSync {
  if (globalStore.subtrackerDatabase) return globalStore.subtrackerDatabase;

  mkdirSync(dataDirectory, { recursive: true });
  const connection = new DatabaseSync(databasePath);
  try {
    connection.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    connection.exec(schema);

    const migration = connection.prepare(
      "SELECT name FROM migrations WHERE name = ?"
    ).get("import-json-store-v1");
    if (!migration) {
      connection.exec("BEGIN IMMEDIATE");
      try {
        if (existsSync(legacyStorePath)) {
          replaceStore(connection, loadLegacyStore());
        }
        connection.prepare("INSERT INTO migrations (name) VALUES (?)")
          .run("import-json-store-v1");
        connection.exec("COMMIT");
      } catch (error) {
        connection.exec("ROLLBACK");
        throw error;
      }
    }

    globalStore.subtrackerDatabase = connection;
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

function readRows(database: DatabaseSync, query: string): Record<string, unknown>[] {
  return database.prepare(query).all();
}

function readStoreFromDatabase(database: DatabaseSync): Store {
  const users = readRows(database, "SELECT * FROM users")
    .map((row): StoredUser => ({
      id: Number(row.id),
      email: String(row.email),
      username: String(row.username),
      password_hash: String(row.password_hash),
      currency: String(row.currency),
      language: String(row.language),
      notification_enabled: Number(row.notification_enabled) !== 0,
      created_at: String(row.created_at),
      display_currency: String(row.display_currency),
      email_notifications: Number(row.email_notifications) !== 0,
      renewal_reminder_days: Number(row.renewal_reminder_days),
    }));
  const categories = readRows(database, "SELECT * FROM categories")
    .map((row): StoredCategory => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      name: String(row.name),
      color: String(row.color),
    }));
  const subscriptions = readRows(database, "SELECT * FROM subscriptions")
    .map((row): StoredSubscription => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      name: String(row.name),
      description: row.description === null ? null : String(row.description),
      amount: String(row.amount),
      currency: String(row.currency),
      frequency: String(row.frequency) as StoredSubscription["frequency"],
      start_date: String(row.start_date),
      billing_date: String(row.billing_date),
      status: String(row.status) as StoredSubscription["status"],
      category: row.category === null ? null : Number(row.category),
      website: row.website === null ? null : String(row.website),
      notes: row.notes === null ? null : String(row.notes),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
  const notifications = readRows(database, "SELECT * FROM notifications")
    .map((row): StoredNotification => ({
      id: String(row.id),
      user_id: Number(row.user_id),
      subscription_id: Number(row.subscription_id),
      subscription_name: String(row.subscription_name),
      billing_date: String(row.billing_date),
      created_at: String(row.created_at),
      read_at: row.read_at === null ? null : String(row.read_at),
      dismissed_at: row.dismissed_at === null ? null : String(row.dismissed_at),
      email_sent_at: row.email_sent_at === null ? null : String(row.email_sent_at),
      email_sending_at: row.email_sending_at === null ? null : String(row.email_sending_at),
    }));
  const passwordEntries = readRows(database, "SELECT * FROM password_entries")
    .map((row): StoredPasswordEntry => ({
      id: String(row.id),
      user_id: Number(row.user_id),
      encrypted_data: String(row.encrypted_data),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
  const refreshTokens = readRows(database, "SELECT token, user_id FROM refresh_tokens")
    .map((row) => ({ token: String(row.token), user_id: Number(row.user_id) }));
  const passwordResetTokens = readRows(database, "SELECT token_hash, user_id, expires_at, created_at FROM password_reset_tokens")
    .map((row) => ({
      token_hash: String(row.token_hash),
      user_id: Number(row.user_id),
      expires_at: String(row.expires_at),
      created_at: String(row.created_at),
    }));
  const nextIds = { ...emptyStore.next_ids };
  for (const row of readRows(database, "SELECT name, value FROM next_ids")) {
    if (row.name === "users") nextIds.users = Number(row.value);
    if (row.name === "categories") nextIds.categories = Number(row.value);
    if (row.name === "subscriptions") nextIds.subscriptions = Number(row.value);
  }

  return {
    users,
    categories,
    subscriptions,
    notifications,
    password_entries: passwordEntries,
    refresh_tokens: refreshTokens,
    password_reset_tokens: passwordResetTokens,
    next_ids: nextIds,
  };
}

async function readStore(): Promise<Store> {
  return readStoreFromDatabase(getDatabase());
}

export async function updateStore<T>(mutate: (store: Store) => T): Promise<T> {
  const connection = getDatabase();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const store = readStoreFromDatabase(connection);
    const result = mutate(store);
    replaceStore(connection, store);
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

export { readStore };

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}