/** Base class of every error this SDK throws. */
export class HelloError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The request never got an HTTP response (DNS failure, connection reset, ...). */
export class ConnectionError extends HelloError {}

/** The request exceeded the configured `timeout`. */
export class TimeoutError extends HelloError {}

/** Fields an {@link APIError} is built from. */
export interface APIErrorInit {
  status: number;
  message: string;
  /** Meta's numeric `error.code`, or Hello's string `code` on non-Cloud-API routes. */
  code?: number | string;
  /** Meta's `error.error_subcode`. */
  subcode?: number;
  /** Hello's own code (`error.error_data.hello_code`, or `code` on Hello-style errors). */
  helloCode?: string;
  /** Meta's trace id, or Hello's request id. */
  fbtraceId?: string;
  /** `error.error_data.details` (Meta envelope only). */
  details?: unknown;
  /** The parsed JSON error body, or the raw text when it was not JSON. */
  body?: unknown;
  /** Seconds from the `Retry-After` header, when sent. */
  retryAfter?: number;
}

/** The API answered with a non-2xx status. */
export class APIError extends HelloError {
  readonly status: number;
  readonly code: number | string | undefined;
  readonly subcode: number | undefined;
  readonly helloCode: string | undefined;
  readonly fbtraceId: string | undefined;
  readonly details: unknown;
  readonly body: unknown;
  readonly retryAfter: number | undefined;

  constructor(init: APIErrorInit) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.subcode = init.subcode;
    this.helloCode = init.helloCode;
    this.fbtraceId = init.fbtraceId;
    this.details = init.details;
    this.body = init.body;
    this.retryAfter = init.retryAfter;
  }
}

/** 401: the API key is missing, wrong or disabled. */
export class AuthenticationError extends APIError {}

/** 404: unknown number, WABA, template, message or media. */
export class NotFoundError extends APIError {}

/** 429: rate limit or plan limit reached. Check `retryAfter` and `helloCode`. */
export class RateLimitError extends APIError {}

/** Maps a status and parsed error body to the right {@link APIError} subclass. */
export function buildAPIError(status: number, body: unknown, retryAfter: number | undefined): APIError {
  const init: APIErrorInit = { status, message: `HTTP ${status}`, body, retryAfter };
  const root = isRecord(body) ? body : undefined;
  const meta = root && isRecord(root.error) ? root.error : undefined;
  if (meta) {
    // Meta-style envelope: {"error": {message, type, code, error_subcode, error_data, fbtrace_id}}
    const data = isRecord(meta.error_data) ? meta.error_data : {};
    init.message = str(meta.message) ?? init.message;
    init.code = num(meta.code);
    init.subcode = num(meta.error_subcode);
    init.helloCode = str(data.hello_code);
    init.fbtraceId = str(meta.fbtrace_id);
    init.details = data.details;
  } else if (root) {
    // Hello-style: {"message", "code"}
    init.message = str(root.message) ?? init.message;
    init.code = str(root.code);
    init.helloCode = str(root.code);
  } else if (typeof body === "string" && body !== "") {
    init.message = body;
  }
  if (status === 401) return new AuthenticationError(init);
  if (status === 404) return new NotFoundError(init);
  if (status === 429) return new RateLimitError(init);
  return new APIError(init);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
