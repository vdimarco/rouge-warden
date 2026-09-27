// The story contract, checked on a live page:
// - js/moves.js exports exactly the eight fight tables (B1).
// - NEW STORY (?story) reaches the story, and S.ready turns true within 30 s of stepped time and within
//   30 s of real time after the win (B2).
// - Every member listed in types.js CONTRACT exists on S with its type; S.register refuses an unknown
//   phase (B6).
// - Every MissionDef and CineDef validates, with every place, line, cine and script id known; every
//   chapter is in CHAPTER_ORDER and names missions that exist; the save written at f1 fits SaveV1.
// - Each real package runs with the others stubbed (B13): ?real=<pkg> for every package whose file is no
//   longer the placeholder, and ?stub=all once.
// - Core units: a child coroutine's error reaches its parent and a failed root task shows
//   'SOMETHING WENT WRONG.' with RETRY (B16); timers fire in time order; interact needs |dy| < 2.5 (D6).
// - RETRY never leaves the story stuck: an error in a task nobody waits on shows the card (a caught child's
//   does not); a chapter task that dies before any checkpoint restarts its mission; an error in e1 retries
//   e1, never an earlier chapter's checkpoint.
// - A Legend fight (E9) validates with its variant; a missing or misplaced variant is caught.
// The page is driven through the frozen S.test handles only, never a package's own DOM.
import { open, step, stepUntil, finish, URL_BASE } from "./lib.mjs";

const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const MOVES = ["BEAR_ATK", "BEAR_CUTS", "CREW", "GABE_ATK", "GABE_CUTS", "PATK", "RONIN_CUTS", "TUNE"];
const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };

// everything about S, worked out in the page
const inspect = (page) => page.evaluate(async () => {
  const T = await import(new URL("js/story/types.js", location.href).href);
  const P = await import(new URL("js/story/world/places.js", location.href).href);
  const S = __crimson.story.S, C = S.content;
  const ids = { places: new Set(P.ALL_POINT_IDS), lines: C.LINES, cines: C.CINES, scripts: C.SCRIPTS, missions: C.MISSIONS };
  const out = { contract: T.checkContract(S), bad: [], pkgs: { ...S.pkgs }, phase: "", count: { missions: 0, cines: 0 } };
  for (const [id, m] of Object.entries(C.MISSIONS)) { out.count.missions++; if (m.id !== id) out.bad.push(`mission key ${id} has id ${m.id}`); out.bad.push(...T.validateMission(m, ids)); }
  for (const [id, c] of Object.entries(C.CINES)) { out.count.cines++; if (c.id !== id) out.bad.push(`cine key ${id} has id ${c.id}`); out.bad.push(...T.validateCine(c, ids)); }
  for (const [id, ch] of Object.entries(C.CHAPTERS)) {
    if (!T.CHAPTER_ORDER.includes(id)) out.bad.push(`chapter ${id} is not in CHAPTER_ORDER`);
    for (const m of ch.missions || []) if (!C.MISSIONS[m]) out.bad.push(`chapter ${id} names a missing mission ${m}`);
    if (ch.start && !ids.places.has(ch.start)) out.bad.push(`chapter ${id} starts at an unknown place ${ch.start}`);
    if (ch.look && !T.LOOKS.includes(ch.look)) out.bad.push(`chapter ${id} has an unknown look ${ch.look}`);
  }
  try { S.register("bogus", () => {}); out.phase = "accepted"; } catch (e) { out.phase = "refused"; }
  const h = S.cast.preload(T.CORE_CAST); out.preload = h && "done" in h && "progress" in h;
  return out;
});
function report(label, r) {
  check(r.contract.length === 0, `${label}: every CONTRACT member is on S with its type (${T.CONTRACT.length} checked)${r.contract.length ? ": " + r.contract.slice(0, 6).join("; ") : ""}`);
  check(r.bad.length === 0, `${label}: ${r.count.missions} missions and ${r.count.cines} cines validate${r.bad.length ? ": " + r.bad.slice(0, 6).join("; ") : ""}`);
  check(r.phase === "refused", `${label}: S.register refuses an unknown phase`);
  check(r.preload, `${label}: S.cast.preload returns a handle with done and progress`);
}

/* ---------------- the full page: ?story (NEW STORY) ---------------- */
{
  const { browser, page, errors } = await open({ query: "?story&seed=7&god&nomusic" });
  const keys = await page.evaluate(async () => Object.keys(await import(new URL("js/moves.js", location.href).href)).sort());
  check(JSON.stringify(keys) === JSON.stringify(MOVES), `js/moves.js exports exactly ${MOVES.join(", ")} (${keys.join(", ")})`);
  check(await page.evaluate(() => __crimson.game.state === "fight" && __crimson.game.mode === "story"), "?story starts NEW STORY");
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 100 });
  const t0 = Date.now();
  await page.evaluate(() => __crimson.win());
  const r = await stepUntil(page, () => __crimson.game.state === "story" && __crimson.story.ready, { maxSec: 30 });
  const real = (Date.now() - t0) / 1000;
  check(r.ok && real <= 30, `S.ready within 30 s after the win (${r.sec} s stepped, ${real.toFixed(1)} s real)`);
  const f1 = await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem("crimson.story.v1") || "null"));
  const bad = T.validateSave(save);
  check(f1.ok && bad.length === 0, `the save written at f1 fits SaveV1${bad.length ? ": " + bad.join("; ") : ""}`);
  const out = await inspect(page);
  report("all packages", out);
  console.log(`     packages: ${Object.entries(out.pkgs).map(([k, v]) => `${k}=${v}`).join(" ")}`);

  const core = await page.evaluate(async () => {
    const { createTimers, createCo } = await import(new URL("js/core/clock.js", location.href).href);
    const { createInteract } = await import(new URL("js/story/core/interact.js", location.href).href);
    const timers = createTimers(), seen = [];
    const co = createCo(timers, { onError: (t) => seen.push(t.name) });
    let caught = "";
    function* child() { yield 0.1; throw new Error("qa-deliberate child error"); }
    function* parent() { try { yield co.start(child(), "child"); } catch (e) { caught = e.message; throw e; } }
    const p = co.start(parent(), "parent");
    for (let i = 0; i < 20; i++) { timers.tick(1 / 60); co.tick(); }
    const order = [], T2 = createTimers();
    T2.after(0.2, () => order.push("b")); T2.after(0.1, () => order.push("a")); T2.after(0.2, () => order.push("c"));
    for (let i = 0; i < 12; i++) T2.tick(1 / 60);
    const I = createInteract();
    I.add({ id: "deck", pos: { x: 0, y: 62, z: 0 }, r: 3 }); I.add({ id: "wash", pos: { x: 0.5, y: 0, z: 0 }, r: 3 });
    const at = (y) => { const c = I.update({ mode: "foot", pos: { x: 0, y, z: 0 } }); return c ? c.id : "none"; };
    return { propagated: !!p.error && /qa-deliberate/.test(caught) && seen.join(",") === "child,parent", order: order.join(""), dy: [at(62.5), at(0.2), at(30)].join(",") };
  });
  check(core.propagated, "a child coroutine's error is thrown into its parent (B16)");
  check(core.order === "abc", `timers fire in time order, 0.2 s on tick 12 (${core.order})`);
  check(core.dy === "deck,wash,none", `interact picks by height: deck on the deck, wash below, none between (${core.dy})`);
  await page.evaluate(() => __crimson.story.S.co.start((function* qa() { yield null; throw new Error("qa-deliberate root error"); })(), "root:qa"));
  await step(page, 0.1);
  const card = await page.evaluate(() => __crimson.story.S.test.ui.card);
  check(card === "SOMETHING WENT WRONG.", `a failed root task shows the error card (${card})`);
  await page.evaluate(() => __crimson.story.S.test.ui.choose(0)); // RETRY
  await step(page, 0.2);
  const after = await page.evaluate(() => ({ card: __crimson.story.S.test.ui.card, mode: __crimson.story.mode, chapter: __crimson.story.chapter }));
  check(after.mode === "play" && after.card !== "SOMETHING WENT WRONG.", `RETRY goes back into the story (${after.chapter}, ${after.mode})`);

  // a child's error that its parent catches shows no card; an error in a task nobody waits on does
  await page.evaluate(() => {
    const S = __crimson.story.S;
    window.__qaCaught = "";
    function* child() { yield null; throw new Error("qa-deliberate caught error"); }
    S.co.start((function* parent() { try { yield S.co.start(child(), "qa:child"); } catch (e) { window.__qaCaught = e.message; } })(), "qa:parent");
  });
  await step(page, 0.2);
  const caught = await page.evaluate(() => ({ card: __crimson.story.S.test.ui.card, caught: window.__qaCaught }));
  check(!caught.card && /qa-deliberate/.test(caught.caught), `a child's error that its parent catches shows no card (card ${caught.card})`);
  await page.evaluate(() => __crimson.story.S.co.start((function* orphan() { yield null; throw new Error("qa-deliberate orphan error"); })(), "qa:orphan"));
  await step(page, 0.1);
  const orphan = await page.evaluate(() => __crimson.story.S.test.ui.card);
  check(orphan === "SOMETHING WENT WRONG.", `an error in a task nobody waits on shows the card (${orphan})`);
  await page.evaluate(() => __crimson.story.S.test.ui.choose(0));
  await step(page, 0.2);

  // the chapter task dies before any checkpoint, so no mission is active: RETRY must still restart f1
  await page.evaluate(() => {
    const S = __crimson.story.S, C = S.content;
    window.__qaStep0 = C.MISSIONS.f1.steps[0];
    let n = 0;
    C.SCRIPTS.qaBoomOnce = function* () { yield null; if (n++ === 0) throw new Error("qa-deliberate step error"); };
    C.MISSIONS.f1.steps[0] = { type: "script", fn: "qaBoomOnce" };
    S.missions.startChapter("f1");
  });
  await step(page, 0.2);
  const dead = await page.evaluate(() => ({ card: __crimson.story.S.test.ui.card, active: __crimson.story.S.missions.active }));
  check(dead.card === "SOMETHING WENT WRONG." && dead.active === null, `a step that throws before the first checkpoint ends the chapter task and shows the card (${dead.card}, active ${JSON.stringify(dead.active)})`);
  await page.evaluate(() => __crimson.story.S.test.ui.choose(0));
  await step(page, 0.5);
  const back = await page.evaluate(() => { const S = __crimson.story.S; return { chapter: S.missions.chapter, mission: S.missions.active && S.missions.active.id, step: S.missions.active && S.missions.active.step, roots: S.co.list.filter((t) => !t.done && t.name.startsWith("root:")).map((t) => t.name).join(",") }; });
  check(back.chapter === "f1" && back.mission === "f1" && back.roots === "root:chapter", `RETRY with no mission active and no checkpoint restarts f1 (${JSON.stringify(back)})`);
  await page.evaluate(() => { __crimson.story.S.content.MISSIONS.f1.steps[0] = window.__qaStep0; });

  // f1's checkpoint ends with f1: an error in e1 retries e1
  await page.evaluate(() => {
    const S = __crimson.story.S, C = S.content, orig = C.SCRIPTS.credits;
    let n = 0;
    C.SCRIPTS.credits = function* (m, st) { if (n++ === 0) { yield null; throw new Error("qa-deliberate credits error"); } yield* orig(m, st); };
    S.missions.autopilot(true);
  });
  const e = await stepUntil(page, () => __crimson.story.S.test.ui.card === "SOMETHING WENT WRONG.", { maxSec: 30, chunk: 1 / 60, realMs: 0 });
  const where = await page.evaluate(() => __crimson.story.chapter);
  await page.evaluate(() => { __crimson.story.S.missions.autopilot(false); __crimson.story.S.test.ui.choose(0); });
  await step(page, 0.2);
  const e1 = await page.evaluate(() => { const S = __crimson.story.S; return { chapter: S.missions.chapter, mission: S.missions.active && S.missions.active.id }; });
  check(e.ok && where === "e1" && e1.chapter === "e1" && e1.mission === "e1", `an error in e1 retries e1, not f1's old checkpoint (error in ${where}, then ${JSON.stringify(e1)})`);
  errs.push(...errors);
  await browser.close();
}

/* ---------------- a Legend fight in the mission data (E9) ---------------- */
{
  const ok = T.validateMission({ id: "qa", chapter: "p1", spawns: [{ id: "jav", foe: "legend", variant: "javelina", pos: { x: 0, z: 0 } }], steps: [{ type: "fight", legend: true, boss: "legend", waves: [[{ foe: "legend", variant: "gila" }]] }] });
  const noVariant = T.validateMission({ id: "qa", steps: [{ type: "fight", waves: [[{ foe: "legend" }]] }] });
  const wrongFoe = T.validateMission({ id: "qa", spawns: [{ id: "d", foe: "driver", variant: "vulture", pos: { x: 0, z: 0 } }], steps: [{ type: "wait" }] });
  check(!ok.length && noVariant.length === 1 && wrongFoe.length === 1, `a Legend fight validates with its variant; a missing or misplaced variant is caught (${[...ok, ...noVariant, ...wrongFoe].join("; ")})`);
}

/* ---------------- stubs: every stub at once, then each real package with the others stubbed ---------------- */
const runs = [["stub=all", "every stub"]];
for (const pkg of T.PACKAGES) {
  const src = await (await fetch(new URL(`js/story/${T.PACKAGE_PATHS[pkg]}`, URL_BASE))).text();
  if (/export \* from '\.\.\/stubs\//.test(src) && src.split("\n").filter((l) => l.trim() && !l.startsWith("//")).length === 1) { console.log(`skip ${pkg}: its file is still the placeholder, so ?real=${pkg} is the stub run`); continue; }
  runs.push([`real=${pkg}`, `real ${pkg}, other packages stubbed`]);
}
for (const [flag, label] of runs) {
  const { browser, page, errors } = await open({ query: `?chapter=i0&${flag}&seed=7&nomusic` });
  const r = await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.chapter, { maxSec: 30 });
  check(r.ok, `${label}: the story starts at i0 and is ready (${r.sec} s)`);
  if (r.ok) {
    const out = await inspect(page);
    if (flag === "stub=all") check(Object.values(out.pkgs).every((v) => v === "stub"), `${label}: every package came from stubs/`);
    else { const pkg = flag.slice(5); check(out.pkgs[pkg] === "real" && Object.entries(out.pkgs).every(([k, v]) => k === pkg || v === "stub"), `${label}: only ${pkg} is real`); }
    report(label, out);
    const f1 = await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
    check(f1.ok, `${label}: i0 leads to f1`);
  }
  errs.push(...errors);
  await browser.close();
}
// the deliberate errors above log on purpose; anything else is a real page error
await finish("contract", fails, null, errs.filter((e) => !/qa-deliberate/.test(e)));
