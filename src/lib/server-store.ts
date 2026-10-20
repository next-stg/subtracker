import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";

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
    notification_enabled BOOLEAN NOT NULL,
    created_at TEXT NOT NULL,
    display_currency TEXT NOT NULL,
    email_notifications BOOLEAN NOT NULL,
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

function loadLegacySqliteStore(): Store {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const readRows = (query: string) =>
      database.prepare(query).all() as Record<string, unknown>[];
    const users = readRows("SELECT * FROM users").map((row): StoredUser => ({
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
    const categories = readRows("SELECT * FROM categories").map((row): StoredCategory => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      name: String(row.name),
      color: String(row.color),
    }));
    const subscriptions = readRows("SELECT * FROM subscriptions").map((row): StoredSubscription => ({
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
    const notifications = readRows("SELECT * FROM notifications").map((row): StoredNotification => ({
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
    const passwordEntries = readRows("SELECT * FROM password_entries").map((row): StoredPasswordEntry => ({
      id: String(row.id),
      user_id: Number(row.user_id),
      encrypted_data: String(row.encrypted_data),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
    const refreshTokens = readRows("SELECT token, user_id FROM refresh_tokens")
      .map((row) => ({ token: String(row.token), user_id: Number(row.user_id) }));
    const passwordResetTokens = readRows(
      "SELECT token_hash, user_id, expires_at, created_at FROM password_reset_tokens"
    ).map((row) => ({
      token_hash: String(row.token_hash),
      user_id: Number(row.user_id),
      expires_at: String(row.expires_at),
      created_at: String(row.created_at),
    }));
    const nextIds = { ...emptyStore.next_ids };
    for (const row of readRows("SELECT name, value FROM next_ids")) {
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
  } finally {
    database.close();
  }
}

async function replaceStore(database: PoolClient, store: Store) {
  await database.query(`
    DELETE FROM refresh_tokens;
    DELETE FROM password_reset_tokens;
    DELETE FROM password_entries;
    DELETE FROM notifications;
    DELETE FROM subscriptions;
    DELETE FROM categories;
    DELETE FROM users;
    DELETE FROM next_ids;
  `);

  for (const user of store.users) {
    await database.query(`
    INSERT INTO users (
      id, email, username, password_hash, currency, language,
      notification_enabled, created_at, display_currency,
      email_notifications, renewal_reminder_days
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
      user.id, user.email, user.username, user.password_hash, user.currency,
      user.language, user.notification_enabled, user.created_at,
      user.display_currency, user.email_notifications,
      user.renewal_reminder_days
    ]);
  }

  for (const category of store.categories) {
    await database.query(
      "INSERT INTO categories (id, user_id, name, color) VALUES ($1, $2, $3, $4)",
      [category.id, category.user_id, category.name, category.color]
    );
  }

  for (const subscription of store.subscriptions) {
    await database.query(`
    INSERT INTO subscriptions (
      id, user_id, name, description, amount, currency, frequency,
      start_date, billing_date, status, category, website, notes,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `, [
      subscription.id, subscription.user_id, subscription.name,
      subscription.description, subscription.amount, subscription.currency,
      subscription.frequency, subscription.start_date, subscription.billing_date,
      subscription.status, subscription.category, subscription.website,
      subscription.notes, subscription.created_at, subscription.updated_at
    ]);
  }

  for (const notification of store.notifications) {
    await database.query(`
    INSERT INTO notifications (
      id, user_id, subscription_id, subscription_name, billing_date,
      created_at, read_at, dismissed_at, email_sent_at, email_sending_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
      notification.id, notification.user_id, notification.subscription_id,
      notification.subscription_name, notification.billing_date,
      notification.created_at, notification.read_at, notification.dismissed_at,
      notification.email_sent_at ?? null, notification.email_sending_at ?? null
    ]);
  }

  for (const entry of store.password_entries) {
    await database.query(`
    INSERT INTO password_entries (id, user_id, encrypted_data, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [
      entry.id, entry.user_id, entry.encrypted_data, entry.created_at, entry.updated_at
    ]);
  }

  for (const token of store.refresh_tokens) {
    await database.query(
      "INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)",
      [token.token, token.user_id]
    );
  }

  for (const token of store.password_reset_tokens) {
    await database.query(`
    INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at)
    VALUES ($1, $2, $3, $4)
  `, [token.token_hash, token.user_id, token.expires_at, token.created_at]);
  }

  for (const [name, value] of Object.entries(store.next_ids)) {
    await database.query(
      "INSERT INTO next_ids (name, value) VALUES ($1, $2)",
      [name, value]
    );
  }
}

const globalStore = globalThis as typeof globalThis & {
  subtrackerPool?: Pool;
  subtrackerInitialization?: Promise<void>;
};

function getPool(): Pool {
  if (globalStore.subtrackerPool) return globalStore.subtrackerPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured to connect to PostgreSQL.");
  }
  const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10_000 });
  pool.on("error", (error) => {
    console.error("Unexpected error from the PostgreSQL connection pool.", error);
  });
  globalStore.subtrackerPool = pool;
  return pool;
}

async function initializeDatabase(pool: Pool): Promise<void> {
  const connection = await pool.connect();
  try {
    await connection.query(schema);
    await connection.query("BEGIN");
    try {
      await connection.query("SELECT pg_advisory_xact_lock($1)", [731054091]);
      const migration = await connection.query(
        "SELECT name FROM migrations WHERE name = $1",
        ["import-json-store-v1"]
      );
      if (migration.rowCount === 0) {
        if (existsSync(databasePath)) {
          await replaceStore(connection, loadLegacySqliteStore());
        } else if (existsSync(legacyStorePath)) {
          await replaceStore(connection, loadLegacyStore());
        }
        await connection.query("INSERT INTO migrations (name) VALUES ($1)", ["import-json-store-v1"]);
      }
      await connection.query("COMMIT");
    } catch (error) {
      try {
        await connection.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Failed to roll back PostgreSQL initialization.", rollbackError);
      }
      throw error;
    }
  } finally {
    connection.release();
  }
}

async function getDatabase(): Promise<Pool> {
  const pool = getPool();
  if (!globalStore.subtrackerInitialization) {
    globalStore.subtrackerInitialization = initializeDatabase(pool).catch((error: unknown) => {
      globalStore.subtrackerInitialization = undefined;
      throw error;
    });
  }
  await globalStore.subtrackerInitialization;
  return pool;
}

async function readRows(database: PoolClient, query: string): Promise<Record<string, unknown>[]> {
  const result = await database.query<Record<string, unknown>>(query);
  return result.rows;
}

async function readStoreFromDatabase(database: PoolClient): Promise<Store> {
  const [
    userRows,
    categoryRows,
    subscriptionRows,
    notificationRows,
    passwordEntryRows,
    refreshTokenRows,
    passwordResetTokenRows,
    nextIdRows,
  ] = await Promise.all([
    readRows(database, "SELECT * FROM users"),
    readRows(database, "SELECT * FROM categories"),
    readRows(database, "SELECT * FROM subscriptions"),
    readRows(database, "SELECT * FROM notifications"),
    readRows(database, "SELECT * FROM password_entries"),
    readRows(database, "SELECT token, user_id FROM refresh_tokens"),
    readRows(database, "SELECT token_hash, user_id, expires_at, created_at FROM password_reset_tokens"),
    readRows(database, "SELECT name, value FROM next_ids"),
  ]);
  const users = userRows
    .map((row): StoredUser => ({
      id: Number(row.id),
      email: String(row.email),
      username: String(row.username),
      password_hash: String(row.password_hash),
      currency: String(row.currency),
      language: String(row.language),
      notification_enabled: Boolean(row.notification_enabled),
      created_at: String(row.created_at),
      display_currency: String(row.display_currency),
      email_notifications: Boolean(row.email_notifications),
      renewal_reminder_days: Number(row.renewal_reminder_days),
    }));
  const categories = categoryRows
    .map((row): StoredCategory => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      name: String(row.name),
      color: String(row.color),
    }));
  const subscriptions = subscriptionRows
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
  const notifications = notificationRows
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
  const passwordEntries = passwordEntryRows
    .map((row): StoredPasswordEntry => ({
      id: String(row.id),
      user_id: Number(row.user_id),
      encrypted_data: String(row.encrypted_data),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
  const refreshTokens = refreshTokenRows
    .map((row) => ({ token: String(row.token), user_id: Number(row.user_id) }));
  const passwordResetTokens = passwordResetTokenRows
    .map((row) => ({
      token_hash: String(row.token_hash),
      user_id: Number(row.user_id),
      expires_at: String(row.expires_at),
      created_at: String(row.created_at),
    }));
  const nextIds = { ...emptyStore.next_ids };
  for (const row of nextIdRows) {
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
  const pool = await getDatabase();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const store = await readStoreFromDatabase(connection);
    await connection.query("COMMIT");
    return store;
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to roll back PostgreSQL read transaction.", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateStore<T>(mutate: (store: Store) => T): Promise<T> {
  const pool = await getDatabase();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock($1)", [731054091]);
    const store = await readStoreFromDatabase(connection);
    const result = mutate(store);
    await replaceStore(connection, store);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to roll back PostgreSQL write transaction.", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
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