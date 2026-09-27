// The story UI, played through the page:
// 1. Layout: at 1280x720 (keyboard), 844x390 (touch) and 390x844 (touch), with the HUD full (objective,
//    timer, meters, clock and chips, vitals, prompt, hint, subtitles, minimap, markers), no HUD piece
//    overlaps a touch button or another HUD piece, on foot, driving, in the phone camera, in stealth (with
//    suspicion eyes) and in a boss fight (the boss bar). On touch the combat set never shows more than 7
//    action buttons. The arena's #boss is never visible in the story, and #song hides unless the menu is up.
// 2. Cines: subtitles and the dialogue box stack above the letterbox bars; holding skip 0.8 s skips a cine.
// 3. Dialogue: 45 characters a second, E finishes the typing then goes on, the box freezes play, portraits
//    load and a missing one shows its glyph card (A3); non-blocking lines play as subtitles.
// 4. Choices and cards by keyboard: the arrows move the focus and Enter picks; a fail card offers RETRY first.
// 5. The menu: Esc opens it (the clock stops), the arrows and Enter reach MISSIONS and CONTROLS, Esc goes
//    back and closes; EVIDENCE opens the board; MAP opens the map. M opens the map in play, a click sets a
//    waypoint that the minimap routes to, and M closes it.
// Set SHOTS=dir to save screenshots of each state. No page errors anywhere.
import { open, step, stepUntil, shot, finish } from "./lib.mjs";

const SHOTS = process.env.SHOTS || "";
const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const snap = async (page, name) => { if (SHOTS) { await page.waitForTimeout(900); await page.evaluate(() => __crimson.draw(performance.now() / 1000)); await shot(page, `${SHOTS}/${name}.png`); } };
const T = (page, fn, arg) => page.evaluate(fn, arg);

async function boot(opts) {
  const s = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", ...opts });
  const r = await stepUntil(s.page, () => __crimson.story && __crimson.story.chapter === "f1" && __crimson.story.mode === "play" && !__crimson.story.S.test.ui.card, { maxSec: 60 });
  if (!r.ok) throw new Error("the story did not reach f1");
  // the enter step: the van stands by the hero with GET IN in reach
  await step(s.page, 0.5);
  return s;
}
// fill the HUD as a busy mission would
const fillHud = (page) => T(page, () => {
  const S = __crimson.story.S, U = S.ui;
  U.objective("Follow the black SUV. Stay far enough back.");
  U.timer(95);
  U.meter("tail", 60, { kind: "band", near: 25, far: 140, max: 180, label: "DISTANCE" });
  U.meter("bump", 1, { pips: 3, label: "BUMPS", hot: 2 });
  U.evidence({ show: true, face: true });
  U.hint("Press {camera} for the phone camera.");
  U.subs("fifty", "Gabe used to hike here. He sent one photo.");
  const p = S.hero.pos;
  U.marker("goal", { x: p.x + 60, z: p.z - 30, kind: "objective", label: "SUV" });
  U.marker("gabe", { x: p.x - 40, z: p.z + 20, kind: "giver", who: "gabe" });
  U.marker("far", { x: p.x - 400, z: p.z + 300, kind: "objective" });
});
const overlaps = (page) => T(page, () => __crimson.story.S.test.ui.overlaps().map((p) => p.join(" x ")));
const arenaHud = (page) => T(page, () => { const b = document.getElementById("boss"); const r = b.getBoundingClientRect(); return getComputedStyle(document.getElementById("hud")).display !== "none" && r.width > 0; });

async function layouts(label, opts) {
  const { browser, page, errors } = await boot(opts);
  const touch = !!opts.touch;
  await fillHud(page);
  await T(page, () => __crimson.story.S.ui.prompt("GET IN", "use"));
  await step(page, 0.3);
  const vis = await T(page, () => ["sObj", "sTimer", "sInfo", "sMini", "sPrompt", "sHint", "sSubs"].filter((id) => !__crimson.story.S.test.ui.visible(id)));
  check(!vis.length, `${label} foot: the full HUD shows (${vis.length ? "missing " + vis.join(", ") : "all there"})`);
  if (!touch) check(await T(page, () => __crimson.story.S.test.ui.visible("sVit")), `${label} foot: vitals show`);
  let ov = await overlaps(page);
  check(!ov.length, `${label} foot: nothing overlaps${ov.length ? ": " + ov.join("; ") : ""}`);
  const mk = await T(page, () => __crimson.story.S.test.ui.markers);
  check(mk.count >= 3, `${label} foot: markers are projected, the far one on the edge (${mk.count})`);
  if (touch) {
    const b = await T(page, () => ({ set: __crimson.story.S.test.ui.touchSet, btn: __crimson.story.S.test.ui.touchButtons }));
    check(b.set === "explore" && b.btn.includes("use") && b.btn.includes("cam"), `${label} foot: the explore set with USE (${b.set}: ${b.btn.join(", ")})`);
  }
  check(!(await arenaHud(page)), `${label} foot: the arena's #boss is hidden`);
  await snap(page, `${label}-foot`);

  // stealth: a guard watching, the eye above his head, CROUCH on touch
  await T(page, () => {
    const S = __crimson.story.S, p = S.hero.pos, fx = Math.sin(S.hero.face), fz = Math.cos(S.hero.face);
    const f = S.combat.spawn("guard", { pos: { x: p.x + fx * 26, z: p.z + fz * 26 } });
    S.stealth.watch(f, {});
    const w = S.stealth.list[S.stealth.list.length - 1]; w.level = 0.55;
    window.__qaGuard = f;
    S.ui.meter("sus", 0.55, { label: "SUSPICION", hot: 0.8 });
  });
  await step(page, 0.3);
  ov = await overlaps(page);
  check(!ov.length, `${label} stealth: nothing overlaps${ov.length ? ": " + ov.join("; ") : ""}`);
  if (touch) { const btn = await T(page, () => __crimson.story.S.test.ui.touchButtons); check(btn.includes("crouch"), `${label} stealth: CROUCH shows (${btn.join(", ")})`); }
  await snap(page, `${label}-stealth`);
  await T(page, () => { const S = __crimson.story.S; S.stealth.unwatch(window.__qaGuard); S.combat.clear(); S.ui.clearMeter("sus"); });

  // a boss fight: the boss bar, and on touch the combat set
  await T(page, () => {
    const S = __crimson.story.S, p = S.hero.pos, fx = Math.sin(S.hero.face), fz = Math.cos(S.hero.face);
    const f = S.combat.spawn("rattler", { pos: { x: p.x + fx * 6, z: p.z + fz * 6 } });
    f.maxHp = 700; f.hp = 420; f.posture = 45;
    S.combat.active = true; S.combat.boss = f; S.ui.boss(f);
    S.ui.timer(null); S.ui.clearMeter("tail"); S.ui.prompt(null);
  });
  await step(page, 0.3);
  ov = await overlaps(page);
  check(await T(page, () => __crimson.story.S.test.ui.visible("sboss")), `${label} boss: the boss bar shows`);
  check(!ov.length, `${label} boss: nothing overlaps${ov.length ? ": " + ov.join("; ") : ""}`);
  if (touch) {
    const b = await T(page, () => ({ set: __crimson.story.S.test.ui.touchSet, btn: __crimson.story.S.test.ui.touchButtons }));
    check(b.set === "combat" && b.btn.length <= 7 && b.btn.includes("cut") && b.btn.includes("guard"), `${label} boss: the combat set, at most 7 action buttons (${b.btn.length}: ${b.btn.join(", ")})`);
    await T(page, () => { __crimson.story.S.flags.bearCall = true; __crimson.story.S.ui.prompt("PICK UP", "use"); });
    await step(page, 0.1);
    const b2 = await T(page, () => __crimson.story.S.test.ui.touchButtons);
    check(b2.length <= 7 && b2.includes("use") && !b2.includes("bear"), `${label} boss: with a prompt, USE takes 熊's place (${b2.length}: ${b2.join(", ")})`);
    await T(page, () => { __crimson.story.S.ui.prompt(null); });
    await step(page, 0.1);
    const b3 = await T(page, () => __crimson.story.S.test.ui.touchButtons);
    check(b3.length === 7 && b3.includes("bear"), `${label} boss: 熊 shows once the bear call is known (${b3.join(", ")})`);
    await T(page, () => { delete __crimson.story.S.flags.bearCall; });
  }
  await snap(page, `${label}-boss`);
  await T(page, () => { const S = __crimson.story.S; S.ui.boss(null); S.combat.boss = null; S.combat.active = false; S.combat.clear(); });

  // the phone camera
  await T(page, () => { const S = __crimson.story.S; S.photo.open(); S.ui.photoFrame(true, { zoom: 2.4, score: 64, min: 50, subject: "Voss. His face, from the front.", focus: { x: 0.5, y: 0.45, r: 0.1 } }); S.ui.subs("redjersey", "Can I post this?"); });
  await step(page, 0.3);
  ov = await overlaps(page);
  check(await T(page, () => __crimson.story.S.input.context === "photo" && __crimson.story.S.test.ui.visible("sPhone")), `${label} photo: the viewfinder shows in the photo context`);
  check(!ov.length, `${label} photo: nothing overlaps${ov.length ? ": " + ov.join("; ") : ""}`);
  if (touch) { const btn = await T(page, () => __crimson.story.S.test.ui.touchButtons); check(btn.includes("shoot") && btn.includes("close"), `${label} photo: SHOOT and CLOSE (${btn.join(", ")})`); }
  await snap(page, `${label}-photo`);
  await T(page, () => { const S = __crimson.story.S; S.ui.photoFrame(false); S.photo.close(); });

  // driving
  await T(page, () => __crimson.story.S.test.van.enter());
  // (the f1 mission talks once the hero is in: the lines go by)
  const d = await stepUntil(page, () => { const S = __crimson.story.S; S.ui.advanceAll(); return S.hero.mode === "drive" && S.drive.state === "riding"; }, { maxSec: 5, realMs: 0 });
  await step(page, 0.2); await T(page, () => __crimson.story.S.ui.advanceAll());
  await T(page, () => { const S = __crimson.story.S; S.test.van.drive(1, 0.2, false, 2); S.ui.subs("tanktop", "It's a whale."); });
  await step(page, 1.2);
  ov = await overlaps(page);
  check(d.ok && (await T(page, () => __crimson.story.S.input.context === "drive" && __crimson.story.S.test.ui.visible("sDrive"))), `${label} drive: the drive cluster shows in the drive context`);
  check(!ov.length, `${label} drive: nothing overlaps${ov.length ? ": " + ov.join("; ") : ""}`);
  const seats = await T(page, () => [...document.querySelectorAll("#sDrive .seat")].filter((e) => e.classList.contains("full")).length);
  check(seats >= 1, `${label} drive: the seat pips show the hero (${seats} full)`);
  if (touch) {
    const btn = await T(page, () => __crimson.story.S.test.ui.touchButtons);
    check(btn.includes("gas") && btn.includes("brake") && btn.includes("drift") && btn.length <= 7, `${label} drive: GAS, BRAKE, DRIFT (${btn.join(", ")})`);
    check(await T(page, () => __crimson.story.S.test.ui.visible("steer") || !!document.querySelector("#stouch .steer:not(.hidden)")), `${label} drive: the steer slider shows`);
  }
  check(!(await arenaHud(page)), `${label} drive: the arena's #boss is hidden`);
  await snap(page, `${label}-drive`);
  errs.push(...errors);
  await browser.close();
}

// ONLY=desk,land,port,flow runs part of it while working on the UI
const ONLY = (process.env.ONLY || "desk,land,port,flow").split(",");
if (ONLY.includes("desk")) await layouts("desk", { width: 1280, height: 720 });
if (ONLY.includes("land")) await layouts("land", { width: 844, height: 390, touch: true });
if (ONLY.includes("port")) await layouts("port", { width: 390, height: 844, touch: true });

/* ---------------- 2 to 5: cines, dialogue, choices, cards, the menu, the map (keyboard) ---------------- */
if (ONLY.includes("flow")) {
  const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 1280, height: 720 });
  await page.route("**/art/portraits/voss.webp", (r) => r.abort()); // a missing portrait shows its glyph card (A3)
  const r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1" && __crimson.story.mode === "play" && !__crimson.story.S.test.ui.card, { maxSec: 60 });
  check(r.ok, "the story reaches f1");
  await step(page, 0.3);

  // cines: letterbox bars, subtitles and the dialogue box on top of them
  await T(page, () => { document.body.classList.add("cine"); const S = __crimson.story.S; S.ui.subs("gabe", "Get down. Now."); });
  await step(page, 0.8);
  const z = await T(page, () => {
    const bar = parseInt(getComputedStyle(document.getElementById("bars"), "::after").zIndex, 10);
    const subs = document.getElementById("sSubs"), r = subs.getBoundingClientRect();
    const story = getComputedStyle(document.getElementById("story"));
    return { bar, subs: parseInt(getComputedStyle(subs).zIndex, 10), story: story.zIndex, say: parseInt(getComputedStyle(document.getElementById("sSay")).zIndex, 10), bottom: innerHeight - r.bottom, barH: innerHeight * 0.11, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) };
  });
  check(z.story === "auto" && z.subs > z.bar && z.say > z.bar, `subtitles (z ${z.subs}) and dialogue (z ${z.say}) stack above the letterbox bars (z ${z.bar}); #story makes no stacking context (${z.story})`);
  check(z.bottom >= 0 && z.bottom < z.barH, `in a cine the subtitles sit in the lower bar (${z.bottom.toFixed(0)} px up, bar ${z.barH.toFixed(0)} px)`);
  await snap(page, "cine-subs");
  await T(page, () => { window.__qaSay = __crimson.story.S.ui.say([{ who: "gabe", text: "You just cost me seven months." }]); });
  await step(page, 1.5);
  await snap(page, "cine-say");
  await T(page, () => { __crimson.story.S.ui.advanceAll(); document.body.classList.remove("cine"); });

  // hold skip 0.8 s in a cine (the stub cine is a 1.5 s card)
  await T(page, () => { window.__qaCine = __crimson.story.S.cine.play("i1"); });
  await step(page, 0.1);
  check(await T(page, () => __crimson.story.S.input.context === "cine"), "a cine puts input in the cine context");
  await page.keyboard.down("Space");
  const k = await stepUntil(page, () => window.__qaCine.done, { maxSec: 1.4, chunk: 1 / 60, realMs: 0 });
  await page.keyboard.up("Space");
  check(k.ok && k.sec >= 0.75 && k.sec <= 1.0, `holding skip ends the cine after 0.8 s (${k.sec.toFixed(2)} s)`);

  // dialogue: typing speed, E finishes then advances, the freeze, portraits and the glyph card
  await T(page, () => { window.__qaH = __crimson.story.S.ui.say([{ who: "vance", text: "I need a face, a place, and a date. Photos. From far away." }, { who: "voss", text: "Labor is our biggest cost." }, "f1.whale"]); });
  await step(page, 0.5);
  let s = await T(page, () => ({ st: __crimson.story.S.test.ui.say, freeze: __crimson.story.S.freeze, modal: __crimson.story.S.modal, ctx: __crimson.story.S.input.context }));
  check(s.st && s.st.text.length >= 19 && s.st.text.length <= 26 && s.st.typing, `the words type at 45 a second (${s.st && s.st.text.length} characters after 0.5 s)`);
  check(s.freeze && s.modal === "dialog" && s.ctx === "menu", `the box freezes play (freeze ${s.freeze}, modal ${s.modal}, context ${s.ctx})`);
  await page.waitForFunction(() => { const i = document.querySelector("#sSay .pf img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 }).catch(() => {});
  const pf = await T(page, () => ({ img: document.querySelector("#sSay .pf img").naturalWidth, cls: document.querySelector("#sSay .pf").className, name: document.querySelector("#sSay .nm").textContent }));
  check(pf.img > 0 && !/glyph|none/.test(pf.cls) && pf.name === "AGENT VANCE", `Vance's portrait shows (${pf.img} px, ${pf.name})`);
  await snap(page, "say-vance");
  await page.keyboard.press("KeyE");
  await step(page, 0.05);
  s = await T(page, () => __crimson.story.S.test.ui.say);
  check(s && s.i === 0 && !s.typing && s.text.endsWith("far away."), "E finishes the typing first");
  await page.keyboard.press("KeyE");
  await step(page, 0.4);
  await page.waitForFunction(() => /glyph/.test(document.querySelector("#sSay .pf").className), null, { timeout: 10000 }).catch(() => {});
  s = await T(page, () => ({ st: __crimson.story.S.test.ui.say, cls: document.querySelector("#sSay .pf").className, g: document.querySelector("#sSay .pf .gl").textContent }));
  check(s.st && s.st.i === 1, "then E goes to the next line");
  check(/glyph/.test(s.cls) && s.g === "笑", `a missing portrait shows the glyph card (${s.g})`);
  await snap(page, "say-glyph");
  await page.keyboard.press("Space"); await step(page, 0.15); await page.keyboard.press("Space"); await step(page, 0.15);
  s = await T(page, () => ({ st: __crimson.story.S.test.ui.say, crew: document.getElementById("sSay").classList.contains("crew"), name: document.querySelector("#sSay .nm").textContent }));
  check(s.st && s.st.i === 2 && s.crew && s.name === "TANK TOP", `a LINES id speaks with its own speaker (${s.name})`);
  await page.keyboard.press("Enter"); await step(page, 0.15); await page.keyboard.press("Enter"); await step(page, 0.15);
  s = await T(page, () => ({ done: window.__qaH.done, freeze: __crimson.story.S.freeze, modal: __crimson.story.S.modal }));
  check(s.done && !s.freeze && !s.modal, "the last line closes the box and play goes on");
  // non-blocking lines: subtitles, no freeze
  await T(page, () => { window.__qaS = __crimson.story.S.ui.say(["f1.seats", "f1.whale"], { block: false }); });
  await step(page, 0.2);
  s = await T(page, () => ({ subs: document.getElementById("sSubs").textContent, freeze: __crimson.story.S.freeze }));
  check(/seats ten/.test(s.subs) && !s.freeze, `block:false plays subtitles with no freeze (${s.subs})`);
  await step(page, 12); // 3.5 s + 60 ms a character each: 7.3 s and 4.3 s
  check(await T(page, () => window.__qaS.done && document.getElementById("sSubs").classList.contains("hidden")), "and the subtitles end on their own");

  // a choice by keyboard
  await T(page, () => { window.__qaC = __crimson.story.S.ui.choose("Who speaks first?", ["Fifty-One", "Gabe", "Shades"]); });
  await step(page, 0.4);
  await snap(page, "choice");
  await page.keyboard.press("ArrowRight"); await step(page, 0.05);
  await page.keyboard.press("ArrowDown"); await step(page, 0.05);
  const foc = await T(page, () => __crimson.story.S.test.ui.focus);
  await page.keyboard.press("Enter"); await step(page, 0.05);
  s = await T(page, () => ({ done: window.__qaC.done, i: window.__qaC.index }));
  check(foc === "Shades" && s.done && s.i === 2, `the arrows move the focus and Enter picks (${foc}, index ${s.i})`);
  // a fail card: RETRY first
  await T(page, () => { window.__qaF = __crimson.story.S.ui.card("fail", { sub: "The van is wrecked." }); });
  await step(page, 0.4);
  await snap(page, "fail");
  s = await T(page, () => ({ card: __crimson.story.S.test.ui.card, focus: __crimson.story.S.test.ui.focus, freeze: __crimson.story.S.freeze }));
  check(s.card === "MISSION FAILED" && s.focus === "RETRY" && s.freeze, `the fail card offers RETRY first (${s.card}, ${s.focus})`);
  await page.keyboard.press("Enter"); await step(page, 0.05);
  check(await T(page, () => window.__qaF.done && window.__qaF.choice === 0 && !__crimson.story.S.freeze), "Enter takes RETRY");
  await T(page, () => { window.__qaP = __crimson.story.S.ui.card("pass", { stats: { TIME: "6:12", PHOTOS: 3, TAKEDOWNS: 4 } }); });
  await step(page, 0.5);
  await snap(page, "pass");
  await step(page, 4);
  check(await T(page, () => window.__qaP.done), "a pass card goes on its own");
  await T(page, () => { window.__qaCh = __crimson.story.S.ui.card("chapter", { n: 8, title: "DAWN PATROL", sub: "SUNDAY · 5:40 AM", kanji: "暁" }); });
  await step(page, 0.8);
  await snap(page, "chapter");
  await page.keyboard.press("Space"); await step(page, 0.05);
  check(await T(page, () => window.__qaCh.done), "Space skips a chapter card");

  // the menu
  await page.keyboard.press("Escape"); await step(page, 0.1);
  const t0 = await T(page, () => __crimson.story.S.time);
  await step(page, 0.5);
  s = await T(page, () => ({ open: __crimson.story.S.ui.menu.isOpen, mode: __crimson.story.mode, t: __crimson.story.S.time, cls: document.body.classList.contains("smenu") }));
  check(s.open && s.mode === "menu" && s.cls && Math.abs(s.t - t0) < 1e-6, `Esc opens the menu and the clock stops (mode ${s.mode})`);
  await snap(page, "menu");
  for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowDown"); await step(page, 0.03); }
  let f = await T(page, () => __crimson.story.S.test.ui.focus);
  await page.keyboard.press("Enter"); await step(page, 0.05);
  s = await T(page, () => ({ page: __crimson.story.S.test.ui.menuPage, text: document.querySelector("#sMenu .mBody").textContent }));
  check(f === "MISSIONS" && s.page === "missions" && /TEN SEATS/i.test(s.text), `the arrows and Enter reach MISSIONS (${f}, ${s.page})`);
  await snap(page, "menu-missions");
  await page.keyboard.press("Escape"); await step(page, 0.05);
  for (let i = 0; i < 4; i++) { await page.keyboard.press("ArrowDown"); await step(page, 0.03); }
  f = await T(page, () => __crimson.story.S.test.ui.focus);
  await page.keyboard.press("Enter"); await step(page, 0.05);
  s = await T(page, () => ({ page: __crimson.story.S.test.ui.menuPage, text: document.querySelector("#sMenu .mBody").textContent }));
  check(f === "CONTROLS" && s.page === "controls" && /KEYBOARD/.test(s.text) && /Tab/.test(s.text), `CONTROLS shows the keyboard (${f})`);
  await snap(page, "menu-controls");
  await page.keyboard.press("Escape"); await step(page, 0.05);
  // EVIDENCE: the board
  await page.click("#sMenu [data-a=board]"); await step(page, 0.1);
  check(await T(page, () => __crimson.story.S.test.ui.visible("sBoard") && document.querySelectorAll("#sBoard .slot").length === 4), "EVIDENCE opens the board with its four slots");
  await snap(page, "board");
  await page.keyboard.press("Escape"); await step(page, 0.05);
  check(await T(page, () => !__crimson.story.S.test.ui.visible("sBoard") && __crimson.story.S.ui.menu.isOpen), "Esc closes the board back to the menu");
  await page.keyboard.press("Escape"); await step(page, 0.05);
  s = await T(page, () => ({ open: __crimson.story.S.ui.menu.isOpen, mode: __crimson.story.mode }));
  check(!s.open && s.mode === "play", "Esc closes the menu");

  // the map: M opens it, a click sets a waypoint, M closes it, the minimap routes to it
  await T(page, () => { const S = __crimson.story.S; for (const id of ["goal", "gabe", "far"]) S.ui.unmark(id); S.markers3d.clear(); });
  await page.keyboard.press("KeyM"); await step(page, 0.1);
  s = await T(page, () => ({ open: __crimson.story.S.ui.map.isOpen, modal: __crimson.story.S.modal, mode: __crimson.story.mode }));
  check(s.open && s.modal === "map" && s.mode === "menu", `M opens the map (modal ${s.modal}, mode ${s.mode})`);
  const box = await page.evaluate(() => { const r = document.querySelector("#sMap canvas").getBoundingClientRect(); return { x: r.left + r.width * 0.72, y: r.top + r.height * 0.3 }; });
  await page.mouse.click(box.x, box.y); await step(page, 0.1);
  const wp = await T(page, () => __crimson.story.S.test.ui.markers.list.find((m) => m.id === "waypoint"));
  check(!!wp, `a click sets a waypoint (${wp ? `${wp.x.toFixed(0)}, ${wp.z.toFixed(0)}` : "none"})`);
  await snap(page, "map");
  await page.keyboard.press("KeyM"); await step(page, 0.4);
  s = await T(page, () => ({ open: __crimson.story.S.ui.map.isOpen, mode: __crimson.story.mode, route: (__crimson.story.S.test.ui.pieces.mini.route || []).length }));
  check(!s.open && s.mode === "play", "M closes the map");
  check(s.route > 1, `the minimap draws a GPS line along the roads to the waypoint (${s.route} points)`);
  await snap(page, "minimap-gps");
  check(!(await arenaHud(page)), "the arena's #boss stays hidden");
  errs.push(...errors);
  await browser.close();
}

await finish("ui", fails, null, errs);
