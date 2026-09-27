// The text and content lint for the story (AMENDMENTS E1-E10, design 2.2, D4). No browser: it reads the
// content modules and the files directly.
// - No em dash, and no en dash or spaced hyphen used as a dash, in content/*.js, ui/*.js, story.css and the
//   title copy of index.html.
// - Every player-facing sentence (lines, objectives, cards, hints and toasts in the scripts, credits, the
//   title note) has 16 words or fewer. Every line fits two subtitle lines of 42 characters.
// - Every LINES id that missions, cines and scripts reference exists, and no id is unused.
// - Every MissionDef and CineDef validates with every place, line, cine and script id known.
// - The tone rules as data: E1 title note, E2 Gabe's motive, E3 the FBI lines, E4 the contact rule, E5 the
//   hotline card, E6 Sunburst and orange jeeps (no pink, no Blush), E7 ten seats, E8 the kazoo rule, E9 the
//   side content, A5/H2 the C0 flash and kneel under the film; no banned words.
// - D4: every mission's cast fits the 10-actor budget, and P10 spawns the six only after the guards.
import { readFileSync, readdirSync } from "fs";
import { finish } from "./lib.mjs";

const ROOT = new URL("../../public/crimson/", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const T = await import(new URL("js/story/types.js", ROOT).href);
const PL = await import(new URL("js/story/world/places.js", ROOT).href);
const C = await import(new URL("js/story/content/content.js", ROOT).href);
const { CHAPTERS } = await import(new URL("js/story/content/chapters.js", ROOT).href);
const { LINES, UI_TEXT } = await import(new URL("js/story/content/lines.js", ROOT).href);
const { CINES } = await import(new URL("js/story/content/cines.js", ROOT).href);
const { SCRIPTS } = await import(new URL("js/story/content/scripts.js", ROOT).href);
const { CREDITS } = await import(new URL("js/story/content/credits.js", ROOT).href);
const MISSIONS = C.MISSIONS;

const fails = [];
let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { console.log("FAIL " + msg); fails.push(msg); } };
const ok = (msg) => console.log("ok   " + msg);

/* ---------------- dashes in the source files ---------------- */
const files = [
  ...readdirSync(new URL("js/story/content/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => `js/story/content/${f}`),
  ...readdirSync(new URL("js/story/ui/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => `js/story/ui/${f}`),
  "story.css",
];
let dashHits = [];
for (const f of files) {
  read(f).split("\n").forEach((l, i) => {
    if (l.includes("—")) dashHits.push(`${f}:${i + 1} em dash`);
    const en = l.replace(/\d–\d/g, ""); // a range like 3–5 is not a dash
    if (en.includes("–")) dashHits.push(`${f}:${i + 1} en dash`);
  });
}
// index.html: the title copy (the #title block and the <title>)
const html = read("index.html");
const titleCopy = [(html.match(/<title>[^<]*<\/title>/) || [""])[0], (html.match(/<div id="title"[\s\S]*?<\/div>\s*<\/div>/) || [""])[0], (html.match(/<p class="note">[^<]*<\/p>/) || [""])[0]].join("\n");
if (/[—]|\s–\s/.test(titleCopy)) dashHits.push("index.html title copy has a dash");
check(!dashHits.length, `no em or en dash used as a dash in ${files.length} files and the title copy${dashHits.length ? ": " + dashHits.slice(0, 6).join("; ") : ""}`);
if (!dashHits.length) ok(`no dashes in ${files.length} files and the title copy`);

/* ---------------- gather every player-facing text ---------------- */
const texts = []; // [where, text, isLine]
for (const [id, L] of Object.entries(LINES)) {
  texts.push([`line ${id}`, L.text, true]);
  for (const [k, t] of Object.entries(L.byPick || {})) texts.push([`line ${id} (${k})`, t, true]);
}
for (const [id, m] of Object.entries(MISSIONS)) {
  if (m.title) texts.push([`mission ${id} title`, m.title]);
  m.steps.forEach((s, i) => {
    if (s.objective) texts.push([`mission ${id} step ${i} objective`, s.objective]);
    if (s.type === "card") { texts.push([`mission ${id} step ${i} card`, s.title]); if (s.sub) texts.push([`mission ${id} step ${i} card sub`, s.sub]); }
    if (s.type === "choice") { texts.push([`mission ${id} step ${i} choice`, s.title]); for (const o of s.options) texts.push([`mission ${id} step ${i} option`, typeof o === "string" ? o : o.label]); }
    if (s.type === "interact") texts.push([`mission ${id} step ${i} label`, s.label]);
    if (s.args && s.args.text) texts.push([`mission ${id} step ${i} hint`, s.args.text]);
    for (const it of s.items || []) if (it.label) texts.push([`mission ${id} step ${i} item`, it.label]);
  });
}
for (const [id, c] of Object.entries(CINES)) for (const k of c.cards || []) { texts.push([`cine ${id} card`, k.title]); if (k.sub) texts.push([`cine ${id} card sub`, k.sub]); }
for (const [id, ch] of Object.entries(CHAPTERS)) { texts.push([`chapter ${id} title`, ch.title]); if (ch.sub) texts.push([`chapter ${id} sub`, ch.sub]); }
for (const [k, t] of Object.entries(UI_TEXT)) texts.push([`ui ${k}`, t]);
texts.push(["credits note", CREDITS.note]);
for (const b of CREDITS.blocks) for (const t of b.split(/<[^>]+>/).map((x) => x.trim()).filter(Boolean)) texts.push(["credits", t]);
// strings the scripts show (hints and toasts)
const scriptSrc = read("js/story/content/scripts.js");
for (const m of scriptSrc.matchAll(/(?:hint|toast)\('([^']+)'/g)) texts.push(["scripts hint", m[1]]);

/* ---------------- sentences of 16 words or fewer, two subtitle lines of 42 ---------------- */
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const sentences = (t) => String(t).split(/(?<=[.!?])\s+/).filter((x) => x.trim());
const wrap = (t, n = 42) => { const out = []; let cur = ""; for (const w of String(t).split(/\s+/)) { if (!cur) cur = w; else if ((cur + " " + w).length <= n) cur += " " + w; else { out.push(cur); cur = w; } } if (cur) out.push(cur); return out; };
const long = [], wide = [], dashy = [];
for (const [where, t, isLine] of texts) {
  if (typeof t !== "string") { long.push(`${where}: no text`); continue; }
  for (const s of sentences(t)) if (words(s) > 16) long.push(`${where}: "${s}" (${words(s)} words)`);
  if (isLine && wrap(t).length > 2) wide.push(`${where}: "${t}" needs ${wrap(t).length} subtitle lines`);
  if (/\s-\s|--/.test(t) || /[—]/.test(t) || /\s–\s/.test(t)) dashy.push(`${where}: "${t}"`);
}
check(!long.length, `every sentence has 16 words or fewer (${texts.length} texts)${long.length ? ": " + long.slice(0, 6).join("; ") : ""}`);
check(!wide.length, `every line fits two subtitle lines of 42 characters${wide.length ? ": " + wide.slice(0, 6).join("; ") : ""}`);
check(!dashy.length, `no text uses a hyphen or dash as a dash${dashy.length ? ": " + dashy.slice(0, 6).join("; ") : ""}`);
if (!long.length && !wide.length && !dashy.length) ok(`${texts.length} texts: sentences of 16 words or fewer, lines of two subtitle rows, no dashes`);

/* ---------------- line ids: all referenced exist, none unused ---------------- */
const used = new Map(); // id -> where
const use = (id, where) => { if (typeof id === "string") used.set(id, where); };
for (const [id, m] of Object.entries(MISSIONS)) m.steps.forEach((s, i) => {
  const w = `mission ${id} step ${i}`;
  if (s.type === "talk") for (const l of [].concat(s.lines)) use(typeof l === "string" ? l : l.line, w);
  for (const it of s.items || []) for (const l of [].concat(it.line || [])) use(l, w);
  for (const e of s.events || []) use(e.line, w);
  const a = s.args || {};
  use(a.line, w); for (const l of a.lines || []) use(l, w);
  if (a.order) for (const list of Object.values(a.order)) for (const l of list) use(l, w);
  if (a.byPick) for (const list of Object.values(a.byPick)) for (const l of list) use(l, w);
});
for (const [id, c] of Object.entries(CINES)) for (const l of c.lines || []) use(l.line, `cine ${id}`);
for (const m of scriptSrc.matchAll(/'([a-z0-9]+\.[A-Za-z0-9]+)'/g)) if (m[1] in LINES) use(m[1], "scripts.js");
const missing = [...used].filter(([id]) => !(id in LINES)).map(([id, w]) => `${id} (${w})`);
const unused = Object.keys(LINES).filter((id) => !used.has(id));
check(!missing.length, `every referenced LINES id exists (${used.size} used)${missing.length ? ": " + missing.slice(0, 8).join("; ") : ""}`);
check(!unused.length, `no LINES id is unused${unused.length ? ": " + unused.slice(0, 12).join(", ") : ""}`);
if (!missing.length && !unused.length) ok(`${used.size} line ids referenced, all exist, none unused`);

/* ---------------- validation ---------------- */
const ids = { places: new Set(PL.ALL_POINT_IDS), lines: LINES, cines: CINES, scripts: SCRIPTS, missions: MISSIONS };
const bad = [];
for (const [id, m] of Object.entries(MISSIONS)) { if (m.id !== id) bad.push(`mission key ${id} has id ${m.id}`); bad.push(...T.validateMission(m, ids)); }
for (const [id, c] of Object.entries(CINES)) { if (c.id !== id) bad.push(`cine key ${id} has id ${c.id}`); bad.push(...T.validateCine(c, ids)); }
for (const id of T.CHAPTER_ORDER) { const ch = CHAPTERS[id]; if (!ch) { bad.push(`chapter ${id} missing`); continue; } for (const m of ch.missions) if (!MISSIONS[m] || MISSIONS[m].chapter !== id) bad.push(`chapter ${id} mission ${m} missing or in another chapter`); if (!T.LOOKS.includes(ch.look)) bad.push(`chapter ${id} look ${ch.look}`); }
const refs = [];
for (const [id, m] of Object.entries(MISSIONS)) m.steps.forEach((s) => { if (s.type === "script" && !(s.fn in SCRIPTS)) refs.push(`${id}: script ${s.fn}`); if (s.type === "cine" && !(s.id in CINES)) refs.push(`${id}: cine ${s.id}`); if (s.args && s.args.cine && !(s.args.cine in CINES)) refs.push(`${id}: intro cine ${s.args.cine}`); });
bad.push(...refs);
check(!bad.length, `${Object.keys(MISSIONS).length} missions, ${Object.keys(CINES).length} cines and ${T.CHAPTER_ORDER.length} chapters validate${bad.length ? ": " + bad.slice(0, 6).join("; ") : ""}`);
if (!bad.length) ok(`${Object.keys(MISSIONS).length} missions, ${Object.keys(CINES).length} cines and ${T.CHAPTER_ORDER.length} chapters validate`);
// every cine is played by a mission (a step or an intro)
const played = new Set();
for (const m of Object.values(MISSIONS)) m.steps.forEach((s) => { if (s.type === "cine") played.add(s.id); if (s.args && s.args.cine) played.add(s.args.cine); });
const orphan = Object.keys(CINES).filter((id) => !played.has(id));
check(!orphan.length, `every cine is played by a mission${orphan.length ? ": " + orphan.join(", ") : ""}`);

/* ---------------- the owner's guardrails (E1-E10), as data ---------------- */
const all = texts.map((t) => String(t[1])).join("\n");
const L = (id) => (LINES[id] || {}).text || "";
const E = [];
E.push(["E1 title note", html.includes(`<p class="note">${UI_TEXT.titleNote}</p>`) && UI_TEXT.titleNote === "A story about friendship. It also deals with human trafficking. No one who is held is hurt on screen."]);
E.push(["E2 Gabe's motive", L("p1.why1") === "I drove jeep tours past that lot every first of the month." && L("p1.why2") === "Same vans. Same hour. I started writing plates down." && !/woman|through a van window/i.test(all)]);
E.push(["E3 P7 Vance asks them to watch the road", /eyes on the road/.test(L("p7.call3")) && /agents/.test(L("p7.call2"))]);
E.push(["E3 P10 radio: her team is minutes out", /minutes out/.test(L("p9.radio")) && /minutes out/.test(L("p10.now"))]);
E.push(["E3 P12 Vance thanks them", L("p12.thank") === "You watched. You called. You kept them safe till we got there." && /wait for us/.test(L("p12.wait"))]);
const p9 = MISSIONS.p9, van1 = p9.spawns.find((s) => s.id === "van1");
E.push(["E4 P9 contact rule 1 m/s", van1 && van1.protect && van1.maxContact === 1 && p9.steps.filter((s) => s.type === "chase" && s.protect === "van1").every((s) => s.maxContact === 1) && /Do not touch the white van/.test(L("p9.rule")) && p9.steps.some((s) => s.type === "chase" && s.goal === "stop")]);
E.push(["E5 hotline card", UI_TEXT.hotline === "If you see signs of trafficking, do not step in yourself. Call 1-888-373-7888. Text HELP to 233733. Outside the US, call your local police." && CREDITS.blocks.some((b) => b.includes("1-888-373-7888") && b.includes("Text HELP to 233733") && b.includes("Outside the US, call your local police."))]);
E.push(["E6 Sunburst Jeep Tours, orange jeeps, F2 is The Jeep Tour", /Sunburst Jeep Tours/.test(L("f2.welcome")) && CHAPTERS.f2.title === "The Jeep Tour" && /orange/.test(all) && !/\bpink\b|Blush/i.test(all)]);
E.push(["E7 P12 ten seats: six people and four friends", MISSIONS.p12.steps.some((s) => s.type === "script" && s.fn === "tenSeats") && /Six in the back\. Four of us\./.test(L("p12.seats")) && /Nobody touches anybody/.test(L("p11.guard"))]);
const sp = (id, first) => (MISSIONS[id].steps.find((s) => s.type === "script" && s.fn === "sayPick" && s.args.lines.includes(first)) || {}).args;
const p1s = sp("p1", "p1.drive"), p11s = sp("p11", "p11.guard");
E.push(["the pick never hands the wheel to itself (P1), and the P12 driver never stays at the ranch (P11)", !!p1s && p1s.byPick.newbalance.includes("p1.driveNB") && LINES["p1.driveNB"].who !== "newbalance" && !!p11s && p11s.byPick.tanktop.includes("p11.guardNB") && LINES["p11.guardNB"].who === "newbalance"]);
E.push(["E8 the kazoo rule (every 17 kazoos, a sip)", /Every 17 you find gives one more canteen sip/.test(L("f1.kazooRule"))]);
const legends = Object.values(MISSIONS).filter((m) => m.kind === "legend"), trials = Object.values(MISSIONS).filter((m) => m.kind === "trial"), hunts = Object.values(MISSIONS).filter((m) => m.kind === "hunt");
E.push(["E9 4 Legend fights at the cairns", legends.length === 4 && legends.every((m) => m.steps.some((s) => s.type === "fight" && s.legend && s.boss === "legend" && s.waves[0][0].foe === "legend" && T.LEGEND_IDS.includes(s.waves[0][0].variant) && String(s.waves[0][0].place).startsWith("cairn_"))) && new Set(legends.map((m) => m.steps.find((s) => s.type === "fight").waves[0][0].variant)).size === 4 && !/coyote/i.test(all)]);
E.push(["E9 2 jeep time trials (race step)", trials.length === 2 && trials.every((m) => m.steps.some((s) => s.type === "race") && m.spawns.some((s) => s.kind === "jeep"))]);
E.push(["E9 3 photo hunts (photo step)", hunts.length === 3 && hunts.every((m) => m.steps.some((s) => s.type === "collect" && s.photo))]);
const unlocked = Object.values(MISSIONS).flatMap((m) => (m.onPass && m.onPass.unlock) || []);
E.push(["E9 side content unlocks from the chapters", [...legends, ...trials, ...hunts].every((m) => unlocked.includes(m.id))]);
E.push(["E10 plain text (checked above)", !long.length && !wide.length && !dashy.length]);
const c0 = CINES.c0;
E.push(["A5/H2 C0: the film, with the engine flash and the kneel under it", c0.arena && c0.fx.some((f) => f.kind === "flash") && c0.actors.some((a) => a.who === "gabe" && a.do === "pose" && a.args.name === "kneel") && c0.actors.some((a) => a.do === "drain") && c0.film && c0.film.src === "clips/yield"]);
E.push(["design 2.2: no banned words", !/migrant|tequila|\bslave|victim/i.test(all)]);
E.push(["design 2.2: Dana speaks for herself, with no portrait", L("p9.dana1").startsWith("I am Dana") && T.PORTRAITS.dana === null]);
for (const [name, v] of E) { check(!!v, name); if (v) ok(name); }

/* ---------------- D4: cast budgets ---------------- */
const over = [];
for (const [id, m] of Object.entries(MISSIONS)) {
  // spawned actors, and the ones content scripts add (friends waiting at a spot, seated passengers)
  const people = (m.spawns || []).filter((s) => s.cast || s.foe).length
    + m.steps.filter((s) => s.type === "script" && s.fn === "crew").reduce((n, s) => n + s.args.ids.length, 0)
    + m.steps.filter((s) => s.type === "script" && s.fn === "seats").reduce((n, s) => n + s.args.list.length, 0)
    + (m.steps.some((s) => s.type === "script" && s.fn === "tenSeats") ? 9 : 0);
  const waves = m.steps.filter((s) => s.waves).map((s) => Math.max(...s.waves.map((w) => w.length)));
  const ch = CHAPTERS[m.chapter] || {};
  const crew = (ch.crew || []).length;
  const n = 1 + crew + people + (waves.length ? Math.max(...waves) : 0);
  if (n > 10) over.push(`${id}: ${n} actors`);
}
check(!over.length, `every mission fits the 10-actor budget${over.length ? ": " + over.join("; ") : ""}`);
const p10 = MISSIONS.p10, rescue = MISSIONS.p10_rescue;
check(!p10.spawns.some((s) => s.cast === "civA" || s.cast === "civB") && rescue.spawns.filter((s) => s.cast === "civA" || s.cast === "civB").length === 6 && CHAPTERS.p10.missions.join() === "p10,p10_rescue", "P10 spawns the six people only after the guards (D4)");
if (!over.length) ok("every mission fits the 10-actor budget; the six at the ranch spawn after the guards");

console.log(`     ${checks} checks, ${texts.length} texts, ${Object.keys(LINES).length} lines`);
await finish("text", fails, null);
