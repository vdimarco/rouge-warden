// The watch voice relay: Alexa request checks and the Hermes hand-off. Usage: node qa/alexa/relay.test.mjs
// Needs openssl on the PATH. It makes a throwaway certificate chain that stands in for Amazon's.
import assert from "node:assert/strict";
import { createHmac, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootCertificates } from "node:tls";
import { LEAD_WORDS, certUrl, chainTrusted, createRelay, hermesReply, parseChain, relayStatus } from "../../voice/alexa-relay.mjs";

const results = [];
const test = async (name, fn) => { const t0 = Date.now(); await fn(); results.push(`ok  ${name} (${Date.now() - t0} ms)`); };
const here = new URL(".", import.meta.url);
const storeRoots = parseChain(rootCertificates.join("\n"));

// A test root, an intermediate, the signing certificate, and one issued for the wrong name. The rest are attacks:
// "forged" names the real intermediate as its issuer, but a look-alike CA signed it. "under" is signed by
// "other", which is not a CA. "evilint" names the real root as its issuer, but a look-alike root signed it.
const dir = mkdtempSync(join(tmpdir(), "alexa-pki-"));
const ssl = (...args) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
writeFileSync(join(dir, "ca.ext"), "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n");
writeFileSync(join(dir, "leaf.ext"), "basicConstraints=CA:FALSE\nsubjectAltName=DNS:echo-api.amazon.com\n");
writeFileSync(join(dir, "other.ext"), "basicConstraints=CA:FALSE\nsubjectAltName=DNS:example.com\n");
writeFileSync(join(dir, "forged.ext"), "basicConstraints=CA:FALSE\nsubjectAltName=DNS:echo-api.amazon.com\nauthorityKeyIdentifier=none\n");
writeFileSync(join(dir, "evilca.ext"), "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nauthorityKeyIdentifier=none\n");
const selfSign = (name, subject, days = "30") => ssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", `${name}.key`, "-out", `${name}.pem`, "-days", days,
  "-subj", subject, "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
const issue = (name, subject, ca, ext) => {
  ssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", `${name}.key`, "-out", `${name}.csr`, "-subj", subject);
  ssl("x509", "-req", "-in", `${name}.csr`, "-CA", `${ca}.pem`, "-CAkey", `${ca}.key`, "-CAcreateserial", "-out", `${name}.pem`, "-days", "30", "-extfile", ext);
};
selfSign("root", "/CN=Relay Test Root");
issue("int", "/CN=Relay Test Intermediate", "root", "ca.ext");
issue("leaf", "/CN=echo-api.amazon.com", "int", "leaf.ext");
issue("other", "/CN=example.com", "int", "other.ext");
selfSign("fakeint", "/CN=Relay Test Intermediate");
issue("forged", "/CN=echo-api.amazon.com", "fakeint", "forged.ext");
issue("under", "/CN=echo-api.amazon.com", "other", "leaf.ext");
selfSign("fakeroot", "/CN=Relay Test Root");
issue("evilint", "/CN=Relay Test Evil Intermediate", "fakeroot", "evilca.ext");
issue("evilleaf", "/CN=echo-api.amazon.com", "evilint", "leaf.ext");
selfSign("shortroot", "/CN=Relay Short Root", "1");
issue("shortint", "/CN=Relay Short Intermediate", "shortroot", "ca.ext");
issue("shortleaf", "/CN=echo-api.amazon.com", "shortint", "leaf.ext");
const file = (name) => readFileSync(join(dir, name), "utf8");
const pki = { root: file("root.pem"), int: file("int.pem"), leaf: file("leaf.pem"), other: file("other.pem"), forged: file("forged.pem"),
  under: file("under.pem"), evilint: file("evilint.pem"), evilleaf: file("evilleaf.pem"),
  shortroot: file("shortroot.pem"), shortint: file("shortint.pem"), shortleaf: file("shortleaf.pem"),
  leafKey: file("leaf.key"), otherKey: file("other.key"), forgedKey: file("forged.key") };
rmSync(dir, { recursive: true, force: true });
const chainPem = pki.leaf + pki.int;
const testRoots = parseChain(pki.root);

// A stand-in for the Hermes webhook route. It checks "Generic V2" signatures the way Hermes does.
const SECRET = "relay-test-secret";
const hermesCalls = [];
let hermesMode = "accept";
const hermes = createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks), ts = String(req.headers["x-webhook-timestamp"] || "");
    const expected = createHmac("sha256", SECRET).update(Buffer.concat([Buffer.from(ts + "."), raw])).digest("hex");
    const ok = Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) <= 300 && req.headers["x-webhook-signature-v2"] === expected;
    hermesCalls.push({ path: req.url, headers: req.headers, body: JSON.parse(raw), ok });
    const [code, reply] = !ok ? [401, { error: "Invalid signature" }]
      : hermesMode === "duplicate" ? [200, { status: "duplicate" }]
      : hermesMode === "ignore" ? [200, { status: "ignored", event: "watch.voice" }]
      : [202, { status: "accepted", route: "watch", event: "watch.voice", delivery_id: req.headers["x-request-id"] }];
    res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(reply));
  });
});
await new Promise((resolve) => hermes.listen(0, "127.0.0.1", resolve));
const HERMES_URL = `http://127.0.0.1:${hermes.address().port}/webhooks/watch`;

const SKILL = "amzn1.ask.skill.relay-test", USER = "amzn1.ask.account.relay-test";
const CERT_URL = "https://s3.amazonaws.com/echo.api/echo-api-cert-test.pem";
const logs = [];
let certFetches = 0, requestSeq = 0;
const makeRelay = (env = {}, roots = testRoots, chain = chainPem) => createRelay({
  env: { ALEXA_SKILL_ID: SKILL, ALEXA_USER_IDS: USER, HERMES_WEBHOOK_URL: HERMES_URL, HERMES_WEBHOOK_SECRET: SECRET, ...env },
  getText: async (url) => { certFetches++; assert.equal(url, CERT_URL); return chain; },
  roots: () => roots,
  log: (line) => logs.push(line),
});
const alexaBody = ({ type = "IntentRequest", intent = "TellIntent", words = "codex to run the tests", at = Date.now(), skill = SKILL, user = USER,
  requestId = "amzn1.echo-api.request." + ++requestSeq } = {}) => JSON.stringify({
  version: "1.0",
  session: { new: true, sessionId: "amzn1.echo-api.session.1", application: { applicationId: skill }, user: { userId: user } },
  context: { System: { application: { applicationId: skill }, user: { userId: user }, device: { deviceId: "sense-2" } } },
  request: {
    type, requestId, timestamp: new Date(at).toISOString(), locale: "en-US",
    ...(type === "IntentRequest" && { intent: { name: intent, confirmationStatus: "NONE", slots: { Query: { name: "Query", value: words, confirmationStatus: "NONE" } } } }),
  },
});
const alexaRequest = (body, { key = pki.leafKey, url = CERT_URL, signature } = {}) => new Request("https://relay.test/api/alexa", {
  method: "POST",
  headers: { "content-type": "application/json", signaturecertchainurl: url, "signature-256": signature ?? sign("sha256", Buffer.from(body), key).toString("base64") },
  body,
});
const speech = async (res) => {
  assert.equal(res.status, 200);
  const { response } = await res.json();
  return { text: response.outputSpeech?.text, end: response.shouldEndSession, reprompt: response.reprompt?.outputSpeech?.text };
};

await test("certificate URLs follow Amazon's rules", () => {
  for (const ok of ["https://s3.amazonaws.com/echo.api/echo-api-cert.pem", "https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem",
    "https://s3.amazonaws.com/echo.api/../echo.api/echo-api-cert.pem", "HTTPS://S3.AMAZONAWS.COM/echo.api/echo-api-cert.pem"])
    assert.equal(certUrl(ok), "https://s3.amazonaws.com/echo.api/echo-api-cert.pem", ok);
  for (const bad of ["http://s3.amazonaws.com/echo.api/echo-api-cert.pem", "https://notamazon.com/echo.api/echo-api-cert.pem",
    "https://s3.amazonaws.com/EcHo.aPi/echo-api-cert.pem", "https://s3.amazonaws.com/invalid.path/echo-api-cert.pem",
    "https://s3.amazonaws.com:563/echo.api/echo-api-cert.pem", "https://s3.amazonaws.com/echo.api/../evil/cert.pem", "not a url", ""])
    assert.equal(certUrl(bad), null, bad);
});

await test("Amazon's 2023 signing chain is trusted by Node's CA store while it was valid", () => {
  const certs = parseChain(readFileSync(new URL("echo-api-cert-12.pem", here), "utf8"));
  assert.equal(certs.length, 4);
  assert.ok(chainTrusted(certs, Date.parse("2023-06-01T00:00:00Z"), storeRoots));
  assert.ok(!chainTrusted(certs, Date.parse("2024-06-01T00:00:00Z"), storeRoots), "the signing certificate expired in December 2023");
  assert.ok(!chainTrusted(certs.slice(0, 1), Date.parse("2023-06-01T00:00:00Z"), storeRoots), "signing certificate without its intermediate");
});

await test("a chain is trusted only up to a known root and only for Alexa's name", () => {
  const now = Date.now();
  assert.ok(chainTrusted(parseChain(chainPem), now, testRoots));
  assert.ok(!chainTrusted(parseChain(chainPem), now, storeRoots), "unknown root");
  assert.ok(!chainTrusted(parseChain(pki.other + pki.int), now, testRoots), "wrong name");
  assert.ok(!chainTrusted(parseChain(pki.leaf), now, testRoots), "missing intermediate");
  assert.ok(!chainTrusted(parseChain(pki.int + pki.leaf), now, testRoots), "wrong order");
  assert.ok(!chainTrusted(parseChain(chainPem), now + 40 * 86400000, testRoots), "expired");
  const [forged, int] = parseChain(pki.forged + pki.int);
  assert.ok(forged.checkIssued(int), "the forged certificate names the real intermediate");
  assert.ok(!chainTrusted([forged, int], now, testRoots), "a real intermediate after a certificate it did not sign");
  assert.ok(!chainTrusted(parseChain(pki.under + pki.other + pki.int), now, testRoots), "signed by a certificate that is not a CA");
  const [evilleaf, evilint] = parseChain(pki.evilleaf + pki.evilint);
  assert.ok(evilint.checkIssued(testRoots[0]), "the look-alike intermediate names the real root");
  assert.ok(!chainTrusted([evilleaf, evilint], now, testRoots), "a look-alike root with the real root's name");
  const short = parseChain(pki.shortleaf + pki.shortint), shortRoot = parseChain(pki.shortroot);
  assert.ok(chainTrusted(short, now, shortRoot));
  assert.ok(!chainTrusted(short, now + 2 * 86400000, shortRoot), "the root expired before the certificates under it");
});

await test("a spoken command reaches Hermes signed, with its lead word put back", async () => {
  const out = await speech(await makeRelay()(alexaRequest(alexaBody({ requestId: "amzn1.echo-api.request.first" }))));
  assert.deepEqual(out, { text: "Sent: tell codex to run the tests", end: true, reprompt: undefined });
  const call = hermesCalls.at(-1);
  assert.ok(call.ok, "Hermes accepts the signature");
  assert.equal(call.path, "/webhooks/watch");
  assert.equal(call.headers["x-request-id"], "amzn1.echo-api.request.first");
  assert.equal(call.body.event_type, "watch.voice");
  assert.equal(call.body.text, "tell codex to run the tests");
  assert.equal(call.body.intent, "TellIntent");
});

await test("send drops its lead word and what's keeps it", async () => {
  const relay = makeRelay();
  await relay(alexaRequest(alexaBody({ intent: "SendIntent", words: "claude open a pull request" })));
  assert.equal(hermesCalls.at(-1).body.text, "claude open a pull request");
  await relay(alexaRequest(alexaBody({ intent: "WhatsIntent", words: "codex doing" })));
  assert.equal(hermesCalls.at(-1).body.text, "what's codex doing");
});

await test("requests that Amazon did not sign for this skill get 400 and never reach Hermes", async () => {
  const relay = makeRelay(), before = hermesCalls.length, body = alexaBody();
  const cases = {
    "no signature headers": new Request("https://relay.test/api/alexa", { method: "POST", body }),
    "certificate from another host": alexaRequest(body, { url: "https://evil.example.com/echo.api/cert.pem" }),
    "body changed after signing": alexaRequest(body.replace("run the tests", "delete the repo"), { signature: sign("sha256", Buffer.from(body), pki.leafKey).toString("base64") }),
    "signed with another key": alexaRequest(body, { key: pki.otherKey }),
    "timestamp 151 seconds old": alexaRequest(alexaBody({ at: Date.now() - 151000 })),
    "another skill": alexaRequest(alexaBody({ skill: "amzn1.ask.skill.someone-else" })),
  };
  for (const [why, req] of Object.entries(cases)) assert.equal((await relay(req)).status, 400, why);
  assert.equal((await makeRelay({}, storeRoots)(alexaRequest(alexaBody()))).status, 400, "chain from an unknown root");
  const forgedRelay = makeRelay({}, testRoots, pki.forged + pki.int);
  assert.equal((await forgedRelay(alexaRequest(alexaBody(), { key: pki.forgedKey }))).status, 400, "forged certificate before the real intermediate");
  assert.equal(hermesCalls.length, before);
});

await test("only allowed Alexa accounts can send", async () => {
  const before = hermesCalls.length;
  let out = await speech(await makeRelay({ ALEXA_USER_IDS: "" })(alexaRequest(alexaBody())));
  assert.match(out.text, /ALEXA_USER_IDS/);
  assert.ok(logs.some((line) => line.includes(USER)), "the log shows the user ID to copy");
  out = await speech(await makeRelay({ ALEXA_USER_IDS: "amzn1.ask.account.someone-else" })(alexaRequest(alexaBody())));
  assert.match(out.text, /different Amazon account/);
  out = await speech(await makeRelay({ ALEXA_SKILL_ID: "" })(alexaRequest(alexaBody())));
  assert.match(out.text, /ALEXA_SKILL_ID/);
  assert.equal(hermesCalls.length, before);
});

await test("launch and help keep the session open, stop ends it", async () => {
  const relay = makeRelay();
  let out = await speech(await relay(alexaRequest(alexaBody({ type: "LaunchRequest" }))));
  assert.equal(out.end, false);
  assert.ok(out.reprompt);
  out = await speech(await relay(alexaRequest(alexaBody({ intent: "AMAZON.HelpIntent" }))));
  assert.equal(out.end, false);
  out = await speech(await relay(alexaRequest(alexaBody({ intent: "AMAZON.StopIntent" }))));
  assert.deepEqual([out.text, out.end], ["Okay.", true]);
  out = await speech(await relay(alexaRequest(alexaBody({ intent: "AMAZON.FallbackIntent", words: "" }))));
  assert.equal(out.end, false);
  assert.match(out.text, /tell, ask/);
  out = await speech(await relay(alexaRequest(alexaBody({ intent: "constructor" }))));
  assert.equal(out.end, false, "names inherited from Object are not relay intents");
  assert.deepEqual(await (await relay(alexaRequest(alexaBody({ type: "SessionEndedRequest" })))).json(), { version: "1.0", response: {} });
});

await test("Hermes answers turn into short spoken lines", async () => {
  hermesMode = "duplicate";
  assert.equal((await speech(await makeRelay()(alexaRequest(alexaBody())))).text, "Hermes already has that one.");
  hermesMode = "ignore";
  assert.match((await speech(await makeRelay()(alexaRequest(alexaBody())))).text, /ignored/);
  hermesMode = "accept";
  assert.match((await speech(await makeRelay({ HERMES_WEBHOOK_SECRET: "wrong-secret" })(alexaRequest(alexaBody())))).text, /rejected the signature/);
  assert.equal((await speech(await makeRelay({ HERMES_WEBHOOK_URL: "http://127.0.0.1:9/webhooks/watch" })(alexaRequest(alexaBody())))).text, "I couldn't reach Hermes.");
  assert.equal(hermesReply(404, undefined, "x"), "Hermes has no route at that address.");
  assert.equal(hermesReply(429, undefined, "x"), "Hermes is rate limiting. Try again in a minute.");
});

await test("the certificate chain is fetched once and reused", async () => {
  const relay = makeRelay(), before = certFetches;
  await relay(alexaRequest(alexaBody()));
  await relay(alexaRequest(alexaBody()));
  assert.equal(certFetches - before, 1);
});

await test("the status check shows what is set without showing values", async () => {
  const status = await relayStatus({ ALEXA_SKILL_ID: SKILL, ALEXA_USER_IDS: `${USER}, other`, HERMES_WEBHOOK_URL: HERMES_URL }).json();
  assert.deepEqual(status, { ok: true, skill: true, users: 2, hermes: false });
});

await test("the skill model matches the relay's intents and Alexa's rules", () => {
  const { languageModel } = JSON.parse(readFileSync(new URL("../../voice/alexa-skill.json", here), "utf8")).interactionModel;
  const name = languageModel.invocationName;
  assert.match(name, /^[a-z']+( [a-z']+)+$/, "two or more lower-case words");
  assert.ok(!/\b(alexa|amazon|echo|skill|app|ask|tell|open|launch|run|start|play|enable)\b/.test(name), name);
  const relayIntents = languageModel.intents.filter((i) => i.slots?.some((s) => s.type === "AMAZON.SearchQuery"));
  assert.deepEqual(relayIntents.map((i) => i.name).sort(), Object.keys(LEAD_WORDS).sort());
  for (const intent of relayIntents) {
    assert.equal(intent.slots.length, 1, intent.name);
    for (const sample of intent.samples) {
      assert.match(sample, /^[a-z']+ \{Query\}$/, "one carrier word, then the slot: " + sample);
      if (LEAD_WORDS[intent.name]) assert.equal(sample.split(" ")[0], LEAD_WORDS[intent.name], sample);
    }
  }
  for (const builtIn of ["AMAZON.CancelIntent", "AMAZON.HelpIntent", "AMAZON.StopIntent", "AMAZON.FallbackIntent"])
    assert.ok(languageModel.intents.some((i) => i.name === builtIn), builtIn);
});

hermes.close();
console.log(results.join("\n"));
console.log(`${results.length} passed`);
