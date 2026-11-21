import { describe, expect, it } from "vitest";
import {
  APIError,
  AuthenticationError,
  ConnectionError,
  HelloError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
} from "../src/index.js";
import { buildAPIError } from "../src/errors.js";

const meta = (code: number, extra: Record<string, unknown> = {}) => ({
  error: {
    message: "boom",
    type: "OAuthException",
    code,
    error_subcode: 33,
    error_data: { details: "why", hello_code: "NOT_FOUND" },
    fbtrace_id: "trace-1",
    ...extra,
  },
});

describe("buildAPIError", () => {
  it("parses the Meta-style envelope", () => {
    const e = buildAPIError(400, meta(100), undefined);
    expect(e).toBeInstanceOf(APIError);
    expect(e.constructor).toBe(APIError);
    expect(e).toMatchObject({
      status: 400,
      message: "boom",
      code: 100,
      subcode: 33,
      helloCode: "NOT_FOUND",
      fbtraceId: "trace-1",
      details: "why",
    });
    expect(e.name).toBe("APIError");
  });

  it("tolerates a sparse Meta envelope", () => {
    const e = buildAPIError(500, { error: { message: 5, code: "x" } }, undefined);
    expect(e.message).toBe("HTTP 500");
    expect(e.code).toBeUndefined();
    expect(e.helloCode).toBeUndefined();
  });

  it("parses the Hello-style envelope", () => {
    const e = buildAPIError(409, { message: "no number", code: "ACCOUNT_NOT_REGISTERED" }, undefined);
    expect(e).toMatchObject({ status: 409, message: "no number", code: "ACCOUNT_NOT_REGISTERED", helloCode: "ACCOUNT_NOT_REGISTERED" });
    expect(e.fbtraceId).toBeUndefined();
  });

  it("falls back for an empty JSON object, text and non-string bodies", () => {
    expect(buildAPIError(500, {}, undefined).message).toBe("HTTP 500");
    expect(buildAPIError(502, "Bad gateway", undefined).message).toBe("Bad gateway");
    expect(buildAPIError(502, "", undefined).message).toBe("HTTP 502");
    expect(buildAPIError(502, [1], undefined).message).toBe("HTTP 502");
    expect(buildAPIError(502, null, undefined).message).toBe("HTTP 502");
  });

  it("maps 401 to AuthenticationError", () => {
    const e = buildAPIError(401, meta(190), undefined);
    expect(e).toBeInstanceOf(AuthenticationError);
    expect(e).toBeInstanceOf(APIError);
    expect(e).toBeInstanceOf(HelloError);
    expect(e.name).toBe("AuthenticationError");
  });

  it("maps 404 to NotFoundError", () => {
    expect(buildAPIError(404, meta(100), undefined)).toBeInstanceOf(NotFoundError);
  });

  it("maps 429 to RateLimitError with retryAfter", () => {
    const e = buildAPIError(429, { message: "slow", code: "PLAN_DAILY_LIMIT_REACHED" }, 7);
    expect(e).toBeInstanceOf(RateLimitError);
    expect(e.retryAfter).toBe(7);
  });

  it("falls back to APIError for other statuses", () => {
    expect(buildAPIError(402, "pay", undefined).constructor).toBe(APIError);
    expect(buildAPIError(403, { message: "m", code: "TEMPLATE_NOT_APPROVED" }, undefined).constructor).toBe(APIError);
  });
});

describe("transport errors", () => {
  it("are HelloErrors with their own names and causes", () => {
    const cause = new Error("x");
    const c = new ConnectionError("down", { cause });
    const t = new TimeoutError("slow");
    expect(c).toBeInstanceOf(HelloError);
    expect(c.cause).toBe(cause);
    expect(c.name).toBe("ConnectionError");
    expect(t.name).toBe("TimeoutError");
    expect(new HelloError("x").name).toBe("HelloError");
  });
});
