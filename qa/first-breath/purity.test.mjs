// First Breath: the layer rules (design.md 16.1, 16.4, 18). core/ is pure: no document, window, Date, performance,
// Math.random, timers, requestAnimationFrame or storage. It imports only core/ and the shared kit rng
// (public/lab/kit/rng.js), by relative paths to files that exist, and never render/, ui/ or main.js. Stage files
// import no other stage. Once core/stages/index.js exists: every stage (and core/ending.js) exports the whole Stage
// interface, probe included, and calling view or probe twice gives equal results and leaves the state unchanged.
// Comments and string text are ignored; import paths are read from the code. The tokenizer is the one in
// qa/ahead-of-the-light/purity.test.mjs, copied.
// node qa/first-breath/purity.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FILE = "qa/first-breath/purity.test.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../../public");
const GAME = join(PUBLIC, "first-breath");
const CORE = join(GAME, "core");
const STAGES_DIR = join(CORE, "stages");
const KIT_RNG = join(PUBLIC, "lab/kit/rng.js");

let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}

const BANNED = ["document", "window", "Date", "performance", "setTimeout", "setInterval", "clearTimeout",
  "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "localStorage",
  "sessionStorage", "indexedDB", "navigator", "fetch", "XMLHttpRequest", "globalThis", "AudioContext"];
const BANNED_RE = new RegExp(`(?<![\\w$.])(${BANNED.join("|")})(?![\\w$])`, "g");
const RANDOM_RE = /\bMath\s*\.\s*random\b/g;

function jsFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (/\.m?js$/.test(name)) out.push(path);
  }
  return out;
}

// Walk the source once. `code` has comments removed and every string and template blanked (template ${} code is
// kept). `imports` has comments removed and templates blanked but quoted strings kept, for reading import paths.
function strip(src) {
  let code = "", imports = "", i = 0, last = "";
  const n = src.length;
  const put = (a, b = a) => { code += a; imports += b; };
  const regexOk = () => last === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(last);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") {
      const j = src.indexOf("*/", i + 2), end = j < 0 ? n : j + 2;
      put(src.slice(i, end).replace(/[^\n]/g, " "));
      i = end;
      continue;
    }
    if (c === "'" || c === "\"") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      put(c + c, src.slice(i, j + 1));
      i = j + 1; last = c;
      continue;
    }
    if (c === "`") {
      let j = i + 1, inner = "";
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") {
          let depth = 1, k = j + 2;
          while (k < n && depth > 0) { if (src[k] === "{") depth++; else if (src[k] === "}") depth--; k++; }
          inner += " " + strip(src.slice(j + 2, k - 1)).code + " ";
          j = k;
          continue;
        }
        j++;
      }
      const lines = src.slice(i, j).replace(/[^\n]/g, "");
      put("`" + inner + lines + "`", "``" + lines);
      i = j + 1; last = "`";
      continue;
    }
    if (c === "/" && regexOk()) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; else if (src[j] === "/" && !cls) break;
        j++;
      }
      j++;
      while (j < n && /[a-z]/.test(src[j])) j++;
      put("/re/");
      i = j; last = "/";
      continue;
    }
    put(c);
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return { code, imports };
}

// Every import path in a file: static imports, export-from and literal dynamic imports. A dynamic import of
// something other than a plain string comes back as { dynamic: true }.
function importsOf(src) {
  const { imports } = strip(src);
  const out = [];
  const stat = /(?:^|[;\n}])\s*(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?(['"])([^'"\n]+)\1/g;
  for (const m of imports.matchAll(stat)) out.push({ spec: m[2] });
  for (const m of imports.matchAll(/\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g)) out.push({ spec: m[2] });
  for (const m of imports.matchAll(/\bimport\s*\(\s*([^'"\s)])/g)) out.push({ spec: null, dynamic: true });
  return out;
}

// Banned names used as code, skipping object keys ({ window: 10 }) and property access (a.window).
function bannedIn(code) {
  const out = [];
  for (const m of code.matchAll(BANNED_RE)) {
    const before = code.slice(0, m.index).trimEnd().slice(-1);
    const after = code.slice(m.index + m[0].length).trimStart()[0];
    if (after === ":" && (before === "{" || before === ",")) continue;
    out.push({ name: m[1], line: code.slice(0, m.index).split("\n").length });
  }
  return out;
}

const rel = (p) => relative(PUBLIC, p).split(sep).join("/");
const inside = (file, dir) => file === dir || file.startsWith(dir + sep);
const lineAt = (code, index) => code.slice(0, index).split("\n").length;

function impurities(file) {
  const bad = [];
  const { code } = strip(readFileSync(file, "utf8"));
  for (const { name, line } of bannedIn(code)) bad.push(`${rel(file)}:${line} names ${name}`);
  for (const m of code.matchAll(RANDOM_RE)) bad.push(`${rel(file)}:${lineAt(code, m.index)} calls Math.random`);
  return bad;
}

await check("the tokenizer ignores comments and strings and keeps code", () => {
  const src = "// window\nconst a = 'Date'; /* document */ const b = `x ${performance.now()} y`; const r = /window/g;\n"
    + "import { x } from './a.js';\nconst d = Date.now();";
  const { code } = strip(src);
  assert.ok(!/window/.test(code), "comments, strings and regex text are gone");
  assert.ok(/performance\.now/.test(code), "template code is kept");
  assert.ok(/Date\.now/.test(code), "code is kept");
  assert.deepEqual(importsOf(src).map((x) => x.spec), ["./a.js"]);
  assert.deepEqual(importsOf("export { E } from './events.js';").map((x) => x.spec), ["./events.js"]);
  assert.equal(importsOf("const m = import(`./${name}.js`);")[0].dynamic, true);
});

await check("the purity scan catches what it should", () => {
  const bad = "const t = performance.now() + Date.now() + Math.random();\nwindow.x = localStorage; setTimeout(f, 1);\n"
    + "requestAnimationFrame(g); document.body;";
  const { code } = strip(bad);
  assert.deepEqual(bannedIn(code).map((x) => x.name),
    ["performance", "Date", "window", "localStorage", "setTimeout", "requestAnimationFrame", "document"]);
  assert.equal([...code.matchAll(RANDOM_RE)].length, 1);
  assert.deepEqual(bannedIn(strip("const o = { a: 1 }; o.window = 2; game.performance = 3;").code), [],
    "a property of the same name is fine");
  assert.deepEqual(bannedIn(strip("const s = { id: 1, window: 10 };\nconst w = a ? window : b;").code),
    [{ name: "window", line: 2 }], "an object key is fine; the global in a ternary is not");
});

const coreFiles = jsFiles(CORE);

await check("core/ is pure: no browser names, no clocks, no timers, no storage, no Math.random", () => {
  assert.ok(coreFiles.length >= 19, `core/ has ${coreFiles.length} files`);
  assert.deepEqual(coreFiles.flatMap(impurities), []);
});

await check("core/ imports only core/ and lab/kit/rng.js, by relative paths to files that exist", () => {
  const bad = [];
  for (const file of coreFiles) {
    for (const imp of importsOf(readFileSync(file, "utf8"))) {
      if (imp.dynamic) { bad.push(`${rel(file)}: a dynamic import of a non-literal path`); continue; }
      if (!imp.spec.startsWith("./") && !imp.spec.startsWith("../")) { bad.push(`${rel(file)} imports '${imp.spec}'`); continue; }
      const target = resolve(dirname(file), imp.spec);
      const r = rel(target);
      if (inside(target, join(GAME, "render")) || inside(target, join(GAME, "ui")) || target === join(GAME, "main.js")) {
        bad.push(`${rel(file)} imports ${r} (render/, ui/ and main.js are off limits)`);
      } else if (!existsSync(target)) bad.push(`${rel(file)} imports ${r}, which does not exist`);
      else if (!inside(target, CORE) && target !== KIT_RNG) bad.push(`${rel(file)} imports ${r}, outside core/`);
    }
  }
  assert.deepEqual(bad, []);
});

await check("core/ never calls the kit's clock (cottageDay)", () => {
  const bad = [];
  for (const file of coreFiles) if (/\bcottageDay\b/.test(strip(readFileSync(file, "utf8")).code)) bad.push(rel(file));
  assert.deepEqual(bad, []);
});

await check("stage files import no other stage (only their own tune, facts and text files and core/)", () => {
  const bad = [];
  const own = (file) => basename(file).split(".")[0];
  const stageFiles = [...jsFiles(STAGES_DIR).filter((f) => basename(f) !== "index.js"),
    ...coreFiles.filter((f) => dirname(f) === CORE && /^ending(\.|$)/.test(basename(f)))];
  for (const file of stageFiles) {
    for (const imp of importsOf(readFileSync(file, "utf8"))) {
      if (!imp.spec || !imp.spec.startsWith(".")) continue;
      const target = resolve(dirname(file), imp.spec);
      const inStages = inside(target, STAGES_DIR) && basename(target) !== "index.js";
      const isEnding = dirname(target) === CORE && /^ending(\.|$)/.test(basename(target));
      if ((inStages || isEnding) && own(target) !== own(file)) bad.push(`${rel(file)} imports ${rel(target)}`);
      if (basename(target) === "index.js" && inside(target, STAGES_DIR)) bad.push(`${rel(file)} imports the stage index`);
    }
  }
  assert.deepEqual(bad, []);
});

await check("every core module imports in plain node and exports something", async () => {
  for (const file of coreFiles) {
    const mod = await import(pathToFileURL(file).href);
    assert.ok(Object.keys(mod).length > 0, `${rel(file)} exports something`);
  }
});

// A plain-data picture of a value, for comparing states and views: functions become a marker, typed arrays lists.
function snap(v, seen = new WeakSet()) {
  if (typeof v === "function") return "[fn]";
  if (typeof v === "number" && !Number.isFinite(v)) return String(v);
  if (v === null || typeof v !== "object") return v;
  if (ArrayBuffer.isView(v)) return { typed: v.constructor.name, v: Array.from(v) };
  if (seen.has(v)) return "[cycle]";
  seen.add(v);
  let out;
  if (Array.isArray(v)) out = v.map((x) => snap(x, seen));
  else if (v instanceof Map) out = { map: [...v].map(([k, x]) => [snap(k, seen), snap(x, seen)]) };
  else if (v instanceof Set) out = { set: [...v].map((x) => snap(x, seen)) };
  else out = Object.fromEntries(Object.keys(v).sort().map((k) => [k, snap(v[k], seen)]));
  seen.delete(v);
  return out;
}

const INDEX = join(STAGES_DIR, "index.js");
const ENDING = join(CORE, "ending.js");
if (existsSync(INDEX)) {
  const { STAGES } = await import(pathToFileURL(INDEX).href);
  const { DEFAULT_CARRY } = await import(pathToFileURL(join(CORE, "carry.js")).href);
  const { makeIntents } = await import(pathToFileURL(join(CORE, "intent.js")).href);
  const mods = [...(STAGES || [])];
  if (existsSync(ENDING)) mods.push(await import(pathToFileURL(ENDING).href));
  const API = ["create", "step", "view", "prompt", "targets", "botSteer", "probe", "result", "jump"];

  await check("core/stages/index.js lists the 8 stages in order", () => {
    assert.deepEqual((STAGES || []).map((m) => m.meta && m.meta.id), ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"]);
  });

  for (const mod of mods) {
    const id = mod.meta ? mod.meta.id : "?";
    await check(`${id}: exports meta and the whole Stage interface, probe included`, () => {
      assert.ok(mod.meta && typeof mod.meta === "object", "meta");
      for (const name of API) assert.equal(typeof mod[name], "function", name);
    });
    await check(`${id}: view and probe are pure (twice equal, state unchanged)`, () => {
      const st = mod.create(1, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
      for (let i = 0; i < 90; i++) { mod.step(st, makeIntents()); st.events.length = 0; }
      const before = JSON.stringify(snap(st));
      const v1 = JSON.stringify(snap(mod.view(st))), v2 = JSON.stringify(snap(mod.view(st)));
      const p1 = JSON.stringify(snap(mod.probe(st))), p2 = JSON.stringify(snap(mod.probe(st)));
      assert.equal(v1, v2, "view twice");
      assert.equal(p1, p2, "probe twice");
      assert.equal(JSON.stringify(snap(st)), before, "the state is unchanged");
      if (id !== "swim" && id !== "egg") assert.equal(mod.probe(st), null, "probe is null outside stages 1 and 2");
    });
  }
}

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks${existsSync(INDEX) ? "" : " (no core/stages/index.js yet: the stage checks wait for it)"}`);
}
