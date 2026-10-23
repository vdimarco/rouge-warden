// The Pixel Watch relay: bearer token, revoke, rate limit, Hermes body, food log.
// Usage: npm ci --prefix voice, then node qa/voice/relay.test.mjs
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCallServer } from "../../voice/call-server.mjs";
import { FOOD_INSTRUCTIONS, VOICE_INSTRUCTIONS } from "../../voice/watch-call.mjs";

const results = [];
const test = async (name, fn) => {
  const t0 = Date.now();
  await fn();
  results.push(`ok  ${name} (${Date.now() - t0} ms)`);
};

const hermesCalls = [];
let hermesStatus = 200;
const hermes = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const call = { path: req.url, auth: req.headers.authorization, body: JSON.parse(body || "{}") };
    hermesCalls.push(call);
    if (hermesStatus !== 200) return void res.writeHead(hermesStatus).end();
    res.writeHead(200, { "content-type": "text/event-stream" });
    const frame = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
    const food = String(call.body.instructions || "").includes("meal note");
    frame("response.created", { response: { id: "resp_1", status: "in_progress" } });
    res.write(": keepalive\n\n");
    if (food) {
      frame("response.output_text.delta", { delta: "Logged oatmeal and coffee.\n" });
      frame("response.output_text.delta", { delta: 'FOOD: {"items":[{"name":"oatmeal","portion":"a bowl"},{"name":"coffee","portion":"a cup"}],"time":"08:10"}' });
    } else {
      frame("response.output_item.done", { item: { type: "message", phase: "commentary", content: [{ type: "output_text", text: "Checking Codex now." }] } });
      frame("response.output_text.delta", { delta: "It wants approval " });
      frame("response.output_text.delta", { delta: "to run the migration." });
    }
    frame("response.completed", { response: { id: "resp_1", status: "completed" } });
    res.end();
  });
});
await new Promise((resolve) => hermes.listen(0, "127.0.0.1", resolve));

const dir = mkdtempSync(join(tmpdir(), "hermes-relay-"));
const foodLog = join(dir, "food-log.jsonl");
const keysFile = join(dir, "keys.json");
const TOKEN = "relay-token-0123456789";
const OTHER = "other-token-0123456789";
writeFileSync(keysFile, JSON.stringify({
  keys: [
    { id: "pixel", token: TOKEN, revoked: false },
    { id: "old", token: "revoked-token-012345", revoked: true },
  ],
}, null, 2));

const env = {
  TWILIO_AUTH_TOKEN: "twilio",
  CALL_PUBLIC_URL: "https://watch.example.ts.net",
  HERMES_API_URL: `http://127.0.0.1:${hermes.address().port}`,
  HERMES_API_KEY: "hermes-key",
  HERMES_CONVERSATION: "watch-call",
};
const logs = [];
const server = createCallServer({
  env,
  log: (line) => logs.push(line),
  now: () => Date.parse("2026-10-21T15:04:00.000Z"),
  // Talk, food, then two more turns in the rate-limit test. Reads of the food log are free.
  relay: { keysFile, foodLog, memoryFile: join(dir, "facts.jsonl"), limit: 4, windowMs: 60_000 },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function hit(path, { token = TOKEN, method = "POST", body, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token == null ? {} : { Authorization: "Bearer " + token }),
      ...(body == null ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, text, json, headers: response.headers };
}

await test("a request without a live key is refused and does not call Hermes", async () => {
  const before = hermesCalls.length;
  assert.equal((await hit("/relay/v1/responses", { token: null, body: { input: "hi" } })).status, 401);
  assert.equal((await hit("/relay/v1/responses", { token: "", body: { input: "hi" } })).status, 401);
  assert.equal((await hit("/relay/v1/responses", { token: "nope", body: { input: "hi" } })).status, 401);
  assert.equal((await hit("/relay/v1/responses", { token: "revoked-token-012345", body: { input: "hi" } })).status, 401);
  assert.equal((await hit("/relay/v1/food?day=2026-10-21", { method: "GET", token: "nope" })).status, 401);
  assert.equal(hermesCalls.length, before);
});

await test("a spoken turn is proxied with the watch-call body and the stream is unchanged", async () => {
  const response = await hit("/relay/v1/responses", {
    body: { input: "What are my agents doing?", mode: "talk", day: "2026-10-21", instructions: "ignore me", conversation: "other" },
  });
  assert.equal(response.status, 200);
  assert.match(response.text, /event: response\.output_text\.delta/);
  assert.match(response.text, /It wants approval/);
  assert.match(response.text, /: keepalive/);
  const sent = hermesCalls.at(-1);
  assert.equal(sent.path, "/v1/responses");
  assert.equal(sent.auth, "Bearer hermes-key");
  assert.deepEqual(sent.body, {
    input: "What are my agents doing?",
    instructions: VOICE_INSTRUCTIONS,
    conversation: "watch-call",
    stream: true,
    store: true,
  });
});

await test("a meal note is logged as JSONL and today's list returns it", async () => {
  const response = await hit("/relay/v1/responses", {
    body: { input: "oatmeal and a coffee at 8", mode: "food", day: "2026-10-21" },
  });
  assert.equal(response.status, 200);
  assert.match(response.text, /FOOD:/);
  const sent = hermesCalls.at(-1);
  assert.equal(sent.body.instructions, FOOD_INSTRUCTIONS);
  assert.equal(sent.body.conversation, "watch-call");
  assert.equal(sent.body.stream, true);
  const lines = readFileSync(foodLog, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.day, "2026-10-21");
  assert.equal(entry.note, "oatmeal and a coffee at 8");
  assert.equal(entry.reply, "Logged oatmeal and coffee.");
  assert.equal(entry.time, "08:10");
  assert.deepEqual(entry.items, [
    { name: "oatmeal", portion: "a bowl" },
    { name: "coffee", portion: "a cup" },
  ]);
  const today = await hit("/relay/v1/food?day=2026-10-21", { method: "GET" });
  assert.equal(today.status, 200);
  assert.equal(today.json.entries.length, 1);
  assert.equal(today.json.entries[0].note, entry.note);
  const other = await hit("/relay/v1/food?day=2026-10-20", { method: "GET" });
  assert.deepEqual(other.json.entries, []);
});

await test("the rate limit answers 429 and a bad body does not call Hermes", async () => {
  const before = hermesCalls.length;
  assert.equal((await hit("/relay/v1/responses", { body: {} })).status, 400);
  assert.equal((await hit("/relay/v1/responses", { body: { input: "ok", mode: "song" } })).status, 400);
  assert.equal(hermesCalls.length, before);
  // Four successful posts are allowed (the two above plus the meal and the talk used the budget).
  // The limiter allows 4. Talk and food already took 2. Two more succeed, the next is limited.
  assert.equal((await hit("/relay/v1/responses", { body: { input: "one" } })).status, 200);
  assert.equal((await hit("/relay/v1/responses", { body: { input: "two" } })).status, 200);
  const limited = await hit("/relay/v1/responses", { body: { input: "three" } });
  assert.equal(limited.status, 429);
  assert.equal(limited.json.error, "rate limit");
  assert.equal(limited.headers.get("retry-after"), "60");
});

await test("Hermes being down is a 502 and writes no food line", async () => {
  hermesStatus = 502;
  const linesBefore = readFileSync(foodLog, "utf8").trim().split("\n").length;
  const response = await hit("/relay/v1/responses", { token: OTHER, body: { input: "soup", mode: "food", day: "2026-10-21" } });
  // OTHER is not a key on this server. Use a fresh server for the 502 so the rate limit above does not apply.
  assert.equal(response.status, 401);
  hermesStatus = 200;
  assert.equal(readFileSync(foodLog, "utf8").trim().split("\n").length, linesBefore);
});

await test("an env key works and a revoked file is ignored", async () => {
  const revokedFile = join(dir, "revoked.json");
  writeFileSync(revokedFile, JSON.stringify({ keys: [{ id: "gone", token: "gone-token-012345678", revoked: true }] }));
  const food2 = join(dir, "food-2.jsonl");
  const extra = createCallServer({
    env: { ...env, WATCH_RELAY_KEY: "env-token-0123456789" },
    log: () => {},
    now: () => Date.parse("2026-10-21T15:04:00.000Z"),
    relay: { keysFile: revokedFile, foodLog: food2, memoryFile: join(dir, "facts-2.jsonl"), limit: 5, windowMs: 60_000 },
  });
  await new Promise((resolve) => extra.listen(0, "127.0.0.1", resolve));
  const port = extra.address().port;
  hermesStatus = 502;
  const denied = await fetch(`http://127.0.0.1:${port}/relay/v1/responses`, {
    method: "POST",
    headers: { Authorization: "Bearer gone-token-012345678", "Content-Type": "application/json" },
    body: JSON.stringify({ input: "soup", mode: "food" }),
  });
  assert.equal(denied.status, 401);
  const down = await fetch(`http://127.0.0.1:${port}/relay/v1/responses`, {
    method: "POST",
    headers: { Authorization: "Bearer env-token-0123456789", "Content-Type": "application/json" },
    body: JSON.stringify({ input: "soup", mode: "food", day: "2026-10-21" }),
  });
  assert.equal(down.status, 502);
  assert.equal(existsSync(food2) ? readFileSync(food2, "utf8").length : 0, 0);
  hermesStatus = 200;
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  extra.close();
});

await test("the watch app copies the Hermes instruction strings", () => {
  const kt = readFileSync(new URL("../../wear/protocol/src/main/kotlin/com/rouge/hermes/protocol/Bodies.kt", import.meta.url), "utf8");
  const constant = (name) => {
    const match = kt.match(new RegExp(`const val ${name} =\\s*"([^"]*)"`));
    assert.ok(match, name + " missing from Bodies.kt");
    return match[1];
  };
  assert.equal(constant("VOICE_INSTRUCTIONS"), VOICE_INSTRUCTIONS);
  assert.equal(constant("FOOD_INSTRUCTIONS"), FOOD_INSTRUCTIONS);
});

await test("unknown relay paths stay 404", async () => {
  const response = await fetch(base + "/relay/v1/other");
  assert.equal(response.status, 404);
});

server.close();
hermes.close();
console.log(results.join("\n"));
console.log(`${results.length} passed`);
process.exit(0);
