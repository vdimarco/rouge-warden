// The screens and the feel of the places and the big fish, in the real game on a phone, with staged fights:
//   the fight prompts in their order, the loss lines, "Big fish on!" and the reveal, the sound and the buzz of each move,
//   the catch card (size line, badges, count-up, photo beat), the unlock beat, the derby results, the journal, the goal
//   reminders, and the old-save toast. And the fight polish: the prompt hold, the toast queue and its place away from the
//   crank, SLACK and the readable gauge, one set of words for each move, the loss beat and its lines, and the first fish.
// The fish and the fight model (fish.js, WP2) are not needed: the test puts a stand-in for the sim into G.sim with the
// same state and the same events (plan section 3.4), so the screens can be checked one by one.
// Run: cd public && python3 -m http.server 8765 &   then   node qa/fish/screens.mjs     (FISH_URL for another address;
// PARTS=H for some parts only)
// Where the world has no setPlace yet (before the merge), a stand-in is used for it.
import { createRequire } from "module";
import { open, sleep } from "./lib.mjs";
import { sizeRank } from "../../public/fish/js/fish.js";
import { byId } from "../../public/fish/js/species.js";
import { rankFor } from "../../public/fish/js/journey.js";
import { DAILY, dailyGoal, todayLine, dayOf, prevDay } from "../../public/fish/js/goals.js";
import { loadSave } from "../../public/fish/js/save.js";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const kgText = (kg) => (kg < 1 ? kg.toFixed(2) : kg.toFixed(1)) + " kg";
const wait = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 40 });
const PAUSE = 350;   // the double-tap guard ignores a click in the first 300 ms of a screen
// PARTS=A,H runs only those parts
const PARTS = process.env.PARTS ? process.env.PARTS.split(",") : null, part = (p) => !PARTS || PARTS.includes(p);

/* ---------- staging a fight ---------- */
// G.sim becomes a stand-in with the shape of LakeSim's state. patch is merged in (patch.fish into the fish, fish: null for none).
// events go to handleEvent in the next frame. fresh: start a new stage (the fight state of a fish on the line)
async function stage(page, patch = {}, events = [], fresh = true) {
  await page.evaluate(([patch, events, fresh]) => {
    const G = FISH.G;
    if (fresh || !G.sim || !G.sim.fake) {
      G.lastEvent = {}; G.walk = false; G.thrownBy = ""; G.slipAt = 0; G.rubDir = null; G.hold = null;
      G.sim = { fake: true, events: [], step() {}, state: {
        phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3,
        fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true },
      } };
      G.bail = "closed";
      if (G.phase !== "reel") FISH.enterReel();
    }
    const s = G.sim.state, { fish, ...rest } = patch;
    Object.assign(s, rest);
    if (fish === null) s.fish = null; else if (fish) Object.assign(s.fish, fish);
    G.sim.events.push(...events);
  }, [patch, events, fresh]);
  // the events are taken in the next frame
  await wait(page, () => !FISH.G.sim || !FISH.G.sim.fake || FISH.G.sim.events.length === 0);
}
const promptNow = (page) => page.evaluate(() => { const p = document.querySelector("#prompt"); return p.hidden ? null : { h: p.querySelector(".p1 span").textContent, sub: p.querySelector(".p2").textContent, cls: p.className }; });
// stage a fight and wait until the prompt says the headline
async function prompts(page, patch, events, headline) {
  await stage(page, patch, events);
  try { await wait(page, (h) => { const p = document.querySelector("#prompt"); return !p.hidden && p.querySelector(".p1 span").textContent === h; }, headline, 12000); } catch (e) { /* the check below says what it saw */ }
  return promptNow(page);
}
const logNow = (page) => page.evaluate(() => window.__log.slice());
const logClear = (page) => page.evaluate(() => { window.__log.length = 0; });
async function spy(page) {
  await page.evaluate(() => {
    const log = (window.__log = []);
    for (const [obj, names, tag] of [[FISH.Sound, ["sfx", "setGrind"], "S"], [FISH.Haptics, ["bump", "thump", "throb", "rub", "thrash", "charge", "phase", "jolt", "surge", "land", "hookset", "splash", "turn", "big", "shutter"], "H"]]) {
      for (const n of names) { const f = obj[n]; obj[n] = function (...a) { log.push([tag + "." + n, ...a]); return f.apply(this, a); }; }
    }
  });
}
const has = (log, name, arg) => log.some((l) => l[0] === name && (arg === undefined || l[1] === arg));
// toasts wait in a short queue (each stays up 1.2 s): wait until the toast says this, then return what it says
async function toastIs(page, text, ms = 6000) {
  await wait(page, (t) => document.querySelector("#toast").textContent === t && document.querySelector("#toast").classList.contains("on"), text, ms).catch(() => {});
  return page.evaluate(() => document.querySelector("#toast").textContent);
}

/* ---------- the catch card ---------- */
// stage a catch and wait for the card. Returns what the card shows, and what the count-up did
async function catchCard(page, c, { wait: waitFor = true } = {}) {
  await page.evaluate((c) => {
    window.__ck = [];
    const el = document.querySelector("#ckg");
    window.__ckObs && window.__ckObs.disconnect();
    window.__ckObs = new MutationObserver(() => window.__ck.push(el.textContent));
    window.__ckObs.observe(el, { childList: true, characterData: true, subtree: true });
    window.__flashes = 0; window.__photoFlashes = 0;
    window.__flashObs && window.__flashObs.disconnect();
    window.__flashObs = new MutationObserver((l) => { window.__flashes += l.filter((m) => m.target.classList.contains("go")).length; if (l.some((m) => m.target.classList.contains("go") && m.target.classList.contains("photo"))) window.__photoFlashes++; });
    window.__flashObs.observe(document.querySelector("#flash"), { attributes: true, attributeFilter: ["class"] });
    window.__log.length = 0;
  }, c);
  await stage(page, { phase: "caught", catch: c, fish: null });
  await wait(page, () => !document.querySelector("#catch").hidden);
  const t0 = Date.now();
  if (waitFor) {
    // the card is up when the photo beat is over and the count-up has finished
    await wait(page, () => !FISH.G.cardWait, null, 20000);
    if (!c.junk) await wait(page, (kg) => { const t = document.querySelector("#ckg").dataset.kg; return t === String(kg) && /kg/.test(document.querySelector("#ckg").textContent); }, c.kg, 20000);
    await sleep(500);
  }
  const card = await page.evaluate(() => ({
    name: document.querySelector("#cname").textContent, badges: [...document.querySelectorAll("#cbadges .badge")].map((b) => b.textContent),
    kg: document.querySelector("#ckg").textContent, size: document.querySelector("#csize").textContent, old: document.querySelector("#cold").textContent, found: document.querySelector("#cfound").textContent,
    cap: document.querySelector("#ccap").textContent, btn: document.querySelector("#catchGo").textContent,
    photo: document.querySelector("#catch .card").classList.contains("photo"), waiting: document.querySelector("#catch").classList.contains("wait"),
    ck: window.__ck.slice(), flashes: window.__flashes, photoFlashes: window.__photoFlashes, phase: FISH.G.phase,
  }));
  card.ms = Date.now() - t0;
  return card;
}
const expectSize = (sp, kg) => { const r = sizeRank(sp, kg); return r >= 0.99 ? "Bigger than 99 in 100 of its kind." : r >= 0.95 ? "Bigger than 19 in 20 of its kind." : r >= 0.9 ? "Bigger than 9 in 10 of its kind." : r >= 0.75 ? "Bigger than 3 in 4 of its kind." : ""; };
const click = async (page, sel) => { await sleep(PAUSE); await page.click(sel); };
// Start on the arrival card goes to the water: free fishing at the new place (after Use touch, the first time, since the
// tests start play with FISH.startMode and never pick motion or touch). Then back to the title, where the checks go on.
// Returns what Start began
async function arrivalStart(page) {
  await click(page, "#aStart");
  await wait(page, () => FISH.G.phase === "cast" || !document.querySelector("#setup").hidden);
  if (await page.isVisible("#setup")) await click(page, "#useTouch");
  await wait(page, () => FISH.G.phase === "cast");
  const at = await page.evaluate(() => ({ phase: FISH.G.phase, mode: FISH.G.mode, place: FISH.place.id }));
  await page.evaluate(() => FISH.toTitle());
  await page.waitForSelector("#title:not([hidden])");
  return at;
}
// a cast that lands at (x, z) (land: "water" or another ground), as release() would leave it: cast is G.cast (its verdict),
// derby casts count down. Returns the report and the sim it started
async function landAt(page, x, z, { cast = null, land = "water" } = {}) {
  await page.evaluate(([x, z, cast, land]) => {
    const G = FISH.G;
    FISH.newCast();
    G.cast = cast; G.casts++; if (G.mode === "derby") G.castsLeft--;
    G.step = "flight"; G.flight = { step: () => ({ x, y: 0, z, done: true, land, lineOut: Math.hypot(x, z), spool: 0 }) };
  }, [x, z, cast, land]);
  await wait(page, (w) => (w ? FISH.G.phase === "reel" : FISH.G.step === "ashore"), land === "water");
  return page.evaluate(() => ({ zone: document.querySelector("#report .zone").textContent, streak: document.querySelector("#report").classList.contains("streak"), ring: !!FISH.G.ring, plan: FISH.G.sim && FISH.G.sim.plan ? { id: FISH.G.sim.plan.id, kg: FISH.G.sim.plan.kg } : null }));
}
// every toast the page shows, in order
const logToasts = (page) => page.evaluate(() => {
  window.__toasts = [];
  const el = document.querySelector("#toast"), d = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  Object.defineProperty(el, "textContent", { get() { return d.get.call(this); }, set(v) { window.__toasts.push(v); d.set.call(this, v); }, configurable: true });
});
const toastsNow = (page) => page.evaluate(() => window.__toasts.slice());

const stand = async (page) => {
  if (!(await page.evaluate(() => typeof FISH.world.setPlace === "function"))) {
    console.log("NOTE this world has no setPlace yet: a stand-in stands in");
    await page.evaluate(() => { FISH.world.setPlace = async () => ({ ms: 0 }); });
  }
};

/* ================= part A: a fresh save at Loon Lake ================= */
if (part("A")) {
  const { browser, page, errors } = await open({ query: "?debug" });
  try {
    await stand(page);
    await spy(page);
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    // ---- the goal reminder ----
    const goal = "Goal: land a fish of 3.5 kg or more. It opens Stump Bay.";
    check(await page.evaluate((g) => document.querySelector("#toast").textContent === g && document.querySelector("#toast").classList.contains("on"), goal), "a mode starts with the goal as a toast (" + (await page.textContent("#toast")) + ")");
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await wait(page, () => !document.querySelector("#pause").hidden);
    const sum = await page.textContent("#pauseSum");
    check(/^Free fishing · 0 fish · 0\.00 kg\n/.test(sum) && sum.endsWith(goal), "the pause summary has the goal (" + JSON.stringify(sum) + ")");
    await click(page, "#resumeBtn");
    check(await page.evaluate(() => FISH.G.phase === "cast" && !FISH.G.paused), "Resume goes on");

    // ---- the fight prompts, in their order (touch) ----
    console.log("     fight prompts (touch)");
    // the state of Big Blue's first stage (species.js): its banner says "Let it go"
    const BLUE = { n: 1, of: 3, name: "It runs! Let it go. Hold the rod up.", at: [0.6, 0.3] };
    const T = [
      ["land", { phase: "land" }, [], "Lift it out!", "Drag the rod up and hold."],
      ["jump", { fish: { move: "jump" } }, [], "It jumped! Lower the rod!", "Drag the rod down."],
      ["a tail walk", { fish: { move: "jump" } }, [{ type: "walk", n: 3 }], "It jumps again and again!", "Drag the rod down."],
      ["the line on a stump, steer right", { rub: 0.4, rubKind: "stump", rubSide: 1 }, [], "The line is on a stump! Steer right.", "Drag the rod right."],
      ["the line on the logs, steer left", { rub: 0.4, rubKind: "logs", rubSide: -1 }, [], "The line is on the logs! Steer left.", "Drag the rod left."],
      ["the line on the rocks", { rub: 0.4, rubKind: "rocks", rubSide: 0 }, [], "The line is on the rocks! Hold the rod up.", "Drag the rod sideways."],
      ["the line in the weeds", { rub: 0.4, rubKind: "weeds", rubSide: -1 }, [], "It is in the weeds! Steer left.", "Drag the rod left."],
      ["a rub below 0.15 is not said", { rub: 0.1, rubKind: "stump", rubSide: 1 }, [], "Pump and reel.", null],
      ["the last run", { fish: { move: "run" } }, [{ type: "lastrun" }], "It sees you! Let it run.", "Reel only if the line goes slack. Hold the rod up."],
      ["the last run comes at you and the line is slack", { fish: { move: "surge" }, slack: true }, [{ type: "lastrun" }], "Slack line! Reel it in.", "Keep the line tight."],
      ["a thrash", { fish: { move: "thrash" } }, [], "It shakes its head!", "Hold the rod up. Keep reeling slowly."],
      ["an ordinary head shake", { fish: { move: "shake" } }, [], "It shakes its head!", "Hold the rod up. Keep reeling slowly."],
      ["the shake just ended", { fish: { move: "swim" } }, [{ type: "shake" }], "It shakes its head!", "Hold the rod up. Keep reeling slowly."],
      ["a head shake with slack line", { fish: { move: "thrash" }, slack: true }, [], "Slack line! Reel it in.", "It shakes its head. Keep the rod up."],
      ["a head shake with slack line for only 0.2 s", { fish: { move: "shake" }, slack: true, slackT: 0.2 }, [], "It shakes its head!", "Hold the rod up. Keep reeling slowly."],
      ["the tuna's first run", { fish: { move: "run" }, boss: BLUE, fightT: 1, slack: true }, [], "It runs! Let it go.", "Hold the rod up. Reel only if the line goes slack."],
      ["a turn", { fish: { move: "turn" } }, [], "It turned. Stop reeling!", ""],
      ["a charge", { fish: { move: "charge" } }, [], "It swims at you! Reel fast.", "Reel until the line is tight."],
      ["too tight", { tfrac: 0.9 }, [], "Too tight! Stop reeling.", "Hold the rod up. Let the drag work."],
      ["the spool, while the drag slips", { spoolFrac: 0.8, slip: 0.5 }, [], "The spool is almost empty!", "Tap + to tighten the drag."],
      ["a rest", { fish: { move: "hold" } }, [], "It rests. Rest your arm.", "Keep the line tight."],
      ["a sulk", { fish: { move: "sulk" } }, [], "It holds on the bottom.", "Drag the rod up. Reel as it comes down."],
      ["cover: lily pads, steer left", { cover: { side: 1, steer: -1, kind: "pads" } }, [], "It swims to the lily pads!", "Drag the rod left."],
      ["cover: the stumps, steer right", { cover: { side: -1, steer: 1, kind: "stumps" } }, [], "It swims to the stumps!", "Drag the rod right."],
      ["cover: the wall", { cover: { side: 1, steer: -1, kind: "wall" } }, [], "It swims to the wall!", "Drag the rod left."],
      ["running", { slip: 0.6 }, [], "It is running. Let it go.", "Keep the rod up. Reel when it stops."],
      ["slack", { slack: true }, [], "Slack line! Reel it in.", ""],
      ["slack for less than 0.35 s is not said yet", { slack: true, slackT: 0.2 }, [], "Pump and reel.", null],
      ["beaten", { beaten: true }, [], "It is tired. Reel steadily.", "Slow down if the gauge says TOO TIGHT."],
      ["beaten, and the line goes slack: still green", { beaten: true, slack: true }, [], "It is tired. Reel a little faster.", "Keep the line tight."],
      ["the pump and reel", { fish: { move: "swim" } }, [], "Pump and reel.", "Drag the rod up. Reel as it comes down."],
      ["the strike", { phase: "strike", fish: null }, [], "SWIPE IT UP! Set the hook!", ""],
    ];
    for (const [name, patch, events, h, sub] of T) {
      const p = await prompts(page, patch, events, h);
      check(p && p.h === h && (sub === null || p.sub === sub), `prompt: ${name} -> "${h}"${sub ? ' / "' + sub + '"' : ""}` + (p && p.h === h && (sub === null || p.sub === sub) ? "" : " (got " + JSON.stringify(p) + ")"));
    }
    // the order: the first that applies wins
    console.log("     the order of the prompts");
    const O = [
      ["a jump beats a rub", { fish: { move: "jump" }, rub: 0.5, rubKind: "stump", rubSide: 1 }, [], "It jumped! Lower the rod!"],
      ["a rub beats the last run", { fish: { move: "run" }, rub: 0.5, rubKind: "logs", rubSide: 1 }, [{ type: "lastrun" }], "The line is on the logs! Steer right."],
      ["the last run beats a thrash", { fish: { move: "thrash" } }, [{ type: "lastrun" }], "It sees you! Let it run."],
      ["a thrash beats a turn and a charge", { fish: { move: "thrash" } }, [{ type: "turn" }], "It shakes its head!"],
      ["a turn beats a charge", { fish: { move: "charge" } }, [{ type: "turn" }], "It turned. Stop reeling!"],
      ["a charge beats too tight", { fish: { move: "charge" }, tfrac: 0.95 }, [], "It swims at you! Reel fast."],
      ["too tight beats the spool", { tfrac: 0.95, spoolFrac: 0.9 }, [], "Too tight! Stop reeling."],
      ["the spool beats a rest (while the drag slips)", { fish: { move: "hold" }, spoolFrac: 0.9, slip: 0.5 }, [], "The spool is almost empty!"],
      ["a full spool does not hide a rest (the drag is quiet)", { fish: { move: "hold" }, spoolFrac: 0.9 }, [], "It rests. Rest your arm."],
      ["a full spool does not hide a sulk", { fish: { move: "sulk" }, spoolFrac: 0.9 }, [], "It holds on the bottom."],
      ["the tuna's first run beats the running prompt", { fish: { move: "run" }, boss: BLUE, fightT: 1, slip: 0.6 }, [], "It runs! Let it go."],
      ["after 2.5 s the run is a plain run", { fish: { move: "run" }, boss: BLUE, fightT: 3, slip: 0.6 }, [], "It is running. Let it go."],
      ["a rest beats a sulk", { fish: { move: "hold" }, cover: { side: 1, steer: -1, kind: "pads" } }, [], "It rests. Rest your arm."],
      ["a sulk beats cover", { fish: { move: "sulk" }, cover: { side: 1, steer: -1, kind: "pads" } }, [], "It holds on the bottom."],
      ["cover beats running", { slip: 0.6, cover: { side: 1, steer: -1, kind: "rocks" } }, [], "It swims to the rocks!"],
      ["running beats slack", { slip: 0.6, slack: true }, [], "It is running. Let it go."],
      ["land beats everything", { phase: "land", fish: { move: "thrash" }, rub: 0.9, rubKind: "stump", rubSide: 1 }, [], "Lift it out!"],
    ];
    for (const [name, patch, events, h] of O) {
      const p = await prompts(page, patch, events, h);
      check(p && p.h === h, `order: ${name}` + (p && p.h === h ? "" : " (got " + JSON.stringify(p) + ")"));
    }
    // the tone: red for a warning, green when it is fine
    const tone = async (patch, ev, h) => { await prompts(page, patch, ev, h); return (await promptNow(page)).cls; };
    check((await tone({ fish: { move: "thrash" } }, [], "It shakes its head!")) === "hot" && (await tone({ fish: { move: "hold" } }, [], "It rests. Rest your arm.")) === "good", "a warning is red and a rest is green");
    check((await tone({ beaten: true, slack: true }, [], "It is tired. Reel a little faster.")) === "good", "a tired fish with slack line stays green");
    // a tail walk at the hook set (a legend's opening): the jump words show at once, over the "Fish on!" banner, and stay up
    // in the dash between two leaps until the walk ends. A hook set with no jump keeps its banner
    const shown = () => page.evaluate(() => ({ banner: !document.querySelector("#banner").hidden, prompt: getComputedStyle(document.querySelector("#prompt")).visibility }));
    await stage(page, { fish: { move: "jump" } }, [{ type: "hooked" }, { type: "walk", n: 3 }, { type: "jump" }]);
    await sleep(150);
    const w0 = { ...(await promptNow(page)), ...(await shown()) };
    // the last leap alone keeps the jump words for 900 ms of the game clock (recent("jump", 900) in main.js). Wait until
    // two frames have run past that, so that only the walk can keep them (a fixed sleep can see no frame on a busy machine)
    const pastJump = async () => {
      await wait(page, () => performance.now() - (FISH.G.lastEvent.jump || -1e9) > 900);
      const f = await page.evaluate(() => FISH.G.frame);
      await wait(page, (f) => FISH.G.frame >= f + 2, f);
    };
    await stage(page, { fish: { move: "swim" }, slack: true, slackT: 1 }, [], false);
    await pastJump();
    const w1 = await promptNow(page);
    await stage(page, { fish: { move: "swim" }, slack: true, slackT: 1 }, [{ type: "walkEnd" }], false);
    await pastJump();
    const w2 = await promptNow(page);
    check(w0.h === "It jumps again and again!" && w0.prompt === "visible" && !w0.banner, `a tail walk at the hook set: the jump words show at once, and the banner gives way (${JSON.stringify(w0)})`);
    check(w1 && w1.h === "It jumps again and again!", `between two leaps of the walk, with slack line, the jump words stay (${JSON.stringify(w1)})`);
    check(w2 && w2.h === "Slack line! Reel it in.", `after the walk ends, the slack words come back (${JSON.stringify(w2)})`);
    await stage(page, {}, [{ type: "hooked" }]);
    await sleep(200);
    const hs = await shown();
    check(hs.banner && hs.prompt === "hidden", `a hook set with no jump keeps "Fish on!" up (${JSON.stringify(hs)})`);

    // ---- the same with a phone in the hand (motion) ----
    console.log("     fight prompts (motion)");
    await page.evaluate(async () => { await FISH.Motion.request(); FISH.G.input = "motion"; });
    await wait(page, () => FISH.Motion.live, null, 10000);
    const M = [
      ["the line on a stump, steer right", { rub: 0.4, rubKind: "stump", rubSide: 1 }, [], "The line is on a stump! Steer right.", "Tilt the phone right."],
      ["cover: steer left", { cover: { side: 1, steer: -1, kind: "pads" } }, [], "It swims to the lily pads!", "Tilt the phone left."],
      ["the line on the rocks", { rub: 0.4, rubKind: "rocks", rubSide: 0 }, [], "The line is on the rocks! Hold the rod up.", "Tilt the phone left or right."],
    ];
    for (const [name, patch, events, h, sub] of M) {
      const p = await prompts(page, patch, events, h);
      check(p && p.h === h && p.sub === sub, `motion prompt: ${name}` + (p && p.h === h && p.sub === sub ? "" : " (got " + JSON.stringify(p) + ")"));
    }
    // one set of words for each move: a fish on the bottom in motion mode. The prompt sub, the guide caption and the rod
    // cue all say "Tip back as you reel." (the guide is turned on for this)
    const words = async (patch, h) => {
      await prompts(page, patch, [], h);
      await wait(page, () => { const g = document.querySelector("#fishGuide"); return g && !g.hidden && g.dataset.lesson !== "hold"; }, null, 5000).catch(() => {});
      await sleep(300);
      return page.evaluate(() => ({ sub: document.querySelector("#prompt .p2").textContent, guide: document.querySelector("#fishGuide").hidden ? null : document.querySelector("#fishGuide .guide-caption").textContent, cue: document.querySelector("#rodCue span").textContent }));
    };
    await page.evaluate(() => { if (document.querySelector("#guideToggle").getAttribute("aria-label") === "Show the moves guide") document.querySelector("#guideToggle").click(); });
    // the phone held at 60°: the rod is up
    await page.evaluate(() => { FISH.Motion.mode = "portrait"; window.__phone.pose(60); });
    let mw = await words({ fish: { move: "sulk" } }, "It holds on the bottom.");
    check(mw.sub === "Tip back as you reel." && mw.guide === mw.sub && mw.cue === mw.sub, `one word for each move: a fish on the bottom in motion mode, the prompt, the guide and the rod cue say "Tip back as you reel." (${JSON.stringify(mw)})`);
    mw = await words({ fish: { move: "swim" } }, "Pump and reel.");
    check(mw.sub === "Tip back as you reel." && mw.guide === mw.sub && mw.cue === mw.sub, `and so does the pump and reel (${JSON.stringify(mw)})`);
    mw = await words({ fish: { move: "jump" } }, "It jumped! Lower the rod!");
    check(mw.sub === "Lower the phone." && mw.guide === mw.sub && mw.cue === mw.sub, `a jump in motion mode: "Lower the phone." on all three (${JSON.stringify(mw)})`);
    mw = await words({ phase: "strike", fish: null }, "SNAP IT UP! Set the hook!");
    check(mw.guide === "Snap it up!" && mw.cue === "Snap it up!", `the strike in motion mode: "SNAP IT UP!" and "Snap it up!" (${JSON.stringify(mw)})`);
    await page.evaluate(() => { FISH.G.input = "touch"; });
    mw = await words({ fish: { move: "sulk" } }, "It holds on the bottom.");
    check(mw.sub === "Drag the rod up. Reel as it comes down." && mw.guide === mw.sub && mw.cue === mw.sub, `and in touch mode all three say "Drag the rod up. Reel as it comes down." (${JSON.stringify(mw)})`);
    mw = await words({ cover: { side: -1, steer: 1, kind: "stumps" } }, "It swims to the stumps!");
    check(mw.sub === "Drag the rod right." && mw.cue === mw.sub && mw.guide === "Drag the rod sideways.", `a steer: the prompt and the rod cue name the side, the guide says the move (${JSON.stringify(mw)})`);
    // the reel move: the guide and the rod cue say the pace the prompt asks for, and never the opposite of it
    const reelWords = async (patch, h) => { const x = await words(patch, h); return { ...x, h: (await promptNow(page) || {}).h }; };
    mw = await reelWords({ phase: "retrieve", fish: null }, "Turn the crank to reel.");
    check(mw.h === "Turn the crank to reel." && mw.guide === mw.h && mw.cue === mw.h, `the reel: the prompt, the guide and the rod cue say "Turn the crank to reel." (${JSON.stringify(mw)})`);
    mw = await reelWords({ phase: "retrieve", fish: null, follower: { id: "perch", x: 0, y: -1, z: -18, heading: 0, len: 0.25 }, tooFast: true }, "Too fast! Reel slower.");
    check(mw.guide === "Reel slowly." && mw.cue === "Reel slowly.", `a lure too fast for the fish: "Too fast! Reel slower." and the guide and the rod cue say "Reel slowly." (${JSON.stringify(mw)})`);
    mw = await reelWords({ slack: true, slackT: 1 }, "Slack line! Reel it in.");
    check(mw.guide === "Reel fast." && mw.cue === "Reel fast.", `slack line: the guide and the rod cue say "Reel fast." (${JSON.stringify(mw)})`);
    mw = await reelWords({ beaten: true, fish: { stamina: 0.05 } }, "It is tired. Reel steadily.");
    check(mw.guide === "Reel steadily." && mw.cue === "Reel steadily.", `a tired fish: the guide and the rod cue say "Reel steadily." (${JSON.stringify(mw)})`);
    mw = await reelWords({ beaten: true, slack: true, slackT: 1, fish: { stamina: 0.05 } }, "It is tired. Reel a little faster.");
    check(mw.guide === "Reel a little faster." && mw.cue === "Reel a little faster.", `a tired fish with slack line: the guide and the rod cue say "Reel a little faster." (${JSON.stringify(mw)})`);
    await page.evaluate(() => { if (document.querySelector("#guideToggle").getAttribute("aria-label") !== "Show the moves guide") document.querySelector("#guideToggle").click(); });
    await page.evaluate(() => { FISH.G.input = "touch"; });

    // ---- the gauge follows the state ----
    await stage(page, { rub: 0.6, spoolFrac: 0.7, boss: { n: 1, of: 3, name: "It jumps!", at: [0.55, 0.3] } });
    await wait(page, () => FISH.gauge.s.rub === 0.6);
    const g = await page.evaluate(() => ({ ...FISH.gauge.s }));
    check(g.rub === 0.6 && g.spool === 0.7 && JSON.stringify(g.phases) === "[0.55,0.3]" && g.label === "", "the gauge gets rub, spool, the stage marks of a legend (" + JSON.stringify({ rub: g.rub, spool: g.spool, phases: g.phases, label: g.label }) + ")");
    await stage(page, {});
    await wait(page, () => FISH.gauge.s.rub === 0);
    check(await page.evaluate(() => FISH.gauge.s.phases === null), "and no marks for an ordinary fish");

    // ---- the sound and the buzz of each move ----
    console.log("     the feel of each move");
    const FEEL = [
      ["charge", [{ type: "charge" }], (l) => has(l, "S.sfx", "slip") && has(l, "H.charge")],
      ["turn", [{ type: "turn" }], (l) => has(l, "H.turn") && !has(l, "H.thump")],
      ["sulk", [{ type: "sulk" }], (l) => has(l, "S.sfx", "creak") && has(l, "H.throb")],
      ["pump", [{ type: "pump", n: 1, need: 2 }], (l) => l.some((x) => x[0] === "H.bump" && x[1] === 0.4)],
      ["unstuck", [{ type: "unstuck" }], (l) => l.some((x) => x[0] === "S.sfx" && x[1] === "splash")],
      ["thrash", [{ type: "thrash" }], (l) => has(l, "H.thrash") && has(l, "S.sfx", "splash")],
      ["spool", [{ type: "spool" }], (l) => has(l, "S.sfx", "slip") && l.some((x) => x[0] === "H.bump" && x[1] === 0.8)],
      ["phase", [{ type: "phase", n: 2, of: 3, name: "It runs for the lily pads!" }], (l) => has(l, "S.sfx", "stage") && !has(l, "S.sfx", "record") && has(l, "H.phase")],
      // its own warning, not the snap buzz (which would also silence the drag)
      ["lastrun", [{ type: "lastrun" }], (l) => has(l, "H.surge") && !has(l, "H.jolt")],
      ["run", [{ type: "run" }], (l) => has(l, "S.sfx", "ratchet") && l.some((x) => x[0] === "H.bump" && x[1] === 0.5)],
    ];
    for (const [name, ev, ok] of FEEL) {
      await stage(page, {});
      await logClear(page);
      await stage(page, {}, ev, false);
      const l = await logNow(page);
      check(ok(l), `${name}: the sound and the buzz (${[...new Set(l.filter((x) => !/setGrind|H.rub/.test(x[0])).map((x) => x[0] + (x[1] !== undefined ? "(" + x[1] + ")" : "")))].join(" ")})`);
    }
    await stage(page, {});
    await stage(page, {}, [{ type: "phase", n: 2, of: 3, name: "It runs for the lily pads!" }], false);
    check((await toastIs(page, "It runs for the lily pads!")) === "It runs for the lily pads!", "a boss stage shows its name as a toast");
    await stage(page, {}, [{ type: "turned" }], false);
    check((await toastIs(page, "You turned it!")) === "You turned it!", "turning a fish shows \"You turned it!\"");
    // the rub: the grind loop and the buzz follow the meter, and stop when it is empty
    await stage(page, { rub: 0.5 });
    await sleep(500);
    await logClear(page);
    await sleep(500);
    let l = await logNow(page);
    check(l.some((x) => x[0] === "S.setGrind" && x[1] === 0.5) && l.some((x) => x[0] === "H.rub" && x[1] === 0.5), "a rub of 0.5 drives the grind loop and the buzz");
    await stage(page, { rub: 0 });
    await sleep(400);
    await logClear(page);
    await sleep(400);
    l = await logNow(page);
    check(l.filter((x) => x[0] === "S.setGrind").every((x) => x[1] === 0) && l.filter((x) => x[0] === "H.rub").every((x) => x[1] === 0), "and both stop when the meter is empty");
    await stage(page, { fish: { move: "sulk" } });
    await sleep(600);
    check(has(await logNow(page), "H.throb"), "a sulking fish throbs in the hand");

    // ---- the loss lines ----
    console.log("     the loss lines");
    const LOSS = [
      ["stump", [], "The line broke on a stump.", "Steer the fish away from the stumps."],
      ["logs", [], "The line broke on the logs.", "Keep the fish away from the logjam."],
      ["rocks", [], "The line broke on the rocks.", "Hold the rod up near the rocks, and steer away."],
      ["weeds", [], "It wrapped the line in the weeds.", "Drag the rod sideways to steer it."],
      ["spooled", [], "It took all your line.", "Tighten the drag on a long run."],
      ["thrown", [{ type: "thrown", thrash: true }], "It shook the hook out.", "Hold the rod up when it shakes its head."],
      ["thrown", [{ type: "thrown", charge: true }], "It threw the hook.", "Reel fast when it swims at you."],
      ["thrown", [{ type: "thrown", jump: true }], "It threw the hook.", "Lower the rod as soon as it jumps."],
      ["thrown", [{ type: "thrown" }], "It threw the hook.", "Keep the line tight."],
      ["thrown", [{ type: "thrown", slack: true }], "It shook the hook out.", "Keep reeling slowly when it shakes its head.", { move: "thrash" }],
      ["snap", [], "SNAP! The line broke.", "Stop reeling when the drag slips."],
      ["snap", [], "SNAP! The line broke.", "Keep the rod up. It bends and saves the line.", null, "rodlow"],
      ["snap", [], "SNAP! The line broke.", "Set the drag lighter with the − button.", null, "drag"],
      ["spat", [], "It spat the lure.", "Swipe it up as soon as it strikes."],
      ["thrown", [{ type: "thrown", jump: true }], "The Golden Loon Bass got away.", "Lower the rod as soon as it jumps. Look for its gold ring again at dawn or dusk.", { id: "golden", kg: 4.2 }],
    ];
    for (const [reason, ev, h, sub, fish = null, cause = ""] of LOSS) {
      await page.evaluate(() => { if (FISH.G.phase === "lost") FISH.enterReel(); });
      await stage(page, { phase: "lost", reason, cause, ...(fish ? { fish } : {}) }, ev);
      // (two loss lines in a row can share the headline: wait for the sub too)
      await wait(page, ([h, sub]) => { const p = document.querySelector("#prompt"); return !p.hidden && p.querySelector(".p1 span").textContent === h && p.querySelector(".p2").textContent === sub; }, [h, sub], 8000).catch(() => {});
      const p = await promptNow(page);
      check(p && p.h === h && p.sub === sub, `loss: ${reason}${ev.length ? " (" + Object.keys(ev[0]).filter((k) => k !== "type").join() + ")" : ""}${cause ? " (" + cause + ")" : ""} -> "${h}"` + (p && p.h === h && p.sub === sub ? "" : " (got " + JSON.stringify(p) + ")"));
    }
    // the loss beat: the line stays up 3.2 s or more (a legend longer), then the next cast
    const beat = async (fish) => {
      await page.evaluate(() => { if (FISH.G.phase === "lost") FISH.enterReel(); });
      await stage(page, { phase: "lost", reason: "thrown", fish }, [{ type: "thrown" }]);
      await wait(page, () => FISH.G.phase === "lost", null, 8000);
      const t0 = Date.now();
      await wait(page, () => FISH.G.phase !== "lost", null, 15000).catch(() => {});
      return Date.now() - t0;
    };
    const plainMs = await beat({ id: "walleye", kg: 2 }), legendMs = await beat({ id: "golden", kg: 4.2 });
    check(plainMs >= 3200 && plainMs < 6000 && legendMs >= 4200 && legendMs < 7000, `the loss line stays 3.2 s or more, a legend's longer (${plainMs} ms, the legend ${legendMs} ms)`);

    // ---- "Big fish on!" ----
    console.log("     a big fish");
    const toastNow = () => page.evaluate(() => document.querySelector("#toast").textContent);
    await page.evaluate(() => { if (FISH.G.phase !== "reel") FISH.enterReel(); });
    // a walleye of 5 kg is heavy for Loon Lake (3.5 kg and over)
    await stage(page, { fish: { id: "walleye", kg: 5, known: false, move: "swim" } }, [{ type: "hooked", id: "walleye" }]);
    check(await page.evaluate(() => !!FISH.G.big && !FISH.G.big.said), "a heavy fish is marked big at the hook set");
    await logClear(page);
    await stage(page, {}, [{ type: "drag" }], false);
    check((await toastIs(page, "It is a big one!")) === "It is a big one!", "the first run of the drag says \"It is a big one!\"");
    await wait(page, () => FISH.gauge.s.label === "Big fish on!", null, 5000).catch(() => {});
    check(await page.evaluate(() => FISH.gauge.s.label === "Big fish on!"), "and the gauge says \"Big fish on!\"");
    check(has(await logNow(page), "H.big") && !has(await logNow(page), "H.thump"), "with its own buzz, not the strike's");
    await stage(page, { fish: { known: true } }, [{ type: "reveal", id: "walleye" }], false);
    check((await toastIs(page, "It is a huge Walleye!")) === "It is a huge Walleye!", "the reveal says \"It is a huge Walleye!\" (" + (await toastNow()) + ")");
    await wait(page, () => FISH.gauge.s.label === "", null, 5000).catch(() => {});
    check(await page.evaluate(() => FISH.gauge.s.label === "" && FISH.gauge.s.name === "Walleye"), "and the gauge shows the name again");
    // a small fish: no warning
    await stage(page, { fish: { id: "perch", kg: 0.35, known: false } }, [{ type: "hooked", id: "perch" }]);
    check(await page.evaluate(() => FISH.G.big === null), "a small perch is not a big one");
    await stage(page, { fish: { known: true } }, [{ type: "drag" }, { type: "reveal", id: "perch" }], false);
    check((await toastIs(page, "It is a Yellow Perch!")) === "It is a Yellow Perch!", "and its reveal is plain (" + (await toastNow()) + ")");
    // big for its kind: a perch at the top of its range
    await stage(page, { fish: { id: "perch", kg: 0.59, known: false } }, [{ type: "hooked", id: "perch" }]);
    check(await page.evaluate(() => !!FISH.G.big), "a perch near the top of its range is big for its kind (size rank 0.9 or more)");
    // a fish that never runs: the warning comes after 4 s
    await stage(page, { fish: { id: "walleye", kg: 5, known: false } }, [{ type: "hooked", id: "walleye" }]);
    await sleep(1500);
    check((await toastNow()) !== "It is a big one!", "no warning yet 1.5 s after the hook set");
    await wait(page, () => FISH.G.big && FISH.G.big.said, null, 6000).catch(() => {});
    check(await page.evaluate(() => FISH.G.big && FISH.G.big.said), "4 s after the hook set the warning comes, run or no run");
    // the reveal of a fish with a vowel, and of a legend
    await stage(page, { fish: { id: "smallmouth", kg: 1.2, known: true } }, [{ type: "hooked", id: "smallmouth" }, { type: "reveal", id: "smallmouth" }]);
    check((await toastIs(page, "It is a Smallmouth Bass!")) === "It is a Smallmouth Bass!", "a plain reveal (" + (await toastNow()) + ")");
    await stage(page, { fish: { id: "golden", kg: 4.2, known: true } }, [{ type: "hooked", id: "golden" }, { type: "reveal", id: "golden" }]);
    check((await toastIs(page, "It is the Golden Loon Bass!")) === "It is the Golden Loon Bass!", "the legend has its own article (" + (await toastNow()) + ")");
    check(await page.evaluate(() => FISH.save.places.loon.lg === 2), "hooking the legend moves its step to 2 in the save");

    // ---- the catch card ----
    console.log("     the catch card");
    await page.evaluate(() => { FISH.G.big = null; });
    const perch = byId("perch"), walleye = byId("walleye"), golden = byId("golden"), smallmouth = byId("smallmouth");
    let c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.35, cm: 27, junk: false });
    check(c.name === "Yellow Perch" && c.badges.join() === "NEW SPECIES" && c.size === "" && c.old === "" && c.btn === "Cast again" && !c.photo && !c.waiting, "a small new perch: NEW SPECIES, no size line, no old record (" + JSON.stringify({ badges: c.badges, size: c.size }) + ")");
    check(c.kg.startsWith(kgText(0.35)) && c.kg.includes("cm"), "its weight and length show (" + c.kg + ")");
    check(c.ck.length >= 2 && c.ck.every((t, i) => i === 0 || parseFloat(t) >= parseFloat(c.ck[i - 1]) - 1e-9) && c.ck[0] !== c.ck[c.ck.length - 1], "the weight counts up (" + c.ck.slice(0, 3).map((t) => t.replace(/<.*/, "")).join(" > ") + " ... " + c.ck.length + " steps)");
    const lg = await logNow(page);
    check(lg.filter((x) => x[0] === "S.sfx" && x[1] === "tick").length >= 3 && lg.filter((x) => x[0] === "S.sfx" && x[1] === "tick").length <= 10 && has(lg, "H.land", 0) && !has(lg, "S.sfx", "shutter") && c.flashes === 0, "3 to 10 ticks, the plain landing buzz, no photo, no flash");
    check(await page.evaluate(() => FISH.save.journal.perch.n === 1 && FISH.save.places.loon.n === 1 && FISH.save.caught === 1), "the journal and the place record are updated");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");

    // a new record for a big perch: a size line, the old record, NEW RECORD and TROPHY
    c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.59, cm: 34, junk: false });
    const rk = sizeRank(perch, 0.59);
    check(rk >= 0.95 && c.badges.join() === "NEW RECORD,TROPHY" && c.size === expectSize(perch, 0.59) && c.old === "Your old record: 0.35 kg.", "a record perch: NEW RECORD, TROPHY, the size line, the old record (" + JSON.stringify({ rank: +rk.toFixed(3), badges: c.badges, size: c.size, old: c.old }) + ")");
    check(c.photo && /^Loon Lake · \d\d:\d\d$/.test(c.cap) && c.flashes > 0, "a trophy gets the photo: white border, flash, caption (" + c.cap + ")");
    check(c.photoFlashes > 0, "and its flash carries the class \"photo\" (the white camera flash), not the red strike flash (" + c.photoFlashes + ")");
    let lg2 = await logNow(page);
    check(has(lg2, "S.sfx", "shutter") && has(lg2, "S.sfx", "record") && has(lg2, "H.land", 1), "the shutter, the record sting and the trophy buzz");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");

    // the card waits for the photo: it is there at once for the sim, but it slides up late, and Cast again does nothing before
    await stage(page, { phase: "caught", catch: { id: "perch", name: "Yellow Perch", kg: 0.6, cm: 35, junk: false }, fish: null });
    await wait(page, () => !document.querySelector("#catch").hidden);
    const early = await page.evaluate(() => { const before = FISH.G.phase; document.querySelector("#catchGo").click(); return { phase: before, after: FISH.G.phase, wait: document.querySelector("#catch").classList.contains("wait"), visible: !document.querySelector("#catch").hidden, cardWait: FISH.G.cardWait }; });
    check(early.phase === "catch" && early.after === "catch" && early.wait && early.cardWait && early.visible, "at once G.phase is catch, the card waits, and Cast again does nothing yet (" + JSON.stringify(early) + ")");
    await wait(page, () => !FISH.G.cardWait, null, 10000);
    check(await page.evaluate(() => !document.querySelector("#catch").classList.contains("wait")), "then the card comes up");
    await sleep(2200);
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");

    // a close call
    c = await catchCard(page, { id: "smallmouth", name: "Smallmouth Bass", kg: 2.6, cm: 50, junk: false });
    check(c.btn === "Cast again" && c.badges.includes("NEW SPECIES") && c.size === expectSize(smallmouth, 2.6), "2.6 kg does not open a place; the size line is right (" + JSON.stringify({ badges: c.badges, size: c.size, want: expectSize(smallmouth, 2.6) }) + ")");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");
    check((await toastIs(page, "Close! Land a fish of 3.5 kg or more to open Stump Bay.")) === "Close! Land a fish of 3.5 kg or more to open Stump Bay.", "70% of the goal or more: the close-call toast after the card (" + (await toastNow()) + ")");
    check(await page.evaluate(() => !FISH.save.places.stumps), "Stump Bay is still closed");

    // a walleye of 3.6 kg opens Stump Bay
    c = await catchCard(page, { id: "walleye", name: "Walleye", kg: 3.6, cm: 62, junk: false });
    check(c.photo && c.btn === "Next" && /^Loon Lake · /.test(c.cap), "a fish that opens a place gets the photo and the button reads Next (" + JSON.stringify({ btn: c.btn, cap: c.cap }) + ")");
    check(c.size === expectSize(walleye, 3.6) && c.badges.includes("NEW SPECIES"), "its size line and badges (" + JSON.stringify({ size: c.size, badges: c.badges }) + ")");
    check(await page.evaluate(() => FISH.save.places.stumps.open === 1 && FISH.save.places.loon.kg === 3.6 && FISH.save.places.loon.id === "walleye"), "the save opens Stump Bay and keeps the best fish here");
    await click(page, "#catchGo");
    await page.waitForSelector("#unlock:not([hidden])");
    const un = await page.evaluate(() => ({ name: document.querySelector("#uname").textContent, blurb: document.querySelector("#ublurb").textContent, badge: document.querySelector("#unlock .badge").textContent, btns: [...document.querySelectorAll("#unlock .btn")].map((b) => b.textContent), seen: FISH.save.seen["opened.stumps"] }));
    check(un.name === "Stump Bay is open!" && un.badge === "NEW PLACE" && un.btns.join() === "Stay here,Go there" && /^Dead trees stand in the water/.test(un.blurb) && un.seen === 1, "the unlock card (" + JSON.stringify(un) + ")");
    await click(page, "#uStay");
    await wait(page, () => FISH.G.phase === "cast");
    check(await page.evaluate(() => document.querySelector("#unlock").hidden && FISH.G.mode === "free"), "Stay here goes on fishing");
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await wait(page, () => !document.querySelector("#pause").hidden);
    check(!/Goal:/.test(await page.textContent("#pauseSum")), "the pause summary has no goal for a place that is already open (" + JSON.stringify(await page.textContent("#pauseSum")) + ")");
    await click(page, "#quitBtn");
    await page.waitForSelector("#title:not([hidden])");
    check(!(await page.evaluate(() => document.querySelector("#placesNew").hidden)), "back at the title Places has a NEW badge (Stump Bay is open and not visited)");
    check((await page.textContent("#tbest")) === "Here: biggest Walleye 3.6 kg\nNext: land 6 kg or more at Stump Bay to open Cedar River.", "the title shows the best fish here and the next goal (" + JSON.stringify(await page.textContent("#tbest")) + ")");

    // ---- the journal ----
    console.log("     the journal");
    await click(page, "#journalBtn");
    await page.waitForSelector("#journal:not([hidden])");
    const jr = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#jlist .jfish")].map((r) => [r.querySelector("b").textContent, r.querySelector("small").textContent, r.className]), sum: document.querySelector("#jsum").textContent, tabs: [...document.querySelectorAll("#jtabs button")].map((b) => b.textContent + (b.classList.contains("lock") ? "*" : "") + (b.getAttribute("aria-selected") === "true" ? "!" : "")) }));
    check(jr.tabs.join() === "Loon!,Stumps,River*,Sea*", "the chips: Loon (chosen), Stumps (open), River and Sea (locked) (" + jr.tabs.join() + ")");
    // a short list: the fish caught (small to big), the next 3 to find with their hints, and how many more
    const jnote = () => page.evaluate(() => (document.querySelector("#jlist .jnote") || {}).textContent);
    check(jr.rows.length === 6 && (await jnote()) === "7 more to find here.", "Loon Lake lists the 3 fish caught, the next 3 to find, and \"7 more to find here.\" (" + jr.rows.length + " rows, " + (await jnote()) + ")");
    const names = jr.rows.map((r) => r[0]);
    check(names.join() === "Yellow Perch,Smallmouth Bass,Walleye,Not caught yet,Not caught yet,Not caught yet", "the fish caught small to big, then the ones to find (" + names.join(", ") + ")");
    check(jr.rows[2][1] === "Best 3.6 kg · 62 cm · caught 1" && jr.rows[0][1] === "Best 0.60 kg · 35 cm · caught 3", "a caught fish shows its best and the count (" + jr.rows[2][1] + " / " + jr.rows[0][1] + ")");
    check(jr.rows[3][1] === "Try the lily pads." && jr.rows[4][1] === "Try the rocky point at dusk." && jr.rows[5][1] === "Try the lily pads at dusk.", "a fish not caught yet says where to try (" + jr.rows.slice(3).map((r) => r[1]).join(" / ") + ")");
    // (the first line only: on a day whose goal these catches meet, a second line says "Goal days: 1")
    check(jr.sum.split("\n")[0] === "3 of 13 found here · 3 of 29 in all · 5 fish landed · 0 casts", "the summary line (" + jr.sum + ")");
    // one cast is "1 cast", not "1 casts" (the Loon chip draws the journal again)
    const sum1 = await page.evaluate(() => { const n = FISH.save.casts; FISH.save.casts = 1; document.querySelector("#jtabs button").click(); const t = document.querySelector("#jsum").textContent; FISH.save.casts = n; document.querySelector("#jtabs button").click(); return t; });
    check(sum1.split("\n")[0].endsWith(" · 1 cast"), "one cast in the summary line: \"1 cast\" (" + sum1 + ")");
    // the legend row, by step: once every other fish here is caught, the legend is among the next 3
    const keep = await page.evaluate(() => JSON.stringify(FISH.save.journal));
    await page.evaluate(() => { for (const id of ["pumpkinseed", "rockbass", "largemouth", "pike", "laketrout", "muskie"]) FISH.save.journal[id] = { n: 1, kg: 1, cm: 30 }; });
    const legendRow = async (lgStep) => {
      await page.evaluate((s) => { FISH.save.places.loon.lg = s; document.querySelector('#jtabs [data-place="loon"]').click(); }, lgStep);
      return page.evaluate(() => { const r = document.querySelector("#jlist .jfish.legend"); return r ? [r.querySelector("b").textContent, r.querySelector("small").textContent] : ["", ""]; });
    };
    const steps = [await legendRow(0), await legendRow(1), await legendRow(2)];
    check(steps.every((s) => s[0] === "The legend") && steps[0][1] === "People say a gold bass lives in Loon Lake." && steps[1][1] === "Look for a gold ring at dawn or dusk, 40 to 50 m out. Cast right into it." && steps[2][1] === "It jumps a lot. Lower the rod when it jumps.", "the legend row gets clearer with each step (" + steps.map((s) => s[1]).join(" | ") + ")");
    const odd = await page.evaluate(() => [...document.querySelectorAll("#jlist .jfish.none")].map((r) => [r.querySelector("b").textContent, r.querySelector("small").textContent]).slice(1));
    check(odd.length === 2 && odd.every((r) => r[0] === "Something odd" && r[1] === "Something odd lies near the dock."), "the junk not found yet at Loon Lake: \"Something odd lies near the dock.\" (" + JSON.stringify(odd) + ")");
    await page.evaluate((j) => { FISH.save.journal = JSON.parse(j); }, keep);
    // Stump Bay's chip
    await page.evaluate(() => document.querySelector('#jtabs [data-place="stumps"]').click());
    const st = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#jlist .jfish")].map((r) => [r.querySelector("b").textContent, r.querySelector("small").textContent]), sum: document.querySelector("#jsum").textContent }));
    check(st.rows.length === 3 && (await jnote()) === "5 more to find here." && st.sum.startsWith("0 of 8 found here · 3 of 29 in all"), "Stump Bay: the first 3 of its own 8 to find, \"5 more to find here.\", and its own count (" + st.sum + ")");
    check(st.rows.map((r) => r[1]).join(" | ") === "Try the lily cove. | Try the stumps at dusk. | Try the stumps at dusk." && !st.rows.some((r) => /midday|morning/.test(r[1])), "Stump Bay's clock runs 19:00 to 24:00, so no hint promises midday or morning (" + st.rows.map((r) => r[1]).join(" | ") + ")");
    // a locked chip
    await page.evaluate(() => document.querySelector('#jtabs [data-place="river"]').click());
    const lk = await page.evaluate(() => ({ note: document.querySelector("#jlist .jnote") && document.querySelector("#jlist .jnote").textContent, rows: document.querySelectorAll("#jlist .jfish").length }));
    check(lk.note === "Open Cedar River to see its fish." && lk.rows === 0, "a locked chip says \"Open Cedar River to see its fish.\" (" + lk.note + ")");
    await page.evaluate(() => { FISH.save.places.loon.lg = 2; });
    await click(page, "#journal [data-close]");

    // ---- the legend on the card ----
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    c = await catchCard(page, { id: "golden", name: "Golden Loon Bass", kg: 4.2, cm: 58, junk: false });
    check(c.badges.join() === "LEGEND,NEW SPECIES" && c.photo && c.size === expectSize(golden, 4.2), "the legend: LEGEND and NEW SPECIES, the photo (" + JSON.stringify({ badges: c.badges, size: c.size }) + ")");
    lg2 = await logNow(page);
    check(has(lg2, "H.land", 2) && has(lg2, "S.sfx", "record") && has(lg2, "S.sfx", "shutter"), "the legend buzz, the record sting and the shutter");
    await sleep(1500);
    check(has(await logNow(page), "S.sfx", "loonWail"), "and at Loon Lake the loon wails for it");
    check(await page.evaluate(() => FISH.save.places.loon.lg === 3 && FISH.save.journal.golden.n === 1), "the save marks the legend as landed (step 3)");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");
    check(await page.evaluate(() => document.querySelector("#unlock").hidden), "a legend of 4.2 kg does not open Stump Bay a second time");
    // junk
    c = await catchCard(page, { id: "boot", name: "Old Boot", kg: 0.5, cm: 0, junk: true });
    check(c.badges.join() === "NEW FIND" && c.kg.startsWith("Junk") && c.size === "" && !c.photo, "junk: NEW FIND, no weight, no size line (" + c.kg + ")");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");

    // ---- go to the new place ----
    console.log("     to Stump Bay");
    await click(page, "#pauseBtn");
    await wait(page, () => !document.querySelector("#pause").hidden);
    await click(page, "#quitBtn");
    await page.waitForSelector("#title:not([hidden])");
    await click(page, "#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const pc = await page.evaluate(() => [...document.querySelectorAll("#plist .pcard")].map((x) => ({ state: x.dataset.state, text: x.innerText.replace(/\s+/g, " ") })));
    check(pc.map((x) => x.state).join() === "here,open,next,locked", "Places: Loon here, Stump Bay open, River next, Sea locked (" + pc.map((x) => x.state).join() + ")");
    check(/Legend: landed/.test(pc[0].text) && /Best derby none yet/.test(pc[0].text) && /5 of 13 found/.test(pc[0].text), "Loon Lake shows its legend landed and its count (the perch, smallmouth, walleye, legend and boot) ("+ pc[0].text.slice(0, 200) + ")");
    check(/To open: land a fish of 6 kg or more at Stump Bay\./.test(pc[2].text) && /Your best there: none yet\./.test(pc[2].text), "River shows the 6 kg goal (" + pc[2].text + ")");
    check((await page.textContent("#pfoot")) === "Legends landed: 1 of 4", "the footer counts the landed legend");
    await click(page, '.pcard[data-place="stumps"] button');
    await page.waitForSelector("#arrive:not([hidden])", { timeout: 60000 });
    check((await page.textContent("#aname")) === "Stump Bay", "Fish here at Stump Bay leads to the arrival card");
    const st0 = await arrivalStart(page);
    check(st0.phase === "cast" && st0.mode === "free" && st0.place === "stumps", "Start goes to the water: free fishing at Stump Bay (" + JSON.stringify(st0) + ")");
    check((await page.textContent("#tkick")) === "GET PLUNGER'D · STUMP BAY" && await page.evaluate(() => document.querySelector("#placesNew").hidden), "the title reads STUMP BAY and the NEW badge is gone");
    check(await page.evaluate(() => FISH.save.place === "stumps" && JSON.parse(localStorage.getItem("fish.v1")).place === "stumps"), "the place is saved");
    check((await page.textContent("#tbest")) === "Land a fish of 6 kg or more here to open Cedar River.", "the title shows the goal of Stump Bay (" + JSON.stringify(await page.textContent("#tbest")) + ")");
    // Stump Bay's clock and goal reminder
    await page.evaluate(() => FISH.startMode("derby"));
    await wait(page, () => FISH.G.phase === "cast");
    check(await page.evaluate(() => FISH.G.hour >= 20 && FISH.G.hour < 20.1) && (await toastIs(page, "Goal: land a fish of 6 kg or more. It opens Cedar River.")) === "Goal: land a fish of 6 kg or more. It opens Cedar River.", "a derby at Stump Bay starts at 20:00 with its own goal (" + (await page.textContent("#toast")) + ")");
    check((await page.textContent("#modeChip")).startsWith("1/10 · "), "the HUD chip (" + (await page.textContent("#modeChip")) + ")");
    // the reload keeps the place
    await page.reload();
    await page.waitForSelector("#title:not([hidden])", { timeout: 120000 });
    check((await page.textContent("#tkick")) === "GET PLUNGER'D · STUMP BAY", "after a reload the player is still at Stump Bay");
  } catch (e) { check(false, "exception in part A: " + (e && e.stack)); }
  check(errors.length === 0, "part A: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part B: a derby that opens a place ================= */
if (part("B")) {
  const { browser, page, errors } = await open({ query: "?debug" });
  try {
    await stand(page);
    await spy(page);
    await page.evaluate(() => FISH.startMode("derby"));
    await wait(page, () => FISH.G.phase === "cast");
    check((await page.textContent("#toast")) === "Goal: land a fish of 3.5 kg or more. It opens Stump Bay.", "a derby starts with the goal");
    await page.evaluate(() => { FISH.G.castsLeft = 0; });
    const c = await catchCard(page, { id: "walleye", name: "Walleye", kg: 3.6, cm: 62, junk: false });
    check(c.btn === "See the results" && c.photo, "the last catch of a derby: See the results, and the photo for the place it opens (" + c.btn + ")");
    await click(page, "#catchGo");
    await page.waitForSelector("#results:not([hidden])");
    // the total counts up first, then the rank shows
    await wait(page, () => !document.querySelector("#rrank").classList.contains("held"), null, 8000);
    const r = await page.evaluate(() => ({ kick: document.querySelector("#rkick").textContent, total: document.querySelector("#rtotal").textContent, rank: document.querySelector("#rrank").textContent, best: document.querySelector("#rbest").textContent, line: document.querySelector("#runlock").textContent, lineHidden: document.querySelector("#runlock").hidden, go: document.querySelector("#rGo").hidden, list: [...document.querySelectorAll("#rlist li")].map((l) => l.textContent) }));
    check(r.kick === "LOON LAKE" && r.total === "3.6 kg" && r.rank === rankFor("loon", 3.6) && r.best === "A new best derby here!" && r.list.join() === "Walleye3.6 kg", "the results: the place, the total, the rank, the new best (" + JSON.stringify(r) + ")");
    check(!r.lineHidden && r.line === "Your 3.6 kg Walleye opened Stump Bay." && !r.go, "the results say which fish opened Stump Bay, with Go there (" + r.line + ")");
    check(await page.evaluate(() => FISH.save.derbyBest === 3.6 && FISH.save.places.loon.d === 3.6 && FISH.save.seen["opened.stumps"] === 1), "the best derby is saved for Loon Lake");
    await click(page, "#rGo");
    await page.waitForSelector("#arrive:not([hidden])", { timeout: 60000 });
    await arrivalStart(page);
    check((await page.textContent("#tkick")) === "GET PLUNGER'D · STUMP BAY", "Go there leads to Stump Bay");
    check((await page.textContent("#tbest")).startsWith("Land a fish of 6 kg"), "with the title of its own goal");
    // a second derby, at Stump Bay: its own best, its own ranks; Loon Lake's best is not touched
    await page.evaluate(() => FISH.startMode("derby"));
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { FISH.G.castsLeft = 0; });
    await catchCard(page, { id: "crappie", name: "Black Crappie", kg: 0.4, cm: 25, junk: false });
    await click(page, "#catchGo");
    await page.waitForSelector("#results:not([hidden])");
    const r2 = await page.evaluate(() => ({ kick: document.querySelector("#rkick").textContent, rank: document.querySelector("#rrank").textContent, best: document.querySelector("#rbest").textContent, lineHidden: document.querySelector("#runlock").hidden, go: document.querySelector("#rGo").hidden, loon: FISH.save.derbyBest, here: FISH.save.places.stumps.d }));
    check(r2.kick === "STUMP BAY" && r2.rank === rankFor("stumps", 0.4) && r2.best === "A new best derby here!" && r2.lineHidden && r2.go && r2.loon === 3.6 && r2.here === 0.4, "Stump Bay has its own results (" + JSON.stringify(r2) + ")");
    await click(page, "#rAgain");
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { FISH.G.castsLeft = 0; });
    await stage(page, { phase: "home" });
    await wait(page, () => !document.querySelector("#results").hidden, null, 15000);
    const r3 = await page.evaluate(() => ({ total: document.querySelector("#rtotal").textContent, rank: document.querySelector("#rrank").textContent, best: document.querySelector("#rbest").textContent }));
    check(r3.rank === "SKUNKED" && r3.best === "Your best derby here: 0.40 kg", "a derby with no fish: SKUNKED, and your best here (" + JSON.stringify(r3) + ")");
  } catch (e) { check(false, "exception in part B: " + (e && e.stack)); }
  check(errors.length === 0, "part B: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part C: an old save ================= */
if (part("C")) {
  const old = { v: 1, journal: { perch: { n: 3, kg: 0.5, cm: 30 }, walleye: { n: 1, kg: 3.6, cm: 63 }, golden: { n: 1, kg: 4.1, cm: 55 } }, casts: 40, longest: 46.2, derbyBest: 8.4, biggest: { id: "walleye", kg: 3.6 }, input: null, assist: true, quality: "auto", seen: { bail: 1 }, caught: 6 };
  const { browser, page, errors } = await open({ query: "?debug", save: old });
  try {
    await stand(page);
    check((await page.textContent("#toast")) === "Your 3.6 kg Walleye opened a new place: Stump Bay." && await page.evaluate(() => document.querySelector("#toast").classList.contains("on")), "an old save with a 3.6 kg walleye: the toast says it opened Stump Bay (" + (await page.textContent("#toast")) + ")");
    check(!(await page.evaluate(() => document.querySelector("#placesNew").hidden)), "and Places has a NEW badge");
    check((await page.textContent("#tbest")) === "Here: best derby 8.4 kg · biggest Walleye 3.6 kg\nNext: land 6 kg or more at Stump Bay to open Cedar River.", "the title shows the old best derby and the biggest fish (" + JSON.stringify(await page.textContent("#tbest")) + ")");
    const s = await page.evaluate(() => JSON.parse(JSON.stringify(FISH.save)));
    check(s.places.loon.d === 8.4 && s.places.loon.kg === 3.6 && s.places.loon.lg === 3 && s.places.stumps.open === 1 && s.seen["opened.stumps"] === 1 && s.seen.bail === 1 && s.place === "loon", "the save holds the old journal, and Loon Lake's record from it (" + JSON.stringify(s.places) + ")");
    await click(page, "#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const pc = await page.evaluate(() => [...document.querySelectorAll("#plist .pcard")].map((x) => ({ state: x.dataset.state, text: x.innerText.replace(/\s+/g, " ") })));
    check(pc.map((x) => x.state).join() === "here,open,next,locked" && /Best derby 8\.4 kg/.test(pc[0].text) && /Legend: landed/.test(pc[0].text) && /3 of 13 found/.test(pc[0].text), "Places: the old best derby, the landed legend and the journal count (" + pc[0].text.slice(0, 220) + ")");
    check((await page.textContent("#pfoot")) === "Legends landed: 1 of 4", "the footer");
    // the toast comes once
    await sleep(350);
    await page.click("#places [data-close]");
    await page.reload();
    await page.waitForSelector("#title:not([hidden])", { timeout: 120000 });
    check(!(await page.evaluate(() => document.querySelector("#toast").classList.contains("on"))), "after a reload the toast does not come again");
  } catch (e) { check(false, "exception in part C: " + (e && e.stack)); }
  check(errors.length === 0, "part C: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part D: the other places (?open) ================= */
if (part("D")) {
  const { browser, page, errors } = await open({ query: "?open&debug" });
  try {
    await stand(page);
    await spy(page);
    const toastNow = () => page.evaluate(() => document.querySelector("#toast").textContent);
    // ---- the painted title: its picture is of Loon Lake. At another place the live place shows behind the title, as in
    // the Original style, and the lake draws there. Counted over frames, not a fixed time: a busy machine draws slowly ----
    const titleArt = (frames) => page.evaluate(async (frames) => {
      const t = document.querySelector("#title"), w = FISH.world, r = w.render;
      let n = 0;
      w.render = function (...a) { n++; return r.apply(this, a); };
      for (let i = 0; i < frames && n < 3; i++) await new Promise((res) => requestAnimationFrame(res));
      w.render = r;
      return { style: document.body.dataset.artStyle, shown: !t.hidden, pic: /film-lake\.webp/.test(getComputedStyle(t).backgroundImage), draws: n, kick: document.querySelector("#tkick").textContent };
    }, frames);
    const loonArt = await titleArt(12);
    check(loonArt.style === "painted" && loonArt.shown && loonArt.pic && loonArt.draws <= 1 && /LOON LAKE$/.test(loonArt.kick), "the painted title at Loon Lake shows its picture, and the lake under it stands still (" + JSON.stringify(loonArt) + ")");
    // ---- Cedar River: the current, and the swing said once ----
    check(await page.evaluate(async () => await FISH.setPlace("river")), "at Cedar River");
    const riverArt = await titleArt(60);
    check(riverArt.style === "painted" && riverArt.shown && !riverArt.pic && riverArt.draws >= 3 && /CEDAR RIVER$/.test(riverArt.kick), "the painted title at Cedar River shows the live river behind it, not the picture of Loon Lake (" + JSON.stringify(riverArt) + ")");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    check(await page.evaluate(() => Math.abs(FISH.G.hour - 5.2) < 0.1), "free fishing at Cedar River starts at 5:12 (" + (await page.textContent("#clock")) + ")");
    check(!/^Goal:/.test(await toastNow()), "?open has no goal to remind (" + (await toastNow()) + ")");
    // the cast report is still up: the swing prompt waits (it would print over the distance) and is not counted as said
    await page.evaluate(() => { document.querySelector("#report").hidden = false; });
    let p = await prompts(page, { phase: "retrieve", fish: null, follower: null, empty: false }, [], "Turn the crank to reel.");
    await sleep(600);
    check(p && p.h === "Turn the crank to reel." && (await promptNow(page)).h === "Turn the crank to reel." && await page.evaluate(() => !FISH.save.seen["river.swing"]), "at the river, while the cast report is up, the swing prompt waits (" + JSON.stringify(await promptNow(page)) + ")");
    await page.evaluate(() => { document.querySelector("#report").hidden = true; });
    p = await prompts(page, { phase: "retrieve", fish: null, follower: null, empty: false }, [], "The current takes your lure.");
    check(p && p.h === "The current takes your lure." && p.sub === "Reel slowly. Fish take it at the end of the swing.", "the river says how the current takes the lure (" + JSON.stringify(p) + ")");
    check(await page.evaluate(() => FISH.save.seen["river.swing"] === 1), "and remembers that it said so");
    await page.evaluate(() => { FISH.G.swingUntil = 0; });
    p = await prompts(page, { phase: "retrieve", fish: null }, [], "Turn the crank to reel.");
    check(p && p.h === "Turn the crank to reel.", "the second cast has the plain prompt (" + (p && p.h) + ")");
    // ---- Stump Bay at night ----
    check(await page.evaluate(async () => await FISH.setPlace("stumps")), "at Stump Bay");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    check(await page.evaluate(() => Math.abs(FISH.G.hour - 19) < 0.1), "free fishing at Stump Bay starts at 19:00");
    await page.evaluate(() => { FISH.G.hour = 22.5; });
    p = await prompts(page, { phase: "retrieve", fish: null, follower: null, empty: false }, [{ type: "nibble", s: 0.6 }], "It is dark. Feel for the bite.");
    check(p && p.h === "It is dark. Feel for the bite." && p.sub === "Wait for the strike.", "a nibble in the dark: \"It is dark. Feel for the bite.\" (" + JSON.stringify(p) + ")");
    await page.evaluate(() => { FISH.G.hour = 12; });
    p = await prompts(page, { phase: "retrieve", fish: null, follower: null, empty: false }, [{ type: "nibble", s: 0.6 }], "A fish is nibbling.");
    check(p && p.h === "A fish is nibbling.", "a nibble by day is the plain one (" + (p && p.h) + ")");
    // the day wraps at midnight to 19:00, with the night's own words
    await page.evaluate(() => { FISH.G.hour = 23.999; });
    await wait(page, () => FISH.G.hour < 20 && FISH.G.hour >= 19, null, 15000);
    check((await toastIs(page, "A new night on Stump Bay.")) === "A new night on Stump Bay.", "at midnight the clock goes back to 19:00: \"A new night on Stump Bay.\" (" + (await toastNow()) + ")");
    // ---- Gull Rock ----
    check(await page.evaluate(async () => await FISH.setPlace("sea")), "at Gull Rock");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    p = await prompts(page, { phase: "land" }, [], "Bring it to the wall!");
    check(p && p.h === "Bring it to the wall!" && p.sub === "Drag the rod up and hold.", "at the wall: \"Bring it to the wall!\"");
    check(await page.evaluate(() => Math.abs(FISH.G.hour - 5.5) < 0.1), "free fishing at Gull Rock starts at 5:30");
    // a big fish here is 10 kg
    await stage(page, { fish: { id: "striper", kg: 8, known: false } }, [{ type: "hooked", id: "striper" }]);
    check(await page.evaluate(() => FISH.G.big === null), "at Gull Rock a striper of 8 kg is not yet a big one");
    await stage(page, { fish: { id: "striper", kg: 11, known: false } }, [{ type: "hooked", id: "striper" }]);
    check(await page.evaluate(() => !!FISH.G.big), "and one of 11 kg is");
    // the hooked legend moves the sea's own legend step
    await stage(page, { fish: { id: "bigblue", kg: 80, known: false } }, [{ type: "hooked", id: "bigblue" }]);
    check(await page.evaluate(() => !FISH.save.places.sea || FISH.save.places.sea.lg === 0), "?open never writes a place record (Gull Rock was not earned)");
    // the trophy line of a legend at the sea: Big Blue has no article
    await stage(page, { fish: { id: "bigblue", kg: 80, known: true } }, [{ type: "reveal", id: "bigblue" }], false);
    check((await toastIs(page, "It is Big Blue!")) === "It is Big Blue!", "\"It is Big Blue!\" (" + (await toastNow()) + ")");
    await stage(page, { fish: { id: "whiskers", kg: 20, known: true } }, [{ type: "reveal", id: "whiskers" }]);
    check((await toastIs(page, "It is Old Whiskers!")) === "It is Old Whiskers!", "\"It is Old Whiskers!\" (" + (await toastNow()) + ")");
  } catch (e) { check(false, "exception in part D: " + (e && e.stack)); }
  check(errors.length === 0, "part D: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part F: prompts that hold, the gold ring, the flash, the chip, the report hint ================= */
if (part("F")) {
  const { browser, page, errors } = await open({ query: "?debug" });
  try {
    await stand(page);
    await spy(page);
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    // a clock the test can move: the holds are timed by now(), and a slow frame must not decide the result.
    // While it is frozen, time only moves by 0.05 ms for each look at the clock, and by jump()
    await page.evaluate(() => {
      const real = performance.now.bind(performance), C = (window.__c = { t: real(), on: false, off: 0 });
      performance.now = () => (C.on ? (C.t += 0.05) : real() + C.off);
      window.__freeze = () => { C.t = performance.now(); C.on = true; };
      window.__thaw = () => { C.off = C.t - real(); C.on = false; };
    });
    const freeze = () => page.evaluate(() => window.__freeze()), thaw = () => page.evaluate(() => window.__thaw());
    // what the game tells the world about the view
    await page.evaluate(() => { window.__views = []; const f = FISH.world.setView; FISH.world.setView = function (v) { window.__views.push({ ...v }); return f.call(this, v); }; });
    const jump = (ms) => page.evaluate((ms) => { window.__c.t += ms; }, ms);
    // some frames of the game have run
    const frames = (n = 3) => page.evaluate((n) => new Promise((res) => { const f = () => (--n > 0 ? requestAnimationFrame(f) : res()); requestAnimationFrame(f); }), n);
    const set = async (key, v) => { await page.evaluate(([key, v]) => { FISH.G.sim.state[key] = v; }, [key, v]); await frames(3); };
    const changes = () => page.evaluate(() => window.__pt.slice());

    // ---- the side to steer holds for 300 ms ----
    console.log("     the steer word holds");
    await freeze();
    await prompts(page, { rub: 0.4, rubKind: "logs", rubSide: 1 }, [], "The line is on the logs! Steer right.");
    await page.evaluate(() => { window.__pt = []; const p1 = document.querySelector("#prompt .p1"); new MutationObserver(() => window.__pt.push(p1.querySelector("span").textContent)).observe(p1, { childList: true, subtree: true, characterData: true }); });
    await set("rubSide", -1); await jump(150); await frames();
    let w = await promptNow(page);
    check(w.h === "The line is on the logs! Steer right.", "a new side that has held 150 ms does not change the headline yet (" + JSON.stringify(w) + ")");
    check(w.sub === "Drag the rod right.", "nor the sub (" + JSON.stringify(w) + ")");
    check(!(await changes()).length, "and the prompt has not changed at all (" + JSON.stringify(await changes()) + ")");
    await set("rubSide", 1); await jump(400); await frames();
    check(!(await changes()).length && (await promptNow(page)).h === "The line is on the logs! Steer right.", "and if the side goes back, the words never changed");
    for (let i = 0; i < 6; i++) { await set("rubSide", i % 2 ? 1 : -1); await jump(120); await frames(2); }
    check(!(await changes()).length, "a side that flips every 120 ms never gets through (" + JSON.stringify(await changes()) + ")");
    await set("rubSide", -1); await jump(150); await frames(); await jump(200); await frames();
    w = await promptNow(page);
    check(w.h === "The line is on the logs! Steer left.", "a side that holds 350 ms changes the headline (" + JSON.stringify(w) + ")");
    check(w.sub === "Drag the rod left.", "and the sub (" + JSON.stringify(w) + ")");
    check((await changes()).length === 1, "once (" + JSON.stringify(await changes()) + ")");
    await set("rubSide", 0); await jump(900); await frames();
    check((await promptNow(page)).h === "The line is on the logs! Steer left.", "no side for a moment keeps the last words, not \"Steer away.\"");
    await page.evaluate(() => { const s = FISH.G.sim.state; s.rubKind = "stump"; s.rubSide = 1; });
    await frames(3);
    check((await promptNow(page)).h === "The line is on a stump! Steer right.", "a new kind of rub starts again, with its own side at once (" + JSON.stringify(await promptNow(page)) + ")");
    await set("rub", 0.05); await set("rubSide", -1); await set("rub", 0.4);
    check((await promptNow(page)).h === "The line is on a stump! Steer left.", "and when the rub stops, the next rub does not carry the old side (" + (await promptNow(page)).h + ")");

    // ---- the slip prompts hold for 0.7 s ----
    console.log("     the slip prompts hold");
    await prompts(page, { slip: 0.6 }, [], "It is running. Let it go.");
    await set("slip", 0); await jump(300); await frames();
    check((await promptNow(page)).h === "It is running. Let it go.", "a slip that stopped 0.3 ago still shows \"It is running\"");
    await jump(600); await frames();
    check((await promptNow(page)).h === "Pump and reel.", "and 0.9 s after, the prompt has gone on (" + (await promptNow(page)).h + ")");
    // a fish that sulks with the spool nearly out: the sulk is said, the spool only while the line runs off
    await prompts(page, { fish: { move: "sulk" }, spoolFrac: 0.85, slip: 0.6 }, [], "The spool is almost empty!");
    await set("slip", 0); await jump(900); await frames();
    check((await promptNow(page)).h === "It holds on the bottom.", "the sulk comes back when the line stops running off (" + (await promptNow(page)).h + ")");
    // heavy drag: the spool warning does not say to tighten the drag
    await page.evaluate(() => FISH.G.drag = 2);
    await set("slip", 0.6);
    w = await promptNow(page);
    check(w.h === "The spool is almost empty!" && w.sub === "Hold on. Keep the rod up.", "at the heavy drag the spool warning says hold on, not tighten (" + JSON.stringify(w) + ")");
    await page.evaluate(() => FISH.G.drag = 1);
    await thaw();

    // ---- the gold ring: one toast for each ring, and none in a fight ----
    console.log("     the gold ring toast");
    await page.evaluate(() => FISH.newCast());
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => {
      // only the staged rings: a real gold ring at golden hour, or a real ring's one-time tip, would change the count
      window.__spawn = FISH.rises.spawn; FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]);
      window.__toasts = [];
      const el = document.querySelector("#toast"), d = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
      Object.defineProperty(el, "textContent", { get() { return d.get.call(this); }, set(v) { window.__toasts.push(v); d.set.call(this, v); } });
      // the ring pulses: FISH.rises says "rise" every step while a spot is set
      const orig = FISH.rises.step; window.__gold = null;
      FISH.rises.step = function (dt, h) { const ev = orig.call(this, dt, h) || []; if (window.__gold) ev.push({ type: "rise", x: window.__gold[0], z: window.__gold[1], gold: true }); return ev; };
    });
    const golds = () => page.evaluate(() => window.__toasts.filter((t) => /gold ring/.test(t)).length);
    await page.evaluate(() => { window.__gold = [40, -30]; });
    await frames(8);
    check((await golds()) === 1, "a ring that pulses again and again toasts once (" + (await golds()) + ")");
    await page.evaluate(() => { window.__gold = [46, -34]; });
    await frames(6);
    await wait(page, () => window.__toasts.filter((t) => /gold ring/.test(t)).length >= 2, null, 5000).catch(() => {});
    check((await golds()) === 2, "a second ring toasts once more");
    check(await page.evaluate(() => FISH.save.places.loon.lg >= 1), "and the save knows the ring was seen");
    // in a fight the ring stays quiet, and is said when the fight is over
    await stage(page, {});
    await page.evaluate(() => { window.__gold = [10, -40]; });
    await frames(6);
    check((await golds()) === 2 && (await page.evaluate(() => FISH.G.phase)) === "reel", "a new ring in the middle of a fight is not said (" + (await golds()) + ")");
    await page.evaluate(() => FISH.newCast());
    await wait(page, () => FISH.G.phase === "cast");
    await frames(6);
    await wait(page, () => window.__toasts.filter((t) => /gold ring/.test(t)).length >= 3, null, 5000).catch(() => {});
    check((await golds()) === 3, "it is said after the fight");
    await page.evaluate(() => { window.__gold = null; FISH.rises.spawn = window.__spawn; FISH.startMode("free"); });
    check(await page.evaluate(() => FISH.G.goldAt === null), "a new mode forgets the last ring");

    // ---- the flash ----
    console.log("     the flash");
    await stage(page, {}, [{ type: "strike" }]);
    await frames();
    check(await page.evaluate(() => !document.querySelector("#flash").classList.contains("photo") && document.querySelector("#flash").classList.contains("go")), "the strike flash is the plain (red) one, with no \"photo\" class");
    const c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.59, cm: 34, junk: false });
    check(c.badges.includes("TROPHY") && c.photoFlashes > 0, "a trophy flash is the \"photo\" flash (" + c.photoFlashes + ")");
    // the catch view: on a tall phone the card covers the bottom, and the world is told how much (setView "bottom")
    const view = () => page.evaluate(() => { const v = window.__views.filter((x) => x.mode === "catch").pop(), card = document.querySelector("#catch .card"), g = document.querySelector("#game"); return { v, h: card.offsetHeight, gh: g.clientHeight, w: card.offsetWidth, gw: g.clientWidth }; });
    let vw = await view();
    const wantB = Math.min(0.62, (vw.h + 24) / vw.gh);
    check(vw.v && vw.v.inset === 0 && vw.v.bottom > 0.15 && Math.abs(vw.v.bottom - wantB) < 0.02, "on a tall phone the catch view gets bottom = the share of the height the card covers (" + JSON.stringify(vw.v) + ", card " + vw.h + " of " + vw.gh + " px)");
    await page.setViewportSize({ width: 844, height: 390 });
    await frames(6);
    vw = await view();
    check(vw.v && vw.v.bottom === 0 && vw.v.inset > 0.2 && vw.v.inset <= 0.6, "and on a wide screen it is 0, with the inset for the card at the side (" + JSON.stringify(vw.v) + ")");
    await page.setViewportSize({ width: 390, height: 844 });
    await frames(6);
    await stage(page, {}, [{ type: "strike" }]);
    await frames();
    check(await page.evaluate(() => !document.querySelector("#flash").classList.contains("photo")), "and the next strike is plain again");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");

    // ---- the chip: the count, then the weight (whole kg from 100 kg) ----
    console.log("     the HUD chip");
    const chip = async (kgs, mode) => {
      await page.evaluate(([kgs, mode]) => { FISH.G.mode = mode; FISH.G.bag = kgs.map((kg) => ({ id: "perch", kg })); FISH.G.casts = 0; FISH.newCast(); }, [kgs, mode]);
      return page.textContent("#modeChip");
    };
    check((await chip([160], "free")) === "1 fish · 160 kg", "160 kg shows in whole kg (" + (await page.textContent("#modeChip")) + ")");
    check((await chip([99.5], "free")) === "1 fish · 99.5 kg" && (await chip([12.34], "free")) === "1 fish · 12.3 kg", "under 100 kg it keeps the decimal (" + (await page.textContent("#modeChip")) + ")");
    check((await chip([112.4, 100.4], "derby")) === "1/10 · 213 kg", "the derby chip too (" + (await page.textContent("#modeChip")) + ")");
    check(await page.evaluate(() => document.querySelector("#modeChip b").textContent === "213 kg"), "the weight is a part of its own, which the chip never cuts");
    await page.evaluate(() => { FISH.G.bag = []; });

    // ---- the report on a short cast ----
    console.log("     the report on a short cast");
    // a cast that lands (x, z) from the dock; the report is what the player reads
    const lands = async (x, z, casts) => {
      await page.evaluate(([x, z, casts]) => {
        FISH.G.mode = "free"; FISH.newCast();
        FISH.rises.near = () => null;   // no rising fish to shout about: the report reads the zone
        FISH.save.casts = casts; FISH.G.cast = null;
        FISH.G.step = "flight"; FISH.G.flight = { step: () => ({ x, y: 0, z, done: true, land: "water", lineOut: Math.hypot(x, z), spool: 0 }) };
      }, [x, z, casts]);
      await wait(page, () => FISH.G.phase === "reel");
      return page.evaluate(() => ({ zone: document.querySelector("#report .zone").textContent, dist: document.querySelector("#report .dist").textContent }));
    };
    // (while the goal that opens Stump Bay is open, the first short cast and every fifth one after it hear the hint)
    await page.evaluate(() => { FISH.G.shortN = 0; });
    let rp = await lands(5, -9, 0);
    check(rp.zone === "Big fish live far out.", "a short first cast at Loon Lake says the big fish live far out (" + JSON.stringify(rp) + ")");
    rp = await lands(0, -30, 0);
    check(rp.zone === "Your longest cast yet!", "a long cast reads as before (" + JSON.stringify(rp) + ")");
    rp = await lands(5, -9, 13);
    check(rp.zone !== "Big fish live far out.", "the next short cast does not say it again (" + JSON.stringify(rp) + ")");
  } catch (e) { check(false, "exception in part F: " + (e && e.stack)); }
  check(errors.length === 0, "part F: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part H: the fight polish: the first fish, toasts, the prompt hold, the gauge ================= */
if (part("H")) {
  const { browser, page, errors } = await open({ query: "?debug" });
  try {
    await stand(page);
    await spy(page);
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    const frames = (n = 3) => page.evaluate((n) => new Promise((res) => { const f = () => (--n > 0 ? requestAnimationFrame(f) : res()); requestAnimationFrame(f); }), n);
    // a cast that lands (x, z) from the dock, with no ring; the plan of the sim that it starts
    const lands = async (x, z) => {
      await page.evaluate(([x, z]) => {
        FISH.G.mode = "free"; FISH.newCast();
        FISH.rises.near = () => null;
        FISH.G.cast = null;
        FISH.G.step = "flight"; FISH.G.flight = { step: () => ({ x, y: 0, z, done: true, land: "water", lineOut: Math.hypot(x, z), spool: 0 }) };
      }, [x, z]);
      await wait(page, () => FISH.G.phase === "reel");
      return page.evaluate(() => { const p = FISH.G.sim.plan; return { id: p ? p.id : null, kg: p ? p.kg : 0, gift: !!FISH.G.gift, gifted: !!FISH.G.gifted, caught: FISH.save.caught }; });
    };

    // ---- the first fish of a fresh save: a sure bite from a small, easy fish, landed in 25 s ----
    console.log("     the first fish");
    let fb = await lands(-12, -18);
    check(["pumpkinseed", "perch"].includes(fb.id) && fb.kg < 0.5 && fb.gift && !fb.gifted && fb.caught === 0, `a fresh save's first cast in the water: a sure bite from a small pumpkinseed or perch (${JSON.stringify(fb)})`);
    // reeled in before it strikes: the next cast still has the sure bite (it is used up by the strike, not by the cast)
    await page.evaluate(() => FISH.newCast());
    await wait(page, () => FISH.G.phase === "cast");
    fb = await lands(-12, -18);
    check(["pumpkinseed", "perch"].includes(fb.id) && fb.gift && !fb.gifted, `a first cast reeled in before the strike leaves the sure bite for the next cast (${JSON.stringify(fb)})`);
    // a player who holds the crank key: reel fast and never slow down (2.4 turns a second), set the hook at the strike. The
    // first fish does not mind a fast lure: it still strikes, and the player lands it within 25 s of the splash
    const firstFight = (rps) => page.evaluate(async (rps) => {
      const G = FISH.G, t0 = performance.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const { REEL_UI } = await import("./js/reel.js"), keep = REEL_UI.keyRps;
      REEL_UI.keyRps = rps;
      FISH.crank.keyHold(true);
      let struck = false, gifted = null;
      const heads = new Set(), p = document.querySelector("#prompt");
      while (performance.now() - t0 < 40000 && G.phase === "reel") {
        const s = G.sim.state;
        if (!p.hidden) heads.add(p.querySelector(".p1 span").textContent);
        if (s.phase === "strike" && !struck) { struck = true; await wait(250); gifted = !!G.gifted; G.hookReq = true; }
        await wait(50);
      }
      FISH.crank.keyHold(false);
      REEL_UI.keyRps = keep;
      return { phase: G.phase, s: G.sim && +G.sim.state.t.toFixed(1), struck, gifted, heads: [...heads].filter((h) => /Nothing|Too fast/.test(h)) };
    }, rps);
    const fast = await firstFight(2.4);
    check(fast.struck && fast.gifted && fast.phase === "catch" && fast.s <= 25 && !fast.heads.length, `a player who reels fast (2.4 turns a second) still gets the strike, which uses up the sure bite, and lands it within 25 s (${JSON.stringify(fast)})`);
    if (fast.phase === "catch") { await sleep(PAUSE); await page.evaluate(() => document.querySelector("#catchGo").click()); await wait(page, () => FISH.G.phase === "cast", null, 20000); }
    // (a fresh save again, for the plain player)
    await page.evaluate(() => { FISH.save.caught = 0; FISH.G.gifted = false; });
    fb = await lands(-12, -18);
    // a plain player: reel slowly and steadily (1.1 turns a second, as the casual player of fight.sim), set the hook at the
    // strike, keep reeling (the rod stays where touch play leaves it)
    const play = await page.evaluate(async () => {
      const G = FISH.G, t0 = performance.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const { REEL_UI } = await import("./js/reel.js"), rps = REEL_UI.keyRps;
      REEL_UI.keyRps = 1.1;
      FISH.crank.keyHold(true);
      let struck = false;
      // the log of the fight: each change of the prompt (s, as the player sees it), and any toast on the crank
      const log = (window.__fl = []), onCrank = (window.__fc = []), p = document.querySelector("#prompt"), toast = document.querySelector("#toast");
      const keyNow = () => (p.hidden ? "" : p.querySelector(".p1 span").textContent + " | " + p.querySelector(".p2").textContent);
      const obs = new MutationObserver(() => { const k = keyNow(); if (G.phase === "reel" && (!log.length || log[log.length - 1][1] !== k)) log.push([performance.now() / 1000, k]); });
      obs.observe(p, { subtree: true, childList: true, characterData: true, attributes: true });
      while (performance.now() - t0 < 40000 && G.phase === "reel") {
        const s = G.sim.state;
        if (s.phase === "strike" && !struck) { struck = true; await wait(250); G.hookReq = true; }
        if (toast.classList.contains("on")) {
          const a = toast.getBoundingClientRect(), b = document.querySelector("#crankBox").getBoundingClientRect();
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) onCrank.push(toast.textContent);
        }
        await wait(50);
      }
      obs.disconnect();
      FISH.crank.keyHold(false);
      REEL_UI.keyRps = rps;
      // (game time from the splash: a slow test browser can fall behind the wall clock)
      return { phase: G.phase, sim: G.sim && G.sim.state.phase, s: G.sim && +G.sim.state.t.toFixed(1), ms: Math.round(performance.now() - t0), struck };
    });
    check(play.struck && play.phase === "catch" && play.s <= 25, `and a player who reels and sets the hook lands it within 25 s of the splash (${JSON.stringify(play)})`);
    // the busy fight: from the splash to the landing no prompt changes within 0.35 s, unless to the strike, a snap risk or a
    // jump; and no toast sits on the crank
    const fl = await page.evaluate(() => window.__fl.slice()), fc = await page.evaluate(() => window.__fc.slice());
    const URGENT = /Set the hook|jumped|jumps again|Too tight|drag is slipping|line is on|in the weeds|spool is almost empty/;
    const quick = fl.slice(1).filter((x, i) => x[0] - fl[i][0] < 0.35 && !URGENT.test(x[1]));
    check(fl.length >= 4 && !quick.length && !fc.length, `the first fight: ${fl.length} prompts, none changed within 0.35 s but for an urgent one, and no toast on the crank (${JSON.stringify(quick.slice(0, 3))}${fc.length ? "; on the crank: " + fc[0] : ""})`);
    if (play.phase === "catch") { await sleep(PAUSE); await page.evaluate(() => document.querySelector("#catchGo").click()); await wait(page, () => FISH.G.phase === "cast", null, 20000); }
    // the next cast has the normal odds: in deep water, where neither of them lives, no perch and no pumpkinseed
    fb = await lands(0, -40);
    check(!["pumpkinseed", "perch"].includes(fb.id), `the next cast has the normal odds (${JSON.stringify(fb)})`);
    await page.evaluate(() => FISH.newCast());
    await wait(page, () => FISH.G.phase === "cast");

    // ---- the toast queue: three news in one frame each get 1.2 s ----
    console.log("     the toast queue");
    await page.evaluate(() => {
      const el = document.querySelector("#toast"), d = Object.getOwnPropertyDescriptor(Node.prototype, "textContent"), t0 = performance.now();
      window.__tq = [];
      Object.defineProperty(el, "textContent", { get() { return d.get.call(this); }, set(v) { window.__tq.push([v, performance.now() - t0]); d.set.call(this, v); } });
    });
    await page.evaluate(() => { delete FISH.save.seen.run; });
    await sleep(2500);   // the toasts before have gone
    // ("Fish on!" is the hook set's banner now, not a toast: the big fish's warning comes first, so the run tip waits)
    await stage(page, { fish: { id: "walleye", kg: 5, known: false } }, [{ type: "hooked", id: "walleye" }, { type: "drag" }, { type: "run" }]);
    const early = await page.evaluate(() => !!FISH.save.seen.run);
    await sleep(4200);
    const tq = await page.evaluate(() => window.__tq.slice());
    const want = ["It is a big one!", "It is running! Let the drag work."], got = tq.map((x) => x[0]);
    const gaps = tq.slice(1).map((x, i) => Math.round(x[1] - tq[i][1]));
    check(want.every((w) => got.includes(w)) && gaps.every((g) => g >= 1150), `the hook set, a run and a drag in one frame: each toast is up 1.2 s before the next (${JSON.stringify(got)}, gaps ${gaps.join(", ")} ms)`);
    check(!early && (await page.evaluate(() => !!FISH.save.seen.run)), `the one-time run tip is marked seen when it shows, not before (${early} at once)`);
    await page.evaluate(() => { const el = document.querySelector("#toast"); delete el.textContent; });

    // ---- toasts in the reel stay off the crank: both reel sides, a tall phone, a small one and a wide screen, in touch and
    // in motion play (where the pull meter shows top right). Off the drag bar too, with its widest label, and a long toast
    // (a legend's stage name, four lines on a small phone) stays off them as well ----
    console.log("     the toast place");
    const LONG = "It runs down the river! Steer it off the logs!", SHORT = "Too fast. It turned away. Reel slower.";
    const toastCases = [["touch", 390, 844], ["touch", 360, 640], ["touch", 844, 390], ["touch", 1280, 800], ["motion", 390, 844], ["motion", 360, 640]];
    for (const [input, W, H] of toastCases) for (const side of ["right", "left"]) for (const msg of W === 360 ? [SHORT, LONG] : [SHORT]) {
      if (input === "motion" && !(await page.evaluate(() => FISH.G.input === "motion"))) {
        await page.evaluate(async () => { await FISH.Motion.request(); FISH.G.input = "motion"; });
        await wait(page, () => FISH.Motion.live, null, 10000);
        await page.evaluate(() => { FISH.Motion.mode = "portrait"; window.__phone.pose(60); });
      }
      await page.setViewportSize({ width: W, height: H });
      await page.evaluate((side) => { document.querySelector("#game").dataset.reelSide = side; document.querySelector("#dragName").textContent = "DRAG: HEAVY"; }, side);
      await stage(page, {});
      await frames(4);
      await sleep(1300);
      await stage(page, {}, [msg === SHORT ? { type: "refuse" } : { type: "phase", n: 2, of: 3, name: LONG }], false);
      await toastIs(page, msg);
      await frames(3);
      const r = await page.evaluate(() => {
        const R = (sel) => { const e = document.querySelector(sel); if (!e || e.hidden || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
        const cue = document.querySelector("#rodCue");
        return { toast: R("#toast"), crank: R("#crankBox"), gauge: R("#gaugeBox"), cue: cue && !cue.hidden ? R("#rodCue span") : null, prompt: R("#prompt .p1"), pull: R("#pullStrength"), drag: R("#dragBar"), layout: FISH.G.layout, on: document.querySelector("#toast").classList.contains("on") };
      });
      const hit = (a, b) => !!a && !!b && a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y;
      const hits = ["crank", "gauge", "cue", "prompt", "pull", "drag"].filter((k) => hit(r.toast, r[k]));
      check(r.on && !!r.toast && !hits.length && r.toast.x >= 0 && r.toast.r <= W && (input === "touch" || !!r.pull), `${input} ${W}x${H}, reel side ${side} (${r.layout})${msg === LONG ? ", a long toast" : ""}: the toast is clear of the crank, the gauge, the rod cue, the prompt, the drag bar${input === "motion" ? " and the pull meter" : ""} (toast ${JSON.stringify(r.toast)}${hits.length ? "; on the " + hits.map((k) => k + " " + JSON.stringify(r[k])).join(", ") : ""})`);
    }
    await page.evaluate(() => { document.querySelector("#game").dataset.reelSide = FISH.save.reelSide; FISH.G.input = "touch"; });
    await page.setViewportSize({ width: 390, height: 844 });
    await frames(4);

    // ---- the prompt hold: 0.35 s, unless the new prompt is urgent ----
    console.log("     the prompt hold");
    await page.evaluate(() => {
      const real = performance.now.bind(performance), C = (window.__c = { t: real(), on: false, off: 0 });
      performance.now = () => (C.on ? (C.t += 0.05) : real() + C.off);
      window.__freeze = () => { C.t = performance.now(); C.on = true; };
      window.__thaw = () => { C.off = C.t - real(); C.on = false; };
    });
    const jump = (ms) => page.evaluate((ms) => { window.__c.t += ms; }, ms);
    const set = async (o) => { await page.evaluate((o) => { const s = FISH.G.sim.state, { fish, ...rest } = o; Object.assign(s, rest); if (fish) Object.assign(s.fish, fish); }, o); await frames(3); };
    await page.evaluate(() => window.__freeze());
    await prompts(page, {}, [], "Pump and reel.");
    // (the prompt is new from now: the frozen clock still creeps a little with each look at it)
    await frames(2);
    await page.evaluate(() => { FISH.G.hold.at = performance.now(); });
    await set({ slack: true, slackT: 1 });
    check((await promptNow(page)).h === "Pump and reel.", "slack line just after a new prompt: the prompt holds (" + (await promptNow(page)).h + ")");
    await jump(400); await frames();
    check((await promptNow(page)).h === "Slack line! Reel it in.", "after 0.35 s it changes (" + (await promptNow(page)).h + ")");
    await set({ slack: false, slackT: 0, tfrac: 0.92 });
    check((await promptNow(page)).h === "Too tight! Stop reeling.", "a snap risk does not wait (" + (await promptNow(page)).h + ")");
    await set({ tfrac: 0.3, fish: { move: "jump" } });
    check((await promptNow(page)).h === "It jumped! Lower the rod!", "nor does a jump (" + (await promptNow(page)).h + ")");
    await set({ fish: { move: "swim" } }); await jump(1000); await frames();
    await set({ phase: "strike" });
    check(/Set the hook!$/.test((await promptNow(page)).h), "nor the strike (" + (await promptNow(page)).h + ")");
    await page.evaluate(() => window.__thaw());

    // ---- the gauge: SLACK after 0.3 s, and words big enough to read on a 360 px phone ----
    console.log("     the gauge");
    await page.setViewportSize({ width: 360, height: 640 });
    await frames(4);
    await page.evaluate(() => {
      const c = FISH.gauge.cv.getContext("2d"), f = c.fillText;
      window.__gt = [];
      c.fillText = function (t, ...a) { window.__gt.push([String(t), parseFloat((/(\d+(?:\.\d+)?)px/.exec(this.font) || [])[1])]); return f.call(this, t, ...a); };
    });
    const gword = async (o, w) => { await stage(page, o); await wait(page, (w) => FISH.gauge.box && FISH.gauge.box.word === w, w, 5000).catch(() => {}); return page.evaluate(() => FISH.gauge.box && FISH.gauge.box.word); };
    check((await gword({ slack: true, slackT: 0.5, tfrac: 0.01 }, "SLACK")) === "SLACK", "the gauge says SLACK when the line has been slack 0.3 s");
    check((await gword({ slack: true, slackT: 0.2, tfrac: 0.01 }, "GOOD")) === "GOOD", "and not before (" + (await page.evaluate(() => FISH.gauge.box.word)) + ")");
    for (const [o, w] of [[{ tfrac: 0.92 }, "TOO TIGHT"], [{ slip: 0.8, tfrac: 0.45 }, "SLIPPING"], [{ tfrac: 0.3, rub: 0.5, rubKind: "stump", rubSide: 1 }, "GOOD"], [{ tfrac: 0.2, beaten: true, fish: { stamina: 0.05 } }, "GOOD"]]) await gword(o, w);
    await sleep(600);
    const gt = await page.evaluate(() => window.__gt.slice()), words = ["GOOD", "TIGHT", "SLIPPING", "SLACK", "TOO TIGHT", "TENSION"];
    const small = gt.filter(([t, px]) => words.includes(t) ? px < 12 : px < 10), seenW = [...new Set(gt.map((x) => x[0]).filter((t) => words.includes(t) || ["RUB", "FIGHT", "TIRED", "LINE OUT", "DEPTH"].includes(t)))];
    check(gt.length > 20 && !small.length && ["TOO TIGHT", "SLIPPING", "SLACK", "RUB", "FIGHT", "TIRED", "LINE OUT", "DEPTH"].every((t) => seenW.includes(t)), `at 360x640 the state word is 12 px or more and every gauge label 10 px or more (${seenW.join(", ")}; too small: ${JSON.stringify(small.slice(0, 5))})`);
    // a long fish name gets a smaller font (10 px or more), and is never squeezed narrower than it is drawn
    const names = [];
    for (const id of ["golden", "smallmouth", "largemouth", "perch"]) {
      await stage(page, { tfrac: 0.3, rub: 0, fish: { id, known: true, stamina: 0.6 } });
      await wait(page, () => FISH.gauge.box && FISH.gauge.box.name, null, 5000).catch(() => {});
      await sleep(300);
      names.push(await page.evaluate((id) => ({ id, ...(FISH.gauge.box.name || {}) }), id));
    }
    check(names.every((n) => n.px >= 10 && n.w <= n.max + 0.5), `at 360x640 every fish name fits its room at 10 px or more (${names.map((n) => n.id + " " + n.px + "px " + Math.round(n.w) + "/" + Math.round(n.max)).join(", ")})`);
    // the rub band has a row of its own (the fish name's) and is wide enough to read beside TOO TIGHT, and a light rub
    // shows as a light rub
    const rubAt = async (o) => {
      await stage(page, { rubKind: "stump", rubSide: 1, ...o });
      // (the band eases to the new rub: wait for it, a slow test browser draws few frames)
      await wait(page, (r) => Math.abs(FISH.gauge.v.rub - r) < 0.005 && Math.abs(FISH.gauge.v.t - FISH.G.sim.state.tfrac) < 0.01, o.rub, 8000).catch(() => {});
      await frames(2);
      return page.evaluate(() => ({ word: FISH.gauge.box.word, rub: FISH.gauge.box.rub }));
    };
    const rubTight = await rubAt({ tfrac: 0.92, rub: 0.7 }), rubLight = await rubAt({ tfrac: 0.3, rub: 0.03 });
    check(rubTight.word === "TOO TIGHT" && rubTight.rub && rubTight.rub.w >= 60 && rubLight.rub && rubLight.rub.fill / rubLight.rub.w <= 0.06, `at 360x640 the rub band is ${rubTight.rub ? Math.round(rubTight.rub.w) : "-"} px wide beside TOO TIGHT (60 or more), and a 3% rub fills ${rubLight.rub ? Math.round(100 * rubLight.rub.fill / rubLight.rub.w) : "-"}% of it`);
    await page.setViewportSize({ width: 390, height: 844 });
  } catch (e) { check(false, "exception in part H: " + (e && e.stack)); }
  check(errors.length === 0, "part H: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part J: goals, today's goal, the next goal, and help on the way ================= */
// ?day=2026-10-03 sets the day of today's goal. A fresh save at Loon Lake: the title line, the ring tip, the help for a
// short caster (the hint and the big ring), three sweet casts, the goal of a 40 m cast, the first fish of the day, a goal
// from a ring, the count of kinds on the card, the Places goals, the same goal after a reload, and the journal
if (part("J")) {
  const DAY = "2026-10-03";
  const { browser, page, errors } = await open({ query: "?debug&day=" + DAY });
  try {
    await stand(page);
    await spy(page);
    await logToasts(page);
    const frames = (n = 3) => page.evaluate((n) => new Promise((res) => { const f = () => (--n > 0 ? requestAnimationFrame(f) : res()); requestAnimationFrame(f); }), n);
    const count = async (t) => (await toastsNow(page)).filter((x) => x === t).length;
    // ---- the title: today's goal ----
    const want = todayLine(loadSave(null), DAY);
    check((await page.textContent("#tday")) === want && /^Today: land .* at Loon Lake\./.test(want), "the title shows today's goal (" + JSON.stringify(await page.textContent("#tday")) + ")");
    check((await page.textContent("#tbest")) === "Land a fish of 3.5 kg or more here to open Stump Bay.", "and above it the goal that opens Stump Bay");

    // ---- the ring tip, once, for a ring within reach (the rings here rise only where the test says) ----
    console.log("     the ring tip");
    // (the sure first bite of a fresh save is used up: these casts get the normal fish)
    await page.evaluate(() => { FISH.G.gifted = true; });
    await page.evaluate(() => { FISH.startMode("free"); window.__rise = null; FISH.rises.step = function () { const e = window.__rise; return e ? [{ type: "rise", x: e[0], z: e[1], gold: false }] : []; }; });
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { window.__rise = [0, -40]; });
    await frames(8);
    const TIP = "A fish is rising. Cast into the ring. Feeding fish bite more often.";
    check((await count(TIP)) === 0 && (await page.evaluate(() => !FISH.save.seen["ring.tip"])), "a ring 40 m out gives no tip");
    // other news on screen: the tip waits for a quiet moment (it never pushes news out of the queue). (The goal reminder
    // goes first, so its own timer cannot take the news off while the test holds it up)
    await wait(page, () => !document.querySelector("#toast").classList.contains("on"), null, 10000);
    await page.evaluate(() => { document.querySelector("#toast").classList.add("on"); window.__rise = [6, -14]; });
    await frames(6);
    check((await count(TIP)) === 0 && (await page.evaluate(() => !FISH.save.seen["ring.tip"])), "a ring within 25 m while other news is up: the tip waits");
    await page.evaluate(() => { document.querySelector("#toast").classList.remove("on"); });
    check((await toastIs(page, TIP)) === TIP, "then a ring within 25 m: \"" + TIP + "\"");
    await frames(10);
    check((await count(TIP)) === 1 && (await page.evaluate(() => FISH.save.seen["ring.tip"] === 1)), "said once, and the save remembers (" + (await count(TIP)) + ")");

    // ---- the hint for a short caster: the first short cast, then every fifth ----
    console.log("     the short-cast hint");
    await page.evaluate(() => { window.__rise = null; FISH.G.shortN = 0; });
    const HINT = "Big fish live far out.";
    const hints = [];
    for (let i = 0; i < 6; i++) hints.push((await landAt(page, -5, -9 - i * 0.3)).zone);
    check(hints[0] === HINT && hints.slice(1, 5).every((z) => z !== HINT) && hints[5] === HINT, "while the Loon goal is open, a short cast hears \"" + HINT + "\" on the 1st and the 6th short cast (" + JSON.stringify(hints) + ")");
    check((await landAt(page, 0, -26)).zone !== HINT, "a cast of 26 m does not");

    // ---- the big ring: after 20 casts in the water with the goal open, a ring close in carries a big fish ----
    console.log("     the big ring");
    await page.evaluate(() => { FISH.newCast(); FISH.G.dry = { at: "loon", n: 19 }; FISH.rises.list.push({ x: 6, z: -14, ttl: 30, species: "perch", gold: false, pulse: 99 }); window.__rise = [6, -14]; });
    await frames(8);
    const BIG = "A big fish is rising close in.";
    check((await count(BIG)) === 0 && (await page.evaluate(() => !FISH.rises.list[0].big)), "after 19 casts in the water, no big ring yet");
    await page.evaluate(() => { FISH.G.dry.n = 20; });
    check((await toastIs(page, BIG)) === BIG, "after 20: \"" + BIG + "\"");
    await frames(10);
    const ring = await page.evaluate(() => ({ big: FISH.rises.list[0].big, species: FISH.rises.list[0].species, ttl: FISH.rises.list[0].ttl, n: FISH.G.dry.n }));
    check((await count(BIG)) === 1 && ring.big && ring.species === "pike" && ring.ttl >= 85 && ring.n === 20, "said once; the ring now carries a pike and stays up 90 s, and the help goes on until its fish is landed (" + JSON.stringify(ring) + ")");
    // one big ring at a time: a second ring close in stays plain while the big one is up
    await page.evaluate(() => { FISH.rises.list.push({ x: -6, z: -16, ttl: 30, species: "perch", gold: false, pulse: 99 }); window.__rise = [-6, -16]; });
    await frames(8);
    check((await count(BIG)) === 1 && (await page.evaluate(() => !FISH.rises.list[1].big)), "one big ring at a time: a second ring close in stays plain");
    await page.evaluate(() => { window.__rise = null; });
    const into = await landAt(page, 6.5, -14.5);
    check(into.ring && into.zone === "Right on the rising fish!" && into.plan && into.plan.id === "pike", "a cast into it: a sure bite from the pike (" + JSON.stringify(into) + ")");
    // its fish is hooked (the ring goes with it, as handleEvent does) and lost: the next ring close in carries a big fish
    await page.evaluate(() => { FISH.rises.take(FISH.G.ring); FISH.newCast(); window.__rise = [-6, -16]; });
    await frames(10);
    const again = await page.evaluate(() => ({ big: FISH.rises.list.map((g) => !!g.big), species: FISH.rises.list[0].species }));
    check((await count(BIG)) === 2 && again.big.join() === "true" && again.species === "pike", "a big fish lost: the next ring close in carries one again, and says so (" + JSON.stringify(again) + ")");
    await page.evaluate(() => { window.__rise = null; FISH.rises.list.length = 0; });
    const ft = await page.evaluate(() => { const G = FISH.G; G.mode = "derby"; const big = G.dry; G.dry = { at: "loon", n: 30 }; FISH.rises.list.push({ x: 4, z: -12, ttl: 60, species: "perch", gold: false, pulse: 99 }); window.__rise = [4, -12]; return !!big; });
    await frames(10);
    check(ft && (await count(BIG)) === 2 && (await page.evaluate(() => !FISH.rises.list[0].big)), "in a derby there is no big ring (the derby ranks stay where they are)");
    await page.evaluate(() => { window.__rise = null; FISH.rises.list.length = 0; FISH.G.mode = "free"; FISH.G.dry = null; });

    // ---- three sweet casts in a row ----
    console.log("     three sweet casts");
    // (castParams' result, as much of it as the game reads: the ?debug line shows v0, pitch and clock)
    const SWEET = { verdict: "sweet", late: false, yaw: 0, v0: 22, pitch: 30, clock: "11:00" }, HIGH = { ...SWEET, verdict: "high", pitch: 50 };
    const s1 = await landAt(page, -8, -26, { cast: SWEET }), s2 = await landAt(page, 8, -26, { cast: SWEET }), s3 = await landAt(page, 0, -28, { cast: SWEET });
    const after3 = await page.evaluate(() => ({ streak: FISH.G.streak, boost: !!FISH.G.boostNext, best: FISH.save.bestRun }));
    check(s1.zone !== s3.zone && s2.zone !== "Three sweet casts! A big fish is near." && s3.zone === "Three sweet casts! A big fish is near." && s3.streak && !s1.streak, "the third sweet cast in a row lights up the report: \"" + s3.zone + "\"");
    check(after3.streak === 3 && after3.boost && after3.best === 3, "and the next cast in the water will bring a bigger fish; the best run, 3, is saved (" + JSON.stringify(after3) + ")");
    const s4 = await landAt(page, 0, -27, { cast: HIGH });
    const after4 = await page.evaluate(() => ({ streak: FISH.G.streak, boost: !!FISH.G.boostNext, best: FISH.save.bestRun }));
    check(!s4.streak && after4.streak === 0 && !after4.boost && after4.best === 3, "a cast that is not sweet ends the run, and uses up the boost (" + JSON.stringify(after4) + ")");
    // the boost reaches the fish: the same cast (same seed, same spot, the same kind of fish), with and without it.
    // (A seed that rolls a fish over the usual range can weigh the same both ways: three seeds, one at least heavier)
    const replay = async (seed, armed) => {
      await page.evaluate(([seed, armed]) => { FISH.G.seed = seed; FISH.G.casts = 6; FISH.G.boostNext = armed; FISH.G.force = { species: "smallmouth", bite: true }; }, [seed, armed]);
      return (await landAt(page, 0, -27, { cast: HIGH })).plan.kg;
    };
    const weighs = [];
    for (const seed of [4242, 777, 31337]) weighs.push([await replay(seed, false), await replay(seed, true)]);
    await page.evaluate(() => { FISH.G.force = null; });
    check(weighs.every(([a, b]) => b >= a) && weighs.some(([a, b]) => b > a), "the cast after three sweet casts brings a bigger fish: the same casts weigh " + weighs.map(([a, b]) => a + " -> " + b + " kg").join(", "));
    await page.evaluate(() => { FISH.G.mode = "derby"; });
    for (let i = 0; i < 3; i++) await landAt(page, -6 + i * 6, -27, { cast: SWEET });
    check(await page.evaluate(() => FISH.G.streak === 0 && !FISH.G.boostNext), "in a derby sweet casts make no run");
    await page.evaluate(() => { FISH.G.mode = "free"; FISH.G.castsLeft = Infinity; });
    // only casts in the water count: three sweet casts onto the shore make no run, and one ends a run
    const shore = [];
    for (let i = 0; i < 3; i++) shore.push(await landAt(page, 0, 3, { cast: SWEET, land: "land" }));
    const ashore = await page.evaluate(() => ({ streak: FISH.G.streak, boost: !!FISH.G.boostNext }));
    check(ashore.streak === 0 && !ashore.boost && shore.every((x) => !x.streak), "three sweet casts onto the shore make no run and arm nothing (" + JSON.stringify(ashore) + ")");
    await landAt(page, -8, -26, { cast: SWEET }); await landAt(page, 8, -26, { cast: SWEET });
    await landAt(page, 0, 3, { cast: SWEET, land: "land" });
    check(await page.evaluate(() => FISH.G.streak === 0), "two sweet casts, then one onto the shore: the run ends");
    // the third sweet cast in a row lands in a ring: the report still says so
    await landAt(page, -8, -26, { cast: SWEET }); await landAt(page, 8, -26, { cast: SWEET });
    await page.evaluate(() => { FISH.rises.list.push({ x: 0, z: -28, ttl: 30, species: "perch", gold: false, pulse: 99 }); });
    const inRing = await landAt(page, 0.5, -28, { cast: SWEET });
    await page.evaluate(() => { FISH.rises.list.length = 0; FISH.G.boostNext = false; FISH.G.streak = 0; });
    check(inRing.ring && inRing.zone === "Three sweet casts! A big fish is near." && inRing.streak, "the third sweet cast lands in a ring: the report still lights up (" + JSON.stringify(inRing) + ")");

    // ---- a goal from a cast: 40 m ----
    console.log("     the goals");
    await landAt(page, 0, -41);
    check((await toastIs(page, "Goal done: Cast 40 m.")) === "Goal done: Cast 40 m." && (await page.evaluate(() => FISH.save.places.loon.g === 1)), "a 41 m cast: \"Goal done: Cast 40 m.\", and the save keeps it");
    await sleep(400);
    check(has(await logNow(page), "S.sfx", "record"), "with the record sting");
    await landAt(page, 0, -42);
    await sleep(1500);
    check((await count("Goal done: Cast 40 m.")) === 1, "a second 40 m cast is not news");

    // ---- the first fish of the day, from a ring and a cast stopped short: all the news in one toast, a line each. It is
    // the first fish of this new player too: that line says "Your first fish!" in place of the day's line ----
    await page.evaluate(() => { FISH.newCast(); window.__toasts.length = 0; window.__log.length = 0; FISH.G.landing = { x: 6, z: -14, dist: 15.2, ring: true, feather: true }; });
    let c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.35, cm: 27, junk: false });
    await sleep(1600);
    const t1 = await toastsNow(page), NEWS1 = "Your first fish!\nGoal done: Land a fish from a rising ring.\nGoal done: Stop a cast short. Land a fish.";
    check(t1.includes(NEWS1) && has(await logNow(page), "S.sfx", "record"), "a new player's first fish does two goals: one toast says \"Your first fish!\" (not the day's line) and both goals, a line each, with the record sting (" + JSON.stringify(t1) + ")");
    const shown = await page.evaluate(() => { const t = document.querySelector("#toast"), r = t.getBoundingClientRect(), card = document.querySelector("#catch .card").getBoundingClientRect(); return { on: t.classList.contains("on"), lines: Math.round(r.height / parseFloat(getComputedStyle(t).lineHeight)), clear: r.bottom <= card.top, top: r.top >= 0 }; });
    check(shown.on && shown.lines >= 3 && shown.clear && shown.top, "the news shows over the catch screen, three lines, clear of the card (" + JSON.stringify(shown) + ")");
    check(c.badges.join() === "NEW SPECIES" && c.found === "1 of 13 found here.", "a new find says how much of the place is found, the journal's count: \"" + c.found + "\"");
    const sv = await page.evaluate(() => JSON.parse(JSON.stringify(FISH.save)));
    check(sv.places.loon.g === 7 && sv.today.d === DAY && sv.today.k === dailyGoalK(), "the save: goals 0, 1 and 2 done (g 7), and today's goal is the one of " + DAY + " (" + JSON.stringify(sv.today) + ")");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { FISH.G.landing = { x: 0, z: -20, dist: 20, ring: false, feather: false }; window.__toasts.length = 0; });
    c = await catchCard(page, { id: "walleye", name: "Walleye", kg: 2.1, cm: 50, junk: false });
    check(c.found === "2 of 13 found here." && !(await toastsNow(page)).some((t) => t.includes("Your first fish")), "the next new kind: \"" + c.found + "\", and no first-fish toast");
    c = await (async () => { await click(page, "#catchGo"); await wait(page, () => FISH.G.phase === "cast"); return catchCard(page, { id: "walleye", name: "Walleye", kg: 1.5, cm: 45, junk: false }); })();
    check(c.found === "" && c.badges.indexOf("NEW SPECIES") < 0, "a kind already found has no count line");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");

    // ---- the Places card: Goals: 3 of 6, with the three checked ----
    await page.evaluate(() => FISH.toTitle());
    await page.waitForSelector("#title:not([hidden])");
    const day1 = todayLine(await page.evaluate(() => JSON.parse(JSON.stringify(FISH.save))), DAY);
    check((await page.textContent("#tday")) === day1, "the title shows today's goal with its progress (" + JSON.stringify(await page.textContent("#tday")) + ")");
    await click(page, "#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const pg = await page.evaluate(() => { const c = document.querySelector('.pcard[data-place="loon"]'), d = c.querySelector("details.goals"); return { sum: d.querySelector("summary").textContent, open: d.open, items: [...d.querySelectorAll("li")].map((l) => l.textContent + (l.classList.contains("done") ? "+" : "")) }; });
    check(pg.sum === "Goals: 3 of 6" && pg.open && pg.items.length === 6 && pg.items[0] === "Cast 40 m.+" && pg.items[1] === "Land a fish from a rising ring.+" && pg.items[2] === "Stop a cast short. Land a fish.+" && pg.items.filter((x) => x.endsWith("+")).length === 3, "the Loon Lake card: \"Goals: 3 of 6\", the list, three checked (" + JSON.stringify(pg) + ")");
    await click(page, "#places [data-close]");

    // ---- ?day is never saved: after a reload the goals done are kept, but today's goal and the run of days were never
    // written (part M reloads on the phone's own day) ----
    check(/ 3 of 5\.$/.test(day1), "three fish today: " + JSON.stringify(day1));
    const kept = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("fish.v1")); return { today: s.today, days: s.days, g: s.places.loon.g }; });
    check(JSON.stringify(kept.today) === JSON.stringify({ d: "", k: 0, n: 0, done: 0 }) && kept.days.n === 0 && kept.days.last === "" && kept.g === 7, "under ?day the save keeps the goals done, and not today's goal or the run of days (" + JSON.stringify(kept) + ")");
    await page.reload();
    await page.waitForSelector("#title:not([hidden])", { timeout: 120000 });
    check((await page.textContent("#tday")) === todayLine(loadSave(null), DAY), "after a reload with ?day: today's goal starts over (" + JSON.stringify(await page.textContent("#tday")) + ")");
    await stand(page);
    await spy(page);

    // ---- the journal: the fish caught, the next 3 with their hints, and how many more; the best sweet run ----
    await click(page, "#journalBtn");
    await page.waitForSelector("#journal:not([hidden])");
    const jr = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#jlist .jfish")].map((r) => [r.querySelector("b").textContent, r.querySelector("small").textContent]), note: (document.querySelector("#jlist .jnote") || {}).textContent, sum: document.querySelector("#jsum").textContent }));
    check(jr.rows.length === 5 && jr.rows[0][0] === "Yellow Perch" && jr.rows[1][0] === "Walleye" && jr.rows.slice(2).every((r) => r[0] === "Not caught yet" && /^Try /.test(r[1])) && jr.note === "8 more to find here.",
      "the journal: the 2 fish caught, the next 3 to find with their hints, \"8 more to find here.\" (" + JSON.stringify(jr) + ")");
    check((jr.sum.split("\n")[1] || "") === "Best sweet run: 3", "the summary shows the best sweet run (" + JSON.stringify(jr.sum) + ")");
    await click(page, "#journal [data-close]");

    // ---- the big ring's fish landed: the help for a short caster counts from 0 again ----
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { FISH.G.dry = { at: "loon", n: 24 }; FISH.G.landing = { x: 6, z: -14, dist: 15.2, ring: true, big: true, feather: false }; });
    await catchCard(page, { id: "pike", name: "Northern Pike", kg: 3.1, cm: 80, junk: false });
    check(await page.evaluate(() => FISH.G.dry.n === 0), "a big ring's fish landed: the count of casts starts again");
    await click(page, "#catchGo");
  } catch (e) { check(false, "exception in part J: " + (e && e.stack)); }
  check(errors.length === 0, "part J: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}
function dailyGoalK() { return dailyGoal("2026-10-03", loadSave(null)).k; }

/* ================= part K: the derby: casts back, the unlock on the card, the rank ladder; the goals of other places ================= */
if (part("K")) {
  const DAY = "2026-10-03";
  const { browser, page, errors } = await open({ query: "?debug&day=" + DAY, save: { v: 1, journal: {}, caught: 3, casts: 30, seen: { "ring.tip": 1 } } });
  try {
    await stand(page);
    await spy(page);
    await logToasts(page);
    // ---- a cast onto the shore in a derby gives the cast back, every time ----
    console.log("     casts back in a derby");
    await page.evaluate(() => { FISH.startMode("derby"); FISH.rises.near = () => null; });
    await wait(page, () => FISH.G.phase === "cast");
    const chip0 = await page.textContent("#modeChip");
    const backs = [];
    for (let i = 0; i < 4; i++) {
      const r = await landAt(page, 0, 3, { land: "land" });
      await wait(page, () => FISH.G.step === "ready", null, 10000);
      backs.push({ zone: r.zone, left: await page.evaluate(() => FISH.G.castsLeft), chip: await page.textContent("#modeChip") });
    }
    check(chip0.startsWith("1/10 · ") && backs.every((b) => b.zone === "You cast onto the shore. You get that cast back." && b.left === 10 && b.chip.startsWith("1/10 · ")), "four casts onto the shore: each says \"You get that cast back.\", and the chip keeps cast 1 of 10 (" + JSON.stringify(backs) + ")");

    // ---- a derby catch that opens a place: NEW PLACE first, "It opens Stump Bay.", and after the card where to go ----
    console.log("     the unlock on the catch card");
    let c = await catchCard(page, { id: "walleye", name: "Walleye", kg: 3.6, cm: 62, junk: false });
    check(c.badges[0] === "NEW PLACE" && c.old === "It opens Stump Bay." && c.btn === "Cast again", "the catch card: NEW PLACE first, and \"It opens Stump Bay.\" (" + JSON.stringify({ badges: c.badges, old: c.old, btn: c.btn }) + ")");
    await click(page, "#catchGo");
    check((await toastIs(page, "Stump Bay is open. Go there after the derby.")) === "Stump Bay is open. Go there after the derby." && (await page.evaluate(() => FISH.G.phase === "cast" && document.querySelector("#unlock").hidden)), "after the card: \"Stump Bay is open. Go there after the derby.\", and the derby goes on");

    // ---- the results: the next rank, and the old best on a new best ----
    console.log("     the rank ladder");
    await page.evaluate(() => { FISH.G.castsLeft = 0; });
    await stage(page, { phase: "home" });
    await page.waitForSelector("#results:not([hidden])", { timeout: 15000 });
    const res = () => page.evaluate(() => ({ rank: document.querySelector("#rrank").textContent, next: document.querySelector("#rnext").textContent, nextShown: getComputedStyle(document.querySelector("#rnext")).display !== "none", best: document.querySelector("#rbest").textContent }));
    let r = await res();
    check(r.rank === "DOCK ROOKIE" && r.next === "Next rank: WEEKEND ANGLER at 4 kg." && r.nextShown && r.best === "A new best derby here!", "a 3.6 kg derby: DOCK ROOKIE, \"Next rank: WEEKEND ANGLER at 4 kg.\" (" + JSON.stringify(r) + ")");
    const derby = async (kgs) => {
      await click(page, "#rAgain");
      await wait(page, () => FISH.G.phase === "cast");
      for (const [i, kg] of kgs.entries()) {
        await page.evaluate((last) => { FISH.G.castsLeft = last ? 0 : 5; }, i === kgs.length - 1);
        await catchCard(page, { id: "muskie", name: "Muskellunge", kg, cm: 100, junk: false });
        await click(page, "#catchGo");
      }
      await page.waitForSelector("#results:not([hidden])", { timeout: 15000 });
      return res();
    };
    r = await derby([5.2, 6]);
    check(r.rank === "COTTAGE REGULAR" && r.next === "Next rank: LAKE PRO at 17 kg." && r.best === "A new best derby here! Your old best: 3.6 kg.", "an 11.2 kg derby: the next rank, and the old best (" + JSON.stringify(r) + ")");
    r = await derby([14, 13]);
    check(r.rank === "LOON LAKE CHAMPION" && r.next === "" && !r.nextShown, "at the top rank there is no next rank (" + JSON.stringify(r) + ")");
    await click(page, "#rMenu");
    await page.waitForSelector("#title:not([hidden])");
    await click(page, "#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const facts = await page.evaluate(() => document.querySelector('.pcard[data-place="loon"] .facts').innerText);
    check(/Best derby 27\.0 kg · LOON LAKE CHAMPION/.test(facts), "the Places card shows the best derby and its rank (" + JSON.stringify(facts) + ")");
    await click(page, "#places [data-close]");

    // ---- Stump Bay: a fish turned from the stumps ----
    console.log("     a goal at Stump Bay");
    check(await page.evaluate(async () => await FISH.setPlace("stumps")), "at Stump Bay");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { window.__toasts.length = 0; FISH.G.landing = { x: -10, z: -20, dist: 22, ring: false, feather: false }; });
    await stage(page, { fish: { id: "largemouth", kg: 2, known: true } }, [{ type: "hooked", id: "largemouth" }, { type: "cover", kind: "stumps", side: 1, steer: -1 }, { type: "turned" }]);
    c = await catchCard(page, { id: "largemouth", name: "Largemouth Bass", kg: 2, cm: 45, junk: false });
    // the news waits in the toast queue behind "You turned it!" (and the goal reminder before it): wait until it shows
    const GOAL = "Goal done: Turn a fish from the stumps.";
    const goalToast = (ms) => wait(page, (g) => window.__toasts.some((t) => t.split("\n").includes(g)), GOAL, ms).then(() => "", () => "not shown in " + ms / 1000 + " s: ");
    let late = await goalToast(6000);
    check(!late, "the toast: \"" + GOAL + "\" (" + late + JSON.stringify(await toastsNow(page)) + ")");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => FISH.toTitle());
    await click(page, "#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const sb = await page.evaluate(() => { const d = document.querySelector('.pcard[data-place="stumps"] details.goals'); return { sum: d.querySelector("summary").textContent, done: [...d.querySelectorAll("li.done")].map((l) => l.textContent) }; });
    check(sb.sum === "Goals: 1 of 6" && sb.done.join() === "Turn a fish from the stumps.", "the Stump Bay card shows the goal checked (" + JSON.stringify(sb) + ")");
    await click(page, "#places [data-close]");
    // ---- the same goal again, and the frame that lands the fish takes 3.5 s: the news waits in the queue for more than
    // 3 s, and still shows, with the record sting ----
    await page.evaluate(() => { FISH.save.places.stumps.g = 0; FISH.startMode("free"); });
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => {
      window.__toasts.length = 0; window.__log.length = 0; FISH.G.landing = { x: -10, z: -20, dist: 22, ring: false, feather: false };
      const el = document.querySelector("#catch"), o = new MutationObserver(() => { if (el.hidden) return; o.disconnect(); const t = performance.now(); while (performance.now() - t < 3500); });
      o.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    });
    // turned and landed in one frame: the news is asked for while another toast is up, so it waits in the queue
    await stage(page, { phase: "caught", catch: { id: "largemouth", name: "Largemouth Bass", kg: 2, cm: 45, junk: false }, fish: null }, [{ type: "hooked", id: "largemouth" }, { type: "cover", kind: "stumps", side: 1, steer: -1 }, { type: "turned" }]);
    late = await goalToast(8000);
    check(!late && has(await logNow(page), "S.sfx", "record"), "a slow frame at the catch: the toast still says \"" + GOAL + "\", with the record sting (" + late + JSON.stringify(await toastsNow(page)) + ")");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");
  } catch (e) { check(false, "exception in part K: " + (e && e.stack)); }
  check(errors.length === 0, "part K: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part L: today's goal done two days running; the next legend; the journal's odd finds ================= */
if (part("L")) {
  const DAY = "2026-10-03", five = DAILY.findIndex((g) => g.at === "loon" && g.kind === "count");
  const fish = { pumpkinseed: 1, perch: 1, rockbass: 1, smallmouth: 1, largemouth: 1, walleye: 1, pike: 1, laketrout: 1, muskie: 1, golden: 1, whiskers: 1 };
  const journal = Object.fromEntries(Object.keys(fish).map((id) => [id, { n: 1, kg: 1, cm: 30 }]));
  const save = { v: 1, journal, caught: 11, casts: 90, seen: { "ring.tip": 1, "at.stumps": 1, "at.river": 1, "at.sea": 1, "opened.stumps": 1, "opened.river": 1, "opened.sea": 1 },
    places: { loon: { open: 1, kg: 4 }, stumps: { open: 1, kg: 7 }, river: { open: 1, kg: 9 }, sea: { open: 1 } },
    today: { d: DAY, k: five, n: 4, done: 0 }, days: { n: 1, run: 1, best: 1, last: "2026-10-02" } };
  const { browser, page, errors } = await open({ query: "?debug&day=" + DAY, save });
  try {
    await stand(page);
    await spy(page);
    await logToasts(page);
    // ---- every place open, two legends left: the title names the next legend and when to look ----
    check((await page.textContent("#tbest")) === "Next: the legend of Cedar River. Look for a gold ring at dawn.", "every place open, two legends left: the title names the next legend and when to look (" + JSON.stringify(await page.textContent("#tbest")) + ")");
    check((await page.textContent("#tday")) === "Today: land 5 fish at Loon Lake. 4 of 5.", "today's goal with its progress (" + JSON.stringify(await page.textContent("#tday")) + ")");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await wait(page, () => !document.querySelector("#pause").hidden);
    check((await page.textContent("#pauseSum")).endsWith("\nNext: the legend of Cedar River. Look for a gold ring at dawn."), "the pause card names it too (" + JSON.stringify(await page.textContent("#pauseSum")) + ")");
    await click(page, "#resumeBtn");
    // ---- the fifth fish: today's goal is done, 2 days in a row. It came from a ring after a cast stopped short, and was
    // turned from the weeds, so it does three goals too; "You turned it!" is still up when it lands ----
    await page.evaluate(() => { window.__toasts.length = 0; FISH.G.landing = { x: 0, z: -20, dist: 20, ring: true, feather: true }; });
    await stage(page, { fish: { id: "perch", kg: 0.3, known: true } }, [{ type: "hooked", id: "perch" }, { type: "cover", kind: "weeds", side: 1, steer: -1 }, { type: "turned" }]);
    await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.3, cm: 25, junk: false });
    await sleep(3200);
    const t = await toastsNow(page), lg = await logNow(page);
    const NEWS = "Goal done: Land a fish from a rising ring.\nGoal done: Stop a cast short. Land a fish.\nGoal done: Turn a fish away from cover.\nToday's goal is done. 2 days in a row.";
    check(t.includes("You turned it!") && t.includes(NEWS) && !t.some((x) => x.includes("Your first fish today.")) && has(lg, "S.sfx", "record"), "the fifth fish does three goals and today's goal while \"You turned it!\" is up: one toast says all four, a line each, with the record sting (" + JSON.stringify(t) + ")");
    check(await page.evaluate(() => FISH.save.days.n === 2 && FISH.save.days.run === 2 && FISH.save.days.best === 2 && FISH.save.today.done === 1 && FISH.save.places.loon.g === 22), "the save: 2 days done, a run of 2, and the three goals (g 22)");
    const kept = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("fish.v1")); return { today: s.today, days: s.days, g: s.places.loon.g }; });
    check(JSON.stringify(kept.today) === JSON.stringify(save.today) && JSON.stringify(kept.days) === JSON.stringify(save.days) && kept.g === 22, "under ?day the stored save keeps its own day and run of days, and the goals done (" + JSON.stringify(kept) + ")");
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => FISH.toTitle());
    check((await page.textContent("#tday")) === "Today's goal is done. 2 days in a row.", "the title says so (" + JSON.stringify(await page.textContent("#tday")) + ")");
    // ---- the journal: the odd finds near the dock, and the days ----
    await click(page, "#journalBtn");
    await page.waitForSelector("#journal:not([hidden])");
    const jr = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#jlist .jfish.none")].map((r) => [r.querySelector("b").textContent, r.querySelector("small").textContent]), note: document.querySelector("#jlist .jnote"), sum: document.querySelector("#jsum").textContent }));
    check(jr.rows.length === 3 && jr.rows.every((r) => r[0] === "Something odd" && r[1] === "Something odd lies near the dock.") && !jr.note, "Loon Lake's junk not found yet: \"Something odd lies near the dock.\" (" + JSON.stringify(jr.rows) + ")");
    check(/\nGoal days: 2 \(best 2 in a row\)$/.test(jr.sum), "the summary counts the days whose goal was done, and the best run of them (" + JSON.stringify(jr.sum) + ")");
    await page.evaluate(() => document.querySelector('#jtabs [data-place="sea"]').click());
    const sea = await page.evaluate(() => [...document.querySelectorAll("#jlist .jfish")].map((r) => r.querySelector("small").textContent));
    check(sea.length === 3 && sea.includes("Try the tide channel in the morning."), "Gull Rock: the next 3 to find, and the Bluefish looks in the morning (" + JSON.stringify(sea) + ")");
    await click(page, "#journal [data-close]");
  } catch (e) { check(false, "exception in part L: " + (e && e.stack)); }
  check(errors.length === 0, "part L: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part M: the phone's own day; the results card and the journal on short screens ================= */
// No ?day: the same goal and the same progress after a reload. Then a long journal, and a 10-fish derby that is a new best
// and opens Stump Bay (every line of the results card), at 360x640 and at 844x390: the buttons stay on the screen
if (part("M")) {
  const day = dayOf(), five = DAILY.findIndex((g) => g.at === "loon" && g.kind === "count");
  const ids = ["pumpkinseed", "perch", "rockbass", "smallmouth", "largemouth", "walleye", "pike", "laketrout"];
  const journal = Object.fromEntries(ids.map((id) => [id, { n: 2, kg: 1.2, cm: 40 }]));
  const save = { v: 1, journal, caught: 30, casts: 200, bestRun: 4, seen: { "ring.tip": 1 }, places: { loon: { open: 1, d: 2.2, kg: 1.2, id: "perch" } },
    today: { d: day, k: five, n: 2, done: 0 }, days: { n: 3, run: 2, best: 2, last: prevDay(day) } };
  const { browser, page, errors } = await open({ save });
  try {
    await stand(page);
    await spy(page);
    // ---- the same day, the same goal and progress after a reload ----
    check((await page.textContent("#tday")) === "Today: land 5 fish at Loon Lake. 2 of 5.", "the phone's own day: today's goal from the save (" + JSON.stringify(await page.textContent("#tday")) + ")");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { FISH.G.landing = { x: 0, z: -20, dist: 20, ring: false, feather: false }; });
    await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.3, cm: 25, junk: false });
    await click(page, "#catchGo");
    await wait(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => FISH.toTitle());
    await page.waitForSelector("#title:not([hidden])");
    const line = await page.textContent("#tday");
    await page.reload();
    await page.waitForSelector("#title:not([hidden])", { timeout: 120000 });
    check(line === "Today: land 5 fish at Loon Lake. 3 of 5." && (await page.textContent("#tday")) === line, "a fish later, and after a reload on the same day: the same goal and the same progress (" + JSON.stringify([line, await page.textContent("#tday")]) + ")");
    await stand(page);
    await spy(page);

    // ---- the journal at 360x640 and 844x390: a long list scrolls inside the card, and Close stays on the screen ----
    const fits = (sel, btn) => page.evaluate(([sel, btn]) => { const c = document.querySelector(sel).getBoundingClientRect(), b = document.querySelector(btn).getBoundingClientRect(); return { top: Math.round(c.top), bottom: Math.round(c.bottom), btn: Math.round(b.bottom), vh: innerHeight, ok: c.top >= 0 && c.bottom <= innerHeight && b.bottom <= innerHeight - 8 }; }, [sel, btn]);
    for (const [w, h] of [[360, 640], [844, 390]]) {
      await page.setViewportSize({ width: w, height: h });
      await sleep(400);
      await click(page, "#journalBtn");
      await page.waitForSelector("#journal:not([hidden])");
      await sleep(300);
      const j = await fits("#journal .card", "#journal [data-close]"), sum = await page.textContent("#jsum");
      check(j.ok && /\nBest sweet run: 4 · Goal days: 3 \(best 2 in a row\)$/.test(sum), `the journal at ${w}x${h}: the card and Close fit (${JSON.stringify(j)}), with the sweet run and the goal days (${JSON.stringify(sum)})`);
      await click(page, "#journal [data-close]");
    }

    // ---- the results card with every line: 10 fish, a new best with the old best, the next rank, the unlock ----
    await page.setViewportSize({ width: 360, height: 640 });
    await sleep(400);
    await page.evaluate(() => FISH.startMode("derby"));
    await wait(page, () => FISH.G.phase === "cast");
    const kgs = [0.4, 0.6, 1.1, 0.5, 0.9, 1.2, 0.3, 0.8, 0.7, 3.7];
    for (const [i, kg] of kgs.entries()) {
      await page.evaluate((last) => { FISH.G.castsLeft = last ? 0 : 5; FISH.G.landing = { x: 0, z: -20, dist: 20, ring: false, feather: false }; }, i === kgs.length - 1);
      await catchCard(page, { id: "perch", name: "Yellow Perch", kg, cm: 25, junk: false });
      await wait(page, () => !FISH.G.cardWait, null, 20000);
      await click(page, "#catchGo");
    }
    await page.waitForSelector("#results:not([hidden])", { timeout: 15000 });
    await sleep(500);
    const lines = await page.evaluate(() => ["#rnext", "#rbest", "#runlock"].map((s) => document.querySelector(s).textContent));
    check(lines[0] === "Next rank: LAKE PRO at 17 kg." && lines[1] === "A new best derby here! Your old best: 2.2 kg." && /opened Stump Bay/.test(lines[2]), "the results: the next rank, the old best and the unlock (" + JSON.stringify(lines) + ")");
    for (const [w, h] of [[360, 640], [844, 390]]) {
      await page.setViewportSize({ width: w, height: h });
      await sleep(500);
      const r = await fits("#results .card", "#rAgain");
      check(r.ok, `the results card at ${w}x${h} fits, and "Fish again" is on the screen (${JSON.stringify(r)})`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  } catch (e) { check(false, "exception in part M: " + (e && e.stack)); }
  check(errors.length === 0, "part M: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part G: the keyboard on a desktop ================= */
// Enter presses the button that has the focus. On the catch card that is Next or Cast again; on the unlock card it is Go there
if (part("G")) {
  const { browser, page, errors } = await open({ query: "?debug", touch: false, phone: false });
  try {
    await stand(page);
    await spy(page);
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    // a walleye of 3.6 kg opens Stump Bay
    const c = await catchCard(page, { id: "walleye", name: "Walleye", kg: 3.6, cm: 62, junk: false });
    check(c.btn === "Next", "a fish that opens Stump Bay: the button reads Next");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#unlock:not([hidden])");
    check(await page.evaluate(() => FISH.G.phase === "catch" && document.activeElement && document.activeElement.id === "uGo"), "Enter on the catch card opens the unlock card, and Go there has the focus");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#arrive:not([hidden])", { timeout: 90000 });
    const at = await page.evaluate(() => ({ place: FISH.place.id, saved: FISH.save.place, unlock: document.querySelector("#unlock").hidden }));
    check(at.place === "stumps" && at.saved === "stumps" && at.unlock, "the second Enter is Go there: it travels to Stump Bay and does not stay (" + JSON.stringify(at) + ")");
  } catch (e) { check(false, "exception in part G: " + (e && e.stack)); }
  check(errors.length === 0, "part G: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part E: the arcade cabinet ================= */
// public/index.html reads the save file without save.js: the line on the cabinet's screen, and the names of the new fish
if (part("E")) {
  console.log("     the arcade cabinet");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const ROOT = (process.env.FISH_URL || "http://localhost:8765/fish/").replace(/fish\/$/, "");
  const browser = await chromium.launch();
  async function line(save) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
    await page.addInitScript((s) => { if (s !== undefined) localStorage.setItem("fish.v1", typeof s === "string" ? s : JSON.stringify(s)); }, save);
    await page.goto(ROOT);
    await page.waitForSelector(".cab.fish .hi", { state: "attached" });
    const t = await page.evaluate(() => document.querySelector(".cab.fish .hi").textContent);
    await ctx.close();
    return { t, errs };
  }
  const base = { v: 1, journal: {}, derbyBest: 0, biggest: null, caught: 0 };
  const J = (ids) => Object.fromEntries(ids.map((id) => [id, { n: 1, kg: 1, cm: 30 }]));
  const cases = [
    [undefined, "HI-SCORE: NONE YET"],
    [{ ...base, derbyBest: 8.4, biggest: { id: "walleye", kg: 3.6 } }, "DERBY BEST 8.4 KG"],
    [{ ...base, biggest: { id: "walleye", kg: 3.6 } }, "WALLEYE 3.6 KG"],
    [{ ...base, derbyBest: 8.4, biggest: { id: "chinook", kg: 12.1 }, places: { loon: { open: 1 }, stumps: { open: 1 }, river: { open: 1 } } }, "PLACES 3/4 · CHINOOK 12.1 KG"],
    [{ ...base, biggest: { id: "catfish", kg: 7.2 }, places: { loon: { open: 1 }, stumps: { open: 0 } } }, "CATFISH 7.2 KG"],
    [{ ...base, biggest: null, derbyBest: 3, places: { loon: { open: 1 }, stumps: { open: 1 } } }, "DERBY BEST 3.0 KG"],
    [{ ...base, journal: J(["golden", "whiskers", "hookjaw", "bigblue"]), biggest: { id: "bigblue", kg: 112 }, places: { stumps: { open: 1 }, river: { open: 1 }, sea: { open: 1 } } }, "ALL 4 LEGENDS · BIG BLUE 112.0 KG"],
    [{ ...base, journal: J(["golden", "whiskers", "hookjaw"]), biggest: { id: "hookjaw", kg: 25 }, places: { stumps: { open: 1 }, river: { open: 1 } } }, "PLACES 3/4 · HOOKJAW 25.0 KG"],
    [{ ...base, biggest: { id: "walleye", kg: 3.6 }, places: "x" }, "WALLEYE 3.6 KG"],
    [{ ...base, biggest: { id: "walleye", kg: 3.6 }, places: { stumps: null, river: 5, sea: "no" } }, "WALLEYE 3.6 KG"],
    ["not json", "HI-SCORE: NONE YET"],
  ];
  for (const [save, want] of cases) {
    const { t, errs } = await line(save);
    check(t === want && !errs.length, `cabinet: ${JSON.stringify(save === undefined ? "no save" : save).slice(0, 100)} -> "${t}"` + (t === want ? "" : ` (want "${want}")`) + (errs.length ? " errors: " + errs.join() : ""));
  }
  const NEW = { crappie: "CRAPPIE", bowfin: "BOWFIN", gar: "GAR", catfish: "CATFISH", whiskers: "WHISKERS", mackerel: "MACKEREL", pollock: "POLLOCK", striper: "STRIPER", bluefish: "BLUEFISH", cod: "COD", bigblue: "BIG BLUE", steelhead: "STEELHEAD", chinook: "CHINOOK", browntrout: "BROWN TROUT", brooktrout: "BROOK TROUT", hookjaw: "HOOKJAW" };
  const bad = [];
  for (const [id, name] of Object.entries(NEW)) { const { t } = await line({ ...base, biggest: { id, kg: 2 } }); if (t !== name + " 2.0 KG") bad.push(id + " -> " + t); }
  check(!bad.length, "cabinet: the 16 new fish have their names" + (bad.length ? " (" + bad.join("; ") + ")" : ""));
  await browser.close();
}

console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);

