import { Hello } from "@lakshyapocketlab/hello";

// HELLO_API_KEY must be set. Free-form text needs an open 24-hour window.
const hello = new Hello();
const [number] = (await hello.phoneNumbers.list()).data;
if (!number) throw new Error("No phone numbers connected");

const res = await hello.messages.sendText(number.phone_number_id, "+919999999999", "Your order has shipped.", {
  idempotencyKey: crypto.randomUUID(),
});
console.log(res.messages[0]?.hello_id);
