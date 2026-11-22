import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, feeds } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/http";
import { buildOpml, parseOpml, type OpmlSource } from "@/lib/opml";
import { truncateAtWord } from "@/lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OPML_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_SOURCES = 2_000;

export async function GET() {
  try {
    const rows = await db
      .select({
        name: feeds.name,
        url: feeds.url,
        categorySlug: categories.slug,
      })
      .from(feeds)
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .orderBy(feeds.name);

    const xml = buildOpml(rows);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="daily-digest-sources.opml"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let xml: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const uploaded = form.get("file");

      if (!(uploaded instanceof File)) {
        throw new AppError(
          400,
          "Attach an OPML file in the `file` field.",
          "MISSING_FILE",
        );
      }
      if (uploaded.size > MAX_OPML_BYTES) {
        throw new AppError(
          413,
          "OPML files must be 2 MB or smaller.",
          "FILE_TOO_LARGE",
        );
      }

      xml = await uploaded.text();
    } else {
      xml = await request.text();
    }

    if (Buffer.byteLength(xml, "utf8") > MAX_OPML_BYTES) {
      throw new AppError(
        413,
        "OPML files must be 2 MB or smaller.",
        "FILE_TOO_LARGE",
      );
    }

    let parsed: OpmlSource[];
    try {
      parsed = parseOpml(xml);
    } catch (error) {
      throw new AppError(
        422,
        error instanceof Error ? error.message : "Could not parse OPML.",
        "INVALID_OPML",
      );
    }

    if (parsed.length === 0) {
      throw new AppError(
        422,
        "No RSS feeds with an xmlUrl were found in that OPML file.",
        "EMPTY_OPML",
      );
    }
    if (parsed.length > MAX_IMPORT_SOURCES) {
      throw new AppError(
        413,
        `Import at most ${MAX_IMPORT_SOURCES} sources at a time.`,
        "TOO_MANY_SOURCES",
      );
    }

    const categoryRows = await db
      .select({ id: categories.id, slug: categories.slug })
      .from(categories);
    const categoryIdBySlug = new Map(
      categoryRows.map((category) => [category.slug, category.id]),
    );

    const rows = parsed.flatMap((source) => {
      const categoryId = categoryIdBySlug.get(source.categorySlug);
      if (!categoryId) return [];

      return [
        {
          categoryId,
          name: truncateAtWord(source.name, 120),
          url: source.url,
          sourceType: source.sourceType,
          isActive: true,
        },
      ];
    });

    let imported = 0;
    for (let index = 0; index < rows.length; index += 250) {
      const chunk = rows.slice(index, index + 250);
      const inserted = await db
        .insert(feeds)
        .values(chunk)
        .onConflictDoNothing({ target: feeds.url })
        .returning({ id: feeds.id });
      imported += inserted.length;
    }

    return ok(
      {
        imported,
        skipped: parsed.length - imported,
        total: parsed.length,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
