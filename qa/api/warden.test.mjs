// Which origins /api/warden takes: node qa/api/warden.test.mjs
// It calls the handler in api/warden.js with a fake request and no gateway credential, so it makes no network call.
// An origin that passes the check gets 503 ("no gateway credential"). An origin that the check refuses gets 403.
// Exit code 1 if an origin gets the wrong answer.
import { createRequire } from "module";

delete process.env.VERCEL_OIDC_TOKEN;
delete process.env.AI_GATEWAY_API_KEY;
const handler = createRequire(import.meta.url)("../../api/warden.js");

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };

async function call(origin) {
  const out = { code: 0, body: null };
  const res = { status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; }, setHeader() {} };
  const headers = origin === undefined ? {} : { origin };
  await handler({ method: "POST", headers, body: { state: {}, questions: [{ id: "move", options: [{ value: "a" }, { value: "b" }] }] } }, res);
  return out;
}

const PASS = [
  "https://arcade.uptick.systems",
  "https://warden-alpha-wheat.vercel.app",
  "https://warden-git-some-branch-vdimarcos-projects.vercel.app",
  undefined, // no Origin header: a call from a server or from curl
];
const REFUSE = [
  "https://example.com",
  "https://uptick.systems",
  "https://www.arcade.uptick.systems",
  "https://evil-arcade.uptick.systems",
  "https://arcade.uptick.systems.example.com",
  "https://arcade.uptick.systems:8443",
  "http://arcade.uptick.systems",
  "https://vercel.app.example.com",
];

for (const o of PASS) {
  const r = await call(o);
  check(r.code === 503, `${o === undefined ? "no origin" : o} passes the origin check (got ${r.code} ${JSON.stringify(r.body)})`);
}
for (const o of REFUSE) {
  const r = await call(o);
  check(r.code === 403, `${o} is refused (got ${r.code} ${JSON.stringify(r.body)})`);
}

console.log(`\n${PASS.length + REFUSE.length - fails.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
