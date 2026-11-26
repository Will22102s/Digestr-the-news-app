import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import {
  errorResponse,
  ok,
  readJsonObject,
  readString,
} from "@/lib/http";
import {
  getPublicSettings,
  saveGeminiApiKey,
  saveGeminiModel,
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

/**
 * Update local settings. Omitted fields are left untouched; an empty string or
 * null clears a stored value so the environment fallback can take over.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonObject(request);

    const hasKey = Object.prototype.hasOwnProperty.call(body, "geminiApiKey");
    const hasModel = Object.prototype.hasOwnProperty.call(body, "geminiModel");

    if (!hasKey && !hasModel) {
      throw new AppError(
        400,
        "Provide geminiApiKey and/or geminiModel.",
        "INVALID_INPUT",
      );
    }

    if (hasKey) {
      const raw = body.geminiApiKey;
      if (raw === null || raw === "") {
        saveGeminiApiKey(null);
      } else {
        const key = readString(raw, {
          field: "geminiApiKey",
          maxLength: 512,
          required: true,
        });
        if (!key || key.length < 8) {
          throw new AppError(
            400,
            "That does not look like a Gemini API key.",
            "INVALID_INPUT",
          );
        }
        saveGeminiApiKey(key);
      }
    }

    if (hasModel) {
      const raw = body.geminiModel;
      if (raw === null || raw === "") {
        saveGeminiModel(null);
      } else {
        const model = readString(raw, {
          field: "geminiModel",
          maxLength: 120,
          required: true,
        });
        if (!model) {
          throw new AppError(
            400,
            "geminiModel cannot be empty.",
            "INVALID_INPUT",
          );
        }
        saveGeminiModel(model);
      }
    }

    return ok(getPublicSettings());
  } catch (error) {
    return errorResponse(error);
  }
}
