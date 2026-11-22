import { afterEach, describe, expect, it, vi } from "vitest";
import { Hello, HelloError, TimeoutError, ConnectionError } from "../src/index.js";
import { setup, json } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("options", () => {
  it("throws without an API key", () => {
    vi.stubEnv("HELLO_API_KEY", "");
    expect(() => new Hello()).toThrow(HelloError);
    expect(() => new Hello()).toThrow(/HELLO_API_KEY/);
  });

  it("throws without an API key when process is unavailable", () => {
    vi.stubGlobal("process", undefined);
    expect(() => new Hello({ fetch: vi.fn() })).toThrow(HelloError);
  });

  it("reads the key from HELLO_API_KEY and uses the default base URL and global fetch", async () => {
    vi.stubEnv("HELLO_API_KEY", "env_key");
    const fetchMock = vi.fn(async () => json({ status: "ok", test_mode: false }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new Hello();
    expect(client.baseUrl).toBe("https://helloapi.lakshyapocketlab.com");
    await client.ping();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://helloapi.lakshyapocketlab.com/v1/ping");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer env_key");
  });

  it("reads the base URL from HELLO_BASE_URL, with the baseUrl option taking precedence", () => {
    vi.stubEnv("HELLO_BASE_URL", "https://staging.example.com/");
    expect(new Hello({ apiKey: "k", fetch: vi.fn() }).baseUrl).toBe("https://staging.example.com");
    expect(new Hello({ apiKey: "k", baseUrl: "https://x.test", fetch: vi.fn() }).baseUrl).toBe("https://x.test");
  });

  it("throws when no fetch exists", () => {
    vi.stubGlobal("fetch", undefined);
    expect(() => new Hello({ apiKey: "k" })).toThrow(/fetch/);
  });

  it("prefers the explicit key and strips trailing slashes from baseUrl", async () => {
    vi.stubEnv("HELLO_API_KEY", "env_key");
    const { client, calls } = setup([json({})], { apiKey: "explicit", baseUrl: "https://x.test///" });
    expect(client.baseUrl).toBe("https://x.test");
    await client.ping();
    expect(calls[0]?.url).toBe("https://x.test/v1/ping");
    expect(calls[0]?.headers.Authorization).toBe("Bearer explicit");
  });
});

describe("ping", () => {
  it("sends GET /v1/ping with auth, user agent and accept headers", async () => {
    const { client, calls } = setup([json({ status: "ok", test_mode: false })]);
    expect(await client.ping()).toEqual({ status: "ok", test_mode: false });
    expect(calls[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/ping" });
    expect(calls[0]?.headers).toMatchObject({
      Authorization: "Bearer hello_live_test",
      "User-Agent": "hello-node/0.1.1",
      Accept: "application/json",
    });
    expect(calls[0]?.headers["Content-Type"]).toBeUndefined();
    expect(calls[0]?.body).toBeUndefined();
  });

  it("returns undefined for an empty body", async () => {
    const { client } = setup([new Response(null, { status: 204 })]);
    expect(await client.ping()).toBeUndefined();
  });

  it("rejects invalid JSON on success", async () => {
    const { client } = setup([new Response("<html>", { status: 200 })]);
    await expect(client.ping()).rejects.toMatchObject({ name: "APIError", status: 200, message: /Invalid JSON/ });
  });
});

describe("transport behaviour", () => {
  it("wraps fetch failures in ConnectionError (after retries)", async () => {
    vi.useFakeTimers();
    const { client, fetch } = setup([new Error("ECONNRESET"), new Error("ECONNRESET"), new Error("ECONNRESET")]);
    const p = client.ping().catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await p;
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toContain("ECONNRESET");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("stringifies non-Error rejections", async () => {
    const { client } = setup([() => Promise.reject("weird")], { maxRetries: 0 });
    await expect(client.ping()).rejects.toThrow("Connection error: weird");
  });

  it("times out via AbortController and retries", async () => {
    vi.useFakeTimers();
    const hang = () =>
      new Promise<Response>(() => {
        /* never settles; the abort signal below rejects */
      });
    let calls = 0;
    const fetch = vi.fn((_url: string, init?: RequestInit) => {
      calls++;
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        void hang;
      });
    });
    const client = new Hello({ apiKey: "k", baseUrl: "https://api.test", fetch, timeout: 100, maxRetries: 1 });
    const p = client.ping().catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await p;
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.message).toContain("100ms");
    expect(calls).toBe(2);
  });

  it("retries GET on 5xx with exponential backoff and jitter, then succeeds", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1); // full delay
    const { client, fetch } = setup([json({ message: "x", code: "E" }, 503), json({ message: "x" }, 500), json({ status: "ok" })]);
    const p = client.ping();
    await vi.advanceTimersByTimeAsync(499);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ status: "ok" });
  });

  it("caps the backoff delay", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1);
    const rs = Array.from({ length: 8 }, () => json({}, 500));
    const { client, fetch } = setup(rs, { maxRetries: 7 });
    const p = client.ping().catch((e) => e);
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000 + 4000 + 8000 + 8000 + 8000);
    await p;
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it("honours Retry-After seconds, capped at 60s", async () => {
    vi.useFakeTimers();
    const { client, fetch } = setup([json({}, 429, { "retry-after": "3" }), json({}, 429, { "retry-after": "9999" }), json({ ok: 1 })]);
    const p = client.ping();
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ ok: 1 });
  });

  it("honours Retry-After as an HTTP date; ignores garbage and blank values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const date = new Date("2026-01-01T00:00:05Z").toUTCString();
    const { client, fetch } = setup([json({}, 429, { "retry-after": date })], { maxRetries: 1 });
    const p = client.ping().catch((e) => e);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await p;

    for (const v of ["garbage", " "]) {
      const s = setup([json({}, 429, { "retry-after": v })], { maxRetries: 0 });
      const err = await s.client.ping().catch((e) => e);
      expect(err.retryAfter).toBeUndefined();
    }
    const past = setup([json({}, 429, { "retry-after": "-5" })], { maxRetries: 0 });
    expect((await past.client.ping().catch((e) => e)).retryAfter).toBe(0);
    const pastDate = setup([json({}, 429, { "retry-after": new Date(0).toUTCString() })], { maxRetries: 0 });
    expect((await pastDate.client.ping().catch((e) => e)).retryAfter).toBe(0);
  });

  it("does not retry 4xx other than 429", async () => {
    const { client, fetch } = setup([json({ message: "bad" }, 400)]);
    await expect(client.ping()).rejects.toMatchObject({ status: 400 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("maxRetries: 0 disables retries; error bodies that are not JSON are kept as text", async () => {
    const { client, fetch } = setup([new Response("upstream down", { status: 502 })], { maxRetries: 0 });
    await expect(client.ping()).rejects.toMatchObject({ status: 502, message: "upstream down", body: "upstream down" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("copes with an unreadable error body", async () => {
    const res = new Response("x", { status: 500 });
    vi.spyOn(res, "text").mockRejectedValue(new Error("stream broke"));
    const { client } = setup([res], { maxRetries: 0 });
    await expect(client.ping()).rejects.toMatchObject({ status: 500, message: "HTTP 500" });
  });
});
