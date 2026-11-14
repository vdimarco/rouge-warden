// Unit tests for the X hire flow. No network and no key.
import { parseMention } from "../parse.mjs";
import { addEvent, createFeed, feedErrors, TYPES } from "../events.mjs";
import { assertBot, missingLiveEnv, oauthHeader, postReply, replyText } from "../reply.mjs";
import { renderThread } from "../thread.mjs";
import { assertTestnet } from "../fund.mjs";
import { askOf, BAD_MAP, CLAY, INK } from "../agents.mjs";
import { near } from "../../lib/near.mjs";

let fails = 0;
const ok = (name, cond) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}`); if (!cond) fails++; };

const logo = parseMention("@payonproof make me a logo, 5 NEAR");
ok("logo mention is paint at contrast 450", logo.kind === "paint" && logo.spec.contrast_x100 === 450 && logo.title === "logo");
ok("logo budget is 5 NEAR", logo.budgetNear === 5 && logo.handle === "payonproof");

const map = parseMention("@payonproof a 3 room map, 0.2 NEAR");
ok("map mention asks for 3 rooms", map.kind === "map" && map.spec.rooms === 3 && map.spec.cols === 4 && map.budgetNear === 0.2);

let threw = false;
try { parseMention("@payonproof make me a logo"); } catch { threw = true; }
ok("a mention without NEAR is refused", threw);

const feed = createFeed("x.testnet");
const tx = "1".repeat(43);
for (const type of TYPES) {
  addEvent(feed, { type, job_id: 0, tx, tx_url: "https://testnet.nearblocks.io/txns/" + tx, account: "a.testnet", data: { n: 1 } });
}
ok("a full feed has no errors", feedErrors(feed).length === 0);
feed.events[0].tx_url = "https://nearblocks.io/txns/" + tx;
ok("a mainnet url is an error", feedErrors(feed).some((e) => e.includes("mainnet")));

const calls = [];
const dry = await postReply({ text: "hello", fetchImpl: async () => { calls.push(1); return { ok: true, json: async () => ({}) }; } });
ok("dry run does not call X", dry.dryRun === true && dry.text === "hello" && calls.length === 0);

let refused = false;
try {
  await postReply({ text: "no", dryRun: false, env: { X_BOT_USERNAME: "proto_von", X_API_KEY: "a", X_API_SECRET: "b", X_ACCESS_TOKEN: "c", X_ACCESS_TOKEN_SECRET: "d" } });
} catch (e) { refused = String(e.message).includes("proto_von"); }
ok("proto_von is refused", refused);

let named = "";
try { await postReply({ text: "no", dryRun: false, env: { X_BOT_USERNAME: "payonproof" } }); }
catch (e) { named = e.message; }
ok("missing live credentials are named", missingLiveEnv({ X_BOT_USERNAME: "payonproof" }).includes("X_API_KEY") && named.includes("X_API_KEY") && named.includes("X_ACCESS_TOKEN_SECRET"));

const fakeEnv = { X_BOT_USERNAME: "payonproof", X_API_KEY: "ck", X_API_SECRET: "consumersecretvalue", X_ACCESS_TOKEN: "tk", X_ACCESS_TOKEN_SECRET: "tokensecretvalue" };
let seen = null;
await postReply({
  text: "Job 0 is open",
  replyTo: "99",
  dryRun: false,
  env: fakeEnv,
  nonce: "n1",
  timestamp: 1700000000,
  fetchImpl: async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ data: { id: "100" } }) }; },
});
const sent = JSON.parse(seen.opts.body);
ok("live post targets the tweets endpoint", seen.url === "https://api.x.com/2/tweets" && sent.text === "Job 0 is open" && sent.reply.in_reply_to_tweet_id === "99");
ok("live post signs OAuth and does not send the secret", seen.opts.headers.authorization.startsWith("OAuth ") && !seen.opts.body.includes("tokensecretvalue") && !seen.opts.headers.authorization.includes("tokensecretvalue"));
assertBot("payonproof");

const header = oauthHeader({ method: "POST", url: "https://api.x.com/2/tweets", consumerKey: "ck", consumerSecret: "cs", token: "tk", tokenSecret: "ts", nonce: "n1", timestamp: 1700000000 });
ok("OAuth header is stable", header === oauthHeader({ method: "POST", url: "https://api.x.com/2/tweets", consumerKey: "ck", consumerSecret: "cs", token: "tk", tokenSecret: "ts", nonce: "n1", timestamp: 1700000000 }) && header.includes("oauth_signature"));

const line = replyText({ kind: "checked", jobId: 1, pass: false, reason: "room cut off", txUrl: "https://testnet.nearblocks.io/txns/" + tx });
ok("a check reply names the reason and the transaction", line.includes("fail") && line.includes("room cut off") && line.includes(tx));

const html = renderThread([{ who: "you", text: "@payonproof make me a logo, 0.2 NEAR" }, { who: "bot", text: line }]);
ok("the thread page contains the reply and says it is a dry run", html.includes("Dry run") && html.includes("room cut off") && html.includes("https://testnet.nearblocks.io/txns/" + tx));

let mainnet = false;
try { assertTestnet("mainnet"); } catch (e) { mainnet = e.message.includes("testnet only"); }
ok("funding refuses mainnet", mainnet);
assertTestnet("testnet");

const budget = near(0.2);
ok("Ink asks 0.16 and Clay asks 0.11 of a 0.2 budget", askOf(INK, budget) === near(0.16) && askOf(CLAY, budget) === near(0.11));
ok("the bad map has three rooms and one link", BAD_MAP.rooms.length === 3 && BAD_MAP.links.length === 1);

console.log(fails ? `${fails} failed` : "all checks passed");
process.exit(fails ? 1 : 0);
