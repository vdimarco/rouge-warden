// The screens and the feel of the places and the big fish, in the real game on a phone, with staged fights:
//   the fight prompts in their order, the loss lines, "Big fish on!" and the reveal, the sound and the buzz of each move,
//   the catch card (size line, badges, count-up, photo beat), the unlock beat, the derby results, the journal, the goal
//   reminders, and the old-save toast.
// The fish and the fight model (fish.js, WP2) are not needed: the test puts a stand-in for the sim into G.sim with the
// same state and the same events (plan section 3.4), so the screens can be checked one by one.
// Run: cd public && python3 -m http.server 8765 &   then   node qa/fish/screens.mjs     (FISH_URL for another address)
// Where the world has no setPlace yet (before the merge), a stand-in is used for it.
import { createRequire } from "module";
import { open, sleep } from "./lib.mjs";
import { sizeRank } from "../../public/fish/js/fish.js";
import { byId } from "../../public/fish/js/species.js";
import { rankFor } from "../../public/fish/js/journey.js";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const kgText = (kg) => (kg < 1 ? kg.toFixed(2) : kg.toFixed(1)) + " kg";
const wait = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 40 });
const PAUSE = 350;   // the double-tap guard ignores a click in the first 300 ms of a screen

/* ---------- staging a fight ---------- */
// G.sim becomes a stand-in with the shape of LakeSim's state. patch is merged in (patch.fish into the fish, fish: null for none).
// events go to handleEvent in the next frame. fresh: start a new stage (the fight state of a fish on the line)
async function stage(page, patch = {}, events = [], fresh = true) {
  await page.evaluate(([patch, events, fresh]) => {
    const G = FISH.G;
    if (fresh || !G.sim || !G.sim.fake) {
      G.lastEvent = {}; G.walk = false; G.thrownBy = "";
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
    for (const [obj, names, tag] of [[FISH.Sound, ["sfx", "setGrind"], "S"], [FISH.Haptics, ["bump", "thump", "throb", "rub", "thrash", "charge", "phase", "jolt", "land", "hookset", "splash"], "H"]]) {
      for (const n of names) { const f = obj[n]; obj[n] = function (...a) { log.push([tag + "." + n, ...a]); return f.apply(this, a); }; }
    }
  });
}
const has = (log, name, arg) => log.some((l) => l[0] === name && (arg === undefined || l[1] === arg));

/* ---------- the catch card ---------- */
// stage a catch and wait for the card. Returns what the card shows, and what the count-up did
async function catchCard(page, c, { wait: waitFor = true } = {}) {
  await page.evaluate((c) => {
    window.__ck = [];
    const el = document.querySelector("#ckg");
    window.__ckObs && window.__ckObs.disconnect();
    window.__ckObs = new MutationObserver(() => window.__ck.push(el.textContent));
    window.__ckObs.observe(el, { childList: true, characterData: true, subtree: true });
    window.__flashes = 0;
    window.__flashObs && window.__flashObs.disconnect();
    window.__flashObs = new MutationObserver((l) => { window.__flashes += l.filter((m) => m.target.classList.contains("go")).length; });
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
    kg: document.querySelector("#ckg").textContent, size: document.querySelector("#csize").textContent, old: document.querySelector("#cold").textContent,
    cap: document.querySelector("#ccap").textContent, btn: document.querySelector("#catchGo").textContent,
    photo: document.querySelector("#catch .card").classList.contains("photo"), waiting: document.querySelector("#catch").classList.contains("wait"),
    ck: window.__ck.slice(), flashes: window.__flashes, phase: FISH.G.phase,
  }));
  card.ms = Date.now() - t0;
  return card;
}
const expectSize = (sp, kg) => { const r = sizeRank(sp, kg); return r >= 0.99 ? "Bigger than 99 in 100 of its kind." : r >= 0.95 ? "Bigger than 19 in 20 of its kind." : r >= 0.9 ? "Bigger than 9 in 10 of its kind." : r >= 0.75 ? "Bigger than 3 in 4 of its kind." : ""; };
const click = async (page, sel) => { await sleep(PAUSE); await page.click(sel); };

const stand = async (page) => {
  if (!(await page.evaluate(() => typeof FISH.world.setPlace === "function"))) {
    console.log("NOTE this world has no setPlace yet: a stand-in stands in");
    await page.evaluate(() => { FISH.world.setPlace = async () => ({ ms: 0 }); });
  }
};

/* ================= part A: a fresh save at Loon Lake ================= */
{
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
    const T = [
      ["land", { phase: "land" }, [], "Lift it out! Raise the rod and hold.", ""],
      ["jump", { fish: { move: "jump" } }, [], "It jumped! Lower the rod!", ""],
      ["a tail walk", { fish: { move: "jump" } }, [{ type: "walk", n: 3 }], "It jumps again and again!", "Keep the rod low."],
      ["the line on a stump, steer right", { rub: 0.4, rubKind: "stump", rubSide: 1 }, [], "The line is on a stump! Steer right.", "Drag the rod pad right."],
      ["the line on the logs, steer left", { rub: 0.4, rubKind: "logs", rubSide: -1 }, [], "The line is on the logs! Steer left.", "Drag the rod pad left."],
      ["the line on the rocks", { rub: 0.4, rubKind: "rocks", rubSide: 0 }, [], "The line is on the rocks! Hold the rod up.", "Drag the rod pad sideways."],
      ["the line in the weeds", { rub: 0.4, rubKind: "weeds", rubSide: -1 }, [], "It is in the weeds! Steer left.", "Drag the rod pad left."],
      ["a rub below 0.15 is not said", { rub: 0.1, rubKind: "stump", rubSide: 1 }, [], "Pump and reel.", null],
      ["the last run", { fish: { move: "run" } }, [{ type: "lastrun" }], "It sees you! Let it run.", "Stop reeling. Hold the rod up."],
      ["a thrash", { fish: { move: "thrash" } }, [], "It shakes its head!", "Hold the rod up. Keep the line tight."],
      ["a turn", { fish: { move: "turn" } }, [], "It turned. Stop reeling!", ""],
      ["a charge", { fish: { move: "charge" } }, [], "It swims at you! Reel fast.", "Reel until the line is tight."],
      ["too tight", { tfrac: 0.9 }, [], "Too tight! Stop reeling.", "Lower the rod a little."],
      ["the spool", { spoolFrac: 0.8 }, [], "The spool is almost empty!", "Tighten the drag."],
      ["a rest", { fish: { move: "hold" } }, [], "It rests. Rest your arm.", "Keep the line tight."],
      ["a sulk", { fish: { move: "sulk" } }, [], "It holds on the bottom.", "Lift the rod slowly. Then reel as you lower it."],
      ["cover: lily pads, steer left", { cover: { side: 1, steer: -1, kind: "pads" } }, [], "It swims to the lily pads!", "Drag the rod pad left."],
      ["cover: the stumps, steer right", { cover: { side: -1, steer: 1, kind: "stumps" } }, [], "It swims to the stumps!", "Drag the rod pad right."],
      ["cover: the wall", { cover: { side: 1, steer: -1, kind: "wall" } }, [], "It swims to the wall!", "Drag the rod pad left."],
      ["running", { slip: 0.6 }, [], "It is running. Let it go.", "Keep the rod up. Reel when it stops."],
      ["slack", { slack: true }, [], "Slack line! Reel it in.", ""],
      ["beaten", { beaten: true }, [], "It is tired. Reel it in.", ""],
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
      ["the spool beats a rest", { fish: { move: "hold" }, spoolFrac: 0.9 }, [], "The spool is almost empty!"],
      ["a rest beats a sulk", { fish: { move: "hold" }, cover: { side: 1, steer: -1, kind: "pads" } }, [], "It rests. Rest your arm."],
      ["a sulk beats cover", { fish: { move: "sulk" }, cover: { side: 1, steer: -1, kind: "pads" } }, [], "It holds on the bottom."],
      ["cover beats running", { slip: 0.6, cover: { side: 1, steer: -1, kind: "rocks" } }, [], "It swims to the rocks!"],
      ["running beats slack", { slip: 0.6, slack: true }, [], "It is running. Let it go."],
      ["land beats everything", { phase: "land", fish: { move: "thrash" }, rub: 0.9, rubKind: "stump", rubSide: 1 }, [], "Lift it out! Raise the rod and hold."],
    ];
    for (const [name, patch, events, h] of O) {
      const p = await prompts(page, patch, events, h);
      check(p && p.h === h, `order: ${name}` + (p && p.h === h ? "" : " (got " + JSON.stringify(p) + ")"));
    }
    // the tone: red for a warning, green when it is fine
    const tone = async (patch, ev, h) => { await prompts(page, patch, ev, h); return (await promptNow(page)).cls; };
    check((await tone({ fish: { move: "thrash" } }, [], "It shakes its head!")) === "hot" && (await tone({ fish: { move: "hold" } }, [], "It rests. Rest your arm.")) === "good", "a warning is red and a rest is green");

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
      ["turn", [{ type: "turn" }], (l) => has(l, "H.thump")],
      ["sulk", [{ type: "sulk" }], (l) => has(l, "S.sfx", "creak") && has(l, "H.throb")],
      ["pump", [{ type: "pump", n: 1, need: 2 }], (l) => l.some((x) => x[0] === "H.bump" && x[1] === 0.4)],
      ["unstuck", [{ type: "unstuck" }], (l) => l.some((x) => x[0] === "S.sfx" && x[1] === "splash")],
      ["thrash", [{ type: "thrash" }], (l) => has(l, "H.thrash") && has(l, "S.sfx", "splash")],
      ["spool", [{ type: "spool" }], (l) => has(l, "S.sfx", "slip") && l.some((x) => x[0] === "H.bump" && x[1] === 0.8)],
      ["phase", [{ type: "phase", n: 2, of: 3, name: "It runs for the lily pads!" }], (l) => has(l, "S.sfx", "record") && has(l, "H.phase")],
      ["lastrun", [{ type: "lastrun" }], (l) => has(l, "H.jolt")],
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
    check((await page.textContent("#toast")) === "It runs for the lily pads!", "a boss stage shows its name as a toast");
    await stage(page, {}, [{ type: "turned" }], false);
    check((await page.textContent("#toast")) === "You turned it!", "turning a fish shows \"You turned it!\"");
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
      ["weeds", [], "It wrapped the line in the weeds.", "Drag the rod pad sideways to steer it."],
      ["spooled", [], "It took all your line.", "Tighten the drag on a long run."],
      ["thrown", [{ type: "thrown", thrash: true }], "It shook the hook out.", "Hold the rod up when it shakes its head."],
      ["thrown", [{ type: "thrown", charge: true }], "It threw the hook.", "Reel fast when it swims at you."],
      ["thrown", [{ type: "thrown", jump: true }], "It threw the hook.", "Lower the rod when it jumps."],
      ["thrown", [{ type: "thrown" }], "It threw the hook.", "Keep the line tight."],
      ["snap", [], "SNAP! The line broke.", "Stop reeling when the drag slips."],
    ];
    for (const [reason, ev, h, sub] of LOSS) {
      await page.evaluate(() => { if (FISH.G.phase === "lost") FISH.enterReel(); });
      await stage(page, { phase: "lost", reason }, ev);
      await wait(page, (h) => { const p = document.querySelector("#prompt"); return !p.hidden && p.querySelector(".p1 span").textContent === h; }, h, 8000).catch(() => {});
      const p = await promptNow(page);
      check(p && p.h === h && p.sub === sub, `loss: ${reason}${ev.length ? " (" + Object.keys(ev[0]).filter((k) => k !== "type").join() + ")" : ""} -> "${h}"` + (p && p.h === h && p.sub === sub ? "" : " (got " + JSON.stringify(p) + ")"));
    }

    // ---- "Big fish on!" ----
    console.log("     a big fish");
    const toastNow = () => page.evaluate(() => document.querySelector("#toast").textContent);
    await page.evaluate(() => { if (FISH.G.phase !== "reel") FISH.enterReel(); });
    // a walleye of 5 kg is heavy for Loon Lake (3.5 kg and over)
    await stage(page, { fish: { id: "walleye", kg: 5, known: false, move: "swim" } }, [{ type: "hooked", id: "walleye" }]);
    check(await page.evaluate(() => !!FISH.G.big && !FISH.G.big.said), "a heavy fish is marked big at the hook set");
    await logClear(page);
    await stage(page, {}, [{ type: "drag" }], false);
    check((await toastNow()) === "It is a big one!", "the first run of the drag says \"It is a big one!\"");
    await wait(page, () => FISH.gauge.s.label === "Big fish on!", null, 5000).catch(() => {});
    check(await page.evaluate(() => FISH.gauge.s.label === "Big fish on!"), "and the gauge says \"Big fish on!\"");
    check(has(await logNow(page), "H.thump"), "with a thump");
    await stage(page, { fish: { known: true } }, [{ type: "reveal", id: "walleye" }], false);
    check((await toastNow()) === "It is a huge Walleye!", "the reveal says \"It is a huge Walleye!\" (" + (await toastNow()) + ")");
    await wait(page, () => FISH.gauge.s.label === "", null, 5000).catch(() => {});
    check(await page.evaluate(() => FISH.gauge.s.label === "" && FISH.gauge.s.name === "Walleye"), "and the gauge shows the name again");
    // a small fish: no warning
    await stage(page, { fish: { id: "perch", kg: 0.35, known: false } }, [{ type: "hooked", id: "perch" }]);
    check(await page.evaluate(() => FISH.G.big === null), "a small perch is not a big one");
    await stage(page, { fish: { known: true } }, [{ type: "drag" }, { type: "reveal", id: "perch" }], false);
    check((await toastNow()) === "It is a Yellow Perch!", "and its reveal is plain (" + (await toastNow()) + ")");
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
    check((await toastNow()) === "It is a Smallmouth Bass!", "a plain reveal (" + (await toastNow()) + ")");
    await stage(page, { fish: { id: "golden", kg: 4.2, known: true } }, [{ type: "hooked", id: "golden" }, { type: "reveal", id: "golden" }]);
    check((await toastNow()) === "It is the Golden Loon Bass!", "the legend has its own article (" + (await toastNow()) + ")");
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
    check((await toastNow()) === "Close! Land a fish of 3.5 kg or more to open Stump Bay.", "70% of the goal or more: the close-call toast after the card (" + (await toastNow()) + ")");
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
    check((await page.textContent("#tbest")) === "Here: biggest Walleye 3.6 kg\nTo open: land a fish of 6 kg or more at Stump Bay.", "the title shows the best fish here and the next goal (" + JSON.stringify(await page.textContent("#tbest")) + ")");

    // ---- the journal ----
    console.log("     the journal");
    await click(page, "#journalBtn");
    await page.waitForSelector("#journal:not([hidden])");
    const jr = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#jlist .jfish")].map((r) => [r.querySelector("b").textContent, r.querySelector("small").textContent, r.className]), sum: document.querySelector("#jsum").textContent, tabs: [...document.querySelectorAll("#jtabs button")].map((b) => b.textContent + (b.classList.contains("lock") ? "*" : "") + (b.getAttribute("aria-selected") === "true" ? "!" : "")) }));
    check(jr.tabs.join() === "Loon!,Stumps,River*,Sea*", "the chips: Loon (chosen), Stumps (open), River and Sea (locked) (" + jr.tabs.join() + ")");
    check(jr.rows.length === 13, "Loon Lake lists 13 rows (" + jr.rows.length + ")");
    const names = jr.rows.map((r) => r[0]);
    check(names[0] === "Not caught yet" && names[1] === "Yellow Perch" && names[3] === "Smallmouth Bass" && names[5] === "Walleye" && names[9] === "The legend" && names.slice(10).join() === "Something odd,Something odd,Something odd", "small to big, then the legend, then the junk (" + names.join(", ") + ")");
    check(jr.rows[5][1] === "Best 3.6 kg · 62 cm · caught 1" && jr.rows[1][1] === "Best 0.60 kg · 35 cm · caught 3", "a caught fish shows its best and the count (" + jr.rows[5][1] + " / " + jr.rows[1][1] + ")");
    check(jr.rows[0][1] === "Try the lily pads." && jr.rows[2][1] === "Try the rocky point at dusk.", "a fish not caught yet says where to try (" + jr.rows[0][1] + " / " + jr.rows[2][1] + ")");
    check(jr.sum === "3 of 13 found here · 3 of 29 in all · 5 fish landed · 0 casts", "the summary line (" + jr.sum + ")");
    // the legend row, by step
    const legendRow = async (lgStep) => {
      await page.evaluate((s) => { FISH.save.places.loon.lg = s; document.querySelector('#jtabs [data-place="loon"]').click(); }, lgStep);
      return page.evaluate(() => { const r = document.querySelectorAll("#jlist .jfish")[9]; return [r.querySelector("b").textContent, r.querySelector("small").textContent]; });
    };
    const steps = [await legendRow(0), await legendRow(1), await legendRow(2)];
    check(steps[0][1] === "People say a gold bass lives in Loon Lake." && steps[1][1] === "Look for a gold ring at dawn or dusk, 40 to 50 m out. Cast right into it." && steps[2][1] === "It jumps a lot. Lower the rod when it jumps.", "the legend row gets clearer with each step (" + steps.map((s) => s[1]).join(" | ") + ")");
    // Stump Bay's chip
    await page.evaluate(() => document.querySelector('#jtabs [data-place="stumps"]').click());
    const st = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#jlist .jfish")].map((r) => [r.querySelector("b").textContent, r.querySelector("small").textContent]), sum: document.querySelector("#jsum").textContent }));
    check(st.rows.length === 8 && st.sum.startsWith("0 of 8 found here · 3 of 29 in all"), "Stump Bay: its own 8 rows (6 fish, the legend, the boot) and its own count (" + st.sum + ")");
    check(st.rows.find((r) => /night/.test(r[1])) && /Try the creek bed at night\./.test(st.rows.map((r) => r[1]).join(" ")), "the catfish hint says where and that it bites at night (" + st.rows.map((r) => r[1]).filter((t) => /night/.test(t)).join() + ")");
    check(st.rows[6][1] === "People say a giant catfish lives in the old creek bed.", "the Old Whiskers rumor (" + st.rows[6][1] + ")");
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
    await click(page, "#aStart");
    await page.waitForSelector("#title:not([hidden])");
    check((await page.textContent("#tkick")) === "GET PLUNGER'D · STUMP BAY" && await page.evaluate(() => document.querySelector("#placesNew").hidden), "the title reads STUMP BAY and the NEW badge is gone");
    check(await page.evaluate(() => FISH.save.place === "stumps" && JSON.parse(localStorage.getItem("fish.v1")).place === "stumps"), "the place is saved");
    check((await page.textContent("#tbest")) === "Land a fish of 6 kg or more here to open Cedar River.", "the title shows the goal of Stump Bay (" + JSON.stringify(await page.textContent("#tbest")) + ")");
    // Stump Bay's clock and goal reminder
    await page.evaluate(() => FISH.startMode("derby"));
    await wait(page, () => FISH.G.phase === "cast");
    check(await page.evaluate(() => FISH.G.hour >= 20 && FISH.G.hour < 20.1) && (await page.textContent("#toast")) === "Goal: land a fish of 6 kg or more. It opens Cedar River.", "a derby at Stump Bay starts at 20:00 with its own goal (" + (await page.textContent("#toast")) + ")");
    check((await page.textContent("#modeChip")).startsWith("Derby 1/10"), "the HUD chip (" + (await page.textContent("#modeChip")) + ")");
    // the reload keeps the place
    await page.reload();
    await page.waitForSelector("#title:not([hidden])", { timeout: 120000 });
    check((await page.textContent("#tkick")) === "GET PLUNGER'D · STUMP BAY", "after a reload the player is still at Stump Bay");
  } catch (e) { check(false, "exception in part A: " + (e && e.stack)); }
  check(errors.length === 0, "part A: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part B: a derby that opens a place ================= */
{
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
    const r = await page.evaluate(() => ({ kick: document.querySelector("#rkick").textContent, total: document.querySelector("#rtotal").textContent, rank: document.querySelector("#rrank").textContent, best: document.querySelector("#rbest").textContent, line: document.querySelector("#runlock").textContent, lineHidden: document.querySelector("#runlock").hidden, go: document.querySelector("#rGo").hidden, list: [...document.querySelectorAll("#rlist li")].map((l) => l.textContent) }));
    check(r.kick === "LOON LAKE" && r.total === "3.6 kg" && r.rank === rankFor("loon", 3.6) && r.best === "A new best derby here!" && r.list.join() === "Walleye3.6 kg", "the results: the place, the total, the rank, the new best (" + JSON.stringify(r) + ")");
    check(!r.lineHidden && r.line === "Your 3.6 kg Walleye opened Stump Bay." && !r.go, "the results say which fish opened Stump Bay, with Go there (" + r.line + ")");
    check(await page.evaluate(() => FISH.save.derbyBest === 3.6 && FISH.save.places.loon.d === 3.6 && FISH.save.seen["opened.stumps"] === 1), "the best derby is saved for Loon Lake");
    await click(page, "#rGo");
    await page.waitForSelector("#arrive:not([hidden])", { timeout: 60000 });
    await click(page, "#aStart");
    await page.waitForSelector("#title:not([hidden])");
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
{
  const old = { v: 1, journal: { perch: { n: 3, kg: 0.5, cm: 30 }, walleye: { n: 1, kg: 3.6, cm: 63 }, golden: { n: 1, kg: 4.1, cm: 55 } }, casts: 40, longest: 46.2, derbyBest: 8.4, biggest: { id: "walleye", kg: 3.6 }, input: null, assist: true, quality: "auto", seen: { bail: 1 }, caught: 6 };
  const { browser, page, errors } = await open({ query: "?debug", save: old });
  try {
    await stand(page);
    check((await page.textContent("#toast")) === "Your 3.6 kg Walleye opened a new place: Stump Bay." && await page.evaluate(() => document.querySelector("#toast").classList.contains("on")), "an old save with a 3.6 kg walleye: the toast says it opened Stump Bay (" + (await page.textContent("#toast")) + ")");
    check(!(await page.evaluate(() => document.querySelector("#placesNew").hidden)), "and Places has a NEW badge");
    check((await page.textContent("#tbest")) === "Here: best derby 8.4 kg · biggest Walleye 3.6 kg\nTo open: land a fish of 6 kg or more at Stump Bay.", "the title shows the old best derby and the biggest fish (" + JSON.stringify(await page.textContent("#tbest")) + ")");
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
{
  const { browser, page, errors } = await open({ query: "?open&debug" });
  try {
    await stand(page);
    await spy(page);
    const toastNow = () => page.evaluate(() => document.querySelector("#toast").textContent);
    // ---- Cedar River: the current, and the swing said once ----
    check(await page.evaluate(async () => await FISH.setPlace("river")), "at Cedar River");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    check(await page.evaluate(() => Math.abs(FISH.G.hour - 5.2) < 0.1), "free fishing at Cedar River starts at 5:12 (" + (await page.textContent("#clock")) + ")");
    check(!/^Goal:/.test(await toastNow()), "?open has no goal to remind (" + (await toastNow()) + ")");
    let p = await prompts(page, { phase: "retrieve", fish: null, follower: null, empty: false }, [], "The current takes your lure.");
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
    check((await toastNow()) === "A new night on Stump Bay.", "at midnight the clock goes back to 19:00: \"A new night on Stump Bay.\" (" + (await toastNow()) + ")");
    // ---- Gull Rock ----
    check(await page.evaluate(async () => await FISH.setPlace("sea")), "at Gull Rock");
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    p = await prompts(page, { phase: "land" }, [], "Bring it to the wall! Raise the rod and hold.");
    check(p && p.h === "Bring it to the wall! Raise the rod and hold.", "at the wall: \"Bring it to the wall!\"");
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
    check((await toastNow()) === "It is Big Blue!", "\"It is Big Blue!\" (" + (await toastNow()) + ")");
    await stage(page, { fish: { id: "whiskers", kg: 20, known: true } }, [{ type: "reveal", id: "whiskers" }]);
    check((await toastNow()) === "It is Old Whiskers!", "\"It is Old Whiskers!\" (" + (await toastNow()) + ")");
  } catch (e) { check(false, "exception in part D: " + (e && e.stack)); }
  check(errors.length === 0, "part D: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part E: the arcade cabinet ================= */
// public/index.html reads the save file without save.js: the line on the cabinet's screen, and the names of the new fish
{
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
