import { HelloError } from "../errors.js";
import { seg } from "../http.js";
import type { MediaData, MediaDownload, MediaObject, MediaUploadResponse } from "../types.js";
import { Resource } from "./base.js";

export class Media extends Resource {
  /**
   * `POST /v1/{phone_number_id}/media`. The returned id works only from the same number,
   * for about 30 days. `filename` is what recipients see on documents (defaults to the
   * `File` name, else `file`).
   */
  upload(phoneNumberId: string, file: MediaData, mimeType: string, filename?: string): Promise<MediaUploadResponse> {
    if (!mimeType) throw new HelloError("mimeType is required, e.g. image/jpeg");
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart], { type: mimeType });
    const name = filename ?? (file instanceof Blob && "name" in file ? String(file.name) : "file");
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("type", mimeType);
    form.set("file", blob, name);
    return this.http.request({ method: "POST", path: `/v1/${seg(phoneNumberId)}/media`, form });
  }

  /** `GET /v1/{media_id}`: the media object (mime type, size, sha256, download url). */
  get(mediaId: string): Promise<MediaObject> {
    return this.http.request({ method: "GET", path: `/v1/${seg(mediaId)}` });
  }

  /**
   * `GET /v1/{media_id}/download`: the file's bytes, fully buffered as an `ArrayBuffer`
   * (media is capped at about 100 MB by WhatsApp and typically a few MB), plus its
   * Content-Type. Wrap with `Buffer.from(data)` to write it to disk.
   */
  async download(mediaId: string): Promise<MediaDownload> {
    const res = await this.http.request({ method: "GET", path: `/v1/${seg(mediaId)}/download`, raw: true });
    return { data: await res.arrayBuffer(), contentType: res.headers.get("content-type") };
  }
}
