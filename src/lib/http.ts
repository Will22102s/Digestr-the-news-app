import { NextResponse } from "next/server";
import { AppError } from "./errors";

/** Optional bearer/header/query protection for mutation-heavy endpoints. */
export function assertAuthorized(request: Request): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return;

  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = new URL(request.url).searchParams.get("secret");

  if (bearer !== secret && headerSecret !== secret && querySecret !== secret) {
    throw new AppError(
      401,
      "Unauthorized. Provide the CRON_SECRET as a Bearer token.",
      "UNAUTHORIZED",
    );
  }
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const text = await request.text();

  if (!text.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError(400, "Request body must be valid JSON.", "INVALID_JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError(
      400,
      "Request body must be a JSON object.",
      "INVALID_BODY",
    );
  }

  return parsed as Record<string, unknown>;
}

export function readInteger(
  value: unknown,
  fallback: number,
  {
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    field = "value",
  }: { min?: number; max?: number; field?: string } = {},
): number {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new AppError(400, `${field} must be an integer.`, "INVALID_INPUT");
  }
  if (parsed < min || parsed > max) {
    throw new AppError(
      400,
      `${field} must be between ${min} and ${max}.`,
      "INVALID_INPUT",
    );
  }

  return parsed;
}

export function readBoolean(
  value: unknown,
  field = "value",
): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;

  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;

  throw new AppError(400, `${field} must be a boolean.`, "INVALID_INPUT");
}

export function readString(
  value: unknown,
  {
    field = "value",
    maxLength = 500,
    required = false,
  }: { field?: string; maxLength?: number; required?: boolean } = {},
): string | undefined {
  if (value === undefined || value === null) {
    if (required) {
      throw new AppError(400, `${field} is required.`, "INVALID_INPUT");
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError(400, `${field} must be a string.`, "INVALID_INPUT");
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new AppError(400, `${field} is required.`, "INVALID_INPUT");
  }
  if (trimmed.length > maxLength) {
    throw new AppError(
      400,
      `${field} must be ${maxLength} characters or fewer.`,
      "INVALID_INPUT",
    );
  }

  return trimmed || undefined;
}

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  console.error("[api] Unhandled error:", error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
