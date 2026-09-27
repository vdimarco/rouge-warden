// The story with a gamepad (navigator.getGamepads is stubbed with a standard-mapping pad the test holds):
// 1. The left stick moves the hero; prompts show pad buttons (Y).
// 2. Start opens the menu; the d-pad moves the focus, A picks (MISSIONS), B goes back, B resumes.
// 3. Choices and cards: the d-pad and A pick; a fail card takes RETRY with A.
// 4. Dialogue: A finishes the typing, then goes on, then closes.
// 5. Back opens the map; the d-pad moves its cursor, A sets a waypoint, B closes it.
// 6. Driving: RT is the gas, the left stick steers, LT brakes, Y gets out.
// 7. Holding A for 0.8 s skips a cine.
// No page errors.
import { open, step, stepUntil, finish, freeRoam } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 1280, height: 720 });
const T = (fn, arg) => page.evaluate(fn, arg);
// the pad: a standard mapping with 17 buttons and 4 axes
await T(() => {
  const btn = () => ({ pressed: false, touched: false, value: 0 });
  window.__pad = { id: "QA pad (standard)", index: 0, connected: true, mapping: "standard", timestamp: 0, buttons: Array.from({ length: 17 }, btn), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => [window.__pad, null, null, null];
});
const btn = (i, on) => T(([i, on]) => { const b = window.__pad.buttons[i]; b.pressed = on; b.value = on ? 1 : 0; window.__pad.timestamp++; }, [i, on]);
const axes = (a) => T((a) => { window.__pad.axes = a; }, a);
const tapBtn = async (i) => { await btn(i, true); await step(page, 1 / 60); await btn(i, false); await step(page, 3 / 60); };
const A = 0, B = 1, Y = 3, LT = 6, RT = 7, BACK = 8, START = 9, UP = 12, DOWN = 13, RIGHT = 15;

const r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1" && __crimson.story.mode === "play" && !__crimson.story.S.test.ui.card, { maxSec: 60 });
check(r.ok, "the story reaches f1");
check((await freeRoam(page)).ok, "free roam: F1's mission quit, nothing modal");
await step(page, 0.3);

/* ---------------- 1: the stick, and pad prompts ---------------- */
const p0 = await T(() => __crimson.story.S.hero.pos.toArray());
await axes([0, -1, 0, 0]); await step(page, 1); await axes([0, 0, 0, 0]);
const p1 = await T(() => __crimson.story.S.hero.pos.toArray());
check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1.2 && (await T(() => __crimson.story.S.input.device)) === "pad", `the left stick moves the hero (${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1)} m)`);
await T(() => __crimson.story.S.ui.prompt("OPEN", "use")); await step(page, 0.1);
check((await T(() => document.querySelector("#sPrompt kbd").textContent)) === "Y", "prompts show the pad's Y");
await T(() => __crimson.story.S.ui.prompt(null));

/* ---------------- 2: the menu ---------------- */
await tapBtn(START);
check(await T(() => __crimson.story.S.ui.menu.isOpen && __crimson.story.mode === "menu"), "Start opens the menu");
for (let i = 0; i < 3; i++) await tapBtn(DOWN);
const f = await T(() => __crimson.story.S.test.ui.focus);
await tapBtn(A);
check(f === "MISSIONS" && (await T(() => __crimson.story.S.test.ui.menuPage)) === "missions", `the d-pad and A reach MISSIONS (${f})`);
check(/CONTROLLER|MISSIONS/.test(await T(() => document.querySelector("#sMenu .mBody").textContent)), "the page shows");
await tapBtn(B);
check((await T(() => __crimson.story.S.test.ui.menuPage)) === "main", "B goes back");
for (let i = 0; i < 4; i++) await tapBtn(DOWN);
await tapBtn(A);
check(/CONTROLLER/.test(await T(() => document.querySelector("#sMenu .mBody").textContent)), "CONTROLS shows the controller");
await tapBtn(B); await tapBtn(B);
check(await T(() => !__crimson.story.S.ui.menu.isOpen && __crimson.story.mode === "play"), "B resumes");

/* ---------------- 3: choices and cards ---------------- */
await T(() => { window.__c = __crimson.story.S.ui.choose("Who speaks first?", ["Fifty-One", "Gabe"]); });
await step(page, 0.3);
await tapBtn(RIGHT); await tapBtn(A);
check(await T(() => window.__c.done && window.__c.index === 1), "the d-pad and A pick a choice");
await T(() => { window.__f = __crimson.story.S.ui.card("fail", { sub: "The van is wrecked." }); });
await step(page, 0.3);
await tapBtn(A);
check(await T(() => window.__f.done && window.__f.choice === 0), "A takes RETRY on a fail card");

/* ---------------- 4: dialogue ---------------- */
await T(() => { window.__s = __crimson.story.S.ui.say([{ who: "gabe", text: "You just cost me seven months." }, { who: "fifty", text: "Seven months of what?" }]); });
await step(page, 0.2);
await tapBtn(A);
let s = await T(() => __crimson.story.S.test.ui.say);
check(s && s.i === 0 && !s.typing, "A finishes the typing");
await step(page, 0.1); await tapBtn(A);
s = await T(() => __crimson.story.S.test.ui.say);
check(s && s.i === 1, "A goes to the next line");
await step(page, 0.1); await tapBtn(A); await step(page, 0.1); await tapBtn(A);
check(await T(() => window.__s.done && !__crimson.story.S.freeze), "and A closes the box");

/* ---------------- 5: the map ---------------- */
await tapBtn(BACK);
check(await T(() => __crimson.story.S.ui.map.isOpen), "Back opens the map");
await btn(RIGHT, true); await step(page, 0.6); await btn(RIGHT, false); await step(page, 0.05);
await tapBtn(A);
const wp = await T(() => __crimson.story.S.test.ui.markers.list.find((m) => m.id === "waypoint"));
const hp = await T(() => __crimson.story.S.hero.pos.toArray());
check(!!wp && wp.x > hp[0] + 20, `the d-pad moves the cursor and A sets a waypoint east of the hero (${wp ? wp.x.toFixed(0) : "none"} vs ${hp[0].toFixed(0)})`);
await tapBtn(B);
check(await T(() => !__crimson.story.S.ui.map.isOpen && __crimson.story.mode === "play"), "B closes the map");

/* ---------------- 6: driving ---------------- */
await T(() => __crimson.story.S.test.van.enter());
const e = await stepUntil(page, () => { const S = __crimson.story.S; S.ui.advanceAll(); return S.hero.mode === "drive" && S.drive.state === "riding"; }, { maxSec: 5, realMs: 0 });
await step(page, 0.3); await T(() => __crimson.story.S.ui.advanceAll());
check(e.ok && (await T(() => __crimson.story.S.input.context)) === "drive", "in the van, input is in the drive context");
await btn(RT, true); await step(page, 2);
const sp = await T(() => __crimson.story.S.vehicles.player.speed);
check(sp > 3, `RT is the gas (${sp.toFixed(1)} m/s)`);
const y0 = await T(() => __crimson.story.S.vehicles.player.yaw);
await axes([1, 0, 0, 0]); await step(page, 1); await axes([0, 0, 0, 0]);
const y1 = await T(() => __crimson.story.S.vehicles.player.yaw);
check(Math.abs(Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0))) > 0.1, `the left stick steers (${Math.abs(y1 - y0).toFixed(2)} rad)`);
await btn(RT, false); await btn(LT, true);
const stop = await stepUntil(page, () => Math.abs(__crimson.story.S.vehicles.player.speed) < 0.5, { maxSec: 6, chunk: 0.1, realMs: 0 });
await btn(LT, false); await step(page, 0.2);
check(stop.ok, "LT brakes to a stop");
check((await T(() => document.querySelector("#sPrompt kbd").textContent)) === "Y", "the GET OUT prompt shows Y");
await tapBtn(Y);
const out = await stepUntil(page, () => __crimson.story.S.hero.mode === "foot", { maxSec: 4, realMs: 0 });
check(out.ok, "Y gets out");

/* ---------------- 7: hold A to skip a cine ---------------- */
await T(() => { window.__cine = __crimson.story.S.cine.play("i1"); });
await step(page, 0.1);
await btn(A, true);
const k = await stepUntil(page, () => window.__cine.done, { maxSec: 1.4, chunk: 1 / 60, realMs: 0 });
await btn(A, false);
check(k.ok && k.sec >= 0.75 && k.sec <= 1.0, `holding A ends the cine after 0.8 s (${k.sec.toFixed(2)} s)`);

await finish("pad", fails, browser, errors);
