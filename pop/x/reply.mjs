// X reply adapter. Dry run is the default: the exact reply text is rendered into HTML.
// Live posting uses POST https://api.x.com/2/tweets with OAuth 1.0a for a dedicated bot.
// It refuses to post as proto_von. It does not create an account.
import crypto from "node:crypto";

export const LIVE_ENV = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET", "X_BOT_USERNAME"];
const API = "https://api.x.com/2/tweets";

export function assertBot(username) {
  const name = String(username || "").replace(/^@/, "").toLowerCase();
  if (name === "proto_von") throw new Error("refusing to post as proto_von");
}

function enc(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function oauthHeader({ method, url, consumerKey, consumerSecret, token, tokenSecret, nonce, timestamp }) {
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const pairs = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join("&");
  const base = [method.toUpperCase(), enc(url), enc(pairs)].join("&");
  const key = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  const signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  const all = { ...params, oauth_signature: signature };
  return "OAuth " + Object.keys(all).sort().map((k) => `${enc(k)}="${enc(all[k])}"`).join(", ");
}

export function missingLiveEnv(env = process.env) {
  return LIVE_ENV.filter((k) => !env[k]);
}

// dryRun defaults to true. Pass dryRun: false only when a dedicated bot should post.
export async function postReply({ text, replyTo, env = process.env, dryRun = true, fetchImpl = globalThis.fetch, nonce, timestamp } = {}) {
  assertBot(env.X_BOT_USERNAME);
  if (dryRun) return { dryRun: true, text };
  const missing = missingLiveEnv(env);
  if (missing.length) {
    throw new Error("live X posting needs a dedicated bot account (not proto_von) and these credentials: " + missing.join(", ") + ". Also set X_REPLY_TO_TWEET_ID to the mention being answered. This run does not create that account.");
  }
  const body = { text };
  if (replyTo) body.reply = { in_reply_to_tweet_id: String(replyTo) };
  const authorization = oauthHeader({
    method: "POST",
    url: API,
    consumerKey: env.X_API_KEY,
    consumerSecret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN,
    tokenSecret: env.X_ACCESS_TOKEN_SECRET,
    nonce: nonce || crypto.randomBytes(12).toString("hex"),
    timestamp: timestamp || Math.floor(Date.now() / 1000),
  });
  const res = await fetchImpl(API, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("X API " + res.status + " " + JSON.stringify(payload).slice(0, 300));
  return { dryRun: false, text, tweetId: payload?.data?.id || null };
}

export function replyText(step) {
  const link = step.txUrl || "";
  switch (step.kind) {
    case "opened":
      return `Job ${step.jobId} is open: ${step.title} (${step.kindName}), budget ${step.budget} NEAR. Funding page, no wallet install: ${step.fundUrl} ${link}`.trim();
    case "refused":
      return `Posting the job before it was funded was refused: ${step.reason} ${link}`.trim();
    case "funded":
      return `Funded. The requester signed the transfer and paid ${step.amount} NEAR. No wallet extension. ${link}`.trim();
    case "bid":
      return `${step.name} bids ${step.ask} NEAR on job ${step.jobId}. ${link}`.trim();
    case "hired":
      return `Hired ${step.name} for job ${step.jobId} at ${step.ask} NEAR. ${step.note || ""} ${link}`.replace(/\s+/g, " ").trim();
    case "delivered":
      return `${step.name} delivered job ${step.jobId}. ${step.note || ""} ${link}`.replace(/\s+/g, " ").trim();
    case "checked":
      return `Check on job ${step.jobId}: ${step.pass ? "pass" : "fail"}. ${step.reason} ${link}`.trim();
    case "paid":
      return `Paid ${step.amount} NEAR to ${step.name} for job ${step.jobId}. ${link}`.trim();
    case "disputed":
      return `${step.name} disputed job ${step.jobId}. Jury case ${step.caseId}. ${link}`.trim();
    case "ruled":
      return `Jury ruled for the ${step.side} on job ${step.jobId}. ${step.detail} ${link}`.replace(/\s+/g, " ").trim();
    default:
      throw new Error("unknown reply kind " + step.kind);
  }
}
