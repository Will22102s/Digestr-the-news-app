import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import {
  errorResponse,
  ok,
  readBoolean,
  readJsonObject,
  readString,
} from "@/lib/http";
import {
  AI_PROVIDER_CHOICES,
  getPublicSettings,
  normalizeOllamaBaseUrl,
  saveAiProvider,
  saveGeminiApiKey,
  saveGeminiModel,
  saveGroqApiKey,
  saveGroqModel,
  saveOllamaBaseUrl,
  saveOllamaEnabled,
  saveOllamaModel,
  type AiProviderChoice,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(getPublicSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function readKey(
  value: unknown,
  field: string,
  provider: string,
): string | null {
  if (value === null || value === "") return null;

  const key = readString(value, {
    field,
    maxLength: 512,
    required: true,
  });

  if (!key || key.length < 8) {
    throw new AppError(
      400,
      `That does not look like a ${provider} API key.`,
      "INVALID_INPUT",
    );
  }

  return key;
}

function readModel(value: unknown, field: string): string | null {
  if (value === null || value === "") return null;

  const model = readString(value, {
    field,
    maxLength: 120,
    required: true,
  });

  return model ?? null;
}

function readBaseUrl(value: unknown): string | null {
  if (value === null || value === "") return null;

  const raw = readString(value, {
    field: "ollamaBaseUrl",
    maxLength: 200,
    required: true,
  });

  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError(
      400,
      "ollamaBaseUrl must be a valid http(s) URL.",
      "INVALID_INPUT",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(
      400,
      "ollamaBaseUrl must start with http:// or https://.",
      "INVALID_INPUT",
    );
  }

  return normalizeOllamaBaseUrl(raw);
}

/**
 * Update local settings. Omitted fields are left untouched; an empty string or
 * null clears a stored value so the environment fallback can take over.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonObject(request);

    const fields = [
      "aiProvider",
      "geminiApiKey",
      "geminiModel",
      "groqApiKey",
      "groqModel",
      "ollamaEnabled",
      "ollamaBaseUrl",
      "ollamaModel",
    ];

    if (!fields.some((field) => has(body, field))) {
      throw new AppError(
        400,
        "Provide at least one setting to update.",
        "INVALID_INPUT",
      );
    }

    if (has(body, "aiProvider")) {
      const provider = readString(body.aiProvider, {
        field: "aiProvider",
        maxLength: 24,
        required: true,
      })?.toLowerCase();

      if (
        !provider ||
        !(AI_PROVIDER_CHOICES as readonly string[]).includes(provider)
      ) {
        throw new AppError(
          400,
          "aiProvider must be auto, gemini, groq, ollama, or fallback.",
          "INVALID_INPUT",
        );
      }

      saveAiProvider(provider as AiProviderChoice);
    }

    if (has(body, "geminiApiKey")) {
      saveGeminiApiKey(
        readKey(body.geminiApiKey, "geminiApiKey", "Gemini"),
      );
    }
    if (has(body, "geminiModel")) {
      saveGeminiModel(readModel(body.geminiModel, "geminiModel"));
    }

    if (has(body, "groqApiKey")) {
      saveGroqApiKey(readKey(body.groqApiKey, "groqApiKey", "Groq"));
    }
    if (has(body, "groqModel")) {
      saveGroqModel(readModel(body.groqModel, "groqModel"));
    }

    if (has(body, "ollamaEnabled")) {
      const enabled = readBoolean(body.ollamaEnabled, "ollamaEnabled");
      if (enabled !== undefined) saveOllamaEnabled(enabled);
    }
    if (has(body, "ollamaBaseUrl")) {
      saveOllamaBaseUrl(readBaseUrl(body.ollamaBaseUrl));
    }
    if (has(body, "ollamaModel")) {
      saveOllamaModel(readModel(body.ollamaModel, "ollamaModel"));
    }

    return ok(getPublicSettings());
  } catch (error) {
    return errorResponse(error);
  }
}
