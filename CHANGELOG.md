# Changelog

## 0.1.1

- Fix: the default API host is now `https://helloapi.lakshyapocketlab.com` (was `api.lakshyapocketlab.com`).
- Add the `HELLO_BASE_URL` environment variable to override the API host (the `baseUrl` option wins).
- README: show passing the API key explicitly first, with `HELLO_API_KEY` as the fallback.

## 0.1.0

- Initial release: `ping`, `phoneNumbers`, `messages` (send, sendText, sendTemplate, sendMedia,
  markAsRead, get), `media` (upload, get, download), `templates` (list, get, create, createBulk,
  edit, sync, delete, deleteByName) and `webhookOverride` (get, set, remove, reapply).
- Typed errors, retries with backoff and `Retry-After`, idempotent sends.
