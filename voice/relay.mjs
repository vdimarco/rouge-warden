// Authenticated relay for the Pixel Watch. Agents stay on the host. The call server mounts
// these routes on the same port that Tailscale Funnel already publishes.
//
//   POST /relay/v1/responses   { input, mode, day, agent }
//   GET  /relay/v1/food?day=YYYY-MM-DD
//   WS   /relay/v1/stream      bearer token, then JSON turns (see voice/adapters.md)
//
// Authorization: Bearer <token>. Tokens live in WATCH_RELAY_KEY or voice/relay-keys.json.
// Set "revoked": true on a key and the next request fails. No restart.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { createBackends, pickAgent } from "./agents.mjs";
import { createMemory, memoryFile, withFacts } from "./memory.mjs";
import { FOOD_INSTRUCTIONS, VOICE_INSTRUCTIONS, hermesRequestBody, readSse, sameText } from "./watch-call.mjs";

export const RESPONSES_PATH = "/relay/v1/responses";
export const FOOD_PATH = "/relay/v1/food";
export const STREAM_PATH = "/relay/v1/stream";
const MAX_BODY = 64 * 1024;
const MAX_INPUT = 8000;

const defaultKeysFile = fileURLToPath(new URL("./relay-keys.json", import.meta.url));
const defaultFoodLog = fileURLToPath(new URL("./food-log.jsonl", import.meta.url));

export function activeKeys(env, keysFile) {
  const keys = [];
  if (env.WATCH_RELAY_KEY) keys.push({ id: "env", token: String(env.WATCH_RELAY_KEY) });
  if (keysFile && existsSync(keysFile)) {
    let parsed = { keys: [] };
    try { parsed = JSON.parse(readFileSync(keysFile, "utf8")); } catch { parsed = { keys: [] }; }
    for (const key of parsed.keys || []) {
      if (key && key.token && key.revoked !== true) keys.push({ id: String(key.id || ""), token: String(key.token) });
    }
  }
  return keys;
}

// Checks every key so a miss does not return early. sameText rejects a different length.
export function matchBearer(keys, header) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(String(header || ""));
  const presented = match ? match[1] : "";
  let found = null;
  for (const key of keys) {
    if (presented && sameText(key.token, presented)) found = key;
  }
  return found;
}

export function createLimiter(limit, windowMs, now) {
  const hits = new Map();
  return function allow(id) {
    const t = now();
    const kept = (hits.get(id) || []).filter((at) => t - at < windowMs);
    if (kept.length >= limit) {
      hits.set(id, kept);
      return false;
    }
    kept.push(t);
    hits.set(id, kept);
    return true;
  };
}

// Splits the spoken confirmation from the FOOD: line the agent adds for the log.
export function takeFood(reply) {
  const text = String(reply || "");
  const match = text.match(/(^|\n)\s*FOOD:\s*(\{[\s\S]*\})\s*$/);
  if (!match) return { spoken: text.trim(), food: null };
  let food = null;
  try { food = JSON.parse(match[2]); } catch { food = null; }
  const spoken = text.slice(0, match.index).trim();
  return { spoken, food };
}

export function foodItems(food) {
  if (!food || !Array.isArray(food.items)) return [];
  return food.items
    .filter((item) => item && typeof item.name === "string" && item.name.trim())
    .map((item) => ({ name: String(item.name).trim().slice(0, 80), portion: String(item.portion || "").trim().slice(0, 80) }));
}

export function readFoodLog(file, day) {
  if (!existsSync(file)) return [];
  const entries = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && entry.day === day) entries.push(entry);
    } catch { /* skip a torn line */ }
  }
  return entries.slice(-50);
}

export function appendFoodLog(file, entry) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(entry) + "\n");
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers }).end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error("body too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function speechText(event, data) {
  if (event === "response.output_text.delta" && data && data.delta) return String(data.delta);
  if (event === "response.output_item.done" && data?.item?.phase === "commentary") {
    const note = (data.item.content || []).map((part) => part.text || "").join("").trim();
    if (note) return note + " ";
  }
  return "";
}

function sseFrame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`;
}

// Returns a function the HTTP server calls. True means this route owns the response.
// route.upgrade handles the warm WebSocket on STREAM_PATH.
export function createRelay({
  env,
  post = fetch,
  log = console.log,
  now = Date.now,
  keysFile = env.WATCH_RELAY_KEYS || defaultKeysFile,
  foodLog = env.FOOD_LOG_PATH || defaultFoodLog,
  memoryFile: memoryPath = memoryFile(env),
  memory,
  backends,
  spawn,
  limit = Number(env.WATCH_RELAY_RATE || 30),
  windowMs = Number(env.WATCH_RELAY_WINDOW_MS || 60_000),
} = {}) {
  const allow = createLimiter(limit, windowMs, now);
  const store = memory || createMemory({ file: memoryPath, now });
  const agents = backends || createBackends({ env, post, spawn, log });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_BODY });

  function route(req, res) {
    const url = new URL(req.url, "http://local");
    if (url.pathname !== RESPONSES_PATH && url.pathname !== FOOD_PATH) return false;
    handle(url, req, res).catch((error) => {
      if (!res.headersSent) {
        json(res, error.status || 500, { error: error.status ? error.message : "relay failed" }, error.headers || {});
      } else res.end();
      log("relay: " + (error.message || error));
    });
    return true;
  }

  route.upgrade = function upgrade(req, socket, head) {
    const key = matchBearer(activeKeys(env, keysFile), req.headers.authorization);
    if (!key) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      return;
    }
    sockets.handleUpgrade(req, socket, head, (ws) => openSocket(ws, key));
  };

  return route;

  function openSocket(ws, key) {
    const turns = new Map();
    const send = (message) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
    };
    send({ type: "ready" });
    ws.on("message", (raw) => {
      let message;
      try { message = JSON.parse(raw); } catch { return; }
      if (message.type === "barge") {
        turns.get(String(message.id || ""))?.abort();
        return;
      }
      if (message.type !== "turn") return;
      const id = String(message.id || "");
      if (!id) return;
      if (!matchBearer(activeKeys(env, keysFile), "Bearer " + key.token)) {
        send({ type: "failed", id, message: "unauthorized" });
        ws.close(1008, "unauthorized");
        return;
      }
      turns.get(id)?.abort();
      const ctl = new AbortController();
      turns.set(id, ctl);
      runTurn({
        input: message.input,
        mode: message.mode,
        day: message.day,
        agent: message.agent,
        signal: ctl.signal,
        key,
        onDelta(text) { send({ type: "delta", id, text }); },
        onDone(info) { send({ type: "done", id, firstMs: info.firstMs }); },
        onFail(error) { send({ type: "failed", id, message: error.message || "relay failed" }); },
      }).catch((error) => {
        if (!ctl.signal.aborted) onFailSafe(send, id, error);
      }).finally(() => {
        if (turns.get(id) === ctl) turns.delete(id);
      });
    });
    ws.on("close", () => {
      for (const ctl of turns.values()) ctl.abort();
    });
  }

  function onFailSafe(send, id, error) {
    send({ type: "failed", id, message: error.status ? error.message : "relay failed" });
    log("relay: " + (error.message || error));
  }

  async function handle(url, req, res) {
    const keys = activeKeys(env, keysFile);
    const key = matchBearer(keys, req.headers.authorization);
    if (!key) return json(res, 401, { error: "unauthorized" });

    if (url.pathname === FOOD_PATH) {
      if (req.method !== "GET") return json(res, 405, { error: "method" });
      const day = url.searchParams.get("day") || utcDay(now());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json(res, 400, { error: "day" });
      return json(res, 200, { day, entries: readFoodLog(foodLog, day) });
    }

    if (req.method !== "POST") return json(res, 405, { error: "method" });
    let payload;
    try { payload = JSON.parse(await readBody(req) || "{}"); } catch (error) {
      if (error.status) throw error;
      return json(res, 400, { error: "bad json" });
    }
    const upstreamCtl = new AbortController();
    const onClose = () => { if (!res.writableEnded) upstreamCtl.abort(); };
    req.on("close", onClose);
    let startedWrite = false;
    try {
      await runTurn({
        input: payload.input,
        mode: payload.mode,
        day: payload.day,
        agent: payload.agent,
        signal: upstreamCtl.signal,
        key,
        onReady(agent) {
          startedWrite = true;
          if (agent !== "hermes") {
            res.writeHead(200, {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache",
            });
          }
        },
        onHermes(upstream) {
          startedWrite = true;
          res.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
          });
          return tap(upstream.body, (chunk) => res.write(chunk));
        },
        onDelta(text) {
          res.write(sseFrame("response.output_text.delta", { delta: text }));
        },
        onDone(info) {
          if (info.agent !== "hermes") {
            res.write(sseFrame("response.completed", { response: { status: "completed" } }));
          }
        },
        onFail(error) {
          if (!startedWrite) throw error;
          res.write(sseFrame("response.failed", { error: error.message }));
        },
      });
    } finally {
      req.off("close", onClose);
      if (startedWrite) res.end();
    }
  }

  async function runTurn({ input, mode: rawMode, day: rawDay, agent: rawAgent, signal, key, onReady, onHermes, onDelta, onDone, onFail }) {
    const cleaned = String(input || "").replace(/\s+/g, " ").trim();
    if (!cleaned) {
      const error = new Error("input required");
      error.status = 400;
      throw error;
    }
    if (cleaned.length > MAX_INPUT) {
      const error = new Error("input too long");
      error.status = 400;
      throw error;
    }
    const mode = rawMode === "food" ? "food" : (rawMode == null || rawMode === "talk" ? "talk" : null);
    if (!mode) {
      const error = new Error("mode");
      error.status = 400;
      throw error;
    }
    const picked = pickAgent(cleaned, rawAgent, env.WATCH_AGENT || "hermes");
    if (picked.error || !picked.input) {
      const error = new Error(picked.error || "input required");
      error.status = 400;
      throw error;
    }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : utcDay(now());
    if (!allow(key.id || "key")) {
      const error = new Error("rate limit");
      error.status = 429;
      error.headers = { "retry-after": String(Math.ceil(windowMs / 1000)) };
      throw error;
    }
    const facts = store.recall(picked.input);
    const instructions = withFacts(mode === "food" ? FOOD_INSTRUCTIONS : VOICE_INSTRUCTIONS, facts);
    const conversation = env.HERMES_CONVERSATION || "watch-call";
    const started = now();
    let reply = "";
    let firstMs = null;
    let completed = false;
    let failed = false;
    const note = (text) => {
      if (!text) return;
      reply += text;
      if (firstMs == null) {
        firstMs = Math.max(0, now() - started);
        log(`relay: first-delta ${firstMs}ms agent=${picked.agent}`);
      }
    };

    try {
      if (picked.agent === "hermes" && onHermes) {
        const upstream = await postHermes(instructions, picked.input, signal);
        for await (const event of readSse(await onHermes(upstream))) {
          note(speechText(event.event, event.data));
          if (event.event === "response.completed") completed = true;
          if (event.event === "response.failed") failed = true;
        }
      } else {
        const backend = agents[picked.agent];
        if (!backend) {
          const error = new Error("agent");
          error.status = 400;
          throw error;
        }
        const iterator = backend.stream({ input: picked.input, instructions, conversation, signal })[Symbol.asyncIterator]();
        let step = await iterator.next();
        if (signal?.aborted) return;
        onReady?.(picked.agent);
        while (!step.done) {
          note(step.value);
          onDelta(step.value);
          step = await iterator.next();
          if (signal?.aborted) return;
        }
        completed = true;
      }
    } catch (error) {
      if (signal?.aborted) return;
      failed = true;
      if (onFail) onFail(error);
      else throw error;
    }

    if (signal?.aborted || failed || !completed) return;
    const taken = takeFood(reply);
    if (mode === "food") {
      appendFoodLog(foodLog, {
        at: new Date(now()).toISOString(),
        day,
        note: picked.input,
        reply: taken.spoken,
        items: foodItems(taken.food),
        time: typeof taken.food?.time === "string" ? taken.food.time.slice(0, 8) : "",
      });
      log(`relay: food logged for ${day} (${key.id || "key"})`);
    }
    const heard = taken.spoken || reply.trim();
    if (heard) {
      store.remember({
        text: `User said: ${picked.input}. Answer: ${heard}`,
        kind: mode,
        day,
      });
    }
    onDone?.({ firstMs, agent: picked.agent });
  }

  async function postHermes(instructions, input, signal) {
    const base = String(env.HERMES_API_URL || "http://127.0.0.1:8642").replace(/\/+$/, "");
    let upstream;
    try {
      upstream = await post(base + "/v1/responses", {
        method: "POST",
        signal,
        headers: {
          Authorization: "Bearer " + env.HERMES_API_KEY,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(hermesRequestBody(env, input, instructions)),
      });
    } catch (error) {
      if (signal?.aborted) {
        const aborted = new Error("aborted");
        aborted.status = 499;
        throw aborted;
      }
      throw error;
    }
    if (!upstream.ok || !upstream.body) {
      const error = new Error(`Hermes answered ${upstream.status}`);
      error.status = 502;
      throw error;
    }
    return upstream;
  }
}

async function* tap(body, write) {
  for await (const chunk of body) {
    write(chunk);
    yield chunk;
  }
}

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
