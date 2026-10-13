// Light Years Home: core/ stays pure. Every core/**/*.js file imports in plain node, imports only other files by
// relative path, and its code (comments and strings aside) uses no browser or rendering globals: no window, document,
// navigator, localStorage, three, requestAnimationFrame, setTimeout, Date.now or argless new Date. Time and storage
// come in as arguments, so the engine replays the same way for the same seed and inputs.
// node qa/light-years-home/pure.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE = fileURLToPath(new URL('../../public/light-years-home/core/', import.meta.url));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && p.endsWith('.js') ? [p] : [];
  }).sort();
}
const FILES = walk(CORE);
const rel = (f) => path.relative(CORE, f);

// The code of a file with comments, strings, template text and regular expressions blanked out (newlines kept, so
// line numbers still match). Template ${...} parts stay, since they are code.
function codeOnly(src) {
  let out = '', i = 0, last = '';            // last: the last code character that is not white space
  const stack = [];                          // open template literals: the brace depth at each ${
  let depth = 0;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const regexCanStart = () => !last || /[(,=:[!&|?{};+\-*%<>~^]/.test(last)
    || /\b(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/.test(out.trimEnd());
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') {
      const j = src.indexOf('\n', i);
      const end = j < 0 ? src.length : j;
      out += blank(src.slice(i, end)); i = end; continue;
    }
    if (c === '/' && n === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j < 0 ? src.length : j + 2;
      out += blank(src.slice(i, end)); i = end; continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += c + blank(src.slice(i + 1, j)) + c; i = j + 1; last = c; continue;
    }
    if (c === '`' || (c === '}' && stack.length && depth === stack[stack.length - 1])) {
      // Template text runs to the closing backtick or the next ${.
      if (c === '}') stack.pop();
      let j = i + 1;
      while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
      out += c + blank(src.slice(i + 1, j));
      if (src[j] === '$') { out += '${'; stack.push(depth); i = j + 2; last = '{'; continue; }
      out += '`'; i = j + 1; last = '`'; continue;
    }
    if (c === '/' && regexCanStart()) {
      let j = i + 1, inClass = false;
      while (j < src.length && src[j] !== '\n' && (inClass || src[j] !== '/')) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        j++;
      }
      j++;
      while (/[a-z]/i.test(src[j] || '')) j++;
      out += '/' + blank(src.slice(i + 1, j - 1)) + ' '; i = j; last = '/'; continue;
    }
    if (c === '{') depth++;
    if (c === '}') depth--;
    out += c;
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return out;
}

const BANNED = [
  ['window', /\bwindow\b/], ['document', /\bdocument\b/], ['navigator', /\bnavigator\b/],
  ['localStorage', /\blocalStorage\b/], ['sessionStorage', /\bsessionStorage\b/], ['three', /\bthree\b/i],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/], ['setTimeout', /\bsetTimeout\b/],
  ['setInterval', /\bsetInterval\b/], ['Date.now', /\bDate\s*\.\s*now\b/],
  ['argless new Date', /\bnew\s+Date\s*(\(\s*\)|(?!\s*\())/],
];

test('the stripper keeps code and blanks comments, strings and regular expressions', () => {
  const src = "const a = 'window'; // document\n/* three */ const b = `x ${window.y} z`; const r = /setTimeout/g;\n"
    + 'const t = a / 2 / 3; const q = "new Date()";';
  const code = codeOnly(src);
  assert.equal(code.split('\n').length, src.split('\n').length, 'lines kept');
  assert.ok(!/document|three|setTimeout|new Date/.test(code), code);
  assert.match(code, /\$\{window\.y\}/, 'template code stays');
  assert.match(code, /a \/ 2 \/ 3/, 'division is not a regular expression');
  assert.ok(BANNED.find(([n]) => n === 'argless new Date')[1].test('new Date()'));
  assert.ok(BANNED.find(([n]) => n === 'argless new Date')[1].test('const d = new Date;'));
  assert.ok(!BANNED.find(([n]) => n === 'argless new Date')[1].test('new Date(2026, 9, 13)'));
  assert.ok(BANNED.find(([n]) => n === 'Date.now')[1].test('Date . now()'));
});

test('core/ has files to check, including the geometry and projection', () => {
  const names = FILES.map(rel);
  for (const f of ['physics.js', 'route.js', 'objects.js', 'geo.js', 'project.js', 'rng.js']) {
    assert.ok(names.includes(f), `${f} is in core/`);
  }
  assert.ok(names.some((f) => f.startsWith('gen' + path.sep)), 'core/gen/ is walked too');
});

for (const file of FILES) {
  test(`core/${rel(file)} is pure`, async () => {
    const src = fs.readFileSync(file, 'utf8');
    const code = codeOnly(src);
    const exports = (t) => t.split('\n').filter((l) => /^export /.test(l)).length;
    assert.equal(exports(code), exports(src), `${rel(file)}: the stripper kept every export line, so code is all checked`);
    const lines = code.split('\n');
    for (const [name, re] of BANNED) {
      const at = lines.findIndex((l) => re.test(l));
      assert.equal(at, -1, `${rel(file)}:${at + 1} uses ${name}: ${src.split('\n')[at]?.trim()}`);
    }
    // Imports: only relative paths to other .js files that exist; no packages, no URLs.
    const IMPORT = /\bimport\s+(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const specs = [...src.matchAll(IMPORT)].map((m) => m[1] || m[2]);
    for (const spec of specs) {
      assert.ok(spec.startsWith('./') || spec.startsWith('../'), `${rel(file)} imports ${spec}`);
      assert.ok(spec.endsWith('.js'), `${rel(file)} imports ${spec} without .js`);
      const target = path.resolve(path.dirname(file), spec);
      assert.ok(target.startsWith(CORE), `${rel(file)} imports ${spec} from outside core/`);
      assert.ok(fs.existsSync(target), `${rel(file)} imports missing ${spec}`);
    }
    assert.ok(!/\brequire\s*\(/.test(code), `${rel(file)} uses require`);
    // It loads in plain node, where window, document and the rest do not exist.
    const mod = await import(pathToFileURL(file).href);
    assert.ok(Object.keys(mod).length > 0, `${rel(file)} exports something`);
  });
}
