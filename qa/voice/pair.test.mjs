// Pairing link, /pair page, LAN token, and the one-command help text.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createCallServer } from "../../voice/call-server.mjs";
import { SERVICE, serviceRecords } from "../../voice/mdns.mjs";
import { deepLink, ensureToken, isRelayBase, pairPageUrl } from "../../voice/pair.mjs";
import worker from "../../voice/worker/src/index.js";

const results = [];
const test = async (name, fn) => {
  await fn();
  results.push(`ok  ${name}`);
};

const token = "relay-token-0123456789";
const relayUrl = "https://watch.example.ts.net";

await test("deep link and page use u and k", () => {
  const link = deepLink(relayUrl, token);
  assert.equal(link, "wristagent://pair?u=https%3A%2F%2Fwatch.example.ts.net&k=relay-token-0123456789");
  assert.equal(pairPageUrl(relayUrl, relayUrl, token), `${relayUrl}/pair?u=https%3A%2F%2Fwatch.example.ts.net&k=relay-token-0123456789`);
  assert.equal(isRelayBase("http://192.168.1.20:8650"), true);
  assert.equal(isRelayBase("http://1.2.3.4:8650"), false);
  assert.equal(isRelayBase("https://watch.example.ts.net"), true);
});

await test("first run creates a token and the next run keeps it", () => {
  const dir = mkdtempSync(join(tmpdir(), "wrist-keys-"));
  const file = join(dir, "keys.json");
  const first = ensureToken({}, file);
  const second = ensureToken({}, file);
  assert.equal(first, second);
  assert.ok(first.length >= 16);
  const saved = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(saved.keys[0].token, first);
  assert.equal(ensureToken({ WATCH_RELAY_KEY: token }, file), token);
});

await test("mDNS record carries the relay url and token", () => {
  const records = serviceRecords({ ip: "192.168.1.20", port: 8650, url: "http://192.168.1.20:8650", token });
  assert.equal(records[0].name, SERVICE);
  assert.equal(records[0].type, "PTR");
  const txt = records.find((record) => record.type === "TXT");
  assert.deepEqual(txt.data, ["u=http://192.168.1.20:8650", `k=${token}`]);
  const srv = records.find((record) => record.type === "SRV");
  assert.equal(srv.data.port, 8650);
});

const env = {
  TWILIO_ACCOUNT_SID: "AC111",
  TWILIO_AUTH_TOKEN: "auth-token",
  TWILIO_PHONE_NUMBER: "+15550001111",
  OWNER_PHONE_NUMBER: "+15552223333",
  CALL_PUBLIC_URL: relayUrl,
  HERMES_API_KEY: "hermes-key",
  HERMES_API_URL: "http://127.0.0.1:9",
  WATCH_RELAY_KEY: token,
};
const dir = mkdtempSync(join(tmpdir(), "wrist-pair-"));
const server = createCallServer({ env, relay: { keysFile: join(dir, "missing.json"), foodLog: join(dir, "food.jsonl"), memoryFile: join(dir, "memory.jsonl") } });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const closed = createCallServer({
  env,
  relay: { keysFile: join(dir, "missing.json"), privateClient: () => false, foodLog: join(dir, "food.jsonl"), memoryFile: join(dir, "memory.jsonl") },
});
await new Promise((resolve) => closed.listen(0, "127.0.0.1", resolve));

async function get(base, path) {
  const res = await fetch(base + path);
  return { status: res.status, type: res.headers.get("content-type") || "", text: await res.text() };
}

await test("pair page redirects to the wristagent link", async () => {
  const page = await get(`http://127.0.0.1:${port}`, `/pair?u=${encodeURIComponent(relayUrl)}&k=${encodeURIComponent(token)}`);
  assert.equal(page.status, 200);
  assert.match(page.type, /text\/html/);
  assert.match(page.text, /wristagent:\/\/pair\?u=https%3A%2F%2Fwatch\.example\.ts\.net&amp;k=relay-token-0123456789/);
  assert.match(page.text, /location\.replace\("wristagent:\/\/pair/);
});

await test("a phone on the LAN can read the token", async () => {
  const lan = await get(`http://127.0.0.1:${port}`, "/pair/lan");
  assert.equal(lan.status, 200);
  assert.deepEqual(JSON.parse(lan.text), { u: `http://127.0.0.1:${port}`, k: token });
});

await test("a public client cannot read the LAN token", async () => {
  const hidden = await get(`http://127.0.0.1:${closed.address().port}`, "/pair/lan");
  assert.equal(hidden.status, 404);
  assert.equal(hidden.text.includes(token), false);
});

await test("worker pair page and hermes stream", async () => {
  globalThis.__wristFood = [];
  const link = deepLink(relayUrl, token);
  const page = await worker.fetch(new Request(`https://relay.example/pair?u=${encodeURIComponent(relayUrl)}&k=${encodeURIComponent(token)}`), {
    WATCH_RELAY_KEY: token,
  });
  const html = await page.text();
  assert.match(html, /location\.replace/);
  assert.match(html, /wristagent:\/\/pair/);
  const bare = await worker.fetch(new Request("https://relay.example/pair"), { WATCH_RELAY_KEY: token });
  const bareHtml = await bare.text();
  assert.equal(bareHtml.includes(token), false);
  const denied = await worker.fetch(new Request("https://relay.example/relay/v1/responses", { method: "POST", body: "{}" }), { WATCH_RELAY_KEY: token });
  assert.equal(denied.status, 401);
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    `event: response.output_text.delta\ndata: ${JSON.stringify({ delta: "Hello there. " })}\n\n`,
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
  try {
    const streamed = await worker.fetch(new Request("https://relay.example/relay/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text: "hi", mode: "talk", agent: "hermes" }),
    }), { WATCH_RELAY_KEY: token, HERMES_API_URL: "https://hermes.example", HERMES_API_KEY: "upstream" });
    const body = await streamed.text();
    assert.match(body, /event: delta/);
    assert.match(body, /Hello there/);
    assert.match(body, /event: done/);
  } finally {
    globalThis.fetch = previous;
  }
  assert.equal(link.startsWith("wristagent://pair?"), true);
});

await test("wrist-relay help exits without starting", () => {
  const script = fileURLToPath(new URL("../../voice/wrist-relay.mjs", import.meta.url));
  const run = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8" });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /npx wrist-relay/);
});

server.close();
closed.close();
console.log(results.join("\n"));
console.log(`${results.length} pair tests passed`);
