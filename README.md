# Hello Node.js SDK for the WhatsApp Business API

Official Node.js SDK for Hello, the WhatsApp Business API. Send messages, templates and webhooks.

[![npm version](https://img.shields.io/npm/v/@lakshyapocketlab/hello)](https://www.npmjs.com/package/@lakshyapocketlab/hello)
[![npm downloads](https://img.shields.io/npm/dm/@lakshyapocketlab/hello)](https://www.npmjs.com/package/@lakshyapocketlab/hello)
[![CI](https://github.com/lakshyapocketlab/hello-node/actions/workflows/ci.yml/badge.svg)](https://github.com/lakshyapocketlab/hello-node/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/lakshyapocketlab/hello-node/badge)](https://scorecard.dev/viewer/?uri=github.com/lakshyapocketlab/hello-node)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/node/v/@lakshyapocketlab/hello)](https://nodejs.org)
[![TypeScript types included](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org)

- Zero runtime dependencies (uses the global `fetch`, `FormData` and `Blob`)
- Node.js 18 or newer, ESM and CommonJS, full TypeScript types
- Typed errors, automatic retries, idempotent sends

## Quick start

**1. Install**

```sh
npm i @lakshyapocketlab/hello
```

**2. Get an API key.** Create one (`hello_live_...`) in the [Hello dashboard](https://hello.lakshyapocketlab.com) under **Integrations**, then export it:

```sh
export HELLO_API_KEY=hello_live_...
```

**3. Send your first message.** Replace `PHONE_NUMBER_ID` with your sending number's ID (see [Setup](#phone-number-id-and-waba-id)). Free-form text needs the recipient to have messaged you in the last 24 hours; otherwise send an approved template.

```ts
import { Hello } from "@lakshyapocketlab/hello";

const hello = new Hello(); // reads HELLO_API_KEY
const res = await hello.messages.sendText("PHONE_NUMBER_ID", "+16505551234", "Your order has shipped.");
console.log("Hello ID:", res.messages[0]?.hello_id);
```

The snippet uses top-level `await`, so run it as an ES module (a `.mjs` file or `"type": "module"` in `package.json`). CommonJS code can wrap it in an `async` function. The runnable version is [`examples/send-text.ts`](examples/send-text.ts).

## Setup

### Prerequisites

- Node.js 18 or newer. The repo pins Node 20 in `.nvmrc`.
- ESM and CommonJS are both supported. TypeScript types ship with the package; there are no runtime dependencies.

### Phone number ID and WABA ID

- `phone_number_id` identifies the sending number. Messages and media use it.
- `waba_id` (WhatsApp Business Account ID) identifies the account. Templates use it.

Both are shown for each number in the Hello dashboard. You can also read them in code:

```ts
const { data } = await hello.phoneNumbers.list();
// data[0].phone_number_id -> messages.*, media.upload
// data[0].waba_id         -> templates.*
```

### API key and base URL

Pass the key explicitly, or leave it out and set `HELLO_API_KEY`:

```ts
const hello = new Hello({ apiKey: "hello_live_..." }); // explicit option wins
const hello = new Hello();                             // reads process.env.HELLO_API_KEY
```

If neither is set, the constructor throws.

The API host defaults to `https://helloapi.lakshyapocketlab.com`. Override it with the `baseUrl` option or the `HELLO_BASE_URL` environment variable (the option wins over the variable). Use this for staging or a self-hosted gateway.

### Client options

```ts
new Hello({
  apiKey: "hello_live_...",                          // default: process.env.HELLO_API_KEY
  baseUrl: "https://helloapi.lakshyapocketlab.com", // default; env HELLO_BASE_URL
  timeout: 60_000,                                  // ms per attempt; default 60 s
  maxRetries: 2,                                    // retries after the first attempt; default 2
  fetch: customFetch,                               // default: global fetch (proxies, tests)
});
```

Requests send `Authorization: Bearer <key>` and `User-Agent: hello-node/<version>`.

## Usage

The examples below assume `const hello = new Hello();` as in [Setup](#setup).

### Send a text message

```ts
const res = await hello.messages.sendText(pnid, "+16505551234", "Hi Asha");
console.log(res.messages[0]?.hello_id); // follow it with messages.get
```

### Send a template

Templates are the only type that can start a conversation. Body variables (`{{1}}`, `{{2}}`) go in `parameters`, in order:

```ts
await hello.messages.sendTemplate(pnid, "+16505551234", {
  name: "order_shipped",
  language: "en",
  components: [{ type: "body", parameters: [{ type: "text", text: "Asha" }, { type: "text", text: "#10432" }] }],
});
```

### Send media (upload, then send)

Media uploaded from one number can only be sent from that number.

```ts
import { readFile } from "node:fs/promises";

const { id } = await hello.media.upload(pnid, await readFile("invoice.pdf"), "application/pdf", "Invoice.pdf");
await hello.messages.sendMedia(pnid, "+16505551234", { type: "document", id, filename: "Invoice.pdf" });
```

`upload` accepts a `Blob`/`File`, `Buffer`, `Uint8Array` or `ArrayBuffer`. Media at a public URL needs no upload: pass `{ type, link }` instead of `id`. For other types (reaction, location, interactive, ...), call `messages.send` with the raw Cloud API body.

Downloading inbound media buffers the whole file:

```ts
const { data, contentType } = await hello.media.download(mediaId); // data: ArrayBuffer
await writeFile("out.bin", Buffer.from(data));
```

### Mark as read

```ts
await hello.messages.markAsRead(pnid, inboundWamid);
await hello.messages.markAsRead(pnid, inboundWamid, { typingIndicator: true });
```

### Message status

```ts
const msg = await hello.messages.get(res.messages[0]!.hello_id); // Hello id or wamid
console.log(msg.status); // queued, sent, delivered, read or failed
```

### Send options

Every send accepts these options as the last argument:

| Option | Effect |
|---|---|
| `idempotencyKey` | Makes the send safe to retry. See [Retries](#idempotency-and-retries). |
| `sync` | Wait up to about 25 s for WhatsApp to accept; the response then carries the wamid. |
| `async` | Return at once, queued. Wins over `sync`. `messages[0].id` is empty; use `hello_id`. |

Without `sync` or `async`, the API key's default send mode applies.

### Templates

```ts
const { data } = await hello.templates.list(wabaId, { status: "APPROVED", limit: 50 });
// next page: pass the response's paging.cursors.after as `after`

const created = await hello.templates.create(wabaId, {
  name: "order_shipped", language: "en", category: "UTILITY",
  components: [{ type: "BODY", text: "Hi {{1}}, order {{2}} shipped." }],
});
await hello.templates.edit(created.id, { category: "UTILITY" });
await hello.templates.createBulk(wabaId, [/* up to 100 create bodies */]);
await hello.templates.sync(wabaId);                  // re-read every template from Meta
await hello.templates.delete(templateId);            // one language
await hello.templates.deleteByName(wabaId, "order_shipped"); // every language
```

A full paging loop is in [`examples/list-templates.ts`](examples/list-templates.ts).

### Phone numbers

```ts
const { data } = await hello.phoneNumbers.list();                // all numbers of the key's organization
const waba = await hello.phoneNumbers.listForWaba(wabaId);       // numbers of one WABA
```

### Direct webhook (webhook override)

This points a number's Meta webhook straight at your URL. Hello's dashboard then stops tracking that number's incoming messages and statuses, so read the Hello docs on direct mode before you enable it.

```ts
await hello.webhookOverride.set(pnid, {
  url: "https://example.com/hooks/meta/9f2c4e1a7b3d",
  verifyToken: "a-long-token",
  acknowledgeNoTracking: true,
});
const current = await hello.webhookOverride.get(pnid, { refresh: true }); // checks Meta's live setting
await hello.webhookOverride.reapply(pnid);  // when status is "draft"
await hello.webhookOverride.remove(pnid);
```

### Errors

Every error extends `HelloError`. Both server error formats are parsed (Meta-style and Hello-style).

| Class | When |
|---|---|
| `APIError` | Any non-2xx response. Has `status`, `message`, `code`, `subcode`, `helloCode`, `fbtraceId`, `details`, `body`, `retryAfter` |
| `AuthenticationError` | 401 |
| `NotFoundError` | 404 |
| `RateLimitError` | 429 (rate or plan limit; see `helloCode`, `retryAfter`) |
| `ConnectionError` | No HTTP response (network failure) |
| `TimeoutError` | `timeout` exceeded |

```ts
import { APIError, RateLimitError } from "@lakshyapocketlab/hello";

try {
  await hello.messages.sendText(pnid, to, "hi");
} catch (err) {
  if (err instanceof RateLimitError) console.log("retry in", err.retryAfter, err.helloCode);
  else if (err instanceof APIError) console.log(err.status, err.helloCode, err.fbtraceId);
  else throw err;
}
```

A complete program is in [`examples/error-handling.ts`](examples/error-handling.ts).

### Idempotency and retries

429, 5xx, timeouts and network errors are retried up to `maxRetries` times (default 2) with exponential backoff (0.5 s base, 8 s cap) and jitter. A `Retry-After` header is honoured, capped at 60 s.

- **Always retried:** `GET`, `PUT` and `DELETE` requests, `markAsRead`, `templates.sync` and `webhookOverride.reapply`.
- **Message sends are retried only with an idempotency key.** Pass `idempotencyKey`. Hello returns the original message for a repeated key, so a billed message is never sent twice. Reuse the same key for the same logical message, for example `order-${orderId}-shipped`.
- **Never retried:** `media.upload` (each upload creates a new media ID), `templates.create`, `templates.edit` and `templates.createBulk`.

```ts
await hello.messages.sendText(pnid, to, "Order shipped", { idempotencyKey: `order-${orderId}-shipped` });
```

## Examples

Runnable programs live in [`examples/`](examples). Run them with [tsx](https://tsx.is), for example `HELLO_API_KEY=hello_live_... npx tsx examples/list-templates.ts <waba_id>`. Every example reads `HELLO_API_KEY` from the environment.

| Example | What it shows | Input |
|---|---|---|
| [`send-text.ts`](examples/send-text.ts) | Send a text message | Edit the sample recipient in the file |
| [`send-template.ts`](examples/send-template.ts) | Send an approved template with body variables | Edit the sample recipient and template in the file |
| [`upload-and-send-media.ts`](examples/upload-and-send-media.ts) | Upload a file, then send it as a document | Edit the sample recipient and file path in the file |
| [`error-handling.ts`](examples/error-handling.ts) | Branch on `AuthenticationError`, `RateLimitError`, `NotFoundError` and `APIError` | `<phone_number_id> <to> "Hello"` |
| [`list-templates.ts`](examples/list-templates.ts) | List approved templates across all pages | `<waba_id>` |

### More examples

The [hello-examples](https://github.com/lakshyapocketlab/hello-examples) repository has more runnable programs:

- [`message-types/node`](https://github.com/lakshyapocketlab/hello-examples/tree/main/message-types/node): one example per message type (media, location, interactive, templates, ...) with delivery tracking
- [`smoke-test/node`](https://github.com/lakshyapocketlab/hello-examples/tree/main/smoke-test/node): a live smoke test of this SDK against the real API
- [`webhooks`](https://github.com/lakshyapocketlab/hello-examples/tree/main/webhooks): receive and verify webhooks
- [`n8n`](https://github.com/lakshyapocketlab/hello-examples/tree/main/n8n): send messages from n8n workflows
- [`ai-agents`](https://github.com/lakshyapocketlab/hello-examples/tree/main/ai-agents): connect AI agents over MCP

## API reference

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
| `hello.webhookOverride.set(phoneNumberId, { url, verifyToken, acknowledgeNoTracking })` | `PUT /v1/{phone_number_id}/webhook-override` |
| `hello.webhookOverride.remove(phoneNumberId)` | `DELETE /v1/{phone_number_id}/webhook-override` |
| `hello.webhookOverride.reapply(phoneNumberId)` | `POST /v1/{phone_number_id}/webhook-override/reapply` |

## Development

```sh
source ~/.nvm/nvm.sh && nvm use   # Node version from .nvmrc
npm run typecheck && npm test
```

## Links

- Docs: [lakshyapocketlab.com/docs](https://lakshyapocketlab.com/docs/)
- Examples: [hello-examples](https://github.com/lakshyapocketlab/hello-examples)
- MCP server: [hello-mcp](https://github.com/lakshyapocketlab/hello-mcp)
- Support: support@lakshyapocketlab.com
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CHANGELOG.md](CHANGELOG.md)

## License

MIT, Copyright Lakshya Pocket Lab.
