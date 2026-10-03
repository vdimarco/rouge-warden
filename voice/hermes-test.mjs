// Sends one signed command to the Hermes watch route, the same way the Alexa relay does. No watch or Alexa needed.
// Usage: HERMES_WEBHOOK_URL=https://.../webhooks/watch HERMES_WEBHOOK_SECRET=... node voice/hermes-test.mjs "tell codex hello"
import { randomUUID } from "node:crypto";
import { hermesReply, hermesRequest } from "./alexa-relay.mjs";

const { HERMES_WEBHOOK_URL: url, HERMES_WEBHOOK_SECRET: secret } = process.env;
if (!url || !secret) {
  console.error("Set HERMES_WEBHOOK_URL and HERMES_WEBHOOK_SECRET first.");
  process.exit(1);
}
const text = process.argv.slice(2).join(" ") || "say hello from the watch relay test";
const r = await fetch(url, hermesRequest(text, { secret, source: "test", requestId: randomUUID() }));
const reply = await r.json().catch(() => ({}));
console.log(r.status, JSON.stringify(reply));
console.log(hermesReply(r.status, reply.status, text));
process.exit(r.ok && reply.status !== "ignored" ? 0 : 1);
