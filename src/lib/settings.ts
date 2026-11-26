import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const GEMINI_API_KEY_SETTING = "gemini_api_key";
export const GEMINI_MODEL_SETTING = "gemini_model";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export type CredentialSource = "database" | "environment" | null;

export type GeminiCredentials = {
  apiKey: string | null;
  source: CredentialSource;
  model: string;
};

function readSetting(key: string): string | null {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();

  const value = row?.value?.trim();
  return value ? value : null;
}

function writeSetting(key: string, value: string | null): void {
  if (!value) {
    db.delete(settings).where(eq(settings.key, key)).run();
    return;
  }

  const updatedAt = new Date();
  db.insert(settings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt },
    })
    .run();
}

/**
 * The stored key wins over `.env`, so a desktop user can configure the app
 * entirely from the settings modal without editing files or restarting.
 */
export function getGeminiCredentials(): GeminiCredentials {
  const storedKey = readSetting(GEMINI_API_KEY_SETTING);
  const environmentKey = process.env.GEMINI_API_KEY?.trim() || null;
  const model =
    readSetting(GEMINI_MODEL_SETTING) ??
    process.env.GEMINI_MODEL?.trim() ??
    DEFAULT_GEMINI_MODEL;

  if (storedKey) {
    return { apiKey: storedKey, source: "database", model };
  }
  if (environmentKey) {
    return { apiKey: environmentKey, source: "environment", model };
  }

  return { apiKey: null, source: null, model };
}

export function getGeminiApiKey(): string | null {
  return getGeminiCredentials().apiKey;
}

export function saveGeminiApiKey(value: string | null): void {
  writeSetting(GEMINI_API_KEY_SETTING, value);
}

export function saveGeminiModel(value: string | null): void {
  writeSetting(GEMINI_MODEL_SETTING, value);
}

/** Never return a full key to the browser. */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export type PublicSettings = {
  gemini: {
    configured: boolean;
    maskedKey: string | null;
    source: CredentialSource;
    model: string;
    modelSource: "database" | "environment" | "default";
  };
};

export function getPublicSettings(): PublicSettings {
  const credentials = getGeminiCredentials();
  const storedModel = readSetting(GEMINI_MODEL_SETTING);
  const modelSource = storedModel
    ? "database"
    : process.env.GEMINI_MODEL?.trim()
      ? "environment"
      : "default";

  return {
    gemini: {
      configured: Boolean(credentials.apiKey),
      maskedKey: credentials.apiKey
        ? maskApiKey(credentials.apiKey)
        : null,
      source: credentials.source,
      model: credentials.model,
      modelSource,
    },
  };
}
