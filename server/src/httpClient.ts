import { ProviderUpstreamError } from "./errors.ts";

export type FetchLike = typeof globalThis.fetch;

export interface UpstreamRequestOptions {
  providerName: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  idempotentRetry?: boolean;
  fetchFn?: FetchLike;
}

export async function requestUpstreamJson<T = unknown>(
  options: UpstreamRequestOptions
): Promise<T> {
  const {
    providerName,
    url,
    method = "GET",
    headers = {},
    body,
    timeoutMs = 12000,
    idempotentRetry = method === "GET",
    fetchFn = globalThis.fetch,
  } = options;

  const maxAttempts = idempotentRetry ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const text = await response.text();
      let parsed: unknown = null;
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text.slice(0, 240) };
        }
      }

      if (!response.ok) {
        const errMessage = extractUpstreamErrorMessage(parsed) ?? response.statusText;
        if (attempt < maxAttempts && response.status >= 500) {
          await new Promise((r) => setTimeout(r, 180 * attempt));
          continue;
        }
        throw new ProviderUpstreamError(providerName, response.status, errMessage);
      }

      return parsed as T;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ProviderUpstreamError) {
        throw err;
      }
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 180 * attempt));
        continue;
      }
    }
  }

  const msg =
    lastError instanceof Error ? lastError.message : "Network or timeout error";
  throw new ProviderUpstreamError(providerName, 504, msg);
}

function extractUpstreamErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.message === "string") return obj.message;
  if (obj.error && typeof obj.error === "object") {
    const errObj = obj.error as Record<string, unknown>;
    if (typeof errObj.message === "string") return errObj.message;
    if (typeof errObj.description === "string") return errObj.description;
  }
  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const first = obj.errors[0] as Record<string, unknown>;
    if (typeof first.message === "string") return first.message;
    if (typeof first.title === "string") return first.title;
  }
  return undefined;
}

