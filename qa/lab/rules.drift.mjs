// Checks that House Rules still matches Down the Drain: node qa/lab/rules.drift.mjs
// public/lab/rules/sand.js copies the materials, the sand, water and fire rules, and the propane tanks from
// public/fall/index.html, and layer.js copies the size of the world, the material ids, the critters' sizes and the
// looks. If the game changes, this test names what drifted, so the copy can be brought up to date. Then it runs the
// copy: a tank by lava blows, as it does in the game. Exit code 1 on failure.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as Layer from "../../public/lab/rules/layer.js";
import { makeSand } from "../../public/lab/rules/sand.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fall = fs.readFileSync(path.join(ROOT, "public/fall/index.html"), "utf8");
const sand = fs.readFileSync(path.join(ROOT, "public/lab/rules/sand.js"), "utf8");
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);

// a block of code: from the line that starts it to the brace that closes it, with each line trimmed
function block(src, start) {
  const i = src.search(start);
  if (i < 0) return null;
  const lines = src.slice(i).split("\n"), out = [];
  let depth = 0, open = false;
  for (const l of lines) {
    out.push(l.trim());
    depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
    if (l.includes("{")) open = true;
    if ((open && depth <= 0) || (!open && l.trim().endsWith(";"))) break;
  }
  return out.join("\n");
}

section("The sand, water and fire rules");
const parts = [
  ["the material kinds", /const K = \{ EMPTY/],
  ["the material ids", /const EMPTY = 0, BEDROCK = 1/],
  ["the material table", /function defMat\(id, o\)/],
  ["the looks", /const THEMES = \{/],
  ["wake", /const wake = \(i\) => \{/],
  ["keep", /const keep = \(i\) => /],
  ["set", /function set\(i, m, l\)/],
  ["swap", /function swap\(i, j\)/],
  ["inb", /const inb = \(x, y\) => /],
  ["at", /const at = \(x, y\) => /],
  ["place", /function place\(x, y, m, l, onlyEmpty\)/],
  ["ignite", /function ignite\(j\)/],
  ["lifeFor", /const lifeFor = /],
  ["canFlow", /const canFlow = /],
  ["powder", /function powder\(i, m\)/],
  ["liquid", /function liquid\(i, m\)/],
  ["gas", /function gas\(i, m\)/],
  ["fire", /function fire\(i\)/],
  ["ember", /function ember\(i\)/],
  ["step", /function step\(\) \{\n\s*tick = tick === 255/],
  ["stepDebris", /function stepDebris\(\) \{/],
  ["explode", /function explode\(cx, cy, r, power\)/],
  ["spill", /function spill\(x, y, m, n, r\)/],
  ["explodeTank", /function explodeTank\(t\)/],
  ["boomTank", /function boomTank\(t\)/],
];
for (const [name, re] of parts) {
  const a = block(fall, re), b = block(sand, re);
  check(a && b && a === b, `${name}: the copy matches the game${!a ? " (not found in the game)" : !b ? " (not found in sand.js)" : ""}`);
}
// the tank rule: the lines under "if (t.kind === "tank") {" in the game's updateProps
{
  const after = (src, n) => { const i = src.search(/if \(t\.kind === "tank"\) \{/); return i < 0 ? null : src.slice(i).split("\n").slice(1, 1 + n).map((l) => l.trim()).join("\n"); };
  const a = after(fall, 6), b = after(sand, 6);
  check(a && b && a === b && /explodeTank\(t\)/.test(a), "the tank rule (heat from fire, embers and lava; a fuse; a lost tank wall) matches the game");
}
// blast: the copy keeps only some of the game's lines (no player, critters, lamps or chests in the preview), word for
// word and in the same order
{
  const a = block(fall, /function blast\(x, y, r, power, dmg, cause, owner\)/), b = block(sand, /function blast\(x, y, r, power, dmg, cause, owner\)/);
  let k = 0;
  const lines = b ? b.split("\n") : [];
  const ok = a && b && lines.every((l) => { const at = a.split("\n").indexOf(l, k); if (at < 0) return false; k = at + 1; return true; });
  check(ok && /World\.explode/.test(b) && /explodeTank\(t\)/.test(b) && /Game\.flashes\.push/.test(b), `blast: each of the ${lines.length} lines of the copy is in the game's blast, in order`);
}
// every material line, one by one
const defs = (src) => src.split("\n").filter((l) => /^\s*defMat\(/.test(l)).map((l) => l.trim());
const fd = defs(fall), sd = defs(sand);
check(fd.length > 20 && fd.length === sd.length && fd.every((l, i) => l === sd[i]), `all ${fd.length} materials match, in order`);
{
  const kinds = /const KIND = new Uint8Array\(NMAT\)[^\n]*\nfor \(let m = 0; m < NMAT; m\+\+\)[^\n]*\nconst blocks = [^\n]*/;
  const a = fall.match(kinds), b = sand.match(kinds);
  check(a && b && a[0] === b[0], "the tables built from them match");
}

section("The world and its layer");
{
  const wm = fall.match(/const W = (\d+), H = (\d+), CS = 16/), tb = fall.match(/const TOP = (\d+), BOT = (\d+);/);
  check(wm && +wm[1] === Layer.W && +wm[2] === Layer.H, `the world is ${Layer.W} by ${Layer.H}, as in the game`);
  check(tb && +tb[1] === Layer.TOP && +tb[2] === Layer.BOT, `the ground starts at row ${Layer.TOP} and the floor is ${Layer.BOT} rows, as in the game`);
  const ids = {};
  for (const m of fall.match(/const EMPTY = 0,[\s\S]*?;/)[0].matchAll(/([A-Z]+) = (\d+)/g)) ids[m[1]] = +m[2];
  const bad = Object.entries(Layer.M).filter(([k, v]) => ids[k] !== v).map(([k]) => k);
  check(bad.length === 0, `the material ids in layer.js match the game${bad.length ? " (not: " + bad.join(", ") + ")" : ""}`);
  const foes = {};
  for (const m of fall.matchAll(/^\s{2}(\w+): \{ name: "[^"]+", (?:boss: true, )?hp: \d+, w: (\d+), h: (\d+)/gm)) foes[m[1]] = [+m[2], +m[3]];
  const cbad = Layer.CRITTERS.filter((c) => !foes[c.id] || foes[c.id][0] !== c.w || foes[c.id][1] !== c.h).map((c) => c.id);
  check(cbad.length === 0, `the ${Layer.CRITTERS.length} critters exist in the game, with the same sizes${cbad.length ? " (not: " + cbad.join(", ") + ")" : ""}`);
  const themes = [...fall.match(/const THEMES = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s{2}(\w+): \{/gm)].map((m) => m[1]);
  check(JSON.stringify(themes) === JSON.stringify(Layer.THEMES), `the four looks match the game (${themes.join(", ")})`);
  // the game's ground shading, which layer.js redoes for a painted layer
  const sw = block(fall, /function shadeWall\(\) \{/);
  check(!!sw && sw.includes("f < 0.18 ? 0 : f < 0.36 ? 1 : f < 0.55 ? 2 : 3") && sw.includes("const R2 = 5;"), "the back wall's shading steps match the game");
  // the drains: the same hollow as the game cuts
  check(fall.includes("const dx = (x - ex) / 26, dy = (yy - (H - 22)) / 26;"), "the drain hollow matches the game");
}

section("The tanks in the preview");
{
  // a pocket with lava in it and a tank beside the lava: in the game this tank blows after about 1.4 s
  const L = Layer.blank(777);
  L.strokes.push({ p: 0, r: 1, pts: [[512, 50], [512, 690]] });
  L.strokes.push({ p: 0, r: 3, pts: [[600, 150], [700, 150]] });
  L.strokes.push({ p: 7, r: 2, pts: [[640, 160], [690, 160]] });
  L.tanks.push({ x: 620, y: 168 });
  const N = 300;   // ticks of 1/60 s: 5 game seconds
  const heard = [];
  let blewAt = -1, fireAt = -1, metalAt = -1;
  for (let run = 0; run < 3; run++) {
    const sand = makeSand(Layer.W, Layer.H, (what) => heard.push(what));
    sand.load(Layer.build(L), L.tanks);
    const count = (m) => sand.mat.reduce((n, v) => n + (v === m), 0);
    const metal0 = count(24);
    let k = 0, fire = 0;
    for (; k < N && !(sand.props[0].dead && count(24) === 0); k++) sand.play(1 / 60);
    for (let j = 0; j < 4; j++) { sand.play(1 / 60); fire = Math.max(fire, count(18)); }
    if (run === 0) { blewAt = sand.props[0].dead ? k : -1; metalAt = metal0; fireAt = fire; }
    check(metal0 === 35 && sand.props[0].dead && count(24) === 0 && fire > 0, `run ${run + 1}: the tank by the lava blows within ${N} ticks: its ${metal0} metal pixels are gone after ${k} ticks, and ${fire} pixels of fire spill out`);
  }
  check(heard.filter((h) => h === "sizzle").length === 3 && heard.filter((h) => h === "boom").length === 3, "each blow asks for a sizzle when the fuse starts, then a boom");
  // a tank with nothing hot near it stays
  const C = Layer.blank(777);
  C.strokes.push({ p: 0, r: 3, pts: [[600, 150], [700, 150]] });
  C.tanks.push({ x: 620, y: 168 });
  const cool = makeSand(Layer.W, Layer.H);
  cool.load(Layer.build(C), C.tanks);
  for (let k = 0; k < N; k++) cool.play(1 / 60);
  check(!cool.props[0].dead && cool.mat.reduce((n, v) => n + (v === 24), 0) === 35, `a tank with nothing hot near it is still whole after ${N} ticks`);
}

console.log(`\nrules.drift: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
