// Checks that the lab stays out of the arcade: node qa/lab/hidden.mjs
// The arcade page and the game switcher never link to /lab/, and every lab page asks search engines to skip it.
// No browser needed. Exit code 1 on failure.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };

for (const f of ["public/index.html", "public/arcade/switch.js"]) check(!/\/lab\b|lab\//.test(read(f)), `${f} does not mention the lab`);

const pages = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
};
walk("public/lab");
check(pages.length >= 1, `found ${pages.length} lab pages`);
for (const p of pages) check(/<meta name="robots" content="noindex">/.test(read(p)), `${p} has noindex`);

console.log(`\nhidden: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
