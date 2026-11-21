import { seg } from "../http.js";
import type { PhoneNumberList, WabaPhoneNumberList } from "../types.js";
import { Resource } from "./base.js";

export class PhoneNumbers extends Resource {
  /** `GET /v1/phone_numbers`: the organization's numbers with the ids other calls need. */
  list(): Promise<PhoneNumberList> {
    return this.http.request({ method: "GET", path: "/v1/phone_numbers" });
  }

  /** `GET /v1/{waba_id}/phone_numbers`: Meta's Graph API shape. */
  listForWaba(wabaId: string): Promise<WabaPhoneNumberList> {
    return this.http.request({ method: "GET", path: `/v1/${seg(wabaId)}/phone_numbers` });
  }
}
