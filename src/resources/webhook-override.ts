import { seg } from "../http.js";
import type { SetWebhookOverrideBody, WebhookOverride } from "../types.js";
import { Resource } from "./base.js";

/**
 * Direct mode: point a number's Meta webhook at your own URL. While active, Hello no longer
 * sees that number's incoming messages and delivery statuses. Needs a plan that includes it.
 */
export class WebhookOverrideResource extends Resource {
  /** `GET /v1/{phone_number_id}/webhook-override`. `refresh` reads Meta's live setting first. */
  get(phoneNumberId: string, options: { refresh?: boolean } = {}): Promise<WebhookOverride> {
    return this.http.request({
      method: "GET",
      path: `/v1/${seg(phoneNumberId)}/webhook-override`,
      query: { refresh: options.refresh ? true : undefined },
    });
  }

  /** `PUT /v1/{phone_number_id}/webhook-override`. Replaces any existing override. */
  set(phoneNumberId: string, body: SetWebhookOverrideBody): Promise<WebhookOverride> {
    return this.http.request({
      method: "PUT",
      path: `/v1/${seg(phoneNumberId)}/webhook-override`,
      json: {
        url: body.url,
        verify_token: body.verifyToken,
        acknowledge_no_tracking: body.acknowledgeNoTracking,
      },
    });
  }

  /** `DELETE /v1/{phone_number_id}/webhook-override`: Meta sends events to Hello again. */
  remove(phoneNumberId: string): Promise<WebhookOverride> {
    return this.http.request({ method: "DELETE", path: `/v1/${seg(phoneNumberId)}/webhook-override` });
  }

  /** `POST /v1/{phone_number_id}/webhook-override/reapply`: re-applies a `draft` override. */
  reapply(phoneNumberId: string): Promise<WebhookOverride> {
    return this.http.request({
      method: "POST",
      path: `/v1/${seg(phoneNumberId)}/webhook-override/reapply`,
      retry: true,
    });
  }
}
