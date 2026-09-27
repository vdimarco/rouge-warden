// The whole story on autopilot, sharded by act (AMENDMENTS F1), and the content scripts played by hand.
// Usage: node qa/crimson/story.mjs [prologue|act1|act2|act3|scripts ...] [--no-reload]
//   (no shard names: every shard, then the scripts)
// Each shard opens the page at its first chapter (?chapter=, seed 7, god, no music) and turns the autopilot
// on. Every chapter must pass inside its stepped-time budget (the sum of its missions' budgets) with no
// error card, and the next one must start. After each chapter the save must name the next chapter; the
// page is reloaded and CONTINUE must resume there (skip with --no-reload). The story invariants hold at
// every chapter change, and the credits roll at the end of act3.
// Checks that need real photos (the F5 photo on the P1 wall, FACE PLACE DATE after P6) run when MISSIONS
// is the real package; with the stub they check the data path and say so.
// The scripts shard plays content's bespoke scripts without the autopilot: the crew on foot and in the van,
// the chapter card, the kazoo shower, the slow drift over the bridge, rocking the van out of the creek, the
// evidence wall, the bridge block and the credits. Screenshots go to /tmp/story_*.png.
import { open, step, stepUntil, loop, invariants, shot, nextFrames, finish, URL_BASE } from "./lib.mjs";

const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const C = await import(new URL("../../public/crimson/js/story/content/content.js", import.meta.url).href);
const { CHAPTERS } = await import(new URL("../../public/crimson/js/story/content/chapters.js", import.meta.url).href);
const SHARDS = C.ACTS;
const args = process.argv.slice(2);
const RELOAD = !args.includes("--no-reload");
const want = args.filter((a) => !a.startsWith("--"));
const runShards = want.length ? want.filter((w) => SHARDS[w]) : Object.keys(SHARDS);
const runScripts = !want.length || want.includes("scripts");
const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const Q = "&seed=7&god&nomusic";
// MISSIONS is still the stub while its file is the one-line placeholder (as contract.mjs decides)
const missionsSrc = (await import("fs")).readFileSync(new URL("../../public/crimson/js/story/missions/missions.js", import.meta.url), "utf8");
const MISSIONS_REAL = !(/export \* from '\.\.\/stubs\//.test(missionsSrc) && missionsSrc.split("\n").filter((l) => l.trim() && !l.startsWith("//")).length === 1);
console.log(`     MISSIONS is ${MISSIONS_REAL ? "the real package" : "the stub"}`);
const ERR = "SOMETHING WENT WRONG.";
const next = (ch) => T.CHAPTER_ORDER[T.CHAPTER_ORDER.indexOf(ch) + 1] || null;
const budgetOf = (ch) => CHAPTERS[ch].missions.reduce((s, id) => s + (C.MISSIONS[id].budget || 60), 0) + 10;
const story = (page) => page.evaluate(() => { const s = __crimson.story, S = s.S; return { chapter: s.chapter, mode: s.mode, mission: s.mission && { ...s.mission }, card: S.test.ui.card, flags: { ...S.flags }, evidence: { ...S.evidence.slots }, save: JSON.parse(localStorage.getItem("crimson.story.v1") || "null") }; });

async function continueAfterReload(page, errors = []) {
  const n0 = errors.length;
  await page.goto(`${URL_BASE}?${Q.slice(1)}`); // a reload without the ?chapter= jump (the save stays: storage is cleared once a session)
  // (a rigged body still loading when the page goes away fails its blob texture on the old page: not an error of the game)
  for (let i = errors.length - 1; i >= n0; i--) if (/GLTFLoader: Couldn't load texture blob:/.test(errors[i])) errors.splice(i, 1);
  await page.waitForFunction(() => window.__crimson && __crimson.game.ready, null, { timeout: 300000, polling: 100 });
  await page.evaluate(() => __crimson.step(0, false));
  const cont = await page.evaluate(() => !document.getElementById("modeContinue").hidden);
  await page.evaluate(() => __crimson.startGame("continue"));
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 50 });
  const r = await stepUntil(page, () => __crimson.story.ready && __crimson.story.mode === "play" && !!__crimson.story.chapter, { maxSec: 40 });
  return { cont, ok: r.ok };
}

/* ---------------- the shards ---------------- */
let carry = null; // the save the last shard ended on: the next shard CONTINUEs from it when it names its first chapter
for (const name of runShards) {
  const list = SHARDS[name];
  const t0 = Date.now();
  console.log(`---- ${name}: ${list.join(" ")}`);
  const cont = carry && carry.chapter === list[0] ? JSON.stringify(carry) : null;
  const { browser, page, errors } = await open(cont
    ? { query: `?${Q.slice(1)}`, before: (pg) => pg.addInitScript((save) => { try { if (!sessionStorage.getItem("qa-carry")) { localStorage.setItem("crimson.story.v1", save); sessionStorage.setItem("qa-carry", "1"); } } catch (e) { /* no storage */ } }, cont) }
    : { query: `?chapter=${list[0]}${Q}` });
  if (cont) { await page.evaluate(() => __crimson.startGame("continue")); await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 50 }); }
  let r = await stepUntil(page, (c) => __crimson.story && __crimson.story.ready && __crimson.story.mode === "play" && !!__crimson.story.chapter, { maxSec: 40 });
  let s = await story(page);
  check(r.ok && s.chapter === list[0], `${name}: ${cont ? "CONTINUE from the last shard's save" : `?chapter=${list[0]}`} starts at ${list[0]} (${s.chapter})`);
  await page.evaluate(() => __crimson.story.autopilot(true));
  for (const ch of list) {
    const nx = next(ch), budget = budgetOf(ch);
    s = await story(page);
    if (s.chapter !== ch) { check(false, `${name}: expected ${ch} to be playing, got ${s.chapter}`); break; }
    // one tick at a time in the page: stop on the chapter change, the credits, or an error card
    const run = await loop(page, Math.round(budget * 60), (a) => {
      const st = __crimson.story, S = st.S;
      return st.chapter !== a.ch || st.mode === "credits" || S.test.ui.card === "SOMETHING WENT WRONG.";
    }, { ch });
    s = await story(page);
    const sec = (run.ticks / 60).toFixed(1);
    if (s.card === ERR) { check(false, `${name}: ${ch} shows the error card (mission ${JSON.stringify(s.mission)})`); break; }
    if (!nx) { check(run.stopped && s.mode === "credits", `${name}: ${ch} passes and the credits roll (${sec} s of ${budget} s)`); break; }
    check(run.stopped && s.chapter === nx, `${name}: ${ch} passes in ${sec} s of its ${budget} s budget, and ${nx} starts (${s.chapter})`);
    if (!run.stopped || s.chapter !== nx) break;
    const inv = await invariants(page);
    check(!inv.length, `${name}: invariants hold at the start of ${nx}${inv.length ? ": " + inv.join("; ") : ""}`);
    // the chapter-specific checks
    if (ch === "f5") {
      if (MISSIONS_REAL) check(typeof s.flags.f5Photo === "string" && s.flags.f5Photo.length > 0, `F5 stores the photo of the figure on the Perch (${s.flags.f5Photo})`);
      else console.log("     (MISSIONS is the stub: F5's photo step passes with no photo; the P1 wall shows PHOTO LOST)");
    }
    if (ch === "p1") {
      const pins = s.flags.wallPins || [];
      check(pins.length === 2 && pins[1] === "gabe:van", `P1 pins two photos on the wall (${pins.join(", ")})`);
      if (MISSIONS_REAL && s.flags.f5Photo) check(pins[0] === s.flags.f5Photo, `the F5 photo ${s.flags.f5Photo} is on the P1 evidence wall`);
      else if (MISSIONS_REAL) console.log("     (this shard did not play F5: run the prologue shard first for the F5 photo on the wall)");
      else check(pins[0] === (s.flags.f5Photo || "lost"), `the P1 wall shows the F5 photo slot (${pins[0]}; MISSIONS is the stub, so no photo exists)`);
      const wall = await page.evaluate(() => { const S = __crimson.story.S, w = S.world.interiors.wall("airstream"); return w ? (w.userData.composedBy || "none") : "no wall"; });
      check(wall === "content" || wall === "missions", `the Airstream wall is composed (${wall})`);
    }
    if (ch === "p6") {
      if (MISSIONS_REAL) check(!!(s.evidence.face && s.evidence.place && s.evidence.date), `FACE, PLACE and DATE are filled after P6 (${JSON.stringify(s.evidence)})`);
      else console.log("     (MISSIONS is the stub: its photo steps store no evidence; FACE PLACE DATE come with the real package)");
      check(!!s.flags.face && !!s.flags.place && !!s.flags.date, "after P6 the story flags FACE, PLACE and DATE as found");
    }
    // the save names the next chapter; CONTINUE after a reload resumes there
    if (!T.COLD_OPEN.includes(nx)) {
      check(!!s.save && s.save.chapter === nx && T.validateSave(s.save).length === 0, `the save names ${nx} and fits SaveV1 (${s.save && s.save.chapter})`);
      if (RELOAD && list.includes(nx)) {
        const c = await continueAfterReload(page, errors);
        const s2 = await story(page);
        check(c.cont && c.ok && s2.chapter === nx, `CONTINUE after a reload resumes at ${nx} (${s2.chapter})`);
        if (s2.chapter !== nx) break;
        await page.evaluate(() => __crimson.story.autopilot(true));
      }
    }
  }
  if (list.includes("e1")) {
    await nextFrames(page);
    const cr = await page.evaluate(() => ({ h: !!__crimson.story.S.test.credits, text: document.getElementById("roll").textContent, again: (document.getElementById("creditsAgain") || {}).textContent }));
    check(cr.h && cr.text.includes("THE BEST MAN") && cr.text.includes("1-888-373-7888") && cr.text.includes("Gabe is the best man.") && cr.again === "▶ KEEP PLAYING", "the credits roll: THE BEST MAN, the hotline card, the closing note, KEEP PLAYING");
  }
  carry = (await story(page)).save;
  console.log(`     ${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s real`);
  errs.push(...errors.map((e) => `${name}: ${e}`));
  await browser.close();
}

/* ---------------- the scripts, played by hand ---------------- */
if (runScripts) {
  console.log("---- scripts");
  // F1: the chapter card, the crew on foot, the crew in the van, the kazoo shower, the drift over the bridge
  {
    const { browser, page, errors } = await open({ query: `?chapter=f1${Q}`, width: 960, height: 540 });
    await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.chapter === "f1" && __crimson.story.mode === "play", { maxSec: 40 });
    await step(page, 0.5, { draw: true });
    const card = await page.evaluate(() => ({ t: __crimson.story.S.test.ui.card, n: document.querySelector("#story .sCard .cN") && document.querySelector("#story .sCard .cN").textContent, stamp: __crimson.story.S.ui && document.querySelector("#sInfo .stamp") && document.querySelector("#sInfo .stamp").textContent }));
    check(card.t === "TEN SEATS" && card.n === "CHAPTER 3", `F1 opens on its chapter card (${card.n} · ${card.t})`);
    await shot(page, "/tmp/story_f1_card.png");
    for (let i = 0; i < 12; i++) { await page.evaluate(() => __crimson.story.S.ui.advanceAll()); await step(page, 0.4); }
    await step(page, 2, { draw: true });
    const crew = await page.evaluate(() => { const S = __crimson.story.S, H = S.hero; return S.test.content.crew.map((id) => { const a = S.cast.followers.list.find((e) => e.a.crewId === id); return a ? Math.hypot(a.pos.x - H.pos.x, a.pos.z - H.pos.z) : 99; }); });
    check(crew.length === 4 && crew.every((d) => d < 7), `the four friends follow New Balance on foot (${crew.map((d) => d.toFixed(1)).join(", ")} m)`);
    // a look at the group from the side, then the game camera again
    await page.evaluate(() => { const S = __crimson.story.S, H = S.hero; window.__qaCam = S.cameras.add("qa", 999, () => true, () => { S.camera.position.set(H.pos.x - 3, H.pos.y + 9, H.pos.z + 7); S.camera.lookAt(H.pos.x - 1, H.pos.y + 0.6, H.pos.z - 1); }); });
    await step(page, 0.3, { draw: true });
    await shot(page, "/tmp/story_f1_crew.png");
    await page.evaluate(() => window.__qaCam());
    await page.evaluate(() => __crimson.story.S.test.van.enter());
    // (f1's own talk step may still be open: a blocking line freezes play, so read it through)
    for (let i = 0; i < 6; i++) { await page.evaluate(() => __crimson.story.S.ui.advanceAll()); await step(page, 0.25); }
    const seated = await page.evaluate(() => { const S = __crimson.story.S, v = S.vehicles.player; return { riding: S.drive.riding === v, n: v.seats.filter((x) => x && x !== "hero" && x.crewId).length, followers: S.cast.followers.list.length }; });
    check(seated.riding && seated.n === 4 && seated.followers === 0, `in the van the four take seats (${seated.n} seated, ${seated.followers} on foot)`);
    await page.evaluate(() => { const S = __crimson.story.S; S.vehicles.player.speed = 0; S.test.van.exit(); });
    await step(page, 2);
    const off = await page.evaluate(() => { const S = __crimson.story.S; return { foot: S.hero.mode, n: S.cast.followers.list.length, vis: S.cast.followers.list.every((e) => e.a.visible) }; });
    check(off.foot === "foot" && off.n === 4 && off.vis, `out of the van they follow again (${off.n})`);
    // the kazoo shower at Mask & Mayhem
    await page.evaluate(() => __crimson.story.S.missions.start("f1", { step: 13 }));
    await step(page, 0.2);
    await page.evaluate(() => __crimson.story.S.test.van.enter());
    await step(page, 0.6, { draw: true });
    const kz = await page.evaluate(() => ({ out: !!__crimson.story.S.flags.kazoosOut, toast: document.getElementById("sToast") && document.getElementById("sToast").textContent }));
    check(kz.out && /Every 17 you find/.test(kz.toast || ""), `the roof box pops: 51 kazoos, and the rule of 17 (${kz.toast})`);
    await shot(page, "/tmp/story_f1_kazoos.png");
    // the slow drift over Midgley Bridge: cinematic time on the deck, and back to 1 after
    await page.evaluate(() => __crimson.story.S.missions.start("f1", { step: 15 }));
    await step(page, 0.3);
    await page.evaluate(() => { const S = __crimson.story.S; S.test.van.enter(); });
    await step(page, 1);
    await page.evaluate(() => { const S = __crimson.story.S, a = S.world.place("midgley_deck_s"), b = S.world.place("midgley_deck_n"); S.test.van.teleport(a.x + (b.x - a.x) * 0.3, a.z + (b.z - a.z) * 0.3, Math.atan2(b.x - a.x, b.z - a.z)); });
    const drift = await loop(page, 600, () => __crimson.story.S.timeScale < 1);
    const slow = await page.evaluate(() => __crimson.story.S.timeScale);
    await step(page, 0.5, { draw: true });
    await shot(page, "/tmp/story_f1_bridge.png");
    await page.evaluate(() => { const S = __crimson.story.S, b = S.world.place("midgley_deck_n"); S.test.van.teleport(b.x, b.z); });
    await step(page, 6);
    const after = await page.evaluate(() => ({ ts: __crimson.story.S.timeScale, m: __crimson.story.mission && __crimson.story.mission.step }));
    check(drift.stopped && slow < 1 && after.ts === 1 && after.m > 15, `the drift over the bridge slows time (${slow}) and gives it back (${after.ts}, step ${after.m})`);
    errs.push(...errors.map((e) => `f1 scripts: ${e}`));
    await browser.close();
  }
  // F4: the hangover, then rock the van out of Oak Creek by hand (the gas on the swing), and the bumper falls off
  {
    const { browser, page, errors } = await open({ query: `?mission=f4&step=2${Q}`, width: 960, height: 540 });
    await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.mission && __crimson.story.mission.id === "f4" && __crimson.story.mode === "play", { maxSec: 40 });
    await step(page, 0.5, { draw: true });
    const hang = await page.evaluate(() => ({ look: __crimson.story.S.look.name, hp: __crimson.story.S.hero.hp, max: __crimson.story.S.hero.maxHp, m: __crimson.story.mission.type }));
    await page.evaluate(() => __crimson.story.S.test.ui.input.set({ canteen: true }));
    await step(page, 0.2);
    await page.evaluate(() => __crimson.story.S.test.ui.input.set({ canteen: false }));
    await step(page, 2.8, { draw: true });
    const clear = await page.evaluate(() => ({ look: __crimson.story.S.look.name, step: __crimson.story.mission.step }));
    check(hang.hp <= hang.max * 0.6 && clear.look === "MEMORY" && clear.step >= 3, `a canteen sip clears the hangover (hp ${hang.hp}/${hang.max}, look ${clear.look})`);
    await page.evaluate(() => __crimson.story.S.missions.start("f4", { step: 6 }));
    await step(page, 0.3);
    await page.evaluate(() => __crimson.story.S.test.van.enter());
    await step(page, 1.2, { draw: true });
    const meter = await page.evaluate(() => !!document.querySelector("#sMeters .meter.k-band"));
    await shot(page, "/tmp/story_f4_rock.png");
    // press the gas when the dot is in the band, four times
    const rocked = await loop(page, 60 * 30, () => {
      const S = __crimson.story.S, m = [...document.querySelectorAll("#sMeters .meter")].find((e) => /ROCK/.test(e.textContent));
      if (!m) return S.test.missions && __crimson.story.mission && __crimson.story.mission.step > 6;
      const left = parseFloat(m.querySelector(".dot").style.left) / 100;
      S.test.ui.input.set({ gas: left > 0.8 && !window.__qaGas });
      window.__qaGas = left > 0.8;
      return false;
    });
    await page.evaluate(() => __crimson.story.S.test.ui.input.set({ gas: false }));
    const out = await page.evaluate(() => ({ step: __crimson.story.mission && __crimson.story.mission.step, look: { ...__crimson.story.S.vehicles.player.look } }));
    check(meter && rocked.stopped && out.step > 6 && out.look.noBumper, `the swing meter shows; four rocks on the swing free the van, and the bumper stays behind (step ${out.step}, ${(rocked.ticks / 60).toFixed(1)} s)`);
    errs.push(...errors.map((e) => `f4 scripts: ${e}`));
    await browser.close();
  }
  // P1: the evidence wall in the Airstream; P9: the bridge block; P12: ten seats; E1: the credits
  {
    const { browser, page, errors } = await open({ query: `?mission=p1&step=7${Q}`, width: 960, height: 540 });
    await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.mission && __crimson.story.mission.id === "p1" && __crimson.story.mode === "play", { maxSec: 40 });
    await page.evaluate(() => { __crimson.story.S.flags.f5Photo = null; });
    await loop(page, 60 * 10, () => __crimson.story.mission && __crimson.story.mission.step >= 10);
    const inside = await page.evaluate(() => { const S = __crimson.story.S; return { y: S.hero.pos.y, room: S.world.interiors.roomAt ? S.world.interiors.roomAt(S.hero.pos.x, S.hero.pos.y, S.hero.pos.z) : null, wall: S.world.interiors.wall("airstream").userData.composedBy, pins: S.flags.wallPins }; });
    check(inside.y < -250 && (inside.wall === "content" || (MISSIONS_REAL && inside.wall === "missions")) && inside.pins && inside.pins[0] === "lost", `P1: into the Airstream, and the wall pins the F5 photo slot beside Gabe's (y ${inside.y.toFixed(1)}, ${inside.wall}, ${inside.pins})`);
    await page.evaluate(() => { const S = __crimson.story.S, w = S.world.interiors.wall("airstream"); w.updateMatrixWorld(); const p = w.getWorldPosition(new S.THREE.Vector3()); S.cameras.add("qa", 999, () => true, () => { S.camera.position.set(p.x + 0.2, p.y + 0.1, p.z + 2.2); S.camera.lookAt(p); }); });
    await step(page, 0.3, { draw: true });
    await shot(page, "/tmp/story_p1_wall.png");
    errs.push(...errors.map((e) => `p1 scripts: ${e}`));
    await browser.close();
  }
  {
    const { browser, page, errors } = await open({ query: `?mission=p9&step=9${Q}`, width: 960, height: 540 });
    await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.mission && __crimson.story.mission.id === "p9" && __crimson.story.mode === "play", { maxSec: 40 });
    // put the convoy just short of the bridge, heading north, and let the block play
    await page.evaluate(() => {
      const S = __crimson.story.S, suv = S.vehicles.list.find((v) => v.kind === "suv"), van = S.vehicles.list.find((v) => v.protect);
      suv.setPose(412, -392, 2.9); van.setPose(407, -372, 2.9);
      S.drivers.route(suv, "midgley_deck_n", { lane: true, speed: 12 }); S.drivers.route(van, "midgley_deck_n", { lane: true, speed: 10 });
    });
    const blocked = await loop(page, 60 * 60, () => __crimson.story.mission && __crimson.story.mission.step > 9);
    await step(page, 0.5, { draw: true });
    await shot(page, "/tmp/story_p9_block.png");
    check(blocked.stopped, `P9: Gabe's roadblock on the bridge plays out (${(blocked.ticks / 60).toFixed(1)} s)`);
    errs.push(...errors.map((e) => `p9 scripts: ${e}`));
    await browser.close();
  }
  {
    const { browser, page, errors } = await open({ query: `?mission=p12&step=3${Q}`, width: 960, height: 540 });
    await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.mission && __crimson.story.mission.id === "p12" && __crimson.story.mode === "play", { maxSec: 40 });
    await page.evaluate(() => __crimson.story.S.test.van.enter());
    await loop(page, 60 * 5, () => __crimson.story.mission && __crimson.story.mission.step >= 5);
    const seats = await page.evaluate(() => { const S = __crimson.story.S, v = S.vehicles.player; return { n: v.seats.filter(Boolean).length, stayed: S.flags.stayed, body: S.hero.body }; });
    const stays = seats.body === "tanktop" ? "newbalance" : "tanktop";
    check(seats.n === 10 && seats.stayed === stays, `P12: ten seats full; ${seats.body} drives and ${stays} stays to guard (${seats.n} seats, ${seats.stayed} stayed)`);
    errs.push(...errors.map((e) => `p12 scripts: ${e}`));
    await browser.close();
  }
  {
    const { browser, page, errors } = await open({ query: `?mission=e1&step=7${Q}`, width: 960, height: 540 });
    await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.mode === "credits", { maxSec: 40 });
    await step(page, 14);
    await nextFrames(page);
    await shot(page, "/tmp/story_credits.png");
    await step(page, 26);
    await nextFrames(page);
    await shot(page, "/tmp/story_credits2.png");
    const cr = await page.evaluate(() => ({ h: !!__crimson.story.S.test.credits, imgs: [...document.querySelectorAll("#roll .role img")].map((i) => i.getAttribute("src")), text: document.getElementById("roll").textContent }));
    check(cr.h && cr.imgs.includes("art/portraits/vance.webp") && cr.imgs.includes("art/gabe.webp") && cr.text.includes("Outside the US, call your local police."), `E1: the credits show the cast with portraits and the hotline card (${cr.imgs.length} portraits)`);
    await page.evaluate(() => document.getElementById("creditsAgain").click());
    await step(page, 0.5);
    const after = await page.evaluate(() => ({ mode: __crimson.story.mode, obj: __crimson.story.S.test.ui.objective, credits: __crimson.story.S.test.credits }));
    check(after.mode === "play" && after.credits === null, `KEEP PLAYING goes on (${after.mode}: ${after.obj})`);
    errs.push(...errors.map((e) => `e1 scripts: ${e}`));
    await browser.close();
  }
}

await finish("story", fails, null, errs);
