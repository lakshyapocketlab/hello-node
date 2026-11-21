import { seg } from "../http.js";
import type {
  BulkTemplatesResponse,
  CreateTemplateBody,
  EditTemplateBody,
  ListTemplatesParams,
  SuccessResponse,
  SyncTemplatesResponse,
  Template,
  TemplateList,
} from "../types.js";
import { Resource } from "./base.js";

export class Templates extends Resource {
  /** `GET /v1/{waba_id}/message_templates`, newest first, cursor-paged. */
  list(wabaId: string, params: ListTemplatesParams = {}): Promise<TemplateList> {
    return this.http.request({ method: "GET", path: `/v1/${seg(wabaId)}/message_templates`, query: { ...params } });
  }

  /** `GET /v1/templates/{template_id}`. */
  get(templateId: string): Promise<Template> {
    return this.http.request({ method: "GET", path: `/v1/templates/${seg(templateId)}` });
  }

  /** `POST /v1/{waba_id}/message_templates`: submits a template to Meta (starts PENDING). */
  create(wabaId: string, template: CreateTemplateBody): Promise<Template> {
    return this.http.request({ method: "POST", path: `/v1/${seg(wabaId)}/message_templates`, json: template });
  }

  /** `POST /v1/{waba_id}/templates/bulk`: create or edit up to 100 templates. */
  createBulk(wabaId: string, templates: CreateTemplateBody[]): Promise<BulkTemplatesResponse> {
    return this.http.request({ method: "POST", path: `/v1/${seg(wabaId)}/templates/bulk`, json: { templates } });
  }

  /** `POST /v1/templates/{template_id}`: edits a template; its status resets to PENDING. */
  edit(templateId: string, changes: EditTemplateBody): Promise<Template> {
    return this.http.request({ method: "POST", path: `/v1/templates/${seg(templateId)}`, json: changes });
  }

  /** `POST /v1/{waba_id}/templates/sync`: re-reads every template from Meta. */
  sync(wabaId: string): Promise<SyncTemplatesResponse> {
    return this.http.request({ method: "POST", path: `/v1/${seg(wabaId)}/templates/sync`, retry: true });
  }

  /** `DELETE /v1/templates/{template_id}`: one language. Cannot be undone. */
  delete(templateId: string): Promise<SuccessResponse> {
    return this.http.request({ method: "DELETE", path: `/v1/templates/${seg(templateId)}` });
  }

  /** `DELETE /v1/{waba_id}/message_templates?name=`: every language. Cannot be undone. */
  deleteByName(wabaId: string, name: string): Promise<SuccessResponse> {
    return this.http.request({ method: "DELETE", path: `/v1/${seg(wabaId)}/message_templates`, query: { name } });
  }
}
