// Agent adapters, shared memory, and the warm relay socket.
// Usage: npm ci --prefix voice, then node qa/voice/agents.test.mjs
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

const require = createRequire(new URL("../../voice/package.json", import.meta.url));
const WebSocket = require("ws");
import { createCallServer } from "../../voice/call-server.mjs";
import { FOOD_INSTRUCTIONS, VOICE_INSTRUCTIONS } from "../../voice/watch-call.mjs";
import { pickAgent, promptMessage, textDelta } from "../../voice/agents.mjs";
import { createMemory, withFacts } from "../../voice/memory.mjs";

const results = [];
const test = async (name, fn) => {
  const t0 = Date.now();
  await fn();
  results.push(`ok  ${name} (${Date.now() - t0} ms)`);
};

function fakePi(lines) {
  const children = [];
  function spawn(command, args) {
    if (command === "missing-pi") {
      const error = new Error("spawn missing-pi ENOENT");
      error.code = "ENOENT";
      throw error;
    }
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; child.stdout.end(); };
    child.stdin.on("data", (buf) => {
      const record = JSON.parse(buf.toString());
      child.prompt = record;
      child.stdout.write(JSON.stringify({
        id: record.id, type: "response", command: "prompt", success: true, data: { disposition: "started" },
      }) + "\n");
      for (const line of lines) child.stdout.write(line + "\n");
      child.stdout.write(JSON.stringify({ type: "agent_settled" }) + "\n");
    });
    children.push({ command, args, child });
    return child;
  }
  return { spawn, children };
}

await test("an ask prefix selects the agent and drops the prefix", () => {
  assert.deepEqual(pickAgent("ask Claude, what time is it", "hermes"), { agent: "openai", input: "what time is it" });
  assert.deepEqual(pickAgent("ask pi to check the build", null, "hermes"), { agent: "pi", input: "to check the build" });
  assert.deepEqual(pickAgent("hello", "pi"), { agent: "pi", input: "hello" });
  assert.equal(pickAgent("hello", "nope").error, "agent");
  assert.equal(textDelta({
    type: "message_update",
    assistantMessageEvent: { type: "text_delta", delta: "Hi" },
  }), "Hi");
  assert.equal(withFacts("Speak plainly.", []), "Speak plainly.");
});

await test("memory recalls an overlapping fact and skips an unrelated one", () => {
  const dir = mkdtempSync(join(tmpdir(), "hermes-memory-"));
  const memory = createMemory({ file: join(dir, "facts.jsonl"), now: () => Date.parse("2026-10-21T15:04:00.000Z") });
  memory.remember({ text: "The migration is waiting for approval.", kind: "talk", day: "2026-10-21" });
  const hit = memory.recall("what is the migration status");
  assert.equal(hit.length, 1);
  assert.match(hit[0].text, /migration/);
  assert.deepEqual(memory.recall("oatmeal and coffee"), []);
  const instructions = withFacts(VOICE_INSTRUCTIONS, hit);
  assert.match(instructions, /Facts you already know/);
  assert.match(instructions, /migration/);
});

const dir = mkdtempSync(join(tmpdir(), "hermes-agents-"));
const foodLog = join(dir, "food.jsonl");
const memoryPath = join(dir, "facts.jsonl");
const keysFile = join(dir, "keys.json");
const { writeFileSync } = await import("node:fs");
writeFileSync(keysFile, JSON.stringify({ keys: [{ id: "pixel", token: "relay-token-0123456789", revoked: false }] }));

const hermesCalls = [];
const hermes = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    hermesCalls.push(JSON.parse(body || "{}"));
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: "Migration is waiting. " })}\n\n`);
    res.write(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed" })}\n\n`);
    res.end();
  });
});
await new Promise((resolve) => hermes.listen(0, "127.0.0.1", resolve));

const openaiCalls = [];
const openai = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    openaiCalls.push({ path: req.url, body: JSON.parse(body || "{}") });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Four." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((resolve) => openai.listen(0, "127.0.0.1", resolve));

const logs = [];
const pi = fakePi([
  JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Build is green." } }),
]);
const env = {
  TWILIO_AUTH_TOKEN: "twilio",
  CALL_PUBLIC_URL: "https://watch.example.ts.net",
  HERMES_API_URL: `http://127.0.0.1:${hermes.address().port}`,
  HERMES_API_KEY: "hermes-key",
  HERMES_CONVERSATION: "watch-call",
  OPENAI_BASE_URL: `http://127.0.0.1:${openai.address().port}`,
  OPENAI_API_KEY: "openai-key",
  OPENAI_API: "chat",
  OPENAI_MODEL: "stub",
};
const server = createCallServer({
  env,
  log: (line) => logs.push(line),
  now: () => Date.parse("2026-10-21T15:04:00.000Z"),
  relay: { keysFile, foodLog, memoryFile: memoryPath, spawn: pi.spawn, limit: 20, windowMs: 60_000 },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const TOKEN = "relay-token-0123456789";

async function post(body) {
  const response = await fetch(base + "/relay/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text };
}

await test("a matching fact is injected into the Hermes turn", async () => {
  const memory = createMemory({ file: memoryPath, now: () => Date.parse("2026-10-21T15:04:00.000Z") });
  memory.remember({ text: "The migration is waiting for approval.", kind: "talk", day: "2026-10-21" });
  const response = await post({ input: "what is the migration status", mode: "talk", agent: "hermes" });
  assert.equal(response.status, 200);
  assert.match(response.text, /Migration is waiting/);
  const sent = hermesCalls.at(-1);
  assert.equal(sent.conversation, "watch-call");
  assert.equal(sent.stream, true);
  assert.match(sent.instructions, /^/);
  assert.ok(sent.instructions.startsWith(VOICE_INSTRUCTIONS));
  assert.match(sent.instructions, /Facts you already know/);
  assert.match(sent.instructions, /migration is waiting/i);
});

await test("ask pi streams text deltas and stops at agent_settled", async () => {
  const before = pi.children.length;
  const response = await post({ input: "ask pi to check the build", mode: "talk", agent: "hermes" });
  assert.equal(response.status, 200);
  assert.match(response.text, /event: response\.output_text\.delta/);
  assert.match(response.text, /Build is green/);
  assert.match(response.text, /response\.completed/);
  assert.equal(pi.children.length, before + 1);
  const prompt = pi.children.at(-1).child.prompt;
  assert.equal(prompt.type, "prompt");
  assert.match(prompt.message, /check the build/);
  assert.match(prompt.message, /Conversation id: watch-call/);
  assert.deepEqual(pi.children.at(-1).args.slice(0, 3), ["--mode", "rpc", "--no-session"]);
});

await test("openai chat completions are streamed", async () => {
  const response = await post({ input: "how many", mode: "talk", agent: "openai" });
  assert.equal(response.status, 200);
  assert.match(response.text, /Four/);
  const sent = openaiCalls.at(-1);
  assert.equal(sent.path, "/v1/chat/completions");
  assert.equal(sent.body.model, "stub");
  assert.equal(sent.body.stream, true);
  assert.match(sent.body.messages[0].content, /Conversation id: watch-call/);
  assert.equal(sent.body.messages[1].content, "how many");
});

await test("a meal through pi is logged and the spoken line has no extra fact requirement", async () => {
  const response = await post({ input: "oatmeal and a coffee at 8", mode: "food", agent: "pi", day: "2026-10-21" });
  assert.equal(response.status, 200);
  const entry = JSON.parse(readFileSync(foodLog, "utf8").trim().split("\n").at(-1));
  assert.equal(entry.day, "2026-10-21");
  assert.equal(entry.note, "oatmeal and a coffee at 8");
  const prompt = pi.children.at(-1).child.prompt.message;
  assert.ok(prompt.startsWith(FOOD_INSTRUCTIONS));
  assert.doesNotMatch(prompt, /Facts you already know/);
});

await test("a missing pi binary is a 502 and writes no food", async () => {
  const linesBefore = readFileSync(foodLog, "utf8").trim().split("\n").length;
  const blocked = fakePi([]);
  const extra = createCallServer({
    env: { ...env, PI_BIN: "missing-pi" },
    log: () => {},
    now: () => Date.parse("2026-10-21T15:04:00.000Z"),
    relay: {
      keysFile,
      foodLog,
      memoryFile: join(dir, "facts-missing.jsonl"),
      spawn: blocked.spawn,
      limit: 5,
      windowMs: 60_000,
    },
  });
  await new Promise((resolve) => extra.listen(0, "127.0.0.1", resolve));
  const response = await fetch(`http://127.0.0.1:${extra.address().port}/relay/v1/responses`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ input: "soup", mode: "food", agent: "pi" }),
  });
  assert.equal(response.status, 502);
  assert.match(await response.text(), /not installed/);
  assert.equal(readFileSync(foodLog, "utf8").trim().split("\n").length, linesBefore);
  extra.close();
});

await test("the warm socket streams the first delta quickly", async () => {
  const started = Date.now();
  const ws = new WebSocket(base.replace("http", "ws") + "/relay/v1/stream", {
    headers: { Authorization: "Bearer " + TOKEN },
  });
  const messages = [];
  await new Promise((resolve, reject) => {
    ws.on("message", (raw) => {
      messages.push(JSON.parse(raw.toString()));
      if (messages.some((message) => message.type === "done" || message.type === "failed")) resolve();
    });
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "turn", id: "t1", input: "ping the socket", mode: "talk", agent: "pi" }));
    });
    ws.on("error", reject);
  });
  const first = messages.find((message) => message.type === "delta");
  const elapsed = Date.now() - started;
  assert.equal(first.text, "Build is green.");
  assert.ok(messages.some((message) => message.type === "done"));
  assert.ok(elapsed < 1500, `first delta took ${elapsed}ms`);
  const timed = logs.filter((line) => line.startsWith("relay: first-delta"));
  assert.ok(timed.length >= 1);
  console.log(`relay first-delta samples: ${timed.join(" | ")}`);
  console.log(`websocket release-to-done on this host: ${elapsed}ms (local stub, not a watch)`);
  ws.close();
});

await test("first-delta on a live clock stays under 1.5s", async () => {
  const clockLogs = [];
  const slow = async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return fetch(...args);
  };
  const live = createCallServer({
    env,
    post: slow,
    log: (line) => clockLogs.push(line),
    relay: { keysFile, foodLog: join(dir, "food-live.jsonl"), memoryFile: join(dir, "facts-live.jsonl"), limit: 5, windowMs: 60_000 },
  });
  await new Promise((resolve) => live.listen(0, "127.0.0.1", resolve));
  const response = await fetch(`http://127.0.0.1:${live.address().port}/relay/v1/responses`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ input: "ping the delayed agent", mode: "talk", agent: "hermes" }),
  });
  assert.equal(response.status, 200);
  await response.text();
  const line = clockLogs.find((entry) => entry.startsWith("relay: first-delta"));
  const ms = Number(line.match(/first-delta (\d+)ms/)[1]);
  assert.ok(ms >= 30 && ms < 1500, line);
  console.log(`relay first-delta on this host: ${ms}ms (local hermes stub delayed 40ms, not a watch)`);
  live.close();
});

await test("an unknown agent is rejected before a backend runs", async () => {
  const before = hermesCalls.length;
  const response = await post({ input: "hello", agent: "nope" });
  assert.equal(response.status, 400);
  assert.equal(hermesCalls.length, before);
});

await test("prompt text carries instructions and the shared conversation id", () => {
  const text = promptMessage({ input: "hello", instructions: "Speak plainly.", conversation: "watch-call" });
  assert.match(text, /Speak plainly/);
  assert.match(text, /Conversation id: watch-call/);
  assert.match(text, /hello/);
});

server.close();
hermes.close();
openai.close();
console.log(results.join("\n"));
console.log(`${results.length} passed`);
process.exit(0);
