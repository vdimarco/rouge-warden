// Agent backends for the watch relay.
//
// AgentBackend:
//   id: "hermes" | "pi" | "openai"
//   stream({ input, instructions, conversation, signal }) yields text deltas (strings)
//
// The relay picks one backend per turn, writes the deltas to the phone or the watch,
// and does not let the client replace instructions or the Hermes conversation id.
//
// Pi speaks the JSONL protocol documented at https://pi.dev/docs/latest/rpc
// and https://pi.dev/docs/latest/json. Stdout is protocol only. This file does not
// import the Pi SDK. It spawns the `pi` CLI when that binary is on PATH.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { hermesRequestBody, readSse } from "./watch-call.mjs";

export const AGENT_IDS = ["hermes", "pi", "openai"];

const ALIASES = { hermes: "hermes", pi: "pi", claude: "openai", openai: "openai", gpt: "openai" };

// "ask claude, ..." selects an agent and removes the prefix from the utterance.
export function pickAgent(input, requested, fallback = "hermes") {
  const text = String(input || "");
  const prefix = text.match(/^\s*ask\s+(hermes|pi|claude|openai|gpt)\b[,:]?\s*/i);
  let agent = String(requested || fallback || "hermes").toLowerCase();
  let spoken = text.replace(/\s+/g, " ").trim();
  if (prefix) {
    agent = ALIASES[prefix[1].toLowerCase()];
    spoken = text.slice(prefix[0].length).replace(/\s+/g, " ").trim();
  }
  if (!AGENT_IDS.includes(agent)) return { error: "agent" };
  return { agent, input: spoken };
}

export function createBackends({ env, post = fetch, spawn: spawnFn = defaultSpawn, log = () => {} } = {}) {
  return {
    hermes: createHermesBackend({ env, post }),
    openai: createOpenAIBackend({ env, post }),
    pi: createPiBackend({ env, spawn: spawnFn, log }),
  };
}

function fail(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function createHermesBackend({ env, post = fetch }) {
  return {
    id: "hermes",
    async *stream({ input, instructions, signal }) {
      const base = String(env.HERMES_API_URL || "http://127.0.0.1:8642").replace(/\/+$/, "");
      const response = await post(base + "/v1/responses", {
        method: "POST",
        signal,
        headers: {
          Authorization: "Bearer " + env.HERMES_API_KEY,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(hermesRequestBody(env, input, instructions)),
      });
      if (!response.ok || !response.body) throw fail(`Hermes answered ${response.status}`);
      yield* deltasFromResponses(response.body);
    },
  };
}

export function createOpenAIBackend({ env, post = fetch }) {
  return {
    id: "openai",
    async *stream({ input, instructions, conversation, signal }) {
      const base = String(env.OPENAI_BASE_URL || "").replace(/\/+$/, "");
      if (!base) throw fail("Set OPENAI_BASE_URL for the OpenAI adapter");
      const style = String(env.OPENAI_API || "responses").toLowerCase() === "chat" ? "chat" : "responses";
      const model = env.OPENAI_MODEL || "gpt-4o-mini";
      const shared = instructions + "\n\nConversation id: " + (conversation || env.HERMES_CONVERSATION || "watch-call") + ".";
      const path = style === "chat" ? "/v1/chat/completions" : "/v1/responses";
      const body = style === "chat"
        ? { model, stream: true, messages: [{ role: "system", content: shared }, { role: "user", content: input }] }
        : { model, stream: true, input, instructions: shared };
      const response = await post(base + path, {
        method: "POST",
        signal,
        headers: {
          Authorization: "Bearer " + (env.OPENAI_API_KEY || ""),
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) throw fail(`OpenAI endpoint answered ${response.status}`);
      if (style === "chat") yield* deltasFromChat(response.body);
      else yield* deltasFromResponses(response.body);
    },
  };
}

async function* deltasFromResponses(body) {
  for await (const { event, data } of readSse(body)) {
    if (event === "response.output_text.delta" && data && data.delta) yield String(data.delta);
    else if (event === "response.output_item.done" && data?.item?.phase === "commentary") {
      const note = (data.item.content || []).map((part) => part.text || "").join("").trim();
      if (note) yield note + " ";
    } else if (event === "response.failed") throw fail("The agent failed the turn");
    else if (event === "response.completed") return;
  }
}

async function* deltasFromChat(body) {
  for await (const { data } of readSse(body)) {
    if (data === "[DONE]") return;
    const choice = data?.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) yield delta;
    if (choice?.finish_reason) return;
  }
}

// text_delta is the streaming shape from Pi's RPC and JSON modes.
export function textDelta(record) {
  if (!record || record.type !== "message_update") return "";
  const update = record.assistantMessageEvent;
  if (update && update.type === "text_delta" && typeof update.delta === "string") return update.delta;
  return "";
}

export function promptMessage({ input, instructions, conversation }) {
  return [
    instructions,
    "",
    "Conversation id: " + (conversation || "watch-call") + ".",
    "",
    input,
  ].join("\n");
}

function defaultSpawn(command, args) {
  return spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
}

async function* readJsonLines(stream, signal) {
  let buf = "";
  const decoder = new TextDecoder();
  try {
    for await (const chunk of stream) {
      if (signal?.aborted) return;
      buf += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      let nl = buf.indexOf("\n");
      while (nl >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);
        if (line.trim()) yield line;
        nl = buf.indexOf("\n");
      }
    }
  } catch (error) {
    if (signal?.aborted) return;
    throw error;
  }
}

export function createPiBackend({ env = {}, spawn: spawnFn = defaultSpawn, log = () => {} } = {}) {
  const command = env.PI_BIN || "pi";
  const extra = [];
  if (env.PI_PROVIDER) extra.push("--provider", String(env.PI_PROVIDER));
  if (env.PI_MODEL) extra.push("--model", String(env.PI_MODEL));
  let child = null;
  let wait = Promise.resolve();
  let pending = [];
  let notify = null;

  function pushLine(line) {
    if (notify) {
      const wake = notify;
      notify = null;
      wake(line);
    } else pending.push(line);
  }

  function takeLine() {
    if (pending.length) return Promise.resolve(pending.shift());
    return new Promise((resolve) => { notify = resolve; });
  }

  function dropChild() {
    const current = child;
    child = null;
    pending = [];
    if (notify) {
      const wake = notify;
      notify = null;
      wake(null);
    }
    if (current && !current.killed) {
      try { current.kill(); } catch { /* already gone */ }
    }
  }

  function ensureChild() {
    if (child && !child.killed && child.exitCode == null && child.signalCode == null) return child;
    let next;
    try {
      next = spawnFn(command, ["--mode", "rpc", "--no-session", ...extra]);
    } catch (error) {
      if (error.code === "ENOENT") throw fail("pi is not installed");
      throw fail(error.message || "pi failed to start");
    }
    pending = [];
    next.on?.("error", (error) => {
      log("pi: " + error.message);
      if (child === next) pushLine(null);
    });
    next.on?.("exit", () => {
      if (child === next) pushLine(null);
    });
    child = next;
    if (next.stdout) {
      const pump = readJsonLines(next.stdout);
      (async () => {
        try {
          for await (const line of pump) {
            if (child !== next) return;
            pushLine(line);
          }
        } catch (error) {
          if (child === next) log("pi: " + error.message);
        }
        if (child === next) pushLine(null);
      })();
    }
    return next;
  }

  async function* oneShot(turn) {
    let proc;
    try {
      proc = spawnFn(command, ["--mode", "json", "--no-session", ...extra, promptMessage(turn)]);
    } catch (error) {
      if (error.code === "ENOENT") throw fail("pi is not installed");
      throw fail(error.message || "pi failed to start");
    }
    const onAbort = () => { try { proc.kill(); } catch { /* already gone */ } };
    turn.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      if (!proc.stdout) throw fail("pi produced no output");
      for await (const line of readJsonLines(proc.stdout, turn.signal)) {
        let record;
        try { record = JSON.parse(line); } catch { continue; }
        const delta = textDelta(record);
        if (delta) yield delta;
        if (record.type === "agent_settled" || record.type === "agent_end") return;
      }
    } finally {
      turn.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function* rpcTurn(turn) {
    const proc = ensureChild();
    if (!proc.stdin || !proc.stdout) throw fail("pi produced no output");
    const id = "turn-" + randomBytes(4).toString("hex");
    const onAbort = () => dropChild();
    turn.signal?.addEventListener("abort", onAbort, { once: true });
    proc.stdin.write(JSON.stringify({ id, type: "prompt", message: promptMessage(turn) }) + "\n");
    let accepted = false;
    try {
      while (!turn.signal?.aborted) {
        const line = await takeLine();
        if (turn.signal?.aborted) return;
        if (line == null) break;
        let record;
        try { record = JSON.parse(line); } catch { continue; }
        if (record.type === "response" && record.id === id) {
          if (record.success === false) throw fail(record.error || "pi refused the prompt");
          accepted = true;
          if (record.data?.disposition === "handled") return;
          continue;
        }
        const delta = textDelta(record);
        if (delta) yield delta;
        if (record.type === "agent_settled") return;
      }
    } finally {
      turn.signal?.removeEventListener("abort", onAbort);
    }
    if (turn.signal?.aborted) return;
    if (!accepted) throw fail("pi closed before accepting the prompt");
  }

  return {
    id: "pi",
    async *stream(turn) {
      const previous = wait;
      let release = () => {};
      wait = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        if (String(env.PI_MODE || "").toLowerCase() === "json") {
          yield* oneShot(turn);
          return;
        }
        try {
          yield* rpcTurn(turn);
        } catch (error) {
          if (error.status === 502 && /not installed|failed to start|no output/.test(error.message)) {
            dropChild();
            yield* oneShot(turn);
            return;
          }
          throw error;
        }
      } finally {
        release();
      }
    },
  };
}
