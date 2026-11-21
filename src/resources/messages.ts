import { seg } from "../http.js";
import type {
  MarkAsReadOptions,
  MarkAsReadResponse,
  MediaMessage,
  MediaOptions,
  MediaRef,
  MediaType,
  Message,
  SendMessageBody,
  SendMessageResponse,
  SendOptions,
  TemplateOptions,
  TemplateSend,
  TextOptions,
} from "../types.js";
import { Resource } from "./base.js";

export class Messages extends Resource {
  /**
   * `POST /v1/{phone_number_id}/messages` with any Cloud API message body, unchanged.
   * A send is retried only when `options.idempotencyKey` is set.
   */
  send(phoneNumberId: string, body: SendMessageBody, options: SendOptions = {}): Promise<SendMessageResponse> {
    const headers = options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : undefined;
    return this.http.request({
      method: "POST",
      path: `/v1/${seg(phoneNumberId)}/messages`,
      query: options.async ? { async: true } : options.sync ? { sync: true } : undefined,
      json: body,
      headers,
      retry: headers !== undefined,
    });
  }

  /** Sends a text message (needs an open 24-hour window; otherwise use a template). */
  sendText(phoneNumberId: string, to: string, body: string, options: TextOptions = {}): Promise<SendMessageResponse> {
    const text = options.previewUrl === undefined ? { body } : { body, preview_url: options.previewUrl };
    return this.send(phoneNumberId, withReply({ messaging_product: "whatsapp", to, type: "text", text }, options.replyTo), options);
  }

  /** Sends an approved template message. */
  sendTemplate(
    phoneNumberId: string,
    to: string,
    template: { name: string; language: string; components?: TemplateSend["components"] },
    options: TemplateOptions = {},
  ): Promise<SendMessageResponse> {
    const { name, language, components } = template;
    const tpl: TemplateSend = components ? { name, language: { code: language }, components } : { name, language: { code: language } };
    return this.send(phoneNumberId, withReply({ messaging_product: "whatsapp", to, type: "template", template: tpl }, options.replyTo), options);
  }

  /** Sends an image, video, audio, document or sticker, by uploaded `id` or public `link`. */
  sendMedia(
    phoneNumberId: string,
    to: string,
    media: { type: MediaType } & MediaRef,
    options: MediaOptions = {},
  ): Promise<SendMessageResponse> {
    const { type, ...ref } = media;
    const body = { messaging_product: "whatsapp", to, type, [type]: ref } as unknown as MediaMessage;
    return this.send(phoneNumberId, withReply(body, options.replyTo), options);
  }

  /** Marks a received message as read (same route as send, `status: "read"`). */
  markAsRead(phoneNumberId: string, messageId: string, options: MarkAsReadOptions = {}): Promise<MarkAsReadResponse> {
    const body: Record<string, unknown> = { messaging_product: "whatsapp", status: "read", message_id: messageId };
    if (options.typingIndicator) body.typing_indicator = { type: "text" };
    return this.http.request({
      method: "POST",
      path: `/v1/${seg(phoneNumberId)}/messages`,
      json: body,
      retry: true, // marking as read twice is harmless
    });
  }

  /** `GET /v1/messages/{id}`: by Hello's id (`hello_id`) or WhatsApp's wamid. */
  get(id: string): Promise<Message> {
    return this.http.request({ method: "GET", path: `/v1/messages/${seg(id)}` });
  }
}

function withReply<T extends object>(body: T, replyTo: string | undefined): T {
  return replyTo ? { ...body, context: { message_id: replyTo } } : body;
}
