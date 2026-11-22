// Prints every APPROVED template of a WhatsApp Business Account, following the paging cursor.
// Run with tsx: HELLO_API_KEY=hello_live_xxx npx tsx examples/list-templates.ts <waba_id>
import { Hello } from "@lakshyapocketlab/hello";

const wabaId = process.argv[2];
if (!wabaId) throw new Error("usage: list-templates <waba_id>");

const hello = new Hello(); // reads HELLO_API_KEY
let after: string | undefined;
do {
  const page = await hello.templates.list(wabaId, { status: "APPROVED", limit: 50, after });
  for (const t of page.data) console.log(t.name.padEnd(30), t.language.padEnd(8), t.category);
  after = page.paging?.cursors?.after;
} while (after);
