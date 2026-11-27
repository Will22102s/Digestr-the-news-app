import { GoogleGenAI, Type } from "@google/genai";
import { AppError } from "./errors";
import {
  normalizeOllamaBaseUrl,
  type AiCredentials,
  type AiProviderId,
} from "./settings";
import { truncateAtWord } from "./text";

const REQUEST_TIMEOUT_MS = 180_000;

export type EditorialRequest = {
  systemInstruction: string;
  prompt: string;
};

export type AiTestResult = {
  provider: AiProviderId;
  model: string;
  reply: string;
};

const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "A specific, editorial headline of 6–12 words. No quotation marks.",
    },
    contentMarkdown: {
      type: Type.STRING,
      description:
        "600–800 words of Markdown prose with 3–5 H2 sections and inline citations as [Source](URL). No H1.",
    },
  },
  required: ["title", "contentMarkdown"],
  propertyOrdering: ["title", "contentMarkdown"],
};

const JSON_INSTRUCTION =
  'Return only a JSON object with two string fields: "title" (6–12 words) and "contentMarkdown" (the full Markdown essay). Do not wrap it in code fences.';

let cachedGemini: { apiKey: string; client: GoogleGenAI } | null = null;

function geminiClient(apiKey: string): GoogleGenAI {
  if (cachedGemini?.apiKey === apiKey) return cachedGemini.client;
  const client = new GoogleGenAI({ apiKey });
  cachedGemini = { apiKey, client };
  return client;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown provider error.";
}

function friendlyMessage(raw: string, provider: string, model: string): string {
  const normalized = raw.toLowerCase();

  if (
    normalized.includes("api key not valid") ||
    normalized.includes("api_key_invalid") ||
    normalized.includes("invalid api key") ||
    normalized.includes("unauthorized")
  ) {
    return `That ${provider} API key was rejected. Check it and try again.`;
  }

  if (
    normalized.includes("model") &&
    (normalized.includes("not found") ||
      normalized.includes("does not exist") ||
      normalized.includes("not supported") ||
      normalized.includes("decommissioned"))
  ) {
    return `The model “${model}” is not available to this ${provider} key.`;
  }

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("econnrefused") ||
    normalized.includes("network")
  ) {
    return `Could not reach ${provider}. Check your connection and try again.`;
  }

  return truncateAtWord(raw, 280);
}

async function readJsonResponse(
  response: Response,
  provider: string,
  model: string,
): Promise<unknown> {
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const record = payload as {
      error?: { message?: string } | string;
      message?: string;
    } | null;
    const detail =
      (typeof record?.error === "string" ? record.error : record?.error?.message) ??
      record?.message ??
      text;

    throw new AppError(
      502,
      friendlyMessage(detail || `HTTP ${response.status}`, provider, model),
      "PROVIDER_ERROR",
      { provider, status: response.status },
    );
  }

  return payload;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  provider: string,
  model: string,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AppError(
      502,
      friendlyMessage(messageFrom(error), provider, model),
      "PROVIDER_UNREACHABLE",
      { provider },
    );
  }

  return readJsonResponse(response, provider, model);
}

async function generateWithGemini(
  credentials: Extract<AiCredentials, { provider: "gemini" }>,
  request: EditorialRequest,
): Promise<string> {
  try {
    const response = await geminiClient(credentials.apiKey).models.generateContent(
      {
        model: credentials.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 8_192,
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
        },
      },
    );

    return response.text ?? "";
  } catch (error) {
    const raw = messageFrom(error);
    throw new AppError(
      502,
      friendlyMessage(raw, "Gemini", credentials.model),
      "PROVIDER_ERROR",
      { provider: "gemini" },
    );
  }
}

async function generateWithGroq(
  credentials: Extract<AiCredentials, { provider: "groq" }>,
  request: EditorialRequest,
): Promise<string> {
  const payload = (await fetchJson(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: credentials.model,
        messages: [
          { role: "system", content: request.systemInstruction },
          {
            role: "user",
            content: `${request.prompt}\n\n${JSON_INSTRUCTION}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 8_192,
        response_format: { type: "json_object" },
      }),
    },
    "Groq",
    credentials.model,
  )) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  const content = payload?.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new AppError(
      502,
      "Groq returned an empty response. Please try again.",
      "EMPTY_MODEL_RESPONSE",
      { provider: "groq" },
    );
  }

  return content;
}

async function generateWithOllama(
  credentials: Extract<AiCredentials, { provider: "ollama" }>,
  request: EditorialRequest,
): Promise<string> {
  const baseUrl = normalizeOllamaBaseUrl(credentials.baseUrl);

  const payload = (await fetchJson(
    `${baseUrl}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: credentials.model,
        messages: [
          { role: "system", content: request.systemInstruction },
          {
            role: "user",
            content: `${request.prompt}\n\n${JSON_INSTRUCTION}`,
          },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.4, num_predict: 8_192 },
      }),
    },
    "Ollama",
    credentials.model,
  )) as { message?: { content?: string } } | null;

  const content = payload?.message?.content;
  if (!content?.trim()) {
    throw new AppError(
      502,
      "Ollama returned an empty response. Please try again.",
      "EMPTY_MODEL_RESPONSE",
      { provider: "ollama" },
    );
  }

  return content;
}

/** Send one editorial prompt to the configured provider and return raw JSON. */
export async function generateEditorial(
  credentials: AiCredentials,
  request: EditorialRequest,
): Promise<string> {
  if (credentials.provider === "gemini") {
    return generateWithGemini(credentials, request);
  }
  if (credentials.provider === "groq") {
    return generateWithGroq(credentials, request);
  }
  return generateWithOllama(credentials, request);
}

async function testGemini(
  apiKey: string,
  model: string,
): Promise<AiTestResult> {
  try {
    const response = await geminiClient(apiKey).models.generateContent({
      model,
      contents: "Reply with the single word OK.",
      config: { maxOutputTokens: 8, temperature: 0 },
    });

    return {
      provider: "gemini",
      model,
      reply: response.text?.trim() || "OK",
    };
  } catch (error) {
    throw new AppError(
      400,
      friendlyMessage(messageFrom(error), "Gemini", model),
      "AI_TEST_FAILED",
      { provider: "gemini", model },
    );
  }
}

async function testGroq(apiKey: string, model: string): Promise<AiTestResult> {
  try {
    const payload = (await fetchJson(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with the single word OK." }],
          temperature: 0,
          max_tokens: 8,
        }),
      },
      "Groq",
      model,
    )) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;

    return {
      provider: "groq",
      model,
      reply: payload?.choices?.[0]?.message?.content?.trim() || "OK",
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError(400, error.message, "AI_TEST_FAILED", {
        provider: "groq",
        model,
      });
    }
    throw error;
  }
}

async function testOllama(
  baseUrl: string,
  model: string,
): Promise<AiTestResult> {
  const normalized = normalizeOllamaBaseUrl(baseUrl);
  let response: Response;

  try {
    response = await fetch(`${normalized}/api/tags`, {
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new AppError(
      400,
      `Could not reach Ollama at ${normalized}. Start Ollama and try again.`,
      "AI_TEST_FAILED",
      { provider: "ollama" },
    );
  }

  if (!response.ok) {
    throw new AppError(
      400,
      `Ollama responded with HTTP ${response.status} at ${normalized}.`,
      "AI_TEST_FAILED",
      { provider: "ollama" },
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    models?: Array<{ name?: string }>;
  } | null;

  const installed = (payload?.models ?? [])
    .map((entry) => entry.name ?? "")
    .filter(Boolean);

  const found =
    installed.length === 0 ||
    installed.some(
      (name) => name === model || name.startsWith(`${model}:`),
    );

  if (!found) {
    throw new AppError(
      400,
      `Ollama is running, but “${model}” is not installed. Run \`ollama pull ${model}\` first.`,
      "AI_TEST_FAILED",
      { provider: "ollama", installed },
    );
  }

  return {
    provider: "ollama",
    model,
    reply: installed.length > 0 ? "Ollama is reachable." : "Ollama is reachable (no models installed).",
  };
}

/** Validate one provider without persisting anything. */
export async function testAiProvider(input: {
  provider: AiProviderId;
  apiKey?: string;
  model: string;
  baseUrl?: string;
}): Promise<AiTestResult> {
  if (input.provider === "fallback") {
    return {
      provider: "fallback",
      model: "algorithmic",
      reply: "The built-in editor is always available.",
    };
  }

  if (input.provider === "gemini") {
    if (!input.apiKey) {
      throw new AppError(
        400,
        "Enter a Gemini API key first.",
        "AI_TEST_FAILED",
      );
    }
    return testGemini(input.apiKey, input.model);
  }

  if (input.provider === "groq") {
    if (!input.apiKey) {
      throw new AppError(400, "Enter a Groq API key first.", "AI_TEST_FAILED");
    }
    return testGroq(input.apiKey, input.model);
  }

  return testOllama(input.baseUrl ?? "http://localhost:11434", input.model);
}
