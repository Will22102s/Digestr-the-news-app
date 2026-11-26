import type { NextRequest } from "next/server";
import { testGeminiConnection } from "@/lib/briefing";
import { AppError } from "@/lib/errors";
import {
  errorResponse,
  ok,
  readJsonObject,
  readString,
} from "@/lib/http";
import { getGeminiCredentials, maskApiKey } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Validate a key without persisting it, so the settings modal can offer a
 * "Test API key" button before the user commits a change.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    const credentials = getGeminiCredentials();

    const candidateKey = readString(body.geminiApiKey, {
      field: "geminiApiKey",
      maxLength: 512,
    });
    const candidateModel = readString(body.geminiModel, {
      field: "geminiModel",
      maxLength: 120,
    });

    const apiKey = candidateKey ?? credentials.apiKey;
    if (!apiKey) {
      throw new AppError(
        400,
        "Enter a Gemini API key first.",
        "GEMINI_KEY_MISSING",
      );
    }

    const model = candidateModel ?? credentials.model;
    const result = await testGeminiConnection(apiKey, model);

    return ok({
      ok: true,
      model: result.model,
      reply: result.reply,
      maskedKey: maskApiKey(apiKey),
      source: candidateKey ? "candidate" : credentials.source,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
