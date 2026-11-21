import { vi } from "vitest";
import { Hello, type HelloOptions } from "../src/index.js";

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: BodyInit | null | undefined;
  signal: AbortSignal | null | undefined;
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** A Hello client whose fetch returns the queued responses in order and records every call. */
export function setup(responses: Array<Response | Error | (() => Promise<Response>)>, opts: HelloOptions = {}) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
      signal: init?.signal,
    });
    const next = queue.shift() ?? json({});
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next() : next;
  });
  const client = new Hello({ apiKey: "hello_live_test", baseUrl: "https://api.test", fetch, ...opts });
  return { client, calls, fetch };
}

export const body = (c: Call | undefined) => JSON.parse(String(c?.body));
