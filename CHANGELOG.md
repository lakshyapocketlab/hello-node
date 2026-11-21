# Changelog

## 0.1.0

- Initial release: `ping`, `phoneNumbers`, `messages` (send, sendText, sendTemplate, sendMedia,
  markAsRead, get), `media` (upload, get, download), `templates` (list, get, create, createBulk,
  edit, sync, delete, deleteByName) and `webhookOverride` (get, set, remove, reapply).
- Typed errors, retries with backoff and `Retry-After`, idempotent sends.
