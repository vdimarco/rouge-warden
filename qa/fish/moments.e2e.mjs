// The big moments of Reel It In, each with its sound, its buzz and its picture, in the real game on a 390x844 phone:
//   the hot prompt (one glow, no growing text), the strike (sound and buzz by its strength, the flash, the rod tip dips), a
//   nibble (the tip twitches), the hook set ("Fish on!" for about 0.9 s, "Quick set!", the freeze with the sim still running,
//   the punch, a sound at least as loud as the strike, a buzz longer than the strike's), a run start (the ratchet), it
//   turned (its own buzz), a legend's stage (no fanfare, none at its first), a jump (the zoom: a smallmouth 30 m out at least
//   20 px wide, then the view eases back), a cast into a ring (its chime, not the menu click), a sweet release (its own
//   sound), a far splash (45 m out, at least 12 px tall), the tiered catch stingers and the catch card's reveal (the ticks
//   climb, the badges wait for the weight, a trophy sparkles), the new place card (the horn, the buzz, the card rises, the
//   badge stamps 250 ms later), and the derby end (the total counts up from zero, then the rank and the close).
// Part B: Calm effects (html data-calm="1"): no freeze, punch, zoom, flash, pulse, pop or count-up, and the same sounds,
// buzzes and words; the cast report and the "Sweet!" cue show without their pop (with reduced motion too).
// Part C: the jump zoom on the other layouts (844x390 and 360x640 phones, a 1280x800 desktop), 30 and 50 m out: the
// leaping fish stays in the view, below the HUD and the prompt, and the rod stays drawn where the hand holds it.
// Part D: the trophy photo, landed while a jump's zoom is still on and on slow frames (each one 150 ms, and none for 1.5 s
// after the landing): when the flash comes, the fish is in the middle of the part of the view the card leaves free, and the
// card comes up under the fish.
// The fights are staged: a stand-in for the sim goes into G.sim with the same state and events (like screens.mjs).
// Run: serve public/ (FISH_URL, default http://localhost:8765/fish/), then
//   NODE_PATH=qa/browser/node_modules node qa/fish/moments.e2e.mjs       (PARTS=A, B, C or D for one part; SHOTS=dir)
import { open, sleep, shot } from "./lib.mjs";
import { CAST } from "../../public/fish/js/cast.js";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
// waits for fn in the page; a timeout fails with the condition it waited for
const wait = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 40 }).catch((e) => { throw new Error(`waited ${ms / 1000} s for ${fn}: ${e.message.split("\n")[0]}`); });
// the lake's own clock moves at most 50 ms a frame, and a loaded software GPU can take 2 s a frame: a wait for the lake's
// time (a camera that settles, a zoom that eases) can take this long (ms)
const SLOW = 180000;
// waits until the lake's own clock has run on by s seconds
async function lakeTime(page, s) { const c = await page.evaluate(() => FISH.world.feel().clock); await wait(page, ([c, s]) => FISH.world.feel().clock >= c + s, [c, s], SLOW); }
// waits until the game has run n more frames
async function frames(page, n) { const f = await page.evaluate(() => FISH.G.frame); await wait(page, ([f, n]) => FISH.G.frame >= f + n, [f, n], 60000); }
const PARTS = process.env.PARTS ? process.env.PARTS.split(",") : null, part = (p) => !PARTS || PARTS.includes(p);
const PAUSE = 350;   // the double-tap guard ignores a click in the first 300 ms of a screen
const click = async (page, sel) => { await sleep(PAUSE); await page.click(sel); };
// a save at Loon Lake with its goals done and no first-time tips, so no goal sting or tip comes between the moments
const SAVE = { places: { loon: { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0, g: 63 } }, seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1 } };

/* ---------- staging ---------- */
// G.sim becomes a stand-in with the shape of LakeSim's state; patch is merged in (patch.fish into the fish). events go to
// handleEvent in the next frame. fresh: a new stage. Counts the stand-in's steps in window.__steps
async function stage(page, patch = {}, events = [], fresh = true) {
  await page.evaluate(([patch, events, fresh]) => {
    const G = FISH.G;
    if (fresh || !G.sim || !G.sim.fake) {
      G.lastEvent = {}; G.walk = false; G.slipAt = 0; G.rubDir = null; G.hold = null; G.big = null;
      G.sim = { fake: true, events: [], step() { window.__steps = (window.__steps || 0) + 1; }, state: {
        phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3,
        fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true },
      } };
      G.bail = "closed";
      if (G.phase !== "reel") FISH.enterReel();
    }
    const s = G.sim.state, { fish, ...rest } = patch;
    Object.assign(s, rest);
    if (fish === null) s.fish = null; else if (fish) s.fish = { ...(s.fish || {}), ...fish };
    G.sim.events.push(...events);
  }, [patch, events, fresh]);
  await wait(page, () => !FISH.G.sim || !FISH.G.sim.fake || FISH.G.sim.events.length === 0);
}
// a cast that lands at (x, z) in the water, as release() would leave it
async function landAt(page, x, z) {
  await page.evaluate(([x, z]) => {
    const G = FISH.G;
    FISH.newCast();
    G.cast = null; G.casts++;
    G.step = "flight"; G.flight = { step: () => ({ x, y: 0, z, done: true, land: "water", lineOut: Math.hypot(x, z), spool: 0 }) };
  }, [x, z]);
  await wait(page, () => FISH.G.phase === "reel");
}
// every sound, buzz, vibrate pattern, world moment, flash and banner, with its time (ms)
async function spy(page) {
  await page.evaluate(() => {
    const t0 = performance.now(), log = (window.__log = []);
    const L = (k, ...a) => log.push([k, ...a, Math.round(performance.now() - t0)]);
    const S = FISH.Sound, sfx = S.sfx;
    S.sfx = function (n, v) { L("sfx", n, v); return sfx.call(this, n, v); };
    for (const n of ["tick", "bump", "thump", "hookset", "jolt", "surge", "land", "thrash", "charge", "phase", "splash", "load", "turn", "big", "shutter"]) {
      const f = FISH.Haptics[n]; FISH.Haptics[n] = function (...a) { L("hx." + n, ...a); return f.apply(this, a); };
    }
    const W = FISH.world;
    for (const n of ["freeze", "punch", "jumpZoom", "twitch", "sparkle", "showCatch"]) {
      const f = W[n]; W[n] = function (...a) { const r = f.apply(this, a); L("w." + n, n === "showCatch" ? JSON.stringify(a[2] || {}) : a[0], r); return r; };
    }
    // the buzz: an Android phone after a first tap
    Object.defineProperty(navigator, "userActivation", { value: { hasBeenActive: true, isActive: true }, configurable: true });
    navigator.vibrate = (p) => { if (Array.isArray(p) || p > 0) L("vib", Array.isArray(p) ? p.slice() : [p]); return true; };
    // the CSS animation an element has (its computed name, "none" for none): a check that does not depend on when it runs
    window.__anim = (sel) => { const el = document.querySelector(sel), cs = el && getComputedStyle(el); return cs ? { name: cs.animationName, delay: cs.animationDelay, n: cs.animationIterationCount } : null; };
    const fl = document.querySelector("#flash"), bn = document.querySelector("#banner");
    new MutationObserver(() => { if (fl.classList.contains("go")) L("flash", fl.className); }).observe(fl, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(() => L("banner", bn.hidden ? "" : bn.querySelector("b").textContent, bn.querySelector("span").textContent)).observe(bn, { attributes: true, attributeFilter: ["hidden"] });
  });
}
// the banner as it shows next, taken at the show: it hides 0.9 s later on the wall clock, and a slow frame can delay a
// read past that
const armBanner = (page) => page.evaluate(() => {
  const b = document.querySelector("#banner");
  if (window.__bannerObs) window.__bannerObs.disconnect();
  window.__shown = { hidden: true };
  window.__bannerObs = new MutationObserver(() => {
    if (b.hidden) return;
    window.__bannerObs.disconnect();
    window.__shown = { hidden: b.hidden, text: b.querySelector("b").textContent, sub: b.querySelector("span").textContent, prompt: getComputedStyle(document.querySelector("#prompt")).visibility, pop: getComputedStyle(b.querySelector("b")).animationName };
  });
  window.__bannerObs.observe(b, { attributes: true, attributeFilter: ["hidden"] });
});
const shownBanner = (page) => page.evaluate(() => window.__shown);
const logClear = (page) => page.evaluate(() => { window.__log.length = 0; });
const logNow = (page) => page.evaluate(() => window.__log.slice());
const has = (log, k, a) => log.some((l) => l[0] === k && (a === undefined || l[1] === a));
const sounds = (log) => log.filter((l) => l[0] === "sfx").map((l) => l[1]);
const onMs = (p) => p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
const brief = (log) => log.filter((l) => !(l[0] === "sfx" && l[1] === "tick") && l[0] !== "hx.tick").map((l) => l.slice(0, -1).map((x) => (typeof x === "number" ? +x.toFixed(2) : x)).join(":")).join(" ");
// the fish's box on the screen (CSS px), from its mesh and the camera
const fishBox = (page, id) => page.evaluate(async (id) => {
  const THREE = await import("/fish/lib/three.module.min.js");
  const W = FISH.world, m = W.scene.children.find((o) => o.userData && o.userData.id === id && o.userData.fx && o.visible);
  if (!m) return null;
  const v = document.querySelector("#view"), w = v.clientWidth, h = v.clientHeight, b = new THREE.Box3().setFromObject(m, true), p = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(W.camera);
    const x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, x1, y0, y1, vw: w, vh: h, fov: W.camera.fov };
}, id);
// the top of the free part of the view: under the HUD and the prompt (CSS px)
const freeTop = (page) => page.evaluate(() => Math.max(...["#hud", "#prompt"].map((s) => document.querySelector(s).getBoundingClientRect().bottom)));
const inFree = (b, top) => !!b && b.x0 >= 0 && b.x1 <= b.vw && b.y0 >= top && b.y1 <= b.vh;
const boxText = (b) => (b ? `x ${b.x0.toFixed(0)}..${b.x1.toFixed(0)}, y ${b.y0.toFixed(0)}..${b.y1.toFixed(0)} of ${b.vw}x${b.vh}` : "no fish");
// the tallest a splash at pt gets on the screen over s seconds of the lake's clock (CSS px): the droplets within 8 m of it,
// with their size. (A slow frame moves the droplets at most 50 ms)
const splashHeight = (page, pt, s = 2.5) => page.evaluate(async ([pt, s, SLOW]) => {
  const THREE = await import("/fish/lib/three.module.min.js");
  const W = FISH.world, sp = W.scene.children.find((o) => o.isPoints && o.geometry.attributes.aGold && o.geometry.attributes.aSize), A = sp.geometry.attributes;
  const view = document.querySelector("#view"), h = view.clientHeight, v = new THREE.Vector3();
  let best = 0, n = 0;
  const c0 = W.feel().clock, t0 = performance.now();
  while (W.feel().clock - c0 < s && performance.now() - t0 < SLOW) {
    await new Promise((r) => requestAnimationFrame(r));
    const cam = W.camera, k = h / (2 * Math.tan(cam.fov * Math.PI / 360));
    let top = Infinity, bot = -Infinity, c = 0;
    for (let i = 0; i < A.aSize.count; i++) {
      if (A.aAlpha.array[i] < 0.1 || A.aGold.array[i] > 0) continue;
      const x = A.position.array[i * 3], y = A.position.array[i * 3 + 1], z = A.position.array[i * 3 + 2];
      if (Math.hypot(x - pt.x, z - pt.z) > 8) continue;
      v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
      if (-v.z < 0.1) continue;
      const size = A.aSize.array[i] * k / -v.z;
      if (size * devicePixelRatio < 1) continue;
      v.set(x, y, z).project(cam);
      const sy = (1 - v.y) / 2 * h;
      top = Math.min(top, sy - size / 2); bot = Math.max(bot, sy + size / 2); c++;
    }
    if (c && bot - top > best) { best = bot - top; n = c; }
  }
  return { height: best, n };
}, [pt, s, SLOW]);
// every shader number in the scene that is not finite (a NaN in a water ripple hides the water): [renderOrder, name]
const badUniforms = (page) => page.evaluate(() => {
  const out = [];
  FISH.world.scene.traverse((o) => {
    const u = o.material && o.material.uniforms;
    if (u) for (const [k, v] of Object.entries(u)) for (const x of Array.isArray(v.value) ? v.value : [v.value]) {
      const nums = typeof x === "number" ? [x] : x && x.isColor ? [x.r, x.g, x.b] : x && typeof x === "object" && "x" in x ? [x.x, x.y, x.z, x.w].filter((q) => q !== undefined) : [];
      if (nums.some((q) => !Number.isFinite(q))) out.push([o.renderOrder, k]);
    }
  });
  return out;
});
// stage a catch and wait for the card (and, when asked, its count-up). Returns the card and what the badges did
async function catchCard(page, c, { calm = false } = {}) {
  await page.evaluate(() => FISH.newCast());
  await logClear(page);
  // the badges when the weight first shows (the count-up runs on the wall clock: a slow frame can delay a later read past
  // its end)
  await page.evaluate(() => {
    const kg = document.querySelector("#ckg"), b = document.querySelector("#cbadges");
    window.__early = null;
    if (window.__earlyObs) window.__earlyObs.disconnect();
    window.__earlyObs = new MutationObserver(() => { if (!window.__early) window.__early = { held: b.classList.contains("held"), kg: kg.textContent }; });
    window.__earlyObs.observe(kg, { childList: true, characterData: true, subtree: true });
  });
  await stage(page, { phase: "caught", catch: c, fish: null });
  await wait(page, () => !document.querySelector("#catch").hidden);
  // the stingers come 0.5 to 1.7 s after the landing, from timers: a timer of 1.9 s set now comes after all of them
  await page.evaluate(() => { window.__stung = false; setTimeout(() => { window.__stung = true; }, 1900); });
  await wait(page, () => !FISH.G.cardWait);
  if (!c.junk) await wait(page, (kg) => document.querySelector("#ckg").dataset.kg === String(kg), c.kg);
  await wait(page, () => window.__stung);
  const early = await page.evaluate(() => window.__early || {});
  const card = await page.evaluate(() => {
    const b = document.querySelector("#cbadges");
    return { badges: [...b.querySelectorAll(".badge")].map((x) => x.textContent), held: b.classList.contains("held"), stamp: b.classList.contains("stamp"),
      badgeAnim: b.querySelector(".badge") ? getComputedStyle(b.querySelector(".badge")).animationName : "", kgAnim: getComputedStyle(document.querySelector("#ckg")).animationName };
  });
  return { ...card, early, log: await logNow(page) };
}

/* ================= part A: the moments ================= */
if (part("A")) {
  const { browser, page, errors } = await open({ save: SAVE });
  try {
    await spy(page);
    const eye = await page.evaluate(() => FISH.place.stand.eye);
    // today's goal is done already, so no catch brings its sting
    await page.evaluate(async () => { const g = await import("/fish/js/goals.js"), d = g.dayOf(), dg = g.dailyGoal(d, FISH.save); FISH.save.today = { d, k: dg.k, n: dg.n, done: 1 }; });
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    await sleep(500);

    // ---- the hot prompt: one glow when it changes, and the text never grows ----
    console.log("     the hot prompt");
    await page.evaluate(() => { window.__hot = 0; document.querySelector("#prompt .p1").addEventListener("animationstart", (e) => { if (e.animationName === "hot") window.__hot++; }); });
    await stage(page, { tfrac: 0.9 });
    await wait(page, () => document.querySelector("#prompt").classList.contains("hot"));
    const hot = await page.evaluate(() => {
      const a = window.__anim("#prompt .p1"), rule = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } }).find((r) => r.type === CSSRule.KEYFRAMES_RULE && r.name === "hot");
      return { ...a, scale: !!rule && /transform|scale/.test(rule.cssText) };
    });
    check(hot.name === "hot" && hot.n === "1" && !hot.scale, "a hot prompt glows once, and its text never grows (" + JSON.stringify(hot) + ")");
    // (the animation events come with the frames, which are slow on a software GPU: wait for them)
    await wait(page, () => document.querySelector("#prompt .p1").getAnimations().length === 0);
    await sleep(800); await frames(page, 5);
    check(await page.evaluate(() => document.querySelector("#prompt .p1").getAnimations().length === 0 && window.__hot === 1), "and then holds still");
    const hot0 = await page.evaluate(() => window.__hot);
    await stage(page, { tfrac: 0.3, fish: { move: "turn" } }, [], false);
    await wait(page, () => /It turned/.test(document.querySelector("#prompt").textContent));
    await wait(page, (n) => window.__hot > n, hot0);
    await wait(page, () => document.querySelector("#prompt .p1").getAnimations().length === 0);
    await sleep(800); await frames(page, 5);
    const hot1 = await page.evaluate(() => window.__hot);
    check(hot1 === hot0 + 1, `a new hot prompt glows once again, and once only (${hot0} glows, then ${hot1})`);

    // ---- the strike ----
    console.log("     the strike");
    await stage(page, { phase: "strike", fish: null });
    await logClear(page);
    await stage(page, {}, [{ type: "strike", s: 1 }], false);
    await sleep(300);
    let l = await logNow(page);
    const strikeVib = (l.find((x) => x[0] === "vib") || [])[1] || [];
    check(has(l, "sfx", "strike") && l.find((x) => x[0] === "sfx" && x[1] === "strike")[2] === 1 && has(l, "hx.thump", 1) && has(l, "flash") && l.some((x) => x[0] === "w.twitch" && x[1] >= 0.7),
      "the strike: its sound and buzz by how hard it hit, the flash, the rod tip pulled down (" + brief(l) + ")");
    // the rod tip: a twitch moves the drawn tip
    const tipMove = await page.evaluate(() => {
      const W = FISH.world, rod = { theta: 50, yaw: 0, bend: 0.1, pull: { x: 0, y: 0, z: -20 }, visible: true };
      const a = W.setRod(rod); W.twitch(0.9, 0); const b = W.setRod(rod);
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    });
    check(tipMove > 0.05, `a twitch moves the rod tip (${(tipMove * 100).toFixed(1)} cm)`);
    await stage(page, { phase: "retrieve", fish: null });
    await logClear(page);
    await stage(page, {}, [{ type: "nibble", s: 0.5 }], false);
    l = await logNow(page);
    const nib = l.find((x) => x[0] === "w.twitch");
    check(!!nib && nib[1] > 0.1 && nib[1] < 0.7, "a nibble twitches the rod tip, less than a strike (" + (nib ? nib[1].toFixed(2) : "none") + ")");

    // ---- the hook set ----
    console.log("     the hook set");
    await stage(page, { phase: "strike", fish: null });
    await logClear(page);
    await armBanner(page);
    await stage(page, { phase: "fight", fish: { id: "smallmouth", kg: 1.2, x: 0, z: -20, known: false } }, [{ type: "strike", s: 1 }, { type: "hooked", id: "smallmouth" }], false);
    const shown = await shownBanner(page);
    await shot(page, "moments-hookset");
    await wait(page, () => document.querySelector("#banner").hidden);
    l = await logNow(page);
    const vibs = l.filter((x) => x[0] === "vib").map((x) => x[1]), setVib = vibs.find((p) => onMs(p) >= 160) || vibs.at(-1) || [];
    const bOn = l.find((x) => x[0] === "banner" && x[1]), bOff = l.find((x) => x[0] === "banner" && !x[1] && bOn && x.at(-1) > bOn.at(-1));
    const bannerMs = bOn && bOff ? bOff.at(-1) - bOn.at(-1) : -1;
    check(!shown.hidden && shown.text === "Fish on!" && shown.sub === "Quick set!" && shown.prompt === "hidden" && shown.pop === "banner-pop", "\"Fish on!\" pops up in the prompt's place, with \"Quick set!\" for a set right after the strike (" + JSON.stringify(shown) + ")");
    check(bannerMs >= 800 && bannerMs <= 1500, `the banner stays about 0.9 s (${bannerMs} ms)`);
    check(has(l, "sfx", "hookset") && has(l, "hx.hookset"), "the hook-set sound and buzz");
    check(onMs(setVib) > onMs(strikeVib) && onMs(strikeVib) > 0, `the hook-set buzz (${JSON.stringify(setVib)}, ${onMs(setVib)} ms on) is longer than the strike's (${JSON.stringify(strikeVib)}, ${onMs(strikeVib)} ms on)`);
    check(l.some((x) => x[0] === "w.freeze" && x[1] === 70 && x[2] === true) && l.some((x) => x[0] === "w.punch" && x[2] === true) && l.some((x) => x[0] === "w.twitch" && x[1] >= 0.9), "the freeze (70 ms), the punch and the rod-tip whip (" + brief(l.filter((x) => /^w\./.test(x[0]))) + ")");
    // the freeze holds the lake, the fish and the camera; the game (the sim, the input) goes on
    const fz = await page.evaluate(async () => {
      const W = FISH.world, out = {};
      out.applied = W.freeze(70);
      const c0 = W.feel().clock; W.update(0.016); out.held = W.feel().clock === c0 && W.feel().frozen;
      await new Promise((r) => setTimeout(r, 120));
      const c1 = W.feel().clock; W.update(0.016); out.after = W.feel().clock > c1;
      // a long freeze, to count the sim's steps meanwhile (long, so a slow frame or timer here cannot outlast it)
      window.__steps = 0; W.freeze(60000); const c2 = W.feel().clock, t2 = performance.now();
      while (window.__steps < 3 && performance.now() - t2 < 30000) await new Promise((r) => setTimeout(r, 100));
      out.steps = window.__steps; out.still = W.feel().clock === c2 && W.feel().frozen;
      W.freeze(0);
      out.punch0 = (W.punch(), W.feel().punch);
      await new Promise((r) => setTimeout(r, 500));
      out.punch1 = W.feel().punch;
      return out;
    });
    check(fz.applied && fz.held && fz.after, "world.freeze(70) holds the world's clock, and it runs again after (" + JSON.stringify(fz) + ")");
    check(fz.still && fz.steps >= 3, `the sim keeps stepping while the world is frozen (${fz.steps} steps, the world's clock held)`);
    check(Math.abs(fz.punch0 - 0.92) < 0.01 && fz.punch1 === 1, `the punch narrows the view by 8% at once, and it is back after 0.5 s (${fz.punch0.toFixed(3)}, ${fz.punch1})`);
    // a slower set, and a fish that hooked itself
    await stage(page, { phase: "strike", fish: null }, [{ type: "strike", s: 0.6 }]);
    await sleep(600);
    await armBanner(page);
    await stage(page, { phase: "fight", fish: { id: "smallmouth", kg: 1.2, x: 0, z: -20, known: false } }, [{ type: "hooked", id: "smallmouth" }], false);
    let b = await shownBanner(page);
    check(!b.hidden && b.text === "Fish on!" && b.sub === "", "a set 0.6 s after the strike: \"Fish on!\" with no \"Quick set!\" (" + JSON.stringify(b) + ")");
    await stage(page, { phase: "fight", fish: { id: "smallmouth", kg: 1.2, known: false } }, [{ type: "hooked", id: "smallmouth", self: true }]);
    b = await page.evaluate(() => ({ text: document.querySelector("#banner b").textContent, sub: document.querySelector("#banner span").textContent }));
    check(b.text === "It hooked itself! Fish on!" && b.sub === "", "a fish that hooked itself says so (" + b.text + ")");

    // ---- a run, a turn, a legend's stages ----
    console.log("     the fight");
    await stage(page, {});
    await sleep(1000);
    await logClear(page);
    await stage(page, {}, [{ type: "run" }], false);
    l = await logNow(page);
    check(has(l, "sfx", "ratchet") && !has(l, "sfx", "tick") && has(l, "hx.bump", 0.5), "a run starts with a ratchet burst and a tap (" + brief(l) + ")");
    await sleep(300); await logClear(page);
    await stage(page, {}, [{ type: "turn" }], false);
    l = await logNow(page);
    check(has(l, "hx.turn") && !has(l, "hx.thump"), "it turned: its own buzz, not the strike's (" + brief(l) + ")");
    await logClear(page);
    await stage(page, { fish: { id: "golden", kg: 4.5 } }, [{ type: "phase", n: 1, of: 3, name: "It runs for the lily pads!" }]);
    l = await logNow(page);
    check(!has(l, "sfx", "record") && !has(l, "sfx", "stage") && !has(l, "hx.phase"), "a legend's first stage: no fanfare, no stage sound, no stage buzz (the hook set says it) (" + brief(l) + ")");
    await sleep(500); await logClear(page);
    await stage(page, {}, [{ type: "phase", n: 2, of: 3, name: "It dives for the rocks!" }], false);
    l = await logNow(page);
    check(has(l, "sfx", "stage") && !has(l, "sfx", "record") && has(l, "hx.phase"), "its next stage: the drum roll and horn, no victory fanfare (" + brief(l) + ")");

    // ---- a jump 30 m out: the zoom ----
    console.log("     a jump");
    const jx = eye.x, jz = eye.z - 30;
    await stage(page, { fish: { id: "smallmouth", kg: 0.9, len: 0.34, x: jx, z: jz, y: -0.3, heading: Math.PI / 2, move: "swim", jump: 0, known: true } });
    await lakeTime(page, 1.5);
    const before = await fishBox(page, "smallmouth");
    await logClear(page);
    await stage(page, { fish: { y: 0.3, jump: 0.5, move: "jump" } }, [{ type: "jump", size: 0.34, x: jx, z: jz }], false);
    await wait(page, () => FISH.world.feel().zoom > 0.95, null, SLOW);
    const box = await fishBox(page, "smallmouth"), zf = await page.evaluate(() => FISH.world.feel()), top = await freeTop(page);
    await shot(page, "moments-jump");
    l = await logNow(page);
    check(has(l, "sfx", "jump") && l.some((x) => x[0] === "w.jumpZoom" && x[2] === true), "a jump: its sound and the zoom (" + brief(l) + ")");
    check(!!box && box.w >= 20, `a smallmouth jumping 30 m out is ${box ? box.w.toFixed(1) : "?"} px wide on a 390 px phone (want 20 or more; ${before ? before.w.toFixed(1) : "?"} px before the jump; view ${zf.fov.toFixed(1)} of ${zf.base.toFixed(1)} degrees)`);
    check(inFree(box, top) && zf.rod, `and it is in the view below the HUD and the prompt (${boxText(box)}, free from ${top.toFixed(0)}), with the rod still drawn (${zf.rod})`);
    await stage(page, { fish: { y: -0.4, jump: 0, move: "swim" } }, [], false);
    const zoomAfter = await page.evaluate(() => FISH.world.feel().zoom);
    await wait(page, () => FISH.world.feel().zoom < 0.05, null, SLOW);
    const back = await page.evaluate(() => FISH.world.feel());
    check(zoomAfter > 0.5 && back.zoom < 0.05 && back.fov > back.base * 0.9, `after the jump the view eases back (zoom ${zoomAfter.toFixed(2)} as it lands, then ${back.zoom.toFixed(3)}; view ${back.fov.toFixed(1)} of ${back.base.toFixed(1)})`);

    // ---- a cast into a ring, a sweet release, a far splash ----
    console.log("     the cast");
    await page.evaluate(() => { FISH.newCast(); });
    await wait(page, () => FISH.G.phase === "cast");
    await wait(page, () => FISH.rises && FISH.rises.list.length > 0, null, SLOW);
    const ring = await page.evaluate(() => { const g = FISH.rises.list[0]; return { x: g.x, z: g.z, gold: g.gold }; });
    await logClear(page);
    await landAt(page, ring.x, ring.z);
    l = await logNow(page);
    const rh = l.find((x) => x[0] === "sfx" && x[1] === "ringHit");
    check(!!rh && rh[2] === (ring.gold ? 1 : 0) && !has(l, "sfx", "ui") && has(l, "hx.bump", 0.5) && has(l, "w.sparkle"), "a cast right into a ring: its own chime (not the menu click), a tap, gold sparks (" + brief(l) + ")");
    await page.evaluate(() => { FISH.newCast(); FISH.G.backMax = 135; });
    await wait(page, () => FISH.G.phase === "cast");
    await logClear(page);
    const sweet = await page.evaluate((th) => { FISH.release(performance.now(), false, { theta: th, fwd: 600 }); return { verdict: FISH.G.cast && FISH.G.cast.verdict, cue: document.querySelector("#report .verdict").textContent }; }, CAST.IDEAL_RELEASE);
    l = await logNow(page);
    const s1 = sounds(l);
    check(sweet.verdict === "sweet" && sweet.cue === "Sweet!" && s1.includes("zing") && !s1.includes("ui") && s1.indexOf("release") < s1.indexOf("zing"), "a sweet release: \"Sweet!\" with its own bright sound, not the menu click (" + s1.join(" ") + ")");
    await wait(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, SLOW);
    // a far splash: no rings near it, so only its own droplets count
    await page.evaluate(() => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); FISH.newCast(); });
    await wait(page, () => FISH.G.phase === "cast");
    await sleep(800);
    await landAt(page, eye.x, eye.z - 45);
    const far = await splashHeight(page, { x: eye.x, z: eye.z - 45 });
    await shot(page, "moments-splash45");
    check(far.height >= 12, `a lure landing 45 m out splashes ${far.height.toFixed(1)} px tall on 390x844 (want 12 or more; ${far.n} droplets)`);
    await page.evaluate(() => { FISH.newCast(); });
    await wait(page, () => FISH.G.phase === "cast");
    await sleep(800);
    await landAt(page, eye.x, eye.z - 6);
    const near = await splashHeight(page, { x: eye.x, z: eye.z - 6 }, 1.5);
    console.log(`     (a splash 6 m out: ${near.height.toFixed(1)} px tall, ${near.n} droplets)`);

    // ---- the catch: tiered stingers and the card's reveal ----
    console.log("     the catch");
    let c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.35, cm: 27, junk: false });
    let s = sounds(c.log);
    const ticks = c.log.filter((x) => x[0] === "sfx" && x[1] === "tick").map((x) => x[2]);
    check(c.badges.join() === "NEW SPECIES" && c.early.held && !c.held && c.stamp && c.badgeAnim === "stamp" && c.kgAnim === "kg-pop" && s.includes("stamp"), "the badges wait for the weight to count up, then stamp on with a thunk, and the weight pops (" + JSON.stringify({ badges: c.badges, early: c.early, held: c.held, stamp: c.stamp, badge: c.badgeAnim, kg: c.kgAnim }) + ")");
    check(ticks.length >= 3 && ticks.every((v, i) => i === 0 || v > ticks[i - 1]), "the count-up ticks climb (" + ticks.map((v) => v.toFixed(2)).join(" ") + ")");
    check(s.includes("landed") && s.includes("newSpecies") && !s.includes("record") && !s.includes("recordCall"), "a new species: the landing, then its short rise, no fanfare (" + s.filter((x) => x !== "tick").join(" ") + ")");
    await click(page, "#catchGo");
    c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.3, cm: 26, junk: false });
    s = sounds(c.log).filter((x) => x !== "tick" && x !== "ui");
    check(s.join() === "landed", "a routine catch: only the landed sound (" + s.join(" ") + ")");
    await click(page, "#catchGo");
    c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.45, cm: 30, junk: false });
    s = sounds(c.log);
    check(c.badges.join() === "NEW RECORD" && s.includes("recordCall") && !s.includes("record"), "a new record: the two-note call, no fanfare (" + s.filter((x) => x !== "tick").join(" ") + ")");
    await click(page, "#catchGo");
    c = await catchCard(page, { id: "perch", name: "Yellow Perch", kg: 0.59, cm: 34, junk: false });
    s = sounds(c.log);
    const sc = c.log.find((x) => x[0] === "w.showCatch");
    check(s.includes("record") && s.includes("shutter") && !s.includes("recordCall") && has(c.log, "hx.shutter") && !has(c.log, "hx.thump") && c.log.filter((x) => x[0] === "hx.land" && x[1] === 1).length >= 2,
      "a trophy: the full fanfare and the shutter, the shutter's own tick, the trophy buzz at the catch and at the end of the count (" + s.filter((x) => x !== "tick").join(" ") + ")");
    check(!!sc && JSON.parse(sc[1]).sparkle === true, "and the trophy sparkles in the catch view (" + (sc ? sc[1] : "") + ")");
    await shot(page, "moments-trophy");
    await click(page, "#catchGo");

    // ---- a new place (a walleye of 3.6 kg opens Stump Bay; any legend here would open it too, so it comes after) ----
    console.log("     a new place");
    c = await catchCard(page, { id: "walleye", name: "Walleye", kg: 3.6, cm: 62, junk: false });
    await logClear(page);
    await click(page, "#catchGo");
    await page.waitForSelector("#unlock:not([hidden])");
    await shot(page, "moments-unlock-0");
    const un = await page.evaluate(() => ({ card: window.__anim("#unlock .card"), badge: window.__anim("#unlock .badge") }));
    await sleep(400);
    await shot(page, "moments-unlock-400");
    l = await logNow(page);
    check(l.some((x) => x[0] === "sfx" && x[1] === "newPlace" && x[2] === 1) && has(l, "hx.land", 1), "the new place card: the horn call and Stump Bay's sound, and a buzz (" + brief(l) + ")");
    check(un.card.name === "card-rise" && un.badge.name === "stamp" && un.badge.delay === "0.25s", "the card rises in, and the NEW PLACE badge stamps on 250 ms later (" + JSON.stringify(un) + ")");
    await click(page, "#uStay");
    await wait(page, () => FISH.G.phase === "cast");
    c = await catchCard(page, { id: "golden", name: "Golden Loon Bass", kg: 4.8, cm: 66, junk: false });
    s = sounds(c.log);
    check(s.includes("record") && s.includes("loonWail") && has(c.log, "hx.land", 2) && JSON.parse((c.log.find((x) => x[0] === "w.showCatch") || [0, "{}"])[1]).sparkle === true, "a legend: the fanfare, the call of its place, the longest buzz, the sparkle (" + s.filter((x) => x !== "tick").join(" ") + ")");
    await click(page, "#catchGo");

    // ---- the derby end ----
    console.log("     the derby end");
    async function derby(bag, unlocked) {
      await page.evaluate(() => FISH.startMode("derby"));
      await wait(page, () => FISH.G.phase === "cast");
      await logClear(page);
      await page.evaluate(([bag, unlocked]) => {
        window.__rt = [];
        const el = document.querySelector("#rtotal"), t0 = performance.now();
        window.__rtObs && window.__rtObs.disconnect();
        window.__rtObs = new MutationObserver(() => window.__rt.push([el.textContent, Math.round(performance.now() - t0), document.querySelector("#rrank").classList.contains("held")]));
        window.__rtObs.observe(el, { childList: true, characterData: true, subtree: true });
        FISH.G.castsLeft = 0; FISH.G.bag = bag; FISH.G.unlocked = unlocked; FISH.newCast();
      }, [bag, unlocked]);
      await page.waitForSelector("#results:not([hidden])");
      await wait(page, () => !document.querySelector("#rrank").classList.contains("held"));
      // a place this derby opened sounds its call 2.6 s after a best derby's close
      if (unlocked.length) await wait(page, () => window.__log.some((l) => l[0] === "sfx" && l[1] === "newPlace"));
      else await sleep(600);
      return { rt: await page.evaluate(() => window.__rt.slice()), log: await logNow(page) };
    }
    let d = await derby([{ id: "perch", kg: 0.42 }, { id: "walleye", kg: 2.2 }], [{ id: "stumps", kg: 3.6, name: "Walleye" }]);
    await shot(page, "moments-results");
    const last = d.rt.at(-1) || [];
    const shownAt = d.rt.find((x) => !x[2]);
    check(d.rt.length >= 4 && d.rt[0][0] === "0.00 kg" && last[0] === "2.6 kg" && d.rt.slice(0, -1).every((x) => x[2]) && shownAt && shownAt[1] >= 700 && shownAt[1] <= 2500,
      `the derby total counts up from zero over about 1 s, then the rank shows (${d.rt.length} steps: ${d.rt.slice(0, 3).map((x) => x[0]).join(", ")} ... ${last[0]} at ${last[1]} ms)`);
    s = sounds(d.log);
    check(s.includes("record") && !s.includes("derbyClose") && has(d.log, "hx.land", 1) && s.indexOf("newPlace") > s.indexOf("record"), "a best derby: the fanfare, then the new place's call for the place it opened (" + s.filter((x) => x !== "tick").join(" ") + ")");
    d = await derby([{ id: "perch", kg: 0.3 }], []);
    s = sounds(d.log);
    check(s.includes("derbyClose") && !s.includes("record") && has(d.log, "hx.land", 0), "any other derby end: a soft close (" + s.filter((x) => x !== "tick").join(" ") + ")");
    // all those splashes, ripples and sparks left every shader number finite (a NaN ripple would hide the water)
    const bad = await badUniforms(page);
    check(!bad.length, "every shader value is still a number after the moments (" + JSON.stringify(bad) + ")");
    // and a splash with no place does nothing (it would put a NaN into a ripple)
    await page.evaluate(() => { FISH.world.splash(undefined, NaN, 0.4); FISH.world.ripple(NaN, 1, 0.3); });
    check(!(await badUniforms(page)).length, "a splash or ripple with no place is ignored");
  } catch (e) { check(false, "exception in part A: " + (e && e.stack)); }
  check(errors.length === 0, "part A: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part B: Calm effects ================= */
if (part("B")) {
  const { browser, page, errors } = await open({ save: SAVE });
  try {
    await spy(page);
    const eye = await page.evaluate(() => FISH.place.stand.eye);
    await page.evaluate(async () => { document.documentElement.dataset.calm = "1"; const g = await import("/fish/js/goals.js"), d = g.dayOf(), dg = g.dailyGoal(d, FISH.save); FISH.save.today = { d, k: dg.k, n: dg.n, done: 1 }; });
    await page.evaluate(() => FISH.startMode("free"));
    await wait(page, () => FISH.G.phase === "cast");
    console.log("     Calm effects");
    await stage(page, { tfrac: 0.9 });
    await wait(page, () => document.querySelector("#prompt").classList.contains("hot"));
    check(await page.evaluate(() => getComputedStyle(document.querySelector("#prompt .p1")).animationName === "none"), "calm: a hot prompt does not glow");
    // the strike and the hook set
    await stage(page, { phase: "strike", fish: null });
    await logClear(page);
    await armBanner(page);
    await stage(page, { phase: "fight", fish: { id: "smallmouth", kg: 1.2, x: 0, z: -20, known: false } }, [{ type: "strike", s: 1 }, { type: "hooked", id: "smallmouth" }], false);
    const bn = { ...(await shownBanner(page)), feel: await page.evaluate(() => FISH.world.feel()) };
    let l = await logNow(page);
    check(!bn.hidden && bn.text === "Fish on!" && bn.sub === "Quick set!" && bn.pop === "none", "calm: the hook set keeps its words, with no pop (" + JSON.stringify({ text: bn.text, sub: bn.sub, pop: bn.pop }) + ")");
    check(has(l, "sfx", "strike") && has(l, "sfx", "hookset") && has(l, "hx.thump") && has(l, "hx.hookset") && l.some((x) => x[0] === "vib"), "calm: the strike and the hook set keep their sounds and buzzes (" + brief(l) + ")");
    check(l.some((x) => x[0] === "w.freeze" && x[2] === false) && l.some((x) => x[0] === "w.punch" && x[2] === false) && !bn.feel.frozen && bn.feel.punch === 1 && !has(l, "flash"), "calm: no freeze, no punch, no flash (" + brief(l.filter((x) => /^w\.|flash/.test(x[0]))) + ")");
    // a jump: no zoom
    await stage(page, { fish: { id: "smallmouth", kg: 0.9, len: 0.34, x: eye.x, z: eye.z - 30, y: 0.3, heading: Math.PI / 2, move: "jump", jump: 0.5, known: true } }, [{ type: "jump", size: 0.34, x: eye.x, z: eye.z - 30 }]);
    const c0 = await page.evaluate(() => FISH.world.feel().clock);
    await wait(page, (c) => FISH.world.feel().clock > c + 1, c0, SLOW);
    const jf = await page.evaluate(() => FISH.world.feel());
    l = await logNow(page);
    check(jf.zoom === 0 && l.some((x) => x[0] === "w.jumpZoom" && x[2] === false) && has(l, "sfx", "jump"), `calm: a jump keeps its sound, and the view does not zoom (zoom ${jf.zoom})`);
    // a sweet release: "Sweet!" and its sound, with no pop; then the same with reduced motion and no Calm effects
    const sweetRelease = async () => {
      await page.evaluate(() => { FISH.newCast(); FISH.G.backMax = 135; });
      await wait(page, () => FISH.G.phase === "cast");
      await logClear(page);
      const r = await page.evaluate((th) => {
        FISH.release(performance.now(), false, { theta: th, fwd: 600 });
        const el = document.querySelector("#report");
        return { cue: el.querySelector(".verdict").textContent, cls: el.className, anim: getComputedStyle(el).animationName, running: el.getAnimations().map((a) => a.animationName) };
      }, CAST.IDEAL_RELEASE);
      r.sounds = sounds(await logNow(page));
      await wait(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, SLOW);
      return r;
    };
    let sw = await sweetRelease();
    check(sw.cue === "Sweet!" && /show/.test(sw.cls) && sw.anim === "none" && !sw.running.length && sw.sounds.includes("zing"), "calm: the \"Sweet!\" cue keeps its words and sound, with no pop (" + JSON.stringify(sw) + ")");
    await page.evaluate(() => { delete document.documentElement.dataset.calm; });
    await page.emulateMedia({ reducedMotion: "reduce" });
    sw = await sweetRelease();
    check(sw.cue === "Sweet!" && sw.anim === "none" && !sw.running.length && sw.sounds.includes("zing"), "reduced motion: the \"Sweet!\" cue shows with no pop too (" + JSON.stringify(sw) + ")");
    await page.emulateMedia({ reducedMotion: null });
    await page.evaluate(() => { document.documentElement.dataset.calm = "1"; });
    // the catch card at once
    await logClear(page);
    await page.evaluate(() => FISH.newCast());
    await stage(page, { phase: "caught", catch: { id: "perch", name: "Yellow Perch", kg: 0.59, cm: 34, junk: false }, fish: null });
    await wait(page, () => !document.querySelector("#catch").hidden);
    await wait(page, () => !FISH.G.cardWait);
    const card = await page.evaluate(() => ({ kg: document.querySelector("#ckg").dataset.kg, held: document.querySelector("#cbadges").classList.contains("held"), anims: [...document.querySelectorAll("#cbadges .badge, #ckg")].filter((x) => getComputedStyle(x).animationName !== "none").length }));
    await sleep(1900);
    l = await logNow(page);
    const s = sounds(l);
    check(card.kg === "0.59" && !card.held && card.anims === 0 && !s.includes("tick"), "calm: the catch card shows its weight and badges at once, with no count-up or stamp motion (" + JSON.stringify(card) + ")");
    check(s.includes("landed") && s.includes("record") && s.includes("shutter") && s.includes("stamp") && !has(l, "flash"), "calm: the catch keeps its sounds (" + s.join(" ") + "), and the photo has no flash");
    await click(page, "#catchGo");
    // the new place card
    await page.evaluate(() => FISH.newCast());
    await stage(page, { phase: "caught", catch: { id: "walleye", name: "Walleye", kg: 3.6, cm: 62, junk: false }, fish: null });
    await wait(page, () => !document.querySelector("#catch").hidden);
    await wait(page, () => !FISH.G.cardWait);
    await logClear(page);
    await click(page, "#catchGo");
    await page.waitForSelector("#unlock:not([hidden])");
    const ua = await page.evaluate(() => [...document.querySelectorAll("#unlock .card, #unlock .badge")].filter((x) => getComputedStyle(x).animationName !== "none").length);
    l = await logNow(page);
    check(ua === 0 && has(l, "sfx", "newPlace") && has(l, "hx.land", 1), `calm: the new place card keeps its horn and buzz, and does not move (${ua} animations)`);
    await click(page, "#uStay");
    // the derby end
    await page.evaluate(() => FISH.startMode("derby"));
    await wait(page, () => FISH.G.phase === "cast");
    await logClear(page);
    await page.evaluate(() => {
      window.__rt = [];
      const el = document.querySelector("#rtotal");
      new MutationObserver(() => window.__rt.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
      FISH.G.castsLeft = 0; FISH.G.bag = [{ id: "perch", kg: 0.42 }]; FISH.G.unlocked = []; FISH.newCast();
    });
    await page.waitForSelector("#results:not([hidden])");
    await sleep(800);
    const rt = await page.evaluate(() => ({ rt: window.__rt.slice(), held: document.querySelector("#rrank").classList.contains("held") }));
    l = await logNow(page);
    check(rt.rt.every((t) => t === "0.42 kg") && !rt.held && (has(l, "sfx", "record") || has(l, "sfx", "derbyClose")), "calm: the derby total shows at once, with the close of the derby (" + JSON.stringify(rt) + " " + sounds(l).join(" ") + ")");
  } catch (e) { check(false, "exception in part B: " + (e && e.stack)); }
  check(errors.length === 0, "part B: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= part C: the jump zoom on the other layouts ================= */
if (part("C")) {
  for (const [width, height, desk] of [[844, 390, false], [360, 640, false], [1280, 800, true]]) {
    const sz = `${width}x${height}`, { browser, page, errors } = await open({ width, height, touch: !desk, phone: !desk, save: SAVE });
    try {
      console.log("     the jump zoom at " + sz);
      const eye = await page.evaluate(() => FISH.place.stand.eye);
      await page.evaluate(async () => { const g = await import("/fish/js/goals.js"), d = g.dayOf(), dg = g.dailyGoal(d, FISH.save); FISH.save.today = { d, k: dg.k, n: dg.n, done: 1 }; });
      await page.evaluate(() => FISH.startMode("free"));
      await wait(page, () => FISH.G.phase === "cast", null, 60000);
      await sleep(500);
      // a smallmouth at the top of its leap (fish.js tops it out at 0.47 m), 30 and 50 m out; a big bass 30 m out on the wide phone
      const cases = [["smallmouth", 0.34, 30], ["smallmouth", 0.34, 50]].concat(width === 844 ? [["golden", 0.66, 30]] : []);
      for (const [id, len, dist] of cases) {
        await stage(page, { fish: { id, kg: 1, len, x: eye.x, z: eye.z - dist, y: -0.3, heading: Math.PI / 2, move: "swim", jump: 0, known: true } });
        await lakeTime(page, 1.5);
        const a0 = await page.evaluate(() => FISH.world.rodAnchor());
        await stage(page, { fish: { y: 0.35 + 0.35 * len, jump: 0.5, move: "jump" } }, [{ type: "jump", size: len, x: eye.x, z: eye.z - dist }], false);
        await wait(page, () => FISH.world.feel().zoom > 0.95, null, SLOW);
        await lakeTime(page, 0.6);
        const box = await fishBox(page, id), top = await freeTop(page), f = await page.evaluate(() => FISH.world.feel()), a1 = await page.evaluate(() => FISH.world.rodAnchor());
        await shot(page, `moments-jump${dist}-${id}-${sz}`);
        check(inFree(box, top) && box.w >= 20, `${sz}: a ${id} leaping ${dist} m out is in the view below the HUD and the prompt (${boxText(box)}, free from ${top.toFixed(0)}; ${box ? box.w.toFixed(0) : "?"} px wide; view ${f.fov.toFixed(1)} of ${f.base.toFixed(1)} degrees)`);
        const drift = Math.hypot(a1.x - a0.x, a1.y - a0.y);
        check(f.rod && drift < 12, `${sz}: the rod stays drawn through the zoom, held where it was (moved ${drift.toFixed(1)} px)`);
        await stage(page, { fish: { y: -0.4, jump: 0, move: "swim" } }, [], false);
        await wait(page, () => FISH.world.feel().zoom < 0.05, null, SLOW);
      }
    } catch (e) { check(false, `exception in part C at ${sz}: ` + (e && e.stack)); }
    check(errors.length === 0, `part C at ${sz}: no page errors` + (errors.length ? ":\n" + errors.join("\n") : ""));
    await browser.close();
  }
}

/* ================= part D: the trophy photo after a jump, on slow frames ================= */
if (part("D")) {
  for (const [width, height] of [[390, 844], [360, 640], [844, 390]]) {
    const sz = `${width}x${height}`, { browser, page, errors } = await open({ width, height, save: SAVE });
    try {
      console.log("     the trophy photo after a jump, on slow frames, at " + sz);
      const eye = await page.evaluate(() => FISH.place.stand.eye);
      await page.evaluate(async () => { const g = await import("/fish/js/goals.js"), d = g.dayOf(), dg = g.dailyGoal(d, FISH.save); FISH.save.today = { d, k: dg.k, n: dg.n, done: 1 }; });
      await page.evaluate(() => FISH.startMode("free"));
      await wait(page, () => FISH.G.phase === "cast", null, 60000);
      await sleep(500);
      // a smallmouth leaps 11 m out, and the view zooms in on it (and looks up at the leap)
      const jx = eye.x - 0.8, jz = eye.z - 11;
      await stage(page, { tfrac: 0.6, lineOut: 11.5, fish: { id: "smallmouth", kg: 1.7, cm: 44, len: 0.44, x: jx, z: jz, y: -0.4, heading: Math.PI / 2, move: "swim", jump: 0, known: true } });
      await lakeTime(page, 1.5);
      await stage(page, { fish: { y: 0.9, jump: 0.8, move: "jump" } }, [{ type: "jump", size: 0.44, x: jx, z: jz }], false);
      await wait(page, () => FISH.world.feel().zoom > 0.95, null, SLOW);
      // the trophy on the screen (CSS px in the view): its middle, its box (the board too), and the middle of the part of
      // the view the card leaves free (above it on a tall view, left of it on a wide one). Taken at the flash. From here on
      // every frame takes 150 ms: the lake's clock (at most 50 ms a frame) runs at a third of the wall clock, which times
      // the flash and the card. And no frame comes for 1.5 s after the landing, so the flash's time comes before a frame
      // shows the photo's pose
      await page.evaluate(async () => {
        const THREE = await import("/fish/lib/three.module.min.js"), W = FISH.world, fl = document.querySelector("#flash");
        window.__trophy = () => {
          const m = W.scene.children.find((o) => o.userData && o.userData.trophy), cam = W.camera;
          if (!m) return null;
          const v = document.querySelector("#view"), w = v.clientWidth, h = v.clientHeight, b = new THREE.Box3().setFromObject(m, true), p = new THREE.Vector3(), r = v.getBoundingClientRect();
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (let i = 0; i < 8; i++) {
            p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam);
            const x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          }
          p.copy(m.position).project(cam);
          const off = cam.view && cam.view.enabled ? cam.view : { offsetX: 0, offsetY: 0 };
          return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, x0, x1, y0, y1, w, h, mx: w / 2 - off.offsetX, my: h / 2 - off.offsetY, left: r.left, top: r.top };
        };
        new MutationObserver(() => { if (fl.classList.contains("go") && fl.classList.contains("photo") && !window.__photo) window.__photo = window.__trophy(); }).observe(fl, { attributes: true, attributeFilter: ["class"] });
        const raf = window.requestAnimationFrame.bind(window), cat = document.querySelector("#catch");
        let last = performance.now(), hold = 0;
        new MutationObserver(() => { if (!cat.hidden && !hold) hold = performance.now() + 1500; }).observe(cat, { attributes: true, attributeFilter: ["hidden"] });
        window.requestAnimationFrame = (cb) => raf(function go() { if (performance.now() < hold) { raf(go); return; } while (performance.now() - last < 150); last = performance.now(); cb(last); });
      });
      // a trophy largemouth is landed at once, with the zoom still on
      await stage(page, { phase: "caught", catch: { id: "largemouth", name: "Largemouth Bass", kg: 3.9, cm: 55, junk: false }, fish: null }, [], false);
      await wait(page, () => !!window.__photo, null, 30000);
      const ph = await page.evaluate(() => window.__photo);
      check(Math.abs(ph.x - ph.mx) <= 0.03 * ph.w && Math.abs(ph.y - ph.my) <= 0.03 * ph.h,
        `${sz}: at the flash the fish is in the middle of the part of the view the card leaves free (at ${ph.x.toFixed(0)}, ${ph.y.toFixed(0)} px; the middle at ${ph.mx.toFixed(0)}, ${ph.my.toFixed(0)})`);
      await wait(page, () => !FISH.G.cardWait, null, 30000);
      await wait(page, () => { const c = document.querySelector("#catch .card"); return !c.getAnimations({ subtree: true }).some((a) => a.playState === "running" || a.pending); }, null, 30000);
      const up = await page.evaluate(() => { const r = document.querySelector("#catch .card").getBoundingClientRect(); return { fish: window.__trophy(), card: { left: r.left, top: r.top } }; });
      await shot(page, `moments-trophy-after-jump-${sz}`);
      // the card covers the bottom of a tall view and the right of a wide one
      const f = up.fish, tall = height > width, clear = tall ? f.top + f.y1 <= up.card.top : f.left + f.x1 <= up.card.left;
      check(clear && f.x0 >= 0 && f.y0 >= 0 && f.x1 <= f.w && f.y1 <= f.h,
        `${sz}: the card comes up beside the fish, not over it (the fish ${(f.left + f.x0).toFixed(0)}..${(f.left + f.x1).toFixed(0)} x ${(f.top + f.y0).toFixed(0)}..${(f.top + f.y1).toFixed(0)} px, the card from ${tall ? "y " + up.card.top.toFixed(0) : "x " + up.card.left.toFixed(0)})`);
    } catch (e) { check(false, `exception in part D at ${sz}: ` + (e && e.stack)); }
    check(errors.length === 0, `part D at ${sz}: no page errors` + (errors.length ? ":\n" + errors.join("\n") : ""));
    await browser.close();
  }
}

console.log(fails.length ? `\n${fails.length} check(s) failed` : "\nall moments checks passed");
process.exit(fails.length ? 1 : 0);
