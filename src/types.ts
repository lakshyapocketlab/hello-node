/** Request and response shapes for the Hello `/v1` Integration API. */

// ---- ping / phone numbers -------------------------------------------------

export interface PingResponse {
  status: "ok";
  /** Always false: test-mode keys are rejected by the API. */
  test_mode: boolean;
}

export interface PhoneNumber {
  phone_number_id: string;
  display_phone_number: string;
  verified_name?: string;
  waba_id: string;
  business_name?: string;
  /** Only `active` numbers can send. */
  status: string;
  can_send: boolean;
  quality_rating?: "GREEN" | "YELLOW" | "RED" | (string & {});
  messaging_limit_tier?: string;
  name_status?: string;
  is_coexistence?: boolean;
}

export interface PhoneNumberList {
  data: PhoneNumber[];
}

/** Meta-style item returned by `GET /v1/{waba_id}/phone_numbers` (Graph API shape). */
export interface WabaPhoneNumber {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  [key: string]: unknown;
}

export interface WabaPhoneNumberList {
  data: WabaPhoneNumber[];
}

// ---- messages -------------------------------------------------------------

interface MessageBase {
  /** Defaults to `whatsapp` on the server. */
  messaging_product?: "whatsapp";
  recipient_type?: "individual";
  /** Recipient number with country code, e.g. `+919999999999`. */
  to: string;
  /** Reply to an earlier message. */
  context?: { message_id: string };
  /** Passed through and returned on delivery webhooks. */
  biz_opaque_callback_data?: string;
}

export interface TextMessage extends MessageBase {
  type: "text";
  text: { body: string; preview_url?: boolean };
}

export interface TemplateParameter {
  type: string;
  text?: string;
  parameter_name?: string;
  [key: string]: unknown;
}

export interface TemplateComponent {
  type: string;
  sub_type?: string;
  index?: number | string;
  parameters?: TemplateParameter[];
  [key: string]: unknown;
}

export interface TemplateSend {
  name: string;
  /** Language code such as `en_US`. */
  language: { code: string; policy?: "deterministic" };
  components?: TemplateComponent[];
}

export interface TemplateMessage extends MessageBase {
  type: "template";
  template: TemplateSend;
}

/** A media reference: upload first and pass `id`, or pass a public https `link`. */
export interface MediaRef {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

export type MediaType = "image" | "video" | "audio" | "document" | "sticker";

export type MediaMessage = MessageBase &
  { [K in MediaType]: { type: K } & { [P in K]: MediaRef } }[MediaType];

export interface LocationMessage extends MessageBase {
  type: "location";
  location: { latitude: number; longitude: number; name?: string; address?: string };
}

export interface ContactsMessage extends MessageBase {
  type: "contacts";
  contacts: Array<Record<string, unknown>>;
}

export interface InteractiveMessage extends MessageBase {
  type: "interactive";
  interactive: { type: string; [key: string]: unknown };
}

export interface ReactionMessage extends MessageBase {
  type: "reaction";
  reaction: { message_id: string; emoji: string };
}

/** Escape hatch: any WhatsApp Cloud API message body, forwarded unchanged. */
export type RawMessageBody = { [key: string]: unknown };

/** Typed send body. `RawMessageBody` is accepted too, for fields not modelled here. */
export type SendMessageBody =
  | TextMessage
  | TemplateMessage
  | MediaMessage
  | LocationMessage
  | ContactsMessage
  | InteractiveMessage
  | ReactionMessage
  | RawMessageBody;

export interface SendOptions {
  /**
   * Makes the send safe to retry: a retry with the same key returns the original message
   * instead of sending (and billing) again. Without it a send is never retried.
   * Sent as the `Idempotency-Key` header.
   */
  idempotencyKey?: string;
  /** Wait (up to ~25 s) for WhatsApp to accept the message. Sent as `?sync=true`. */
  sync?: boolean;
  /** Return at once with Hello's id. Sent as `?async=true`; wins over `sync`. */
  async?: boolean;
}

export interface SendMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{
    /** WhatsApp's wamid; empty while the message is queued. */
    id: string;
    message_status?: "accepted" | "queued" | (string & {});
    /** Hello's message id (UUID): use it with `messages.get`. */
    hello_id?: string;
  }>;
}

export interface TextOptions extends SendOptions {
  previewUrl?: boolean;
  /** wamid to reply to. */
  replyTo?: string;
}

export interface TemplateOptions extends SendOptions {
  replyTo?: string;
}

export interface MediaOptions extends SendOptions {
  replyTo?: string;
}

export interface MarkAsReadOptions {
  /** Also show the typing indicator to the sender. */
  typingIndicator?: boolean;
}

export interface MarkAsReadResponse {
  success: boolean;
  [key: string]: unknown;
}

/** The stored message returned by `messages.get`. */
export interface Message {
  id: string;
  message_id?: string;
  direction?: string;
  message_type?: string;
  recipient_phone?: string;
  sender_phone?: string;
  template_name?: string;
  /** queued, sent, delivered, read or failed. */
  status: string;
  error_code?: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at?: string;
  [key: string]: unknown;
}

// ---- media ----------------------------------------------------------------

export type MediaData = Blob | Uint8Array | ArrayBuffer;

export interface MediaUploadResponse {
  id: string;
}

export interface MediaObject {
  messaging_product: "whatsapp";
  id: string;
  /** A Hello URL; `media.download` fetches it with your API key. */
  url: string;
  mime_type: string;
  sha256?: string;
  file_size?: number;
}

export interface MediaDownload {
  /** The file bytes. */
  data: ArrayBuffer;
  /** The response `Content-Type`, when sent. */
  contentType: string | null;
}

// ---- templates ------------------------------------------------------------

export interface Template {
  id: string;
  waba_id?: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: Array<{ type: string; [key: string]: unknown }>;
  quality_score?: { score: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface ListTemplatesParams {
  name?: string;
  search?: string;
  status?: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | (string & {});
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | (string & {});
  language?: string;
  /** Page size, 1 to 100. */
  limit?: number;
  after?: string;
  before?: string;
  /** Comma-separated: `total_count`, `status_counts`. */
  summary?: string;
  sort_by?: "created" | "name";
  sort_order?: "asc" | "desc";
}

export interface TemplateList {
  data: Template[];
  paging?: { cursors?: { before?: string; after?: string } };
  summary?: { total_count?: number; status_counts?: Record<string, number> };
}

/** Meta's template create body. */
export interface CreateTemplateBody {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | (string & {});
  components: Array<{ type: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Meta's template edit body (any of these fields). */
export interface EditTemplateBody {
  category?: string;
  components?: Array<{ type: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface BulkTemplatesResponse {
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SyncTemplatesResponse {
  created: number;
  updated: number;
  deleted: number;
  total: number;
}

export interface SuccessResponse {
  success: boolean;
}

// ---- webhook override -------------------------------------------------------

export interface WebhookOverride {
  enabled: boolean;
  url?: string;
  /** `active`, `error` or `draft` (saved but not applied on Meta: use `reapply`). */
  status?: string;
  last_error?: string;
  set_at?: string;
  last_checked_at?: string;
  /** Whether the plan includes the feature. */
  plan_allows?: boolean;
  /** Present when read with `refresh: true`. */
  meta_enabled?: boolean;
  meta_host?: string;
  in_sync?: boolean;
  [key: string]: unknown;
}

export interface SetWebhookOverrideBody {
  /** Your https endpoint (at most 200 characters); include a secret path token. */
  url: string;
  /** 8 to 100 characters that your server checks during Meta's verification handshake. */
  verifyToken: string;
  /**
   * Must be true: Hello's dashboard stops tracking the number's incoming messages and
   * delivery statuses while the override is active.
   */
  acknowledgeNoTracking: boolean;
}
