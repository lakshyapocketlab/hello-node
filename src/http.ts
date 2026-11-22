import { APIError, ConnectionError, HelloError, TimeoutError, buildAPIError } from "./errors.js";
import { VERSION } from "./version.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HelloOptions {
  /** API key (`hello_live_...`). Defaults to `process.env.HELLO_API_KEY`. */
  apiKey?: string;
  /** API origin. Defaults to `process.env.HELLO_BASE_URL`, then `https://helloapi.lakshyapocketlab.com`. */
  baseUrl?: string;
  /** Per-attempt timeout in milliseconds. Default 60000. */
  timeout?: number;
  /** Retries after the first attempt, for retry-safe requests. Default 2. */
  maxRetries?: number;
  /** Custom `fetch` implementation (proxies, tests). Defaults to the global one. */
  fetch?: FetchLike;
}

export const DEFAULT_BASE_URL = "https://helloapi.lakshyapocketlab.com";
export const DEFAULT_TIMEOUT = 60_000;
export const DEFAULT_MAX_RETRIES = 2;

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;
const MAX_RETRY_AFTER_MS = 60_000;

export interface RequestSpec {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON body. */
  json?: unknown;
  /** Multipart body. */
  form?: FormData;
  headers?: Record<string, string>;
  /** Overrides the default rule (GET/PUT/DELETE retry; POST does not). */
  retry?: boolean;
  /** Return the raw `Response` (for downloads) instead of parsed JSON. */
  raw?: boolean;
}

/** Joins a path built from encoded segments. Every dynamic segment must go through `seg`. */
export const seg = (value: string): string => encodeURIComponent(value);

/** HTTP transport shared by every resource: auth, timeout, retries, error mapping. */
export class HttpClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: HelloOptions = {}) {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const apiKey = options.apiKey ?? env?.HELLO_API_KEY;
    if (!apiKey) {
      throw new HelloError(
        "Missing API key: pass `apiKey` to new Hello({ apiKey }) or set the HELLO_API_KEY environment variable.",
      );
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new HelloError("No global fetch found (Node >=18 is required): pass a `fetch` option.");
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? (env?.HELLO_BASE_URL || DEFAULT_BASE_URL)).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = (input, init) => fetchImpl(input, init);
  }

  async request<T>(spec: RequestSpec & { raw: true }): Promise<Response>;
  async request<T>(spec: RequestSpec): Promise<T>;
  async request<T>(spec: RequestSpec): Promise<T | Response> {
    const retryable = spec.retry ?? spec.method !== "POST";
    const attempts = retryable ? this.maxRetries : 0;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.attempt<T>(spec);
      } catch (err) {
        if (attempt >= attempts || !shouldRetry(err)) throw err;
        await sleep(backoff(attempt, err instanceof APIError ? err.retryAfter : undefined));
      }
    }
  }

  private async attempt<T>(spec: RequestSpec): Promise<T | Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": `hello-node/${VERSION}`,
      Accept: "application/json",
      ...spec.headers,
    };
    let body: string | FormData | undefined;
    if (spec.form) {
      body = spec.form; // fetch sets the multipart Content-Type with its boundary
    } else if (spec.json !== undefined) {
      body = JSON.stringify(spec.json);
      headers["Content-Type"] = "application/json";
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(spec), { method: spec.method, headers, body, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`, { cause: err });
      }
      throw new ConnectionError(`Connection error: ${errMessage(err)}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw buildAPIError(res.status, await readBody(res), parseRetryAfter(res.headers.get("retry-after")));
    }
    if (spec.raw) return res;
    const text = await res.text();
    if (text === "") return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new APIError({ status: res.status, message: "Invalid JSON in response body", body: text });
    }
  }

  private url(spec: RequestSpec): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(spec.query ?? {})) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return `${this.baseUrl}${spec.path}${qs ? `?${qs}` : ""}`;
  }
}

function shouldRetry(err: unknown): boolean {
  if (err instanceof APIError) return err.status === 429 || err.status >= 500;
  return err instanceof ConnectionError || err instanceof TimeoutError;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Seconds from a `Retry-After` header (delta-seconds or an HTTP date). */
export function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, (date - Date.now()) / 1000);
}

/** Exponential backoff with jitter, or the server's Retry-After (capped). */
export function backoff(attempt: number, retryAfter: number | undefined): number {
  if (retryAfter !== undefined) return Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return exp * (0.5 + Math.random() / 2);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
