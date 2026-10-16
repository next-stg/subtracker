import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type PasswordEntryData = {
  title: string;
  username: string;
  password: string;
  website: string;
  notes: string;
};

export class PasswordVaultConfigurationError extends Error {
  constructor() {
    super("Le coffre-fort est indisponible : configurez PASSWORD_VAULT_KEY (clé Base64 de 32 octets).");
    this.name = "PasswordVaultConfigurationError";
  }
}

function getVaultKey() {
  const encodedKey = process.env.PASSWORD_VAULT_KEY;
  if (!encodedKey) throw new PasswordVaultConfigurationError();
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new PasswordVaultConfigurationError();
  }
  return key;
}

export function assertPasswordVaultConfigured() {
  getVaultKey();
}

export function encryptPasswordEntry(entry: PasswordEntryData) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getVaultKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(entry), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
}

export function decryptPasswordEntry(encryptedEntry: string): PasswordEntryData {
  const [encodedIv, encodedTag, encodedData] = encryptedEntry.split(".");
  if (!encodedIv || !encodedTag || !encodedData) {
    throw new Error("Données du coffre invalides.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getVaultKey(),
    Buffer.from(encodedIv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as PasswordEntryData;
}