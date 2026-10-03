// Alexa relay for the Fitbit Sense 2. Amazon posts what you said on the watch to /api/alexa.
// This module checks that Amazon sent it, from your skill and your account, then posts the words
// to a Hermes Agent webhook route. Hermes answers in your Telegram chat. Setup: voice/README.md.
import { createHmac, verify, X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";

// Each relay intent holds the words after one lead word. Alexa drops the lead word from the slot,
// so the relay puts it back. SendIntent has several lead words ("send", "say", ...) that carry no meaning.
export const LEAD_WORDS = {
  TellIntent: "tell", AskIntent: "ask", HaveIntent: "have", CheckIntent: "check",
  WhatIntent: "what", WhatsIntent: "what's", HowIntent: "how", HowsIntent: "how's",
  IsIntent: "is", AreIntent: "are", DidIntent: "did", CanIntent: "can",
  RunIntent: "run", FixIntent: "fix", SendIntent: "",
};

const SIGNER = "echo-api.amazon.com";
const MAX_SKEW_MS = 150000; // Amazon allows no more than 150 seconds
const MAX_BODY = 100000;
const HELP = "Say what to send. For example: tell Codex to run the tests.";
const REPROMPT = "What should I send to Hermes?";
const FALLBACK = "I didn't catch a command. Start with tell, ask, check or send.";

const msOf = (c, k) => (c[k + "Date"] instanceof Date ? c[k + "Date"].getTime() : Date.parse(c[k]));
const current = (c, now) => msOf(c, "validFrom") <= now && now <= msOf(c, "validTo");
const issuedBy = (c, parent) => { try { return c.checkIssued(parent) && c.verify(parent.publicKey); } catch { return false; } };
const clip = (s) => (s.length > 140 ? s.slice(0, 137) + "..." : s);

// Amazon's rules for the SignatureCertChainUrl header. Returns the URL to fetch, or null.
export function certUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname !== "s3.amazonaws.com" || (u.port && u.port !== "443")) return null;
  const path = u.pathname.replace(/\/{2,}/g, "/");
  return path.startsWith("/echo.api/") ? "https://s3.amazonaws.com" + path : null;
}

export const parseChain = (pem) =>
  (String(pem).match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || []).map((b) => new X509Certificate(b));

// Walks up from the signing certificate and stops at the first one that a trusted root issued.
// Amazon's chain ends in cross-signed roots that newer CA stores no longer carry, so the walk
// cannot insist on reaching the last certificate in the file.
export function chainTrusted(certs, now, roots) {
  if (!certs.length || !(certs[0].subjectAltName || "").split(", ").includes("DNS:" + SIGNER)) return false;
  for (let i = 0; i < certs.length; i++) {
    const c = certs[i], parent = certs[i + 1];
    if (!current(c, now)) return false;
    if (roots.some((r) => current(r, now) && (r.fingerprint256 === c.fingerprint256 || issuedBy(c, r)))) return true;
    if (!parent || !parent.ca || !issuedBy(c, parent)) return false;
  }
  return false;
}

export function signedBy(body, signature, cert) {
  try { return verify("sha256", body, cert.publicKey, Buffer.from(signature, "base64")); } catch { return false; }
}

// Hermes "Generic V2" webhook signature: hex HMAC-SHA256 of "<unix seconds>.<body>".
export const hermesSignature = (body, secret, ts) => createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

// The fetch options for one signed post to the Hermes watch route. The route's events list must include watch.voice.
export function hermesRequest(text, { secret, intent = "SendIntent", locale = "en-US", requestId, source = "alexa", t = Date.now() }) {
  const body = JSON.stringify({ event_type: "watch.voice", text, source, intent, locale, sent_at: new Date(t).toISOString() });
  const ts = Math.floor(t / 1000);
  const headers = { "Content-Type": "application/json", "X-Webhook-Timestamp": String(ts), "X-Webhook-Signature-V2": hermesSignature(body, secret, ts) };
  if (requestId) headers["X-Request-ID"] = requestId; // Hermes drops a repeat of the same ID for an hour
  return { method: "POST", headers, body };
}

export function hermesReply(code, status, text) {
  if (status === "duplicate") return "Hermes already has that one.";
  if (status === "ignored") return "Hermes ignored it. Check the watch route in its config.";
  if (code >= 200 && code < 300) return "Sent: " + clip(text);
  if (code === 401) return "Hermes rejected the signature. Use the same secret on both sides.";
  if (code === 404) return "Hermes has no route at that address.";
  if (code === 429) return "Hermes is rate limiting. Try again in a minute.";
  return `Hermes answered with error ${code}.`;
}

const say = (text, open = false) => Response.json({
  version: "1.0",
  response: {
    outputSpeech: { type: "PlainText", text },
    ...(open && { reprompt: { outputSpeech: { type: "PlainText", text: REPROMPT } } }),
    shouldEndSession: !open,
  },
});

async function fetchText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error("certificate fetch " + r.status);
  return r.text();
}

let storeRoots;
const systemRoots = () => (storeRoots ||= rootCertificates.flatMap((p) => { try { return [new X509Certificate(p)]; } catch { return []; } }));

export function relayStatus(env = process.env) {
  const users = (env.ALEXA_USER_IDS || "").split(",").filter((s) => s.trim()).length;
  return Response.json({ ok: true, skill: Boolean(env.ALEXA_SKILL_ID), users, hermes: Boolean(env.HERMES_WEBHOOK_URL && env.HERMES_WEBHOOK_SECRET) });
}

export function createRelay({ env = process.env, now = Date.now, getText = fetchText, post = fetch, roots = systemRoots, log = console.log } = {}) {
  const chains = new Map(); // certificate URL -> verified chain, kept while the signing certificate is current
  const reject = (why) => { log("alexa: rejected, " + why); return new Response("Bad Request", { status: 400 }); };

  async function signer(url, t) {
    const hit = chains.get(url);
    if (hit && current(hit[0], t)) return hit[0];
    const certs = parseChain(await getText(url));
    if (!chainTrusted(certs, t, roots())) return null;
    chains.set(url, certs);
    return certs[0];
  }

  async function forward(text, req, t) {
    const options = hermesRequest(text, { secret: env.HERMES_WEBHOOK_SECRET, intent: req.intent.name, locale: req.locale, requestId: req.requestId, t });
    let r, reply;
    try {
      r = await post(env.HERMES_WEBHOOK_URL, { ...options, signal: AbortSignal.timeout(4000) });
      reply = await r.json().catch(() => ({}));
    } catch (e) {
      log("alexa: hermes unreachable, " + e.message);
      return "I couldn't reach Hermes.";
    }
    log(`alexa: hermes ${r.status} ${reply.status || ""}`);
    return hermesReply(r.status, reply.status, text);
  }

  return async function handle(request) {
    const t = now();
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return reject("body too large");
    const body = Buffer.from(await request.arrayBuffer());
    if (body.length > MAX_BODY) return reject("body too large");
    const url = certUrl(request.headers.get("signaturecertchainurl") || "");
    const signature = request.headers.get("signature-256") || "";
    if (!url || !signature) return reject("missing or bad signature headers");
    let cert;
    try { cert = await signer(url, t); } catch (e) { return reject(e.message); }
    if (!cert || !signedBy(body, signature, cert)) return reject("signature check failed");
    let alexa;
    try { alexa = JSON.parse(body.toString("utf8")); } catch { return reject("body is not JSON"); }
    if (!alexa || typeof alexa !== "object") return reject("body is not an Alexa request");
    const req = alexa.request || {};
    if (!(Math.abs(t - Date.parse(req.timestamp)) <= MAX_SKEW_MS)) return reject("timestamp outside 150 seconds");
    const sys = alexa.context?.System || {};
    const skill = sys.application?.applicationId || alexa.session?.application?.applicationId;
    if (!env.ALEXA_SKILL_ID) return say("The relay needs ALEXA_SKILL_ID in Vercel.");
    if (skill !== env.ALEXA_SKILL_ID) return reject("request for another skill");

    if (req.type === "LaunchRequest") return say(HELP, true);
    if (req.type !== "IntentRequest") return Response.json({ version: "1.0", response: {} });
    const name = req.intent?.name || "";
    if (name === "AMAZON.HelpIntent") return say(HELP, true);
    if (/^AMAZON\.(Stop|Cancel|NavigateHome)Intent$/.test(name)) return say("Okay.");
    const words = String(req.intent?.slots?.Query?.value || "").trim();
    if (!Object.hasOwn(LEAD_WORDS, name) || !words) return say(FALLBACK, true);

    const user = sys.user?.userId || alexa.session?.user?.userId || "";
    const users = (env.ALEXA_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!users.length) {
      log("alexa: add this user ID to ALEXA_USER_IDS: " + user);
      return say("Almost ready. Copy your Alexa user ID from the Vercel log into ALEXA_USER_IDS.");
    }
    if (!users.includes(user)) return say("This relay is set up for a different Amazon account.");
    if (!env.HERMES_WEBHOOK_URL || !env.HERMES_WEBHOOK_SECRET) return say("The relay needs HERMES_WEBHOOK_URL and HERMES_WEBHOOK_SECRET in Vercel.");
    return say(await forward((LEAD_WORDS[name] ? LEAD_WORDS[name] + " " : "") + words, req, t));
  };
}
