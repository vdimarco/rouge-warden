// Cloudflare Worker relay. `node voice/worker/deploy.mjs` runs `wrangler deploy` and prints the pairing link.
// Hermes or OpenAI must be a public URL. Pi and the JSONL memory file stay on `npx wrist-relay`.
import { deepLink, pairPage } from "../../pair-link.mjs";

const VOICE = "Reply in short spoken sentences.";
const FOOD = "Confirm the meal in one sentence, then a line FOOD: {\"items\":[{\"name\":\"\",\"portion\":\"\"}],\"time\":\"HH:MM\"}.";

function tokensMatch(presented, want) {
  const got = String(presented || "");
  const need = String(want || "");
  if (!got || got.length !== need.length) return false;
  let diff = 0;
  for (let i = 0; i < need.length; i++) diff |= got.charCodeAt(i) ^ need.charCodeAt(i);
  return diff === 0;
}

function authorized(request, env) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization") || "");
  return tokensMatch(match ? match[1] : "", env.WATCH_RELAY_KEY);
}

function meals() {
  if (!globalThis.__wristFood) globalThis.__wristFood = [];
  return globalThis.__wristFood;
}

function takeFood(text) {
  const raw = String(text || "");
  const at = raw.lastIndexOf("FOOD:");
  if (at < 0) return { speech: raw.trim(), food: false, entry: null };
  const speech = raw.slice(0, at).trim();
  try {
    const entry = JSON.parse(raw.slice(at + 5).trim());
    return { speech, food: true, entry };
  } catch {
    return { speech: raw.trim(), food: false, entry: null };
  }
}

function pair(url, env) {
  let relayUrl = url.searchParams.get("u") || url.searchParams.get("url") || "";
  let key = url.searchParams.get("k") || url.searchParams.get("token") || "";
  if (!relayUrl || !key) {
    return new Response("<!doctype html><p>Open the pairing link printed when the relay was deployed.</p>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (!env.WATCH_RELAY_KEY || !tokensMatch(key, env.WATCH_RELAY_KEY)) {
    return new Response("<!doctype html><p>That pairing link does not match this relay.</p>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const link = deepLink(relayUrl, key);
  return new Response(pairPage(link), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function foodList(url) {
  const day = url.searchParams.get("day") || "";
  const entries = meals().filter((entry) => !day || entry.day === day);
  return Response.json({ entries });
}

async function responses(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const text = String(body.text || body.input || "").slice(0, 8000);
  const mode = body.mode === "food" ? "food" : "talk";
  const agent = String(body.agent || env.WATCH_AGENT || "hermes");
  if (!text) return Response.json({ error: "empty" }, { status: 400 });
  if (agent === "pi") return Response.json({ error: "pi runs on npx wrist-relay" }, { status: 501 });
  const openai = agent === "openai";
  const base = openai ? env.OPENAI_BASE_URL : env.HERMES_API_URL;
  const key = openai ? env.OPENAI_API_KEY : env.HERMES_API_KEY;
  if (!base || !key) return Response.json({ error: "agent is not configured" }, { status: 502 });
  const upstream = await fetch(String(base).replace(/\/+$/, "") + "/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: openai ? env.OPENAI_MODEL || "gpt-4o-mini" : "hermes-agent",
      store: !openai,
      instructions: mode === "food" ? FOOD : VOICE,
      input: [{ role: "user", content: text }],
      ...(openai ? {} : { conversation: env.HERMES_CONVERSATION || "watch-call" }),
      stream: true,
    }),
  });
  if (!upstream.ok || !upstream.body) return Response.json({ error: "agent failed" }, { status: 502 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`));
      };
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let spoken = "";
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buf += decoder.decode(chunk.value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const part of parts) {
            const dataLine = part
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .join("\n");
            if (!dataLine || dataLine === "[DONE]") continue;
            let json;
            try {
              json = JSON.parse(dataLine);
            } catch {
              continue;
            }
            const event = (part.match(/^event:\s*(\S+)/m) || [])[1] || json.type || "";
            if (event === "response.output_text.delta" && json.delta) {
              spoken += json.delta;
              send("delta", { text: json.delta });
            }
          }
        }
        const food = takeFood(spoken);
        if (mode === "food" && food.entry) {
          meals().push({ at: Date.now(), day: String(body.day || ""), text: food.speech, ...food.entry });
        }
        send("done", { speech: food.speech, food: food.food, entry: food.entry });
      } catch {
        send("error", { message: "agent failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return Response.json({ ok: true });
    if (request.method === "GET" && (url.pathname === "/pair" || url.pathname === "/pair/")) return pair(url, env || {});
    if (url.pathname === "/relay/v1/food" || url.pathname === "/relay/v1/responses") {
      if (!authorized(request, env || {})) return Response.json({ error: "unauthorized" }, { status: 401 });
      if (request.method === "GET" && url.pathname === "/relay/v1/food") return foodList(url);
      if (request.method === "POST" && url.pathname === "/relay/v1/responses") return responses(request, env);
    }
    return new Response("not found", { status: 404 });
  },
};
