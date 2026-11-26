import type {
  ArticlesResponse,
  BriefingDTO,
  BriefingsResponse,
  GenerateBriefingResponse,
  SettingsDTO,
  SettingsTestResponse,
  SourceDTO,
  SourcesResponse,
  StatsDTO,
  SyncReport,
} from "./types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = "API_ERROR") {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as {
      error?: { message?: string; code?: string };
    } | null)?.error;

    throw new ApiClientError(
      response.status,
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.code ?? "API_ERROR",
    );
  }

  return payload as T;
}

export function getArticles(
  params: {
    category?: string;
    q?: string;
    bookmarked?: boolean;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
): Promise<ArticlesResponse> {
  const search = new URLSearchParams();

  if (params.category && params.category !== "ALL") {
    search.set("category", params.category);
  }
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.bookmarked) search.set("bookmarked", "true");
  search.set("limit", String(params.limit ?? 60));
  search.set("offset", String(params.offset ?? 0));

  return request<ArticlesResponse>(`/api/articles?${search.toString()}`, {
    signal,
  });
}

export function getBriefings(
  params: { category?: string; limit?: number; offset?: number } = {},
): Promise<BriefingsResponse> {
  const search = new URLSearchParams();
  if (params.category && params.category !== "ALL") {
    search.set("category", params.category);
  }
  search.set("limit", String(params.limit ?? 1));
  search.set("offset", String(params.offset ?? 0));

  return request<BriefingsResponse>(`/api/briefings?${search.toString()}`);
}

export function generateBriefing(
  categorySlug: string,
): Promise<GenerateBriefingResponse> {
  return request<GenerateBriefingResponse>("/api/briefings/generate", {
    method: "POST",
    body: { categorySlug },
  });
}

export function setArticleBookmark(
  id: number,
  isBookmarked: boolean,
): Promise<{ article: { id: number; isBookmarked: boolean } }> {
  return request("/api/articles", {
    method: "PATCH",
    body: { id, isBookmarked },
  });
}

export function getSources(): Promise<SourcesResponse> {
  return request<SourcesResponse>("/api/sources");
}

export function addSource(input: {
  url: string;
  name?: string;
  categorySlug: string;
}): Promise<{ source: SourceDTO; previewItems: number }> {
  return request("/api/sources", {
    method: "POST",
    body: input,
  });
}

export function updateSource(input: {
  id: number;
  name?: string;
  url?: string;
  categorySlug?: string;
  isActive?: boolean;
}): Promise<{ source: SourceDTO }> {
  return request("/api/sources", {
    method: "PATCH",
    body: input,
  });
}

export function deleteSource(id: number): Promise<{ deleted: boolean; id: number }> {
  return request(`/api/sources?id=${id}`, { method: "DELETE" });
}

export function importOpml(file: File): Promise<{
  imported: number;
  skipped: number;
  total: number;
}> {
  const form = new FormData();
  form.append("file", file);

  return request("/api/sources/opml", {
    method: "POST",
    body: form,
  });
}

export function syncFeeds(): Promise<SyncReport> {
  return request<SyncReport>("/api/feeds/sync", {
    method: "POST",
    body: {},
  });
}

export function getStats(): Promise<StatsDTO> {
  return request<StatsDTO>("/api/stats");
}

export function getSettings(): Promise<SettingsDTO> {
  return request<SettingsDTO>("/api/settings");
}

export function updateSettings(input: {
  geminiApiKey?: string | null;
  geminiModel?: string | null;
}): Promise<SettingsDTO> {
  return request<SettingsDTO>("/api/settings", {
    method: "PUT",
    body: input,
  });
}

export function testGeminiKey(input: {
  geminiApiKey?: string;
  geminiModel?: string;
}): Promise<SettingsTestResponse> {
  return request<SettingsTestResponse>("/api/settings/test", {
    method: "POST",
    body: input,
  });
}

export type { BriefingDTO };
