// Sends a text message and shows how to branch on the SDK's typed errors.
// Run with tsx: HELLO_API_KEY=hello_live_xxx npx tsx examples/error-handling.ts <phone_number_id> <to> "Hello"
import {
  APIError,
  AuthenticationError,
  ConnectionError,
  Hello,
  HelloError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
} from "@lakshyapocketlab/hello";

const [pnid, to, text] = process.argv.slice(2);
if (!pnid || !to || !text) throw new Error('usage: error-handling <phone_number_id> <to> "<text>"');

// Reads HELLO_API_KEY. Retries for 429, 5xx and network errors have already run when we catch.
const hello = new Hello();

try {
  const res = await hello.messages.sendText(pnid, to, text);
  console.log("accepted, Hello ID:", res.messages[0]?.hello_id);
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error("bad or disabled API key:", err.message);
  } else if (err instanceof RateLimitError) {
    console.error(`rate limited (${err.helloCode ?? "429"}); retry after ${err.retryAfter ?? "a while"} s`);
  } else if (err instanceof NotFoundError) {
    console.error("not found, check the phone_number_id:", err.message);
  } else if (err instanceof APIError) {
    // helloCode (e.g. VALIDATION_ERROR) is the stable value to branch on; quote fbtraceId to support.
    console.error(
      `API error ${err.status} hello_code=${err.helloCode} code=${err.code} trace=${err.fbtraceId}: ${err.message}`,
    );
  } else if (err instanceof TimeoutError || err instanceof ConnectionError) {
    console.error("network problem, retries already ran:", err.message);
  } else if (err instanceof HelloError) {
    console.error("hello error:", err.message);
  } else {
    throw err;
  }
  process.exitCode = 1;
}
