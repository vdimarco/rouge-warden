#!/usr/bin/env node
// Tests for the bundle check. Each case writes a tiny www/ to a temp folder and checks what check-www reports.
// Usage: node scripts/check-www.test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkWww } from "./check-www.mjs";

let failed = 0, passed = 0;
const GOOD_HEAD = `<!doctype html><html lang="en" data-build="store"><head><meta charset="utf-8">
<script type="importmap">{ "imports": { "three": "./lib/three.module.min.js" } }</script>
<link rel="stylesheet" href="style.css"></head>`;

function bundle(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "www-check-"));
  const base = {
    "index.html": `${GOOD_HEAD}<body><section id="title" hidden><div id="tkick">LOON LAKE</div><button>Go fishing</button></section>
<script type="module" src="js/main.js"></script></body></html>`,
    "style.css": `body { background: url("./art/lake.webp"); }`,
    "art/lake.webp": "x",
    "lib/three.module.min.js": `export const REVISION = "170"; const NS = "http://www.w3.org/1999/xhtml";`,
    "js/main.js": `import * as THREE from "three";\n// fetch("https://example.com/old.json") is only a comment\nconst glsl = \`// a shader comment, not a web address\`;\n`,
    "privacy.html": `<!doctype html><html lang="en"><body><p>Read more at https://example.com/policy. That is plain text.</p><a href="./">Back</a></body></html>`,
  };
  for (const [f, text] of Object.entries({ ...base, ...files })) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}

function expect(name, files, { ok, error, warn, strict = false }) {
  const dir = bundle(files);
  const res = checkWww(dir, { strict, quiet: true });
  const problems = [];
  if (res.ok !== ok) problems.push(`ok was ${res.ok}, wanted ${ok}`);
  if (error && !res.errors.some((e) => error.test(e.msg))) problems.push(`no error matched ${error}`);
  if (warn && !res.warns.some((e) => warn.test(e.msg))) problems.push(`no warning matched ${warn}`);
  fs.rmSync(dir, { recursive: true, force: true });
  if (problems.length) {
    failed++;
    console.log(`FAIL ${name}: ${problems.join("; ")}`);
    for (const e of [...res.errors, ...res.warns]) console.log(`     ${e.level} ${e.file}: ${e.msg}`);
  } else { passed++; console.log(`ok   ${name}`); }
}

expect("a clean bundle passes (comments, shader strings and privacy text are allowed)", {}, { ok: true });
expect("missing store flag", { "index.html": `<!doctype html><html lang="en"><head><script type="importmap">{"imports":{"three":"./lib/three.module.min.js"}}</script></head><body><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /data-build="store"/ });
expect("an import from a CDN", { "js/main.js": `import { gsap } from "https://cdn.jsdelivr.net/npm/gsap/index.js";` }, { ok: false, error: /import loads another host/ });
expect("an import map entry on a CDN", { "index.html": GOOD_HEAD.replace('"./lib/three.module.min.js"', '"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js"') + `<body><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /import map entry "three" loads another host/ });
expect("a fetch to another host", { "js/main.js": `fetch("https://api.example.com/score");` }, { ok: false, error: /fetch loads another host/ });
expect("a web font link", { "index.html": GOOD_HEAD.replace("</head>", `<link href="https://fonts.googleapis.com/css2?family=Nunito" rel="stylesheet"></head>`) + `<body><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /<link href> loads another host/ });
expect("an image src on another host", { "index.html": `${GOOD_HEAD}<body><img src="https://example.com/a.png" alt=""><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /<img src> loads another host/ });
expect("a root path icon", { "index.html": `${GOOD_HEAD.replace("</head>", '<link rel="icon" href="/icons/favicon.svg"></head>')}<body><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /root path/ });
expect('a link to href="/"', { "index.html": `${GOOD_HEAD}<body><a href="/">Home</a><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /root path/ });
expect("a string that names an arcade path", { "js/main.js": `import * as THREE from "three"; const next = "/wild/";` }, { ok: false, error: /path of the web site: \/wild\// });
expect("the arcade switcher script", { "index.html": `${GOOD_HEAD}<body><script src="/arcade/switch.js"></script><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /root path/ });
expect("visible Switch game", { "index.html": `${GOOD_HEAD}<body><section id="title" hidden><button>Switch game</button></section><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /arcade text/ });
expect("visible GET PLUNGER'D kicker", { "index.html": `${GOOD_HEAD}<body><div id="tkick">GET PLUNGER'D · LOON LAKE</div><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /arcade text/ });
expect("arcade text in a label", { "index.html": `${GOOD_HEAD}<body><button aria-label="Back to the arcade">x</button><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /arcade text/ });
expect("arcade parts that the store CSS hides are allowed", { "index.html": `${GOOD_HEAD}<body><div id="arcadeRow"><button data-switch>Switch game</button><a data-store-hidden hidden>Back to the arcade</a></div><button data-switch hidden>Switch game</button><script type="module" src="js/main.js"></script></body></html>` }, { ok: true });
expect("a missing file", { "js/main.js": `import * as THREE from "three"; import { x } from "./gone.js";` }, { ok: false, error: /missing file: \.\/gone\.js/ });
expect("a missing art file from new URL", { "js/main.js": `import * as THREE from "three"; const u = new URL("../art/sky.webp", import.meta.url);` }, { ok: false, error: /missing file: \.\.\/art\/sky\.webp/ });
expect("a path outside the game folder", { "js/main.js": `import * as THREE from "three"; import { y } from "../../crimson/js/y.js";` }, { ok: false, error: /outside the game folder/ });
expect("a bare import with no import map entry", { "js/main.js": `import * as THREE from "three"; import gsap from "gsap";` }, { ok: false, error: /has no import map entry/ });
expect("ghibli is a warning by default", { "art/ghibli-sky.webp": "x", "js/main.js": `import * as THREE from "three"; const s = new URL("../art/ghibli-sky.webp", import.meta.url);` }, { ok: true, warn: /ghibli/ });
expect("ghibli is an error with --strict", { "art/ghibli-sky.webp": "x", "js/main.js": `import * as THREE from "three"; const s = new URL("../art/ghibli-sky.webp", import.meta.url);` }, { ok: false, error: /ghibli/, strict: true });
expect("a template URL copies every match", { "clips/guide-touch.mp4": "x", "clips/guide-motion.mp4": "x", "js/main.js": "import * as THREE from \"three\"; const v = new URL(`../clips/guide-${mode}.mp4`, import.meta.url);" }, { ok: true });
expect("an unused file is a warning", { "art/old.webp": "x" }, { ok: true, warn: /nothing loads this file/ });
expect("web copy is a warning", { "index.html": `${GOOD_HEAD}<body><p>Free in your browser.</p><script type="module" src="js/main.js"></script></body></html>` }, { ok: true, warn: /web copy/ });
expect("a regular expression with quote marks does not confuse the scanner", { "js/main.js": `import * as THREE from "three"; const re = /["'\`]/g; const t = "ok"; fetch("https://x.example.com/a");` }, { ok: false, error: /fetch loads another host/ });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
