import { describe, expect, it, vi } from "vitest";
import { APIError, HelloError, NotFoundError, RateLimitError, AuthenticationError } from "../src/index.js";
import { body, json, setup } from "./helpers.js";

const PNID = "106540352242922";
const WABA = "102290129340398";
const OK = { messaging_product: "whatsapp", contacts: [], messages: [{ id: "", hello_id: "h1" }] };

describe("phoneNumbers", () => {
  it("list", async () => {
    const { client, calls } = setup([json({ data: [] })]);
    expect(await client.phoneNumbers.list()).toEqual({ data: [] });
    expect(calls[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/phone_numbers" });
  });
  it("listForWaba encodes the id", async () => {
    const { client, calls } = setup([json({ data: [] })]);
    await client.phoneNumbers.listForWaba("a/b c");
    expect(calls[0]?.url).toBe("https://api.test/v1/a%2Fb%20c/phone_numbers");
  });
});

describe("messages", () => {
  it("send posts the raw body, JSON content type, no retry without a key", async () => {
    vi.useFakeTimers();
    const msg = { to: "+1", type: "text", text: { body: "hi" } };
    const { client, calls, fetch } = setup([json({ message: "x" }, 500)]);
    await expect(client.messages.send(PNID, msg)).rejects.toBeInstanceOf(APIError);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({ method: "POST", url: `https://api.test/v1/${PNID}/messages` });
    expect(calls[0]?.headers["Content-Type"]).toBe("application/json");
    expect(calls[0]?.headers["Idempotency-Key"]).toBeUndefined();
    expect(body(calls[0])).toEqual(msg);
    vi.useRealTimers();
  });

  it("send with idempotencyKey sets the header and is retried", async () => {
    vi.useFakeTimers();
    const { client, calls, fetch } = setup([json({}, 503), json(OK, 202)]);
    const p = client.messages.send(PNID, { to: "+1", type: "text", text: { body: "x" } }, { idempotencyKey: "k-1" });
    await vi.runAllTimersAsync();
    expect((await p).messages[0]?.hello_id).toBe("h1");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(calls[1]?.headers["Idempotency-Key"]).toBe("k-1");
    vi.useRealTimers();
  });

  it("send maps sync/async to query params (async wins)", async () => {
    const { client, calls } = setup([json(OK), json(OK), json(OK)]);
    const m = { to: "+1", type: "text", text: { body: "x" } };
    await client.messages.send(PNID, m, { sync: true });
    await client.messages.send(PNID, m, { async: true, sync: true });
    await client.messages.send(PNID, m, { async: false, sync: false });
    expect(calls.map((c) => c.url.split("?")[1])).toEqual(["sync=true", "async=true", undefined]);
  });

  it("sendText", async () => {
    const { client, calls } = setup([json(OK), json(OK)]);
    await client.messages.sendText(PNID, "+9199", "hello");
    await client.messages.sendText(PNID, "+9199", "see https://x.y", { previewUrl: true, replyTo: "wamid.1", idempotencyKey: "i" });
    expect(body(calls[0])).toEqual({ messaging_product: "whatsapp", to: "+9199", type: "text", text: { body: "hello" } });
    expect(body(calls[1])).toEqual({
      messaging_product: "whatsapp",
      to: "+9199",
      type: "text",
      text: { body: "see https://x.y", preview_url: true },
      context: { message_id: "wamid.1" },
    });
    expect(calls[1]?.headers["Idempotency-Key"]).toBe("i");
  });

  it("sendTemplate", async () => {
    const { client, calls } = setup([json(OK), json(OK)]);
    await client.messages.sendTemplate(PNID, "+1", { name: "order_shipped", language: "en" });
    const components = [{ type: "body", parameters: [{ type: "text", text: "Asha" }] }];
    await client.messages.sendTemplate(PNID, "+1", { name: "order_shipped", language: "en_US", components }, { replyTo: "w" });
    expect(body(calls[0])).toEqual({
      messaging_product: "whatsapp",
      to: "+1",
      type: "template",
      template: { name: "order_shipped", language: { code: "en" } },
    });
    expect(body(calls[1]).template).toEqual({ name: "order_shipped", language: { code: "en_US" }, components });
    expect(body(calls[1]).context).toEqual({ message_id: "w" });
  });

  it("sendMedia", async () => {
    const { client, calls } = setup([json(OK), json(OK)]);
    await client.messages.sendMedia(PNID, "+1", { type: "image", id: "m1", caption: "c" });
    await client.messages.sendMedia(PNID, "+1", { type: "document", link: "https://x/y.pdf", filename: "y.pdf" }, { replyTo: "w" });
    expect(body(calls[0])).toEqual({ messaging_product: "whatsapp", to: "+1", type: "image", image: { id: "m1", caption: "c" } });
    expect(body(calls[1])).toMatchObject({ type: "document", document: { link: "https://x/y.pdf", filename: "y.pdf" }, context: { message_id: "w" } });
  });

  it("markAsRead", async () => {
    const { client, calls } = setup([json({ success: true }), json({ success: true })]);
    await client.messages.markAsRead(PNID, "wamid.A");
    await client.messages.markAsRead(PNID, "wamid.A", { typingIndicator: true });
    expect(calls[0]).toMatchObject({ method: "POST", url: `https://api.test/v1/${PNID}/messages` });
    expect(body(calls[0])).toEqual({ messaging_product: "whatsapp", status: "read", message_id: "wamid.A" });
    expect(body(calls[1]).typing_indicator).toEqual({ type: "text" });
  });

  it("get encodes wamids", async () => {
    const { client, calls } = setup([json({ id: "x", status: "read" })]);
    await client.messages.get("wamid.HBg=/+");
    expect(calls[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/messages/wamid.HBg%3D%2F%2B" });
  });
});

describe("media", () => {
  it("upload sends multipart for a Uint8Array", async () => {
    const { client, calls } = setup([json({ id: "m1" })]);
    expect(await client.media.upload(PNID, new Uint8Array([1, 2, 3]), "application/pdf", "Invoice.pdf")).toEqual({ id: "m1" });
    expect(calls[0]).toMatchObject({ method: "POST", url: `https://api.test/v1/${PNID}/media` });
    expect(calls[0]?.headers["Content-Type"]).toBeUndefined();
    const form = calls[0]?.body as FormData;
    expect(form.get("messaging_product")).toBe("whatsapp");
    expect(form.get("type")).toBe("application/pdf");
    const file = form.get("file") as File;
    expect(file.name).toBe("Invoice.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBe(3);
  });

  it("upload accepts Buffer, ArrayBuffer, Blob and File; default filenames", async () => {
    const { client, calls } = setup([json({ id: "1" }), json({ id: "2" }), json({ id: "3" }), json({ id: "4" })]);
    await client.media.upload(PNID, Buffer.from("abc"), "image/png");
    await client.media.upload(PNID, new ArrayBuffer(2), "image/png");
    await client.media.upload(PNID, new Blob(["x"]), "image/png");
    await client.media.upload(PNID, new File(["x"], "pic.png"), "image/png");
    const names = calls.map((c) => ((c.body as FormData).get("file") as File).name);
    expect(names).toEqual(["file", "file", "file", "pic.png"]);
  });

  it("upload is not retried (each upload creates a new media id)", async () => {
    const { client, fetch } = setup([json({}, 503)]);
    await expect(client.media.upload(PNID, new Uint8Array(1), "image/png")).rejects.toBeInstanceOf(APIError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("upload requires a mime type", () => {
    const { client } = setup([]);
    expect(() => client.media.upload(PNID, new Uint8Array(1), "")).toThrow(HelloError);
  });

  it("get", async () => {
    const { client, calls } = setup([json({ id: "m1", url: "u", mime_type: "image/jpeg" })]);
    expect((await client.media.get("m1")).mime_type).toBe("image/jpeg");
    expect(calls[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/m1" });
  });

  it("download returns an ArrayBuffer and content type", async () => {
    const { client, calls } = setup([
      new Response(new Uint8Array([9, 8, 7]), { headers: { "content-type": "image/jpeg" } }),
      new Response(new Uint8Array([1])),
    ]);
    const r = await client.media.download("m 1");
    expect(calls[0]?.url).toBe("https://api.test/v1/m%201/download");
    expect(new Uint8Array(r.data)).toEqual(new Uint8Array([9, 8, 7]));
    expect(r.contentType).toBe("image/jpeg");
    expect((await client.media.download("m2")).contentType).toBeNull();
  });

  it("download maps errors", async () => {
    const { client } = setup([json({ error: { message: "gone", code: 100, error_data: { hello_code: "NOT_FOUND" } } }, 404)]);
    await expect(client.media.download("m")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("templates", () => {
  it("list with and without params", async () => {
    const { client, calls } = setup([json({ data: [] }), json({ data: [] })]);
    await client.templates.list(WABA);
    await client.templates.list(WABA, { status: "APPROVED", limit: 20, after: "c", search: "", sort_order: "asc" });
    expect(calls[0]?.url).toBe(`https://api.test/v1/${WABA}/message_templates`);
    expect(calls[1]?.url).toBe(`https://api.test/v1/${WABA}/message_templates?status=APPROVED&limit=20&after=c&sort_order=asc`);
  });

  it("get", async () => {
    const { client, calls } = setup([json({ id: "t" })]);
    await client.templates.get("123");
    expect(calls[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/templates/123" });
  });

  it("create, edit and createBulk are not retried", async () => {
    const tpl = { name: "a", language: "en", category: "UTILITY", components: [] };
    const { client, fetch } = setup([json({}, 503), json({}, 503), json({}, 503)]);
    await expect(client.templates.create(WABA, tpl)).rejects.toBeInstanceOf(APIError);
    await expect(client.templates.createBulk(WABA, [tpl])).rejects.toBeInstanceOf(APIError);
    await expect(client.templates.edit("1", {})).rejects.toBeInstanceOf(APIError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("create", async () => {
    const tpl = { name: "a", language: "en", category: "UTILITY", components: [{ type: "BODY", text: "hi" }] };
    const { client, calls } = setup([json({ id: "t" })]);
    await client.templates.create(WABA, tpl);
    expect(calls[0]).toMatchObject({ method: "POST", url: `https://api.test/v1/${WABA}/message_templates` });
    expect(body(calls[0])).toEqual(tpl);
  });

  it("createBulk wraps in {templates}", async () => {
    const tpl = { name: "a", language: "en", category: "UTILITY", components: [] };
    const { client, calls } = setup([json({ results: [] })]);
    await client.templates.createBulk(WABA, [tpl]);
    expect(calls[0]).toMatchObject({ method: "POST", url: `https://api.test/v1/${WABA}/templates/bulk` });
    expect(body(calls[0])).toEqual({ templates: [tpl] });
  });

  it("edit", async () => {
    const { client, calls } = setup([json({ id: "t" })]);
    await client.templates.edit("9", { components: [] });
    expect(calls[0]).toMatchObject({ method: "POST", url: "https://api.test/v1/templates/9" });
    expect(body(calls[0])).toEqual({ components: [] });
  });

  it("sync (retried on 5xx)", async () => {
    vi.useFakeTimers();
    const { client, calls } = setup([json({}, 502), json({ created: 1, updated: 0, deleted: 0, total: 1 })]);
    const p = client.templates.sync(WABA);
    await vi.runAllTimersAsync();
    expect((await p).total).toBe(1);
    expect(calls[1]).toMatchObject({ method: "POST", url: `https://api.test/v1/${WABA}/templates/sync` });
    expect(calls[1]?.body).toBeUndefined();
    vi.useRealTimers();
  });

  it("delete and deleteByName", async () => {
    const { client, calls } = setup([json({ success: true }), json({ success: true })]);
    await client.templates.delete("77");
    await client.templates.deleteByName(WABA, "order shipped");
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "https://api.test/v1/templates/77" });
    expect(calls[1]).toMatchObject({ method: "DELETE", url: `https://api.test/v1/${WABA}/message_templates?name=order+shipped` });
  });
});

describe("webhookOverride", () => {
  it("get, with and without refresh", async () => {
    const { client, calls } = setup([json({ enabled: false }), json({ enabled: true })]);
    await client.webhookOverride.get(PNID);
    await client.webhookOverride.get(PNID, { refresh: true });
    expect(calls[0]).toMatchObject({ method: "GET", url: `https://api.test/v1/${PNID}/webhook-override` });
    expect(calls[1]?.url).toBe(`https://api.test/v1/${PNID}/webhook-override?refresh=true`);
    await client.webhookOverride.get(PNID, { refresh: false });
  });

  it("set sends snake_case body", async () => {
    const { client, calls } = setup([json({ enabled: true })]);
    await client.webhookOverride.set(PNID, { url: "https://me.test/hook/s3cret", verifyToken: "tokentoken", acknowledgeNoTracking: true });
    expect(calls[0]).toMatchObject({ method: "PUT", url: `https://api.test/v1/${PNID}/webhook-override` });
    expect(body(calls[0])).toEqual({ url: "https://me.test/hook/s3cret", verify_token: "tokentoken", acknowledge_no_tracking: true });
  });

  it("remove and reapply", async () => {
    const { client, calls } = setup([json({ enabled: false }), json({ enabled: true })]);
    await client.webhookOverride.remove(PNID);
    await client.webhookOverride.reapply(PNID);
    expect(calls[0]).toMatchObject({ method: "DELETE", url: `https://api.test/v1/${PNID}/webhook-override` });
    expect(calls[1]).toMatchObject({ method: "POST", url: `https://api.test/v1/${PNID}/webhook-override/reapply` });
  });
});

describe("error mapping end to end", () => {
  it("401 / 404 / 429 / generic, both envelopes", async () => {
    const { client } = setup([
      json({ message: "bad key", code: "UNAUTHORIZED" }, 401),
      json({ error: { message: "no such", code: 100, error_subcode: 33, error_data: { hello_code: "NOT_FOUND" }, fbtrace_id: "t" } }, 404),
      json({ error: { message: "cap", code: 130429, error_data: { hello_code: "PLAN_DAILY_LIMIT_REACHED", details: { limit: 1 } } } }, 429, { "retry-after": "0" }),
      json({ error: { message: "bad", code: 100, error_data: { hello_code: "VALIDATION_ERROR" } } }, 400),
    ], { maxRetries: 0 });
    const m = { to: "+1", type: "text", text: { body: "x" } };
    const e1 = await client.messages.send(PNID, m).catch((e) => e);
    expect(e1).toBeInstanceOf(AuthenticationError);
    expect(e1).toMatchObject({ status: 401, helloCode: "UNAUTHORIZED", message: "bad key" });
    const e2 = await client.messages.get("x").catch((e) => e);
    expect(e2).toBeInstanceOf(NotFoundError);
    expect(e2).toMatchObject({ subcode: 33, fbtraceId: "t", code: 100, helloCode: "NOT_FOUND" });
    const e3 = await client.messages.send(PNID, m).catch((e) => e);
    expect(e3).toBeInstanceOf(RateLimitError);
    expect(e3).toMatchObject({ details: { limit: 1 }, retryAfter: 0 });
    const e5 = await client.messages.send(PNID, m).catch((e) => e);
    expect(e5.constructor).toBe(APIError);
    expect(e5.helloCode).toBe("VALIDATION_ERROR");
  });
});
