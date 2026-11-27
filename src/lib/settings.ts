import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getDemoStatus, type DemoStatus } from "@/db/demo-data";
import { settings } from "@/db/schema";

export const GEMINI_API_KEY_SETTING = "gemini_api_key";
export const GEMINI_MODEL_SETTING = "gemini_model";
export const GROQ_API_KEY_SETTING = "groq_api_key";
export const GROQ_MODEL_SETTING = "groq_model";
export const OLLAMA_ENABLED_SETTING = "ollama_enabled";
export const OLLAMA_BASE_URL_SETTING = "ollama_base_url";
export const OLLAMA_MODEL_SETTING = "ollama_model";
export const AI_PROVIDER_SETTING = "ai_provider";

export const AI_PROVIDER_IDS = [
  "gemini",
  "groq",
  "ollama",
  "fallback",
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const AI_PROVIDER_CHOICES = ["auto", ...AI_PROVIDER_IDS] as const;

export type AiProviderChoice = (typeof AI_PROVIDER_CHOICES)[number];

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_OLLAMA_MODEL = "llama3.1";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export type CredentialSource = "database" | "environment" | null;

export type ProviderStatus = {
  configured: boolean;
  source: CredentialSource;
  maskedKey: string | null;
  model: string;
  modelSource: "database" | "environment" | "default";
};

export type OllamaStatus = {
  enabled: boolean;
  baseUrl: string;
  baseUrlSource: "database" | "environment" | "default";
  model: string;
  modelSource: "database" | "environment" | "default";
  configured: boolean;
};

export type AiSettings = {
  provider: AiProviderChoice;
  effectiveProvider: AiProviderId;
  gemini: ProviderStatus;
  groq: ProviderStatus;
  ollama: OllamaStatus;
};

export type AiCredentials =
  | { provider: "gemini"; apiKey: string; model: string }
  | { provider: "groq"; apiKey: string; model: string }
  | { provider: "ollama"; baseUrl: string; model: string };

export function readSetting(key: string): string | null {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();

  const value = row?.value?.trim();
  return value ? value : null;
}

export function writeSetting(key: string, value: string | null): void {
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

function envValue(name: string): string | null {
  return process.env[name]?.trim() || null;
}

export function normalizeOllamaBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isChoice(value: string | null | undefined): value is AiProviderChoice {
  return Boolean(
    value &&
      (AI_PROVIDER_CHOICES as readonly string[]).includes(
        value.trim().toLowerCase(),
      ),
  );
}

function providerStatus(
  keySetting: string,
  envKeyName: string,
  modelSetting: string,
  envModelName: string,
  defaultModel: string,
): ProviderStatus {
  const storedKey = readSetting(keySetting);
  const environmentKey = envValue(envKeyName);
  const apiKey = storedKey ?? environmentKey;

  const storedModel = readSetting(modelSetting);
  const environmentModel = envValue(envModelName);

  return {
    configured: Boolean(apiKey),
    source: storedKey ? "database" : environmentKey ? "environment" : null,
    maskedKey: apiKey ? maskApiKey(apiKey) : null,
    model: storedModel ?? environmentModel ?? defaultModel,
    modelSource: storedModel
      ? "database"
      : environmentModel
        ? "environment"
        : "default",
  };
}

function getOllamaStatus(): OllamaStatus {
  const storedEnabled = readSetting(OLLAMA_ENABLED_SETTING);
  const environmentEnabled = envValue("OLLAMA_ENABLED")?.toLowerCase();
  const enabled = storedEnabled
    ? storedEnabled === "true"
    : environmentEnabled
      ? ["1", "true", "yes", "on"].includes(environmentEnabled)
      : false;

  const storedBaseUrl = readSetting(OLLAMA_BASE_URL_SETTING);
  const environmentBaseUrl = envValue("OLLAMA_BASE_URL");
  const baseUrl = normalizeOllamaBaseUrl(
    storedBaseUrl ?? environmentBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
  );

  const storedModel = readSetting(OLLAMA_MODEL_SETTING);
  const environmentModel = envValue("OLLAMA_MODEL");

  return {
    enabled,
    configured: enabled,
    baseUrl,
    baseUrlSource: storedBaseUrl
      ? "database"
      : environmentBaseUrl
        ? "environment"
        : "default",
    model: storedModel ?? environmentModel ?? DEFAULT_OLLAMA_MODEL,
    modelSource: storedModel
      ? "database"
      : environmentModel
        ? "environment"
        : "default",
  };
}

export function getAiProviderChoice(): AiProviderChoice {
  const stored = readSetting(AI_PROVIDER_SETTING);
  if (isChoice(stored)) return stored.trim().toLowerCase() as AiProviderChoice;

  const environment = envValue("AI_PROVIDER");
  if (isChoice(environment)) {
    return environment.trim().toLowerCase() as AiProviderChoice;
  }

  return "auto";
}

function effectiveProvider(
  choice: AiProviderChoice,
  gemini: ProviderStatus,
  groq: ProviderStatus,
  ollama: OllamaStatus,
): AiProviderId {
  if (choice === "gemini") return gemini.configured ? "gemini" : "fallback";
  if (choice === "groq") return groq.configured ? "groq" : "fallback";
  if (choice === "ollama") return ollama.enabled ? "ollama" : "fallback";
  if (choice === "fallback") return "fallback";

  if (gemini.configured) return "gemini";
  if (groq.configured) return "groq";
  if (ollama.enabled) return "ollama";
  return "fallback";
}

/**
 * Stored settings win over `.env`, so a desktop user can configure the app
 * entirely from Settings without editing files or restarting.
 */
export function getAiSettings(): AiSettings {
  const gemini = providerStatus(
    GEMINI_API_KEY_SETTING,
    "GEMINI_API_KEY",
    GEMINI_MODEL_SETTING,
    "GEMINI_MODEL",
    DEFAULT_GEMINI_MODEL,
  );
  const groq = providerStatus(
    GROQ_API_KEY_SETTING,
    "GROQ_API_KEY",
    GROQ_MODEL_SETTING,
    "GROQ_MODEL",
    DEFAULT_GROQ_MODEL,
  );
  const ollama = getOllamaStatus();
  const provider = getAiProviderChoice();

  return {
    provider,
    effectiveProvider: effectiveProvider(provider, gemini, groq, ollama),
    gemini,
    groq,
    ollama,
  };
}

export function getAiCredentials(
  provider?: AiProviderId,
): AiCredentials | null {
  const ai = getAiSettings();
  const target = provider ?? ai.effectiveProvider;

  if (target === "gemini" && ai.gemini.configured) {
    const stored = readSetting(GEMINI_API_KEY_SETTING);
    const apiKey = stored ?? envValue("GEMINI_API_KEY");
    if (apiKey) return { provider: "gemini", apiKey, model: ai.gemini.model };
  }

  if (target === "groq" && ai.groq.configured) {
    const stored = readSetting(GROQ_API_KEY_SETTING);
    const apiKey = stored ?? envValue("GROQ_API_KEY");
    if (apiKey) return { provider: "groq", apiKey, model: ai.groq.model };
  }

  if (target === "ollama" && ai.ollama.enabled) {
    return {
      provider: "ollama",
      baseUrl: ai.ollama.baseUrl,
      model: ai.ollama.model,
    };
  }

  return null;
}

export function getProviderLabel(provider: AiProviderId | "demo"): string {
  if (provider === "gemini") return "Google Gemini";
  if (provider === "groq") return "Groq";
  if (provider === "ollama") return "Ollama";
  if (provider === "demo") return "the Digestr demo desk";
  return "the built-in algorithmic editor";
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function saveAiProvider(value: AiProviderChoice | null): void {
  writeSetting(AI_PROVIDER_SETTING, value);
}

export function saveGeminiApiKey(value: string | null): void {
  writeSetting(GEMINI_API_KEY_SETTING, value);
}

export function saveGeminiModel(value: string | null): void {
  writeSetting(GEMINI_MODEL_SETTING, value);
}

export function saveGroqApiKey(value: string | null): void {
  writeSetting(GROQ_API_KEY_SETTING, value);
}

export function saveGroqModel(value: string | null): void {
  writeSetting(GROQ_MODEL_SETTING, value);
}

export function saveOllamaEnabled(value: boolean | null): void {
  writeSetting(
    OLLAMA_ENABLED_SETTING,
    value === null ? null : value ? "true" : "false",
  );
}

export function saveOllamaBaseUrl(value: string | null): void {
  writeSetting(
    OLLAMA_BASE_URL_SETTING,
    value ? normalizeOllamaBaseUrl(value) : null,
  );
}

export function saveOllamaModel(value: string | null): void {
  writeSetting(OLLAMA_MODEL_SETTING, value);
}

export type PublicSettings = {
  ai: AiSettings;
  demo: DemoStatus;
};

export function getPublicSettings(): PublicSettings {
  return {
    ai: getAiSettings(),
    demo: getDemoStatus(),
  };
}
