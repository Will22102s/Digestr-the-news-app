import type { NextRequest } from "next/server";
import { normalizeCategoryFilter } from "@/lib/categories";
import { generateBriefing } from "@/lib/briefing";
import { AppError } from "@/lib/errors";
import {
  assertAuthorized,
  errorResponse,
  ok,
  readInteger,
  readJsonObject,
  readString,
} from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    assertAuthorized(request);
    const body = await readJsonObject(request);

    const category = normalizeCategoryFilter(
      readString(body.categorySlug, {
        field: "categorySlug",
        maxLength: 24,
      }) ?? null,
    );

    if (!category) {
      throw new AppError(
        400,
        "categorySlug must be ALL, AI, or CYBERSEC.",
        "INVALID_CATEGORY",
      );
    }

    let articleIds: number[] | undefined;
    if (body.articleIds !== undefined) {
      if (!Array.isArray(body.articleIds)) {
        throw new AppError(
          400,
          "articleIds must be an array of article ids.",
          "INVALID_INPUT",
        );
      }
      if (body.articleIds.length > 50) {
        throw new AppError(
          400,
          "Select at most 50 articles for one briefing.",
          "INVALID_INPUT",
        );
      }

      articleIds = Array.from(
        new Set(
          body.articleIds.map((value) =>
            readInteger(value, 0, {
              min: 1,
              max: 2_147_483_647,
              field: "articleIds",
            }),
          ),
        ),
      );
    }

    const maxArticles = readInteger(body.maxArticles, 30, {
      min: 6,
      max: 50,
      field: "maxArticles",
    });

    const result = await generateBriefing({
      categorySlug: category,
      ...(articleIds === undefined ? {} : { articleIds }),
      maxArticles,
    });

    return ok(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
