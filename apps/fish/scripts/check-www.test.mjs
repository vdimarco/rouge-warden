#!/usr/bin/env node
// Tests for the bundle check. Each case writes a tiny www/ to a temp folder and checks what check-www reports.
// Usage: node scripts/check-www.test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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

// Web addresses that the code holds in a variable, or builds into markup, and root paths in page navigation.
const T = `import * as THREE from "three";\n`;
expect("a CDN address in a variable, loaded by import()", { "js/main.js": T + `const CDN = "https://cdn.jsdelivr.net/npm/foo@1/foo.js"; import(CDN);` }, { ok: false, error: /string holds a web address: https:\/\/cdn\.jsdelivr/ });
expect("an API address in a variable, joined and fetched", { "js/main.js": T + `const API = "https://api.example.com/scores"; fetch(API + "?x=1");` }, { ok: false, error: /string holds a web address: https:\/\/api\.example\.com/ });
expect("a web font link built by a script", { "js/main.js": T + `const GF = "https://fonts.googleapis.com/css2?family=Nunito"; document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: GF }));` }, { ok: false, error: /string holds a web address: https:\/\/fonts\.googleapis/ });
expect("a web address inside a longer string", { "js/main.js": T + `el.innerHTML = '<img src="https://example.com/a.png">';` }, { ok: false, error: /string holds a web address/ });
expect("a web address in a template literal", { "js/main.js": T + "const u = `https://${host}/scores`;" }, { ok: false, error: /string holds a web address/ });
expect("a protocol-relative address", { "js/main.js": T + `const u = "//cdn.example.com/a.js";` }, { ok: false, error: /string holds a web address/ });
expect("a WebSocket address", { "js/main.js": T + `const ws = new WebSocket("wss://live.example.com/feed");` }, { ok: false, error: /another host/ });
expect("window.location to the site root", { "js/main.js": T + `window.location = "/";` }, { ok: false, error: /page navigation uses a root path/ });
expect("location.assign to the site root", { "js/main.js": T + `location.assign("/");` }, { ok: false, error: /page navigation uses a root path/ });
expect("location.replace to the arcade", { "js/main.js": T + `location.replace("/arcade/");` }, { ok: false, error: /page navigation uses a root path/ });
expect("history.pushState to the site root", { "js/main.js": T + `history.pushState({ s: 1 }, "", "/");` }, { ok: false, error: /page navigation uses a root path/ });
expect("window.open on another host", { "js/main.js": T + `window.open("https://example.com/");` }, { ok: false, error: /page navigation loads another host/ });
expect("markup in a string that links to the site root", { "js/main.js": T + `el.innerHTML = '<a href="/">Back</a>';` }, { ok: false, error: /markup in a string uses a root path that does not exist in the app: \/$/ });
expect("a relative navigation in the app is allowed", { "js/main.js": T + `location.replace("./?debug"); history.replaceState(null, "", "#title");` }, { ok: true });
expect("a web address in a style sheet custom property", { "style.css": `body { background: url("./art/lake.webp"); --src: "https://example.com/x.png"; }` }, { ok: false, error: /style sheet holds a web address/ });
expect("a web address in a data attribute", { "index.html": `${GOOD_HEAD}<body><div data-src="https://example.com/a.png"></div><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /<div data-src> holds a web address/ });
expect("a web address in a JSON data block", { "index.html": `${GOOD_HEAD}<body><script type="application/json" id="cfg">{"api":"https://api.example.com"}</script><script type="module" src="js/main.js"></script></body></html>` }, { ok: false, error: /<script type="application\/json"> holds a web address/ });
expect("a web address in a JSON file", { "data/places.json": `{"places":[{"name":"Loon Lake","img":"https://example.com/a.webp"}]}`, "js/main.js": T + `fetch("data/places.json");` }, { ok: false, error: /JSON string holds a web address/ });
expect("a site path in a JSON file", { "data/places.json": `{"next":"/wild/"}`, "js/main.js": T + `fetch("data/places.json");` }, { ok: false, error: /JSON string names a path of the web site/ });
expect("an SVG that loads another host", { "art/badge.svg": `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image href="https://example.com/a.png"/></svg>`, "style.css": `body { background: url("./art/badge.svg"); }` }, { ok: false, error: /<image href> loads another host/ });
expect("an SVG with namespace names only is allowed", { "art/badge.svg": `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="4" height="4"/></svg>`, "style.css": `body { background: url("./art/lake.webp"), url("./art/badge.svg"); }` }, { ok: true });
expect("a file that nothing loads is still read for web addresses", { "js/old.js": `fetch("https://api.example.com/old");` }, { ok: false, error: /fetch loads another host/ });
expect("a web address as text in the game page is a warning", { "index.html": `${GOOD_HEAD}<body><p>Visit https://example.com for more.</p><script type="module" src="js/main.js"></script></body></html>` }, { ok: true, warn: /shows a web address/ });

// Arcade text that a script writes at run time.
expect("arcade text in a script is a warning", { "js/main.js": T + `document.querySelector("#tkick").textContent = "GET PLUNGER'D · " + place;` }, { ok: true, warn: /line 2: a script holds arcade text "GET PLUNGER'D/ });
expect("arcade text in a script is an error with --strict", { "js/main.js": T + `document.querySelector("#tkick").textContent = "GET PLUNGER'D · " + place;` }, { ok: false, error: /a script holds arcade text/, strict: true });
expect('arcade text on a line marked "web only" is allowed', { "js/main.js": T + `const kick = store ? "" : "GET PLUNGER'D · "; // web only` }, { ok: true, strict: true });
expect("arcade text in an inline script", { "index.html": `${GOOD_HEAD}<body><script>document.title = "Switch game";</script><script type="module" src="js/main.js"></script></body></html>` }, { ok: true, warn: /a script holds arcade text "Switch game"/ });

// WWW_STRICT=1 does what --strict does, on the command line of check-www.
{
  const dir = bundle({ "art/ghibli-sky.webp": "x", "js/main.js": T + `const s = new URL("../art/ghibli-sky.webp", import.meta.url);` });
  const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-www.mjs");
  const plain = spawnSync(process.execPath, [cli, dir], { encoding: "utf8" });
  const env = spawnSync(process.execPath, [cli, dir], { encoding: "utf8", env: { ...process.env, WWW_STRICT: "1" } });
  const flag = spawnSync(process.execPath, [cli, "--strict", dir], { encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  if (plain.status === 0 && env.status === 1 && flag.status === 1) { passed++; console.log("ok   WWW_STRICT=1 and --strict both fail on ghibli, and the plain check passes"); }
  else { failed++; console.log(`FAIL WWW_STRICT: exit codes plain ${plain.status}, WWW_STRICT=1 ${env.status}, --strict ${flag.status} (wanted 0, 1, 1)`); }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
