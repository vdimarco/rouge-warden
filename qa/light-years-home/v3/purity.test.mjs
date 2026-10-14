// Light Years Home v3: the layer rules (final.md 4.2). core/ imports only core/ and never names three, window,
// document, performance, Date, Math.random, localStorage (nor the other browser clocks and stores); render/ never
// imports ui/, and ui/ never imports render/. Comments and string text are ignored; import paths are read from the
// code. node qa/light-years-home/v3/purity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '../../../public/light-years-home');
const CORE = join(GAME, 'core');
const RENDER = join(GAME, 'render');
const UI = join(GAME, 'ui');

const BANNED = ['three', 'THREE', 'window', 'document', 'performance', 'Date', 'localStorage', 'sessionStorage',
  'navigator', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'setInterval'];
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
export function strip(src) {
  let code = '', imports = '', i = 0, last = '';
  const n = src.length;
  const put = (a, b = a) => { code += a; imports += b; };
  const regexOk = () => last === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(last);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2), end = j < 0 ? n : j + 2;
      const blank = src.slice(i, end).replace(/[^\n]/g, ' ');
      put(blank); i = end; continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      put(c + c, src.slice(i, j + 1)); i = j + 1; last = c; continue;
    }
    if (c === '`') {
      let j = i + 1, inner = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1, k = j + 2;
          while (k < n && depth > 0) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          inner += ' ' + strip(src.slice(j + 2, k - 1)).code + ' ';
          j = k; continue;
        }
        j++;
      }
      const lines = src.slice(i, j).replace(/[^\n]/g, '');               // keep line numbers
      put('`' + inner + lines + '`', '``' + lines); i = j + 1; last = '`'; continue;
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
      put('/re/'); i = j; last = '/'; continue;
    }
    put(c);
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return { code, imports };
}

// Every import path in a file: static imports, export-from and literal dynamic imports. A dynamic import of
// something other than a plain string comes back as { dynamic: true }.
export function importsOf(src) {
  const { imports } = strip(src);
  const out = [];
  const stat = /(?:^|[;\n}])\s*(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?(['"])([^'"\n]+)\1/g;
  for (const m of imports.matchAll(stat)) out.push({ spec: m[2] });
  for (const m of imports.matchAll(/\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g)) out.push({ spec: m[2] });
  for (const m of imports.matchAll(/\bimport\s*\(\s*([^'"\s)])/g)) out.push({ spec: null, dynamic: true, at: m.index });
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

const rel = (p) => relative(GAME, p).split(sep).join('/');
const inside = (file, dir) => file === dir || file.startsWith(dir + sep);

test('the tokenizer ignores comments and strings and keeps code', () => {
  const src = "// window\nconst a = 'Date'; /* three */ const b = `x ${performance.now()} y`; const r = /window/g;\n"
    + "import { x } from './a.js';\nconst d = Date.now();";
  const { code } = strip(src);
  assert.ok(!/window/.test(code), 'comments, strings and regex text are gone');
  assert.ok(/performance\.now/.test(code), 'template code is kept');
  assert.ok(/Date\.now/.test(code), 'code is kept');
  assert.deepEqual(importsOf(src).map((x) => x.spec), ['./a.js']);
  assert.deepEqual(importsOf("const m = () => import('./zones/wall.js');").map((x) => x.spec), ['./zones/wall.js']);
  assert.equal(importsOf('const m = import(`./${name}.js`);')[0].dynamic, true);
});

test('core/ is pure: no browser names, no three, no clock, no Math.random', () => {
  const files = jsFiles(CORE);
  assert.ok(files.length > 0, 'core/ has files');
  const bad = [];
  for (const file of files) {
    const { code } = strip(readFileSync(file, 'utf8'));
    for (const { name, line } of bannedIn(code)) bad.push(`${rel(file)}:${line} names ${name}`);
    for (const m of code.matchAll(RANDOM_RE)) {
      bad.push(`${rel(file)}:${code.slice(0, m.index).split('\n').length} calls Math.random`);
    }
  }
  assert.deepEqual(bad, []);
});

test('core/ imports only core/, by relative paths to files that exist', () => {
  const bad = [];
  for (const file of jsFiles(CORE)) {
    for (const imp of importsOf(readFileSync(file, 'utf8'))) {
      if (imp.dynamic) { bad.push(`${rel(file)}: dynamic import of a non-literal path`); continue; }
      if (!imp.spec.startsWith('./') && !imp.spec.startsWith('../')) {
        bad.push(`${rel(file)} imports '${imp.spec}'`);
        continue;
      }
      const target = resolve(dirname(file), imp.spec);
      if (!inside(target, CORE)) bad.push(`${rel(file)} imports ${rel(target)} outside core/`);
      else if (!existsSync(target)) bad.push(`${rel(file)} imports ${rel(target)}, which does not exist`);
    }
  }
  assert.deepEqual(bad, []);
});

test('render/ never imports ui/, and ui/ never imports render/', () => {
  const bad = [];
  const check = (dir, banned) => {
    for (const file of jsFiles(dir)) {
      for (const imp of importsOf(readFileSync(file, 'utf8'))) {
        if (!imp.spec || !(imp.spec.startsWith('./') || imp.spec.startsWith('../'))) continue;
        const target = resolve(dirname(file), imp.spec);
        if (inside(target, banned)) bad.push(`${rel(file)} imports ${rel(target)}`);
      }
    }
  };
  check(RENDER, UI);
  check(UI, RENDER);
  assert.deepEqual(bad, []);
});

test('the purity check catches what it should', () => {
  const bad = "import * as THREE from 'three';\nconst t = performance.now() + Date.now() + Math.random();\n"
    + 'window.x = localStorage;';
  const { code } = strip(bad);
  assert.deepEqual(bannedIn(code).map((x) => x.name), ['THREE', 'performance', 'Date', 'window', 'localStorage']);
  assert.equal([...code.matchAll(RANDOM_RE)].length, 1);
  assert.deepEqual(importsOf(bad).map((x) => x.spec), ['three']);
  assert.deepEqual(bannedIn(strip('const o = { a: 1 }; o.window = 2; game.performance = 3;').code), [],
    'a property of the same name is fine');
  assert.deepEqual(bannedIn(strip('const s = { id: 1, window: 10 };\nconst w = a ? window : b;').code),
    [{ name: 'window', line: 2 }], 'an object key is fine; the global in a ternary is not');
});
