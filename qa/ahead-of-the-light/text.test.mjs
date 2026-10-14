// Ahead of the Light: the words in the game (build rules, final.md 12.7). No string in the game (its JS, HTML and
// CSS) repeats a 6-word run of the source video's narration; no string uses an em dash; and once cards.js holds
// cards, every card's title fits 14 characters and its face, filled in with each of its values, fits 68.
// node qa/ahead-of-the-light/text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS } from '../../public/ahead-of-the-light/core/cards.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '../../public/ahead-of-the-light');

// The normalising of qa/light-years-home/v3/text.test.mjs, and FNV-1a hashes (base 36) of every 6-word run of the
// narration in the scratchpad's video-notes.md, so the narration itself never enters the repo. (Recomputed from the
// notes for this game: the same 268 runs.)
const SPELL = { centre: 'center', grey: 'gray', neighbour: 'neighbor', neighbours: 'neighbors', colour: 'color',
  metres: 'meters' };
const words = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/(\d),(\d)/g, '$1$2').split(/[^a-z0-9]+/)
  .filter(Boolean).map((w) => SPELL[w] || w);
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
const NARRATION_6 = new Set([
  'j1dzf9', '1od7jbv', '16dsr44', '14lld0g', '1xqqm0y', '1mb4mhu', '16kzy2y', 'wgfb7w', '18x8uam', 'dfm9d3',
  '1fqtye0', '1xt95qn', '5sxpxr', 'xxyevy', '1ifz19z', 'vjjln7', '83wczl', '1i3i2ub', '165x1v', '16m8m5i', '1ruka7d',
  'ug5u6w', 'optiw4', '1v677qh', '10qjvro', 'q6ugek', '1fxhhtj', 'ih4q7i', '10chtx9', '1qados9', 'w81xsa', '1py8xbt',
  'osc8l7', '155t2ro', '1q5u1kz', '1growes', '4toh2k', '16ux8mw', '37v8a2', '1l4e2h3', '1bez6b0', 'wf3n3j', '1e84krb',
  'ml1j2n', '1mpdkyb', '135sbaq', '1m90rjd', 'fxdiga', 'rc99yz', 'yr5u2c', '1xdzgev', '1xsnaei', 'tdn7rz', '12ts2c1',
  'ja5x7x', '1chkp9o', 'k2drn', 'jnyzyu', '1litcma', '99g7b8', 'f7ewyq', 'xlft85', '19wqwmd', 'z6m4ve', '1hdoz73',
  '33b5h9', '1e6tske', '1rbwp4d', '75o3mj', '177609y', 'zlullr', 'n9z3ja', '1rd08wp', 'avb5q8', '11jmjvj', '8n54pd',
  '13vxznq', '1uktsm0', 'cv293k', '1bojjtn', '4d9drv', '1lwfilu', 'c6fdzt', 'ce4jto', '14cjr36', '1aa3v2z', '1lew5hk',
  '5go8qi', 'wlu6c7', '16x0zak', '7blgbx', '1ayyxyj', 'hp8q6h', 'nkrtmi', '1eppoce', 'i5wh9i', 'qnrtyt', '1lfx9p3',
  '14dvdcj', 'rp5rj3', '171821y', '1h0rgd9', 'jxlhsz', 'y254m7', 'wbzhrf', 'va6h3p', '181ac1z', 'imvggf', '10j1n6b',
  'hyw9an', 'pejw7p', '6xmnr9', '1ekjkb5', 'gfhmd5', '10wba8k', '1kef4n2', '1wojd07', '1id0an4', '10ti23r', '15m7k7j',
  'oukiti', 'lkwkf0', '11z2atm', '1xbzyll', '16tqe6r', '1xsklb8', '1l3kzbw', '1oxbe5a', '156vnjy', 'hryod9', 'hf2afi',
  'sd2sus', 'hcyvb6', 'bs0t79', '1usff0j', 'pt6rlg', '1qze4i8', '1lvqbpl', '1in4qsp', 'fef2px', 'pr9vjt', 'op6a1l',
  '15g2sge', '1qqkseu', 'p388q2', '1c78k80', '9inu65', '1skgaqv', '1ngpjiz', 'lqmjx3', 'fj5efs', '1c7i1df', '18fyiur',
  '8ajnef', 'wzak2m', '10ww1br', '3ohmzx', '1786sp1', '1nkf55n', '2gaq7d', '1dnr5s', '1v3tdjy', '1i1dwx1', '295zbi',
  '17vojxc', '97yq53', '2if4o6', '1ljdxtt', '1x71df4', '19vh97j', '1tupyj3', '1ey7ne', '78269b', 'qb6clc', 'lepcwl',
  '10r8iz3', '1jyagyj', '152h2qu', '60hv2q', 'hnmwr0', '1clv1tp', '1xkb1cm', '1odxn00', '1nj0s5j', 'ibcu88',
  '1d8igqt', '14t64bz', '1ikqy7b', '8w4ypp', 'ofcgoy', '1dszqra', '1t8bodl', 't4zyu1', '1vycf6m', '15ovo62',
  '19qe563', '182753f', '1keawab', '1xy54mu', '103697n', '14v6c5b', 'n3dr0m', '1u0l1rn', '10h5dx5', '1ttr606',
  '7f9cj2', '1tge6zf', '1wruiem', 'ri214', 'jzfdr3', '18m9z75', 'sawixz', 'wvwl92', 'igm1sy', '1110uid', '1muiskk',
  'qjvnad', 'n87hkg', '5gzzet', '1mndrr6', 'a4gr8r', '1osytrv', 'z9sy6c', 'fs4edf', '1u26i3x', '1746um', '1ehthjq',
  'q9nbmk', 'ywvjhv', '11jyies', '1ufbxq0', '6kchrq', '14joqcy', 'tor83q', '5x3llf', 'tygrdq', '1fea4s7', '126jky8',
  'ysh306', '8dvep4', 'o7ny5n', '1veaxz4', '1sgtqcz', '11mgs1v', '1amgqkv', 'gmafbl', '12o9jdr', '78c4ak', 'tmopw0',
  '1thyovz', '1ljpikc', '192jy5z', 'fiwjtk', 'rd4ing', '1fncj0r', '32m5ks', 'ybg68t', '14w69va', '11s7jer', '18l80jd',
  '1fjlrts', '1wqvo9l', '1fvljtc', '1nvnhl4', '1umacwq', 'bvumgo', 'fezhw0', '18yvaf0',
]);

function runIn(text) {
  const w = words(text);
  for (let i = 0; i + 6 <= w.length; i++) {
    const run = w.slice(i, i + 6).join(' ');
    if (NARRATION_6.has(fnv(run).toString(36))) return run;
  }
  return null;
}

function files(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path, ext));
    else if (ext.test(name)) out.push(path);
  }
  return out;
}
const rel = (p) => relative(GAME, p).split(sep).join('/');

// Every quoted string and template text in a JS or CSS file (comments skipped; a template's ${} parts become a
// space). Line numbers come along for the messages.
function stringsOf(src) {
  const out = [];
  let i = 0, line = 1, last = '';
  const n = src.length;
  const regexOk = () => last === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(last);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') line++;
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2), end = j < 0 ? n : j + 2;
      line += (src.slice(i, end).match(/\n/g) || []).length;
      i = end;
      continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== c && src[j] !== '\n') {
        s += src[j] === '\\' ? src[j + 1] : src[j];
        j += src[j] === '\\' ? 2 : 1;
      }
      out.push({ line, text: s });
      i = j + 1; last = c;
      continue;
    }
    if (c === '`') {
      let j = i + 1, s = '';
      const at = line;
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1, k = j + 2;
          while (k < n && depth > 0) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          for (const inner of stringsOf(src.slice(j + 2, k - 1))) out.push({ line: at, text: inner.text });
          s += ' ';
          j = k;
          continue;
        }
        if (src[j] === '\n') line++;
        s += src[j];
        j++;
      }
      out.push({ line: at, text: s });
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
      i = j + 1; last = '/';
      while (i < n && /[a-z]/.test(src[i])) i++;
      continue;
    }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return out;
}

// The text a player can read in an HTML file: text between tags, and the aria-label, alt, title, content and
// placeholder attributes. Scripts and styles are read as code.
function htmlText(src) {
  const out = [];
  const body = src.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  for (const m of body.matchAll(/\b(?:aria-label|alt|title|content|placeholder)="([^"]*)"/g)) out.push(m[1]);
  for (const t of body.replace(/<[^>]*>/g, '\n').split('\n')) if (t.trim()) out.push(t.trim());
  for (const m of src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const s of stringsOf(m[1])) out.push(s.text);
  }
  return out;
}

function allStrings() {
  const out = [];
  for (const f of files(GAME, /\.(m?js|css)$/)) {
    for (const s of stringsOf(readFileSync(f, 'utf8'))) out.push([`${rel(f)}:${s.line}`, s.text]);
  }
  for (const f of files(GAME, /\.html$/)) for (const t of htmlText(readFileSync(f, 'utf8'))) out.push([rel(f), t]);
  return out;
}

test('the narration check works', () => {
  assert.equal(NARRATION_6.size, 268);
  assert.ok(runIn('Surrounded by galaxies. Laniakea is too vast'), 'a run straight from the narration is caught');
  assert.equal(runIn('Race home ahead of a gamma-ray burst. Every near miss holds the light back.'), null);
  const s = stringsOf("const a = 'one'; // 'not this'\nconst b = `two ${'three'} four`; /* 'nor this' */ x = /'re'/g;");
  assert.deepEqual(s.map((x) => x.text), ['one', 'three', 'two   four']);
  assert.deepEqual(htmlText('<p aria-label="A B">Hi <b>there</b></p><script>const q = "in code";</script>'),
    ['A B', 'Hi', 'there', 'in code']);
});

test('no string in the game repeats a 6-word run of the video\'s narration', () => {
  const all = allStrings();
  assert.ok(all.length > 100, `${all.length} strings`);
  const bad = [];
  for (const [where, text] of all) {
    const run = runIn(text);
    if (run) bad.push(`${where}: "${text}" repeats "${run}"`);
  }
  assert.deepEqual(bad, []);
});

test('no em dashes in the game\'s strings', () => {
  const bad = allStrings().filter(([, t]) => /—/.test(t)).map(([w, t]) => `${w}: "${t}"`);
  assert.deepEqual(bad, []);
});

test('card faces: a title of 14 characters or fewer, and a face of 68 or fewer with each value filled in', (t) => {
  if (!CARDS.length) { t.skip('cards.js has no cards yet'); return; }
  const bad = [];
  for (const c of CARDS) {
    const title = c.name || c.title || c.id;
    if (!title || title.length > 14) bad.push(`${c.id}: title "${title}"`);
    const vals = Array.isArray(c.values) && c.values.length ? c.values : [''];
    for (const v of vals) {
      const face = String(c.face || '').replace(/\{v\}/g, String(v ?? ''));
      if (!face.trim() || face.length > 68) bad.push(`${c.id}: face (${face.length}) "${face}"`);
      if (/—/.test(face)) bad.push(`${c.id}: an em dash`);
      const run = runIn(face);
      if (run) bad.push(`${c.id}: repeats "${run}"`);
    }
  }
  assert.deepEqual(bad, []);
});
