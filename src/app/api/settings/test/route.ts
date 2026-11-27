import type { NextRequest } from "next/server";
import { testAiProvider } from "@/lib/ai-providers";
import { AppError } from "@/lib/errors";
import {
  errorResponse,
  ok,
  readJsonObject,
  readString,
} from "@/lib/http";
import {
  AI_PROVIDER_IDS,
  getAiCredentials,
  getAiSettings,
  maskApiKey,
  type AiProviderId,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * Validate one provider without persisting it, so Settings can offer a
 * "Test connection" button before the user commits a change.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    const ai = getAiSettings();

    const requested = readString(body.provider, {
      field: "provider",
      maxLength: 24,
    })?.toLowerCase();

    if (
      requested &&
      !(AI_PROVIDER_IDS as readonly string[]).includes(requested)
    ) {
      throw new AppError(
        400,
        "provider must be gemini, groq, ollama, or fallback.",
        "INVALID_INPUT",
      );
    }

    const provider = (requested ?? ai.effectiveProvider) as AiProviderId;
    const candidateKey = readString(body.apiKey, {
      field: "apiKey",
      maxLength: 512,
    });
    const candidateModel = readString(body.model, {
      field: "model",
      maxLength: 120,
    });
    const candidateBaseUrl = readString(body.baseUrl, {
      field: "baseUrl",
      maxLength: 200,
    });

    if (provider === "fallback") {
      return ok({
        ok: true,
        provider,
        model: "algorithmic",
        reply: "The built-in editor is always available.",
        maskedKey: null,
      });
    }

    if (provider === "ollama") {
      const model = candidateModel ?? ai.ollama.model;
      const result = await testAiProvider({
        provider,
        model,
        baseUrl: candidateBaseUrl ?? ai.ollama.baseUrl,
      });

      return ok({
        ok: true,
        provider,
        model: result.model,
        reply: result.reply,
        maskedKey: null,
      });
    }

    const saved = getAiCredentials(provider);
    const apiKey =
      candidateKey ??
      (saved && "apiKey" in saved ? saved.apiKey : undefined);

    if (!apiKey) {
      throw new AppError(
        400,
        `Enter a ${provider === "gemini" ? "Gemini" : "Groq"} API key first.`,
        "AI_KEY_MISSING",
      );
    }

    const model =
      candidateModel ??
      (provider === "gemini" ? ai.gemini.model : ai.groq.model);

    const result = await testAiProvider({
      provider,
      apiKey,
      model,
    });

    return ok({
      ok: true,
      provider,
      model: result.model,
      reply: result.reply,
      maskedKey: maskApiKey(apiKey),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
