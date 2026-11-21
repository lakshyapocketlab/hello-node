import { readFile } from "node:fs/promises";
import { Hello } from "@lakshyapocketlab/hello";

const hello = new Hello();
const [number] = (await hello.phoneNumbers.list()).data;
if (!number) throw new Error("No phone numbers connected");

const { id } = await hello.media.upload(number.phone_number_id, await readFile("invoice.pdf"), "application/pdf", "Invoice.pdf");
const res = await hello.messages.sendMedia(number.phone_number_id, "+919999999999", {
  type: "document",
  id,
  filename: "Invoice.pdf",
  caption: "Your invoice",
});
console.log(res.messages[0]?.hello_id);
