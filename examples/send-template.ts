import { Hello } from "@lakshyapocketlab/hello";

const hello = new Hello();
const [number] = (await hello.phoneNumbers.list()).data;
if (!number) throw new Error("No phone numbers connected");

const res = await hello.messages.sendTemplate(number.phone_number_id, "+919999999999", {
  name: "order_shipped",
  language: "en",
  components: [{ type: "body", parameters: [{ type: "text", text: "Asha" }] }],
});
const id = res.messages[0]?.hello_id;
console.log("sent", id, (await hello.messages.get(id!)).status);
