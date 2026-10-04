// Checks the links between the arcade and the lab: node qa/lab/links.mjs
// The arcade page links to the Lab page. Every game card on the Lab page and every game in the game switcher opens
// a page that exists in public/, and every picture the switcher names exists. A switcher game marked probe shows only
// when its page is live, so its page may be missing. No browser needed. Exit code 1 on failure.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
// a site path such as /lab/worlds/ or /neon/ gives the file that the server sends
const exists = (url) => { const p = url.split(/[?#]/)[0]; return fs.existsSync(path.join(ROOT, "public", p.endsWith("/") ? p + "index.html" : p)); };

check(/href="\/lab\/"/.test(read("public/index.html")), "the arcade page links to the Lab page");

const cards = [...read("public/lab/index.html").matchAll(/<article class="toy"[\s\S]*?<\/article>/g)].map((m) => m[0]);
check(cards.length >= 4, `the Lab page has ${cards.length} game cards`);
for (const card of cards) {
  const name = (card.match(/<h2>([^<]+)<\/h2>/) || [])[1] || "a card";
  const href = (card.match(/class="play" href="([^"]+)"/) || [])[1];
  check(!!href && exists(href), `Lab page: ${name} opens ${href}`);
}

const games = [...read("public/arcade/switch.js").matchAll(/\{\s*id:\s*"[^"]+"[^}]*\}/g)].map((m) => m[0]);
check(games.length >= 5, `the game switcher lists ${games.length} games`);
for (const g of games) {
  const field = (k) => (g.match(new RegExp(k + ':\\s*"([^"]+)"')) || [])[1];
  const id = field("id"), url = field("url"), art = field("art");
  if (!/probe:\s*true/.test(g)) check(!!url && exists(url), `switcher: ${id} opens ${url}`);
  if (art) check(exists(art), `switcher: the picture for ${id} exists (${art})`);
}

console.log(`\nlinks: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
