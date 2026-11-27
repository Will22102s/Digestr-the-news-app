import type { NextRequest } from "next/server";
import { clearDemoData } from "@/db/demo-data";
import { normalizeCategoryFilter } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import {
  assertAuthorized,
  errorResponse,
  ok,
  readInteger,
  readJsonObject,
  readString,
} from "@/lib/http";
import { syncAllFeeds, type SyncOptions } from "@/lib/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function buildOptions(input: {
  categorySlug?: unknown;
  feedId?: unknown;
  limit?: unknown;
  concurrency?: unknown;
}): SyncOptions {
  const categorySlug = normalizeCategoryFilter(
    readString(input.categorySlug, {
      field: "categorySlug",
      maxLength: 24,
    }) ?? null,
  );

  if (!categorySlug) {
    throw new AppError(
      400,
      "categorySlug must be ALL, AI, or CYBERSEC.",
      "INVALID_CATEGORY",
    );
  }

  let feedId: number | undefined;
  if (input.feedId !== undefined && input.feedId !== null && input.feedId !== "") {
    feedId = readInteger(input.feedId, 0, {
      min: 1,
      max: 2_147_483_647,
      field: "feedId",
    });
  }

  const limit = readInteger(input.limit, 5_000, {
    min: 1,
    max: 5_000,
    field: "limit",
  });

  let concurrency: number | undefined;
  if (
    input.concurrency !== undefined &&
    input.concurrency !== null &&
    input.concurrency !== ""
  ) {
    concurrency = readInteger(input.concurrency, 0, {
      min: 1,
      max: 50,
      field: "concurrency",
    });
  }

  return {
    categorySlug,
    ...(feedId === undefined ? {} : { feedId }),
    limit,
    ...(concurrency === undefined ? {} : { concurrency }),
  };
}

export async function POST(request: NextRequest) {
  try {
    assertAuthorized(request);
    const body = await readJsonObject(request);
    const report = await syncAllFeeds(
      buildOptions({
        categorySlug: body.categorySlug,
        feedId: body.feedId,
        limit: body.limit,
        concurrency: body.concurrency,
      }),
    );

    // Once real coverage arrives, the sample desk has done its job.
    if (report.articlesInserted > 0) clearDemoData();

    return ok(report);
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET supports scheduled ingestion, e.g. Vercel Cron or a system timer. */
export async function GET(request: NextRequest) {
  try {
    assertAuthorized(request);
    const params = request.nextUrl.searchParams;
    const report = await syncAllFeeds(
      buildOptions({
        categorySlug: params.get("category") ?? undefined,
        feedId: params.get("feedId") ?? undefined,
        limit: params.get("limit") ?? undefined,
        concurrency: params.get("concurrency") ?? undefined,
      }),
    );

    if (report.articlesInserted > 0) clearDemoData();

    return ok(report);
  } catch (error) {
    return errorResponse(error);
  }
}
