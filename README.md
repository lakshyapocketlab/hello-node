# Hello Node.js SDK for the WhatsApp Business API

Official Node.js SDK for Hello, the WhatsApp Business API. Send messages, templates and webhooks.

[![npm version](https://img.shields.io/npm/v/@lakshyapocketlab/hello)](https://www.npmjs.com/package/@lakshyapocketlab/hello)
[![npm downloads](https://img.shields.io/npm/dm/@lakshyapocketlab/hello)](https://www.npmjs.com/package/@lakshyapocketlab/hello)
[![CI](https://github.com/lakshyapocketlab/hello-node/actions/workflows/ci.yml/badge.svg)](https://github.com/lakshyapocketlab/hello-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/node/v/@lakshyapocketlab/hello)](https://nodejs.org)
[![TypeScript types included](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org)

- Zero runtime dependencies (uses the global `fetch`, `FormData` and `Blob`)
- Node.js 18 or newer, ESM and CommonJS, full TypeScript types
- Typed errors, automatic retries, idempotent sends

## Install

```sh
npm i @lakshyapocketlab/hello
```

## Quickstart

```ts
import { Hello } from "@lakshyapocketlab/hello";

// Pass your API key (hello_live_...) directly; if omitted, HELLO_API_KEY is read from the environment.
const hello = new Hello({ apiKey: "hello_live_..." });

const { data: numbers } = await hello.phoneNumbers.list();
const from = numbers[0]!.phone_number_id;

// Templates can start a conversation; free-form messages need an open 24-hour window.
const res = await hello.messages.sendTemplate(from, "+919999999999", {
  name: "order_shipped",
  language: "en",
  components: [{ type: "body", parameters: [{ type: "text", text: "Asha" }] }],
});
console.log(res.messages[0]?.hello_id);
```

CommonJS: `const { Hello } = require("@lakshyapocketlab/hello");`

## Configuration

```ts
new Hello({
  apiKey: "hello_live_...",                  // default: process.env.HELLO_API_KEY (throws if missing)
  baseUrl: "https://helloapi.lakshyapocketlab.com", // default; env HELLO_BASE_URL overrides it, this option wins
  timeout: 60_000,                           // ms per attempt
  maxRetries: 2,                             // retries after the first attempt
  fetch: customFetch,                        // default: global fetch
});
```

Requests send `Authorization: Bearer <key>` and `User-Agent: hello-node/<version>`.

## Methods

| Method | Route |
|---|---|
| `hello.ping()` | `GET /v1/ping` |
| `hello.phoneNumbers.list()` | `GET /v1/phone_numbers` |
| `hello.phoneNumbers.listForWaba(wabaId)` | `GET /v1/{waba_id}/phone_numbers` |
| `hello.messages.send(phoneNumberId, body, opts?)` | `POST /v1/{phone_number_id}/messages` |
| `hello.messages.sendText(phoneNumberId, to, text, opts?)` | same |
| `hello.messages.sendTemplate(phoneNumberId, to, { name, language, components? }, opts?)` | same |
| `hello.messages.sendMedia(phoneNumberId, to, { type, id \| link, caption?, filename? }, opts?)` | same |
| `hello.messages.markAsRead(phoneNumberId, messageId, { typingIndicator? })` | same, `status: "read"` |
| `hello.messages.get(id)` | `GET /v1/messages/{id}` (Hello id or wamid) |
| `hello.media.upload(phoneNumberId, file, mimeType, filename?)` | `POST /v1/{phone_number_id}/media` |
| `hello.media.get(mediaId)` | `GET /v1/{media_id}` |
| `hello.media.download(mediaId)` | `GET /v1/{media_id}/download` |
| `hello.templates.list(wabaId, params?)` | `GET /v1/{waba_id}/message_templates` |
| `hello.templates.get(templateId)` | `GET /v1/templates/{template_id}` |
| `hello.templates.create(wabaId, template)` | `POST /v1/{waba_id}/message_templates` |
| `hello.templates.createBulk(wabaId, templates)` | `POST /v1/{waba_id}/templates/bulk` |
| `hello.templates.edit(templateId, changes)` | `POST /v1/templates/{template_id}` |
| `hello.templates.sync(wabaId)` | `POST /v1/{waba_id}/templates/sync` |
| `hello.templates.delete(templateId)` | `DELETE /v1/templates/{template_id}` (one language) |
| `hello.templates.deleteByName(wabaId, name)` | `DELETE /v1/{waba_id}/message_templates?name=` (all languages) |
| `hello.webhookOverride.get(phoneNumberId, { refresh? })` | `GET /v1/{phone_number_id}/webhook-override` |
| `hello.webhookOverride.set(phoneNumberId, { url, verifyToken, acknowledgeNoTracking })` | `PUT ...` |
| `hello.webhookOverride.remove(phoneNumberId)` | `DELETE ...` |
| `hello.webhookOverride.reapply(phoneNumberId)` | `POST .../reapply` |

### Sending

`messages.send` takes any WhatsApp Cloud API message body (text, template, image, video, audio,
document, sticker, location, contacts, interactive, reaction) and forwards it unchanged. The
typed union gives autocomplete; any other object is accepted as an escape hatch.

```ts
await hello.messages.send(from, {
  to: "+919999999999",
  type: "interactive",
  interactive: { type: "button", body: { text: "Confirm?" }, action: { buttons: [] } },
});
```

Options on every send: `idempotencyKey`, `sync` (wait up to ~25 s for WhatsApp to accept; the
response then carries the wamid), `async` (return at once; `messages[0].id` is empty and
`messages[0].hello_id` identifies the message). Follow up with `messages.get(hello_id)`.

### Media

```ts
import { readFile } from "node:fs/promises";

const { id } = await hello.media.upload(from, await readFile("invoice.pdf"), "application/pdf", "Invoice.pdf");
await hello.messages.sendMedia(from, "+919999999999", { type: "document", id, filename: "Invoice.pdf" });

const { data, contentType } = await hello.media.download(mediaId); // data: ArrayBuffer
await writeFile("out.bin", Buffer.from(data));
```

`upload` accepts a `Blob`/`File`, `Buffer`, `Uint8Array` or `ArrayBuffer`. `download` buffers the
whole file and returns it as an `ArrayBuffer` plus the `Content-Type`.

### Templates

```ts
const { data } = await hello.templates.list(wabaId, { status: "APPROVED", limit: 50 });
// next page: pass the response's paging.cursors.after as `after`
```

## Errors

Every error extends `HelloError`.

| Class | When |
|---|---|
| `APIError` | Any non-2xx response. Has `status`, `message`, `code`, `subcode`, `helloCode`, `fbtraceId`, `details`, `body`, `retryAfter` |
| `AuthenticationError` | 401 |
| `NotFoundError` | 404 |
| `RateLimitError` | 429 (rate or plan limit; see `helloCode`, `retryAfter`) |
| `ConnectionError` | No HTTP response (network failure) |
| `TimeoutError` | `timeout` exceeded |

Both server envelopes are parsed: Meta-style `{"error": {message, code, error_subcode, error_data:
{details, hello_code}, fbtrace_id}}` (sends, media, templates) and Hello-style `{message, code}`.

```ts
import { APIError, RateLimitError } from "@lakshyapocketlab/hello";

try {
  await hello.messages.sendText(from, to, "hi");
} catch (err) {
  if (err instanceof RateLimitError) console.log("retry in", err.retryAfter, err.helloCode);
  else if (err instanceof APIError) console.log(err.status, err.helloCode, err.fbtraceId);
  else throw err;
}
```

## Retries

429, 5xx, timeouts and network errors are retried up to `maxRetries` times (default 2) with
exponential backoff (0.5 s base, 8 s cap) and jitter. A `Retry-After` header is honoured (capped
at 60 s).

- `GET`, `PUT` and `DELETE` requests are retried.
- A message send is **never** retried unless you pass `idempotencyKey`, so a billed message is
  not sent twice. With a key, retries return the original message.
- `markAsRead`, `templates.sync` and `webhookOverride.reapply` are retried.
- `media.upload` (each upload creates a new media id) and `templates.create`, `edit` and
  `createBulk` are **not** retried.

```ts
await hello.messages.sendText(from, to, "hi", { idempotencyKey: crypto.randomUUID() });
```

## License

MIT, Copyright Lakshya Pocket Lab.
