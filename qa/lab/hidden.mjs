// Checks that the arcade shows the lab, and that every lab page still asks search engines to skip it: node qa/lab/hidden.mjs
// (The file keeps its old name. It used to check that the arcade never mentioned the lab; that rule is retired, because the arcade now has a Lab machine.)
// The arcade page has a Lab machine and a link to the lab, the game switcher lists the lab, and every lab page has noindex.
// No browser needed. Exit code 1 on failure.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };

const arcade = read("public/index.html"), sw = read("public/arcade/switch.js");
check(/<article class="cab[^"]*"[^>]*data-url="\/lab\/"/.test(arcade), "public/index.html has a machine that opens /lab/");
check(/<a href="\/lab\/">/.test(arcade), "public/index.html has a link to /lab/");
check(/url:\s*"\/lab\/"/.test(sw), "public/arcade/switch.js lists /lab/");

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
