import { HttpClient, type HelloOptions } from "./http.js";
import { Media } from "./resources/media.js";
import { Messages } from "./resources/messages.js";
import { PhoneNumbers } from "./resources/phone-numbers.js";
import { Templates } from "./resources/templates.js";
import { WebhookOverrideResource } from "./resources/webhook-override.js";
import type { PingResponse } from "./types.js";

/** Client for the Hello WhatsApp Business API. */
export class Hello {
  readonly phoneNumbers: PhoneNumbers;
  readonly messages: Messages;
  readonly media: Media;
  readonly templates: Templates;
  readonly webhookOverride: WebhookOverrideResource;
  private readonly http: HttpClient;

  constructor(options: HelloOptions = {}) {
    this.http = new HttpClient(options);
    this.phoneNumbers = new PhoneNumbers(this.http);
    this.messages = new Messages(this.http);
    this.media = new Media(this.http);
    this.templates = new Templates(this.http);
    this.webhookOverride = new WebhookOverrideResource(this.http);
  }

  /** The API origin in use (no trailing slash). */
  get baseUrl(): string {
    return this.http.baseUrl;
  }

  /** `GET /v1/ping`: checks that the API key works. */
  ping(): Promise<PingResponse> {
    return this.http.request({ method: "GET", path: "/v1/ping" });
  }
}
