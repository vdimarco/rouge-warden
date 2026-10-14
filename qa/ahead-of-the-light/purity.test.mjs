// Ahead of the Light: the layer rules (final.md 18.1, build rules). core/ is pure: it imports only core/ and the
// shared light-years-home core modules it may use read-only (physics, rng, captions, gen/web, gen/galaxy,
// gen/stars) plus public/lab/kit/rng.js for the daily seed, and never names window, document, navigator, storage,
// three, timers, performance, Date or Math.random (the shared modules it pulls in are held to the same rule).
// render/ never imports ui/, and ui/ never imports render/. Nothing in the game imports light-years-home's ui/, its
// v3 modules or anything outside the read-only list; the only bare import is 'three', and never from core/.
// Comments and string text are ignored; import paths are read from the code.
// node qa/ahead-of-the-light/purity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '../../public');
const GAME = join(PUBLIC, 'ahead-of-the-light');
const CORE = join(GAME, 'core');
const RENDER = join(GAME, 'render');
const UI = join(GAME, 'ui');
const LYH = join(PUBLIC, 'light-years-home');

// Shared modules the core may import, read-only (build rules; final.md 18.1 and 14.4).
const CORE_SHARED = ['core/physics.js', 'core/rng.js', 'core/captions.js', 'core/gen/web.js', 'core/gen/galaxy.js',
  'core/gen/stars.js'].map((p) => join(LYH, p));
const KIT_RNG = join(PUBLIC, 'lab/kit/rng.js');
// Everything in the game may also use render/points.js (it imports three, so never from core/).
const GAME_SHARED = [...CORE_SHARED, join(LYH, 'render/points.js')];

const BANNED = ['three', 'THREE', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'performance', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'fetch', 'XMLHttpRequest', 'globalThis', 'AudioContext'];
const BANNED_RE = new RegExp(`(?<![\\w$.])(${BANNED.join('|')})(?![\\w$])`, 'g');
const RANDOM_RE = /\bMath\s*\.\s*random\b/g;

function jsFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (/\.m?js$/.test(name)) out.push(path);
  }
  return out;
}

// Walk the source once. `code` has comments removed and every string and template blanked (template ${} code is
// kept). `imports` has comments removed and templates blanked but quoted strings kept, for reading import paths.
// (The same tokenizer as qa/light-years-home/v3/purity.test.mjs, copied.)
function strip(src) {
  let code = '', imports = '', i = 0, last = '';
  const n = src.length;
  const put = (a, b = a) => { code += a; imports += b; };
  const regexOk = () => last === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(last);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2), end = j < 0 ? n : j + 2;
      put(src.slice(i, end).replace(/[^\n]/g, ' '));
      i = end;
      continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      put(c + c, src.slice(i, j + 1));
      i = j + 1; last = c;
      continue;
    }
    if (c === '`') {
      let j = i + 1, inner = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1, k = j + 2;
          while (k < n && depth > 0) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          inner += ' ' + strip(src.slice(j + 2, k - 1)).code + ' ';
          j = k;
          continue;
        }
        j++;
      }
      const lines = src.slice(i, j).replace(/[^\n]/g, '');
      put('`' + inner + lines + '`', '``' + lines);
      i = j + 1; last = '`';
      continue;
    }
    if (c === '/' && regexOk()) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break;
        j++;
      }
      j++;
      while (j < n && /[a-z]/.test(src[j])) j++;
      put('/re/');
      i = j; last = '/';
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
    if (after === ':' && (before === '{' || before === ',')) continue;
    out.push({ name: m[1], line: code.slice(0, m.index).split('\n').length });
  }
  return out;
}

const rel = (p) => relative(PUBLIC, p).split(sep).join('/');
const inside = (file, dir) => file === dir || file.startsWith(dir + sep);
const lines = (code, index) => code.slice(0, index).split('\n').length;

function impurities(file) {
  const bad = [];
  const { code } = strip(readFileSync(file, 'utf8'));
  for (const { name, line } of bannedIn(code)) bad.push(`${rel(file)}:${line} names ${name}`);
  for (const m of code.matchAll(RANDOM_RE)) bad.push(`${rel(file)}:${lines(code, m.index)} calls Math.random`);
  return bad;
}

test('the tokenizer ignores comments and strings and keeps code', () => {
  const src = "// window\nconst a = 'Date'; /* three */ const b = `x ${performance.now()} y`; const r = /window/g;\n"
    + "import { x } from './a.js';\nconst d = Date.now();";
  const { code } = strip(src);
  assert.ok(!/window/.test(code), 'comments, strings and regex text are gone');
  assert.ok(/performance\.now/.test(code), 'template code is kept');
  assert.ok(/Date\.now/.test(code), 'code is kept');
  assert.deepEqual(importsOf(src).map((x) => x.spec), ['./a.js']);
  assert.deepEqual(importsOf("export { E } from './events.js';").map((x) => x.spec), ['./events.js']);
  assert.equal(importsOf('const m = import(`./${name}.js`);')[0].dynamic, true);
});

test('the purity check catches what it should', () => {
  const bad = "import * as THREE from 'three';\nconst t = performance.now() + Date.now() + Math.random();\n"
    + 'window.x = localStorage; setTimeout(f, 1);';
  const { code } = strip(bad);
  assert.deepEqual(bannedIn(code).map((x) => x.name),
    ['THREE', 'performance', 'Date', 'window', 'localStorage', 'setTimeout']);
  assert.equal([...code.matchAll(RANDOM_RE)].length, 1);
  assert.deepEqual(bannedIn(strip('const o = { a: 1 }; o.window = 2; game.performance = 3;').code), [],
    'a property of the same name is fine');
  assert.deepEqual(bannedIn(strip('const s = { id: 1, window: 10 };\nconst w = a ? window : b;').code),
    [{ name: 'window', line: 2 }], 'an object key is fine; the global in a ternary is not');
});

test('core/ is pure: no browser names, no three, no clocks, no Math.random', () => {
  const files = jsFiles(CORE);
  assert.ok(files.length >= 30, `core/ has ${files.length} files`);
  const bad = files.flatMap(impurities);
  assert.deepEqual(bad, []);
});

test('core/ imports only core/ and the read-only shared modules, by relative paths to files that exist', () => {
  const bad = [];
  for (const file of jsFiles(CORE)) {
    for (const imp of importsOf(readFileSync(file, 'utf8'))) {
      if (imp.dynamic) { bad.push(`${rel(file)}: a dynamic import of a non-literal path`); continue; }
      if (!imp.spec.startsWith('./') && !imp.spec.startsWith('../')) {
        bad.push(`${rel(file)} imports '${imp.spec}'`);
        continue;
      }
      const target = resolve(dirname(file), imp.spec);
      if (!existsSync(target)) bad.push(`${rel(file)} imports ${rel(target)}, which does not exist`);
      else if (!inside(target, CORE) && !CORE_SHARED.includes(target) && target !== KIT_RNG) {
        bad.push(`${rel(file)} imports ${rel(target)}, outside core/ and the shared list`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('the shared modules core/ pulls in are pure too (lab/kit/rng.js: only through daySeed with a day)', () => {
  const seen = new Set(), bad = [];
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const imp of importsOf(readFileSync(file, 'utf8'))) {
      if (imp.spec && imp.spec.startsWith('.')) visit(resolve(dirname(file), imp.spec));
    }
  };
  for (const file of jsFiles(CORE)) visit(file);
  for (const file of seen) {
    if (inside(file, CORE)) continue;
    if (file === KIT_RNG) continue;                       // cottageDay's default reads the clock; core never calls it
    bad.push(...impurities(file));
  }
  for (const file of jsFiles(CORE)) {
    const { code } = strip(readFileSync(file, 'utf8'));
    if (/\bcottageDay\b/.test(code)) bad.push(`${rel(file)} calls cottageDay (pass the day in instead)`);
  }
  assert.deepEqual(bad, []);
});

test('render/ never imports ui/, and ui/ never imports render/', () => {
  const bad = [];
  const check = (dir, banned) => {
    for (const file of jsFiles(dir)) {
      for (const imp of importsOf(readFileSync(file, 'utf8'))) {
        if (!imp.spec || !imp.spec.startsWith('.')) continue;
        const target = resolve(dirname(file), imp.spec);
        if (inside(target, banned)) bad.push(`${rel(file)} imports ${rel(target)}`);
      }
    }
  };
  check(RENDER, UI);
  check(UI, RENDER);
  assert.deepEqual(bad, []);
});

test('the game imports from light-years-home only the read-only list, and no bare module but three', () => {
  const bad = [];
  for (const file of jsFiles(GAME)) {
    for (const imp of importsOf(readFileSync(file, 'utf8'))) {
      if (imp.dynamic) { bad.push(`${rel(file)}: a dynamic import of a non-literal path`); continue; }
      if (!imp.spec.startsWith('.') && !imp.spec.startsWith('/')) {
        if (imp.spec !== 'three') bad.push(`${rel(file)} imports '${imp.spec}'`);
        continue;
      }
      const target = imp.spec.startsWith('/') ? join(PUBLIC, imp.spec) : resolve(dirname(file), imp.spec);
      if (!existsSync(target)) bad.push(`${rel(file)} imports ${rel(target)}, which does not exist`);
      if (inside(target, LYH) && !GAME_SHARED.includes(target)) bad.push(`${rel(file)} imports ${rel(target)}`);
      if (!inside(target, GAME) && !inside(target, LYH) && target !== KIT_RNG) {
        bad.push(`${rel(file)} imports ${rel(target)}, outside the game`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('every core module imports in plain node', async () => {
  const files = jsFiles(CORE);
  for (const file of files) {
    const mod = await import(file);
    assert.ok(Object.keys(mod).length > 0, `${rel(file)} exports something`);
  }
});
