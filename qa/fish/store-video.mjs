// The store videos of Reel It In (apps/fish/store/video.md), at 30 fps, H.264 with AAC. FORMAT=play: the Google Play
// promo video, 31 s at 1920 x 1080 for YouTube; the game plays in phone panels on the painted water of the store art,
// with titles that move. FORMAT=appstore: the App Store app preview, under 30 s at 886 x 1920; the game fills the picture.
//  1. film: each clip is the real game on Playwright's fake clock, one frame each 1/30 s, in a phone (360 x 640 at 1.5x, or
//     443 x 960 at 2x for the app preview). The page's CSS animations follow that clock, and every sound the game asks
//     for is logged with its time. The casts are real motion casts with the virtual phone; the strike, the fight and the
//     catch are staged with the game's QA hooks (window.FISH), as in store-shots.mjs.
//  2. cut: a page lays out the clips, the titles and the end card, and each frame of the video is a screenshot of it.
//  3. sound: the logged sounds, rendered by the game's own audio.js (renderOffline), on the video's timeline, over the
//     sound of each place.
//  4. mp4: ffmpeg puts the frames and the sound together, at -16 LUFS.
// Run (serve public/ first): NODE_PATH=qa/browser/node_modules node qa/fish/store-video.mjs
//   FORMAT=appstore             the app preview (default play). Its clips, frames and sound have their own names in OUT
//   OUT=<dir>                   the work folder and the video (default <tmp>/fish-video). The clips stay there between runs
//   STEPS=film,cut,sound,mp4    only these passes
//   CLIPS=cast,strike           film only these clips (cast strike fight trophy touch place-loon place-stumps place-river place-sea,
//                               and title for appstore)
// It needs ffmpeg. Watch the video: a run that ends well says nothing about how it looks.
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { URL as GAME, installPhone, SEEN } from "./lib.mjs";
import { C, water, ripples, bobber, stickTip, svg } from "../../apps/fish/scripts/art.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.resolve(process.env.OUT || path.join(os.tmpdir(), "fish-video"));
const STEPS = (process.env.STEPS || "film,cut,sound,mp4").split(",").map((s) => s.trim());
const ONLY = process.env.CLIPS ? process.env.CLIPS.split(",").map((s) => s.trim()) : null;
// FORMAT=play (the default): the Google Play promo video, 1920 x 1080 for YouTube. FORMAT=appstore: the App Store app
// preview of a 6.9" iPhone, 886 x 1920, under 30 s. Apple allows only screen captures of the app with text over them, so
// the game fills that picture, filmed in a 443 x 960 phone at 2x
const FORMATS = {
  play: { W: 1920, H: 1080, phone: [360, 640], dpr: 1.5, placeDpr: 1.2, crf: 17, level: "4.1", audio: "192k", file: "reel-it-in-promo.mp4" },
  appstore: { W: 886, H: 1920, phone: [443, 960], dpr: 2, placeDpr: 2, crf: 15, level: "4.0", audio: "256k", maxrate: "12M", file: "reel-it-in-app-preview.mp4" },
};
const FORMAT = process.env.FORMAT || "play", FMT = FORMATS[FORMAT];
if (!FMT) { console.error("FORMAT is play or appstore"); process.exit(2); }
const CLIPS = path.join(OUT, FORMAT === "play" ? "clips" : "clips-" + FORMAT);
const work = (name, ext) => path.join(OUT, FORMAT === "play" ? name + ext : `${name}-${FORMAT}${ext}`);   // frames, timeline, sound
const FPS = 30;
const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

// A player some way into the game, as in store-shots.mjs: every place open, fish in the journal, no first-time tips
const SAVE = {
  v: 1, cuts: SEEN, input: "motion", assist: true, artStyle: "painted", reelSide: "right", place: "loon", quality: "high", casts: 140, caught: 61, longest: 52,
  journal: {
    pumpkinseed: { n: 9, kg: 0.21, cm: 17 }, perch: { n: 14, kg: 0.48, cm: 31 }, rockbass: { n: 6, kg: 0.35, cm: 22 },
    smallmouth: { n: 8, kg: 1.9, cm: 46 }, largemouth: { n: 5, kg: 2.2, cm: 44 }, walleye: { n: 7, kg: 2.6, cm: 58 }, pike: { n: 3, kg: 4.1, cm: 79 },
  },
  places: {
    loon: { open: 1, d: 9.4, kg: 4.1, id: "pike", n: 52, lg: 1, g: 63 }, stumps: { open: 1, d: 0, kg: 2.4, id: "crappie", n: 6, lg: 0, g: 0 },
    river: { open: 1, d: 0, kg: 1.8, id: "brooktrout", n: 2, lg: 0, g: 0 }, sea: { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0, g: 0 },
  },
  seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1, "river.swing": 1, "at.stumps": 1, "at.river": 1, "at.sea": 1, "opened.stumps": 1, "opened.river": 1, "opened.sea": 1 },
};

/* ================= 1. film ================= */

// In the page, before the game: the tools the clips use
function pageTools() {
  // A synthetic event takes its timeStamp from the real clock, but the page runs on the fake one. The game times the
  // phone's motion samples and the thumb's lift by timeStamp, and a frame of the big phone takes seconds of real time, so
  // the samples of a whip fell outside the 450 ms the game looks back. Here a synthetic event reads the page clock when
  // it is first asked, which is while it is dispatched
  const stamps = new WeakMap(), realStamp = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp").get;
  Object.defineProperty(Event.prototype, "timeStamp", { configurable: true, get() {
    if (this.isTrusted) return realStamp.call(this);
    if (!stamps.has(this)) stamps.set(this, performance.now());
    return stamps.get(this);
  } });
  // CSS animations and transitions follow the page clock (the fake one while filming): each is paused when first seen,
  // and its time is set from the clock before every frame
  const born = new Map();
  window.__syncAnims = () => {
    const now = performance.now();
    for (const a of document.getAnimations()) { if (!born.has(a)) { born.set(a, now); a.pause(); } a.currentTime = now - born.get(a); }
  };
  // every sound the game asks for, with the page clock (s)
  window.__sounds = [];
  window.__hookSound = () => {
    const S = FISH.Sound;
    for (const k of ["sfx", "setSwish", "setSpool", "setReel", "setDrag", "setTension"]) {
      const f = S[k];
      S[k] = function (...a) { window.__sounds.push([performance.now() / 1000, k, ...a]); return f.apply(this, a); };
    }
  };
  // a finger: each pointer keeps the element it pressed, like a real touch
  const held = new Map();
  const fire = (type, x, y, id) => {
    const el = held.get(id) || document.elementFromPoint(x, y) || document.body;
    if (type === "pointerdown") held.set(id, el);
    if (type === "pointerup") held.delete(id);
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
  };
  window.__press = (x, y, id = 1) => fire("pointerdown", x, y, id);
  window.__move = (x, y, id = 1) => fire("pointermove", x, y, id);
  window.__lift = (x, y, id = 1) => fire("pointerup", x, y, id);
  // G.sim becomes a stand-in with the shape of LakeSim's state (as in store-shots.mjs); patch is merged in, patch.fish
  // into the fish. events go to the game in its next frame. fresh: a new stand-in
  window.__stage = (patch = {}, events = [], fresh = false) => {
    const G = FISH.G;
    if (fresh || !G.sim || !G.sim.fake) {
      G.lastEvent = {}; G.walk = false; G.hold = null; G.big = null;
      G.sim = { fake: true, events: [], step() {}, state: {
        phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.45, slip: 0, dragN: 18, breakN: 45, lineOut: 22, slack: false, bend: 0.4, spoolFrac: 0.2,
        fish: null,
      } };
      G.bail = "closed";
      if (G.phase !== "reel") FISH.enterReel();
    }
    const s = G.sim.state, { fish, ...rest } = patch;
    Object.assign(s, rest);
    if (fish === null) s.fish = null; else if (fish) s.fish = { ...(s.fish || {}), ...fish };
    G.sim.events.push(...events);
  };
}

async function phone({ place = "loon", input = "motion", dpr = FMT.dpr } = {}) {
  const browser = await chromium.launch({ args: GL });
  const ctx = await browser.newContext({ viewport: { width: FMT.phone[0], height: FMT.phone[1] }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  await page.addInitScript((save) => { localStorage.clear(); localStorage.setItem("fish.v1", JSON.stringify(save)); }, { ...SAVE, place, input });
  await page.addInitScript(installPhone);
  await page.addInitScript(pageTools);
  await page.clock.install();
  await page.goto(GAME);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  await page.evaluate(async () => {
    document.documentElement.dataset.build = "store";
    window.__hookSound();
    // today's goal is done already, so no goal toast covers a scene
    const g = await import("/fish/js/goals.js"), d = g.dayOf(), dg = g.dailyGoal(d, FISH.save);
    FISH.save.today = { d, k: dg.k, n: dg.n, done: 1 };
  });
  // A capture from a CDP session of our own puts back that session's screen, and it had none: the page fell to a pixel
  // ratio of 1 after the first frame, and the game drew the lake at 1x. The same screen here keeps the ratio
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: FMT.phone[0], height: FMT.phone[1], deviceScaleFactor: dpr, mobile: true, screenWidth: FMT.phone[0], screenHeight: FMT.phone[1] });
  return { browser, page, cdp, errors, k: 0, dpr };
}

// Stop the page's clock 2 s ahead of its time. In the big phone a frame of software WebGL can take longer than that, so
// the page's time can pass the mark before the pause comes. The clock stops all the same, and the second ask works
async function pauseSoon(page) {
  for (let i = 0; ; i++) {
    try { return await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000); }
    catch (e) { if (i > 1 || !/fast-forward to the past/.test(e.message)) throw e; }
  }
}

// free fishing at an hour, with no rising rings (their toasts would cover a scene); then the clock stops, and a second of
// the game's time runs unfilmed, so the lake settles (it moves at most 50 ms a frame, and slow frames are few)
async function startFishing(cam, hour) {
  const { page } = cam;
  await page.click("#freeBtn");
  await page.waitForFunction(() => FISH.G.phase === "cast", null, { timeout: 60000 });
  // the hour goes a hair before the next 10 minutes of the game's clock: the clock on the screen is drawn again only when
  // the hour passes one, and it still shows the hour the place opened at
  const h = Math.ceil(hour * 6) / 6 - 1e-4;
  await page.evaluate((h) => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); FISH.G.hour = h; FISH.world.setHour(h); }, h);
  await sleep(2500);
  await pauseSoon(page);
  for (let i = 0; i < 30; i++) await page.clock.runFor(33);
}

// film a clip: script(c) calls c.shoot(n, each) to film n frames (each(i) runs before frame i), and c.mark(name) to note
// the clip time of the next frame. meta.json keeps the frames, the marks, the sounds (clip time, method, arguments) and
// the fingers (clip time, x, y in CSS px of the phone)
async function record(cam, name, script) {
  const dir = path.join(CLIPS, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let frame = 0;
  const marks = {}, fingers = [];
  const t0 = await cam.page.evaluate(() => { window.__sounds.length = 0; return performance.now() / 1000; });
  const c = {
    page: cam.page, marks,
    mark: (k) => { marks[k] = frame / FPS; },
    finger: (x, y) => fingers.push([+(frame / FPS).toFixed(4), Math.round(x), Math.round(y)]),
    async shoot(n = 1, each) {
      for (let i = 0; i < n; i++) {
        if (each) await each(i);
        const ms = Math.round((cam.k + 1) * 1000 / FPS) - Math.round(cam.k * 1000 / FPS);
        cam.k++;
        await cam.page.clock.runFor(ms);
        await cam.page.evaluate(() => window.__syncAnims());
        const r = await cam.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, clip: { x: 0, y: 0, width: FMT.phone[0], height: FMT.phone[1], scale: 1 } });
        fs.writeFileSync(path.join(dir, String(frame++).padStart(4, "0") + ".jpg"), Buffer.from(r.data, "base64"));
      }
    },
  };
  const t = Date.now();
  await script(c);
  const sounds = (await cam.page.evaluate(() => window.__sounds.slice())).map(([ts, ...rest]) => [+(ts - t0 - 1 / FPS).toFixed(4), ...rest]);
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ frames: frame, marks, sounds, fingers }));
  console.log(`  ${name}: ${frame} frames in ${((Date.now() - t) / 1000).toFixed(0)} s, marks ${JSON.stringify(marks)}`);
}

// A motion cast, as a player makes it: the thumb holds the line on the reel, the phone tips back over 0.42 s and holds,
// then whips forward over 0.17 s, and the thumb lifts at 70 degrees (11 o'clock). Then the lure flies and lands
async function motionCast(c, { lead = 15, after = 24, maxFlight = 150 } = {}) {
  const { page } = c;
  await page.evaluate(() => __phone.pose(88));
  await c.shoot(lead);
  const p = await page.evaluate(() => { const r = document.querySelector("#reelBox").getBoundingClientRect(); return { x: r.left + r.width * 0.2, y: r.top + r.height * 0.25 }; });
  await page.evaluate((p) => __press(p.x, p.y, 1), p);
  c.mark("thumb");
  await c.shoot(6);
  const TB = 0.42, HOLD = 0.25, WHIP = 0.17;
  c.mark("back");
  let t = 0, lifted = false;
  while (t < TB + HOLD + WHIP + 0.05) {
    const th = t < TB ? 88 + 42 * (t / TB) : t < TB + HOLD ? 130 : 130 - 110 * ease((t - TB - HOLD) / WHIP);
    if (c.marks.whip == null && t >= TB + HOLD) c.mark("whip");
    const lift = !lifted && th <= 70;
    await page.evaluate(({ th, lift, p }) => { __phone.pose(th); if (lift) __lift(p.x, p.y, 1); }, { th, lift, p });
    if (lift) { lifted = true; c.mark("release"); }
    await c.shoot(1);
    t += 1 / FPS;
  }
  await page.evaluate(() => __phone.pose(60));
  for (let n = 0; n < maxFlight && (await page.evaluate(() => FISH.G.step === "flight")); n++) await c.shoot(1);
  c.mark("land");
  await c.shoot(after);
  const cast = await page.evaluate(() => FISH.G.cast && FISH.G.cast.verdict);
  if (cast !== "sweet") console.log(`  (the cast was "${cast}", not "sweet"; the last release: ${JSON.stringify(await page.evaluate(() => FISH.G.lastRelease || null))})`);
}

// Loon Lake at golden hour, motion play: the cast, the strike, the fight and the trophy, one after the other
async function filmLoon() {
  const cam = await phone({ place: "loon" });
  const { page } = cam;
  try {
    await startFishing(cam, 19.3);
    const eye = await page.evaluate(() => FISH.place.stand.eye);
    const L = { x: eye.x + 0.3, y: -0.15, z: eye.z - 7, speed: 0 };
    if (want("cast")) await record(cam, "cast", (c) => motionCast(c));
    if (want("strike") || want("fight") || want("trophy")) await record(cam, "strike", async (c) => {
      // the shadow of a big bass follows the lure in, taps it twice, and takes it; the phone snaps up: fish on
      await page.evaluate(() => { const r = document.querySelector("#report"); if (r) r.hidden = true; });
      const lure = (k) => ({ x: L.x, y: -0.12, z: L.z - 1.4 * (1 - k), speed: k < 1 ? 0.35 : 0 });
      const F = (k) => ({ id: "largemouth", x: L.x - 0.35 * (1 - k), y: -0.75 + 0.45 * k, z: L.z - 3.3 + 2.6 * k, heading: Math.PI, len: 0.9 });
      await page.evaluate(({ l, f }) => __stage({ phase: "retrieve", lure: l, lineOut: 8.9, tfrac: 0.05, bend: 0.05, fish: null, follower: f }, [], true), { l: lure(0), f: F(0) });
      await page.evaluate(() => __phone.pose(78));
      await c.shoot(42, (i) => { const k = ease(i / 41); return page.evaluate(({ l, f }) => { const s = FISH.G.sim.state; s.lure = l; s.follower = f; s.lineOut = 7.5 + 1.4 * (1 - (l.z - f.z) / 3.3); }, { l: lure(k), f: F(k) }); });
      c.mark("nibble");
      await page.evaluate(() => __stage({}, [{ type: "nibble", s: 0.5 }]));
      await c.shoot(11);
      await page.evaluate(() => __stage({}, [{ type: "nibble", s: 0.7 }]));
      await c.shoot(13);
      c.mark("strike");
      await page.evaluate(() => __stage({ phase: "strike", lineOut: 7.5 }, [{ type: "strike", s: 1 }]));
      await c.shoot(5);
      c.mark("set");
      await c.shoot(4, (i) => page.evaluate((th) => __phone.pose(th), 78 + 40 * ease((i + 1) / 4)));
      await page.evaluate(({ L }) => __stage({ phase: "fight", follower: null, tfrac: 0.62, bend: 0.65, lineOut: 7.5,
        fish: { id: "largemouth", kg: 3.9, cm: 55, x: L.x, y: -0.3, z: L.z - 0.3, heading: Math.PI / 2, len: 0.55, stamina: 0.9, move: "shake", jump: 0, near: 0.4, known: true } },
        [{ type: "hooked", id: "largemouth" }]), { L });
      c.mark("hooked");
      await c.shoot(36, (i) => page.evaluate(({ i, L }) => { const s = FISH.G.sim.state; s.fish.x = L.x + 0.6 * Math.sin(i / 5); s.fish.heading = Math.PI / 2 + 0.6 * Math.sin(i / 5); s.tfrac = 0.6 + 0.08 * Math.sin(i / 3); }, { i, L }));
    });
    if (want("fight") || want("trophy")) await record(cam, "fight", async (c) => {
      // a run to the right (the drag gives line), a leap, then the fish comes in as the rod pumps
      const x0 = L.x, z0 = L.z - 0.3;
      c.mark("run");
      await page.evaluate(() => __stage({}, [{ type: "run" }]));
      await c.shoot(36, (i) => {
        const k = ease(i / 35);
        return page.evaluate(({ k, i, x0, z0 }) => {
          const s = FISH.G.sim.state;
          Object.assign(s, { tfrac: 0.74 + 0.04 * Math.sin(i / 2), slip: 1.4 * (1 - k * 0.6), bend: 0.8, lineOut: 7.5 - 1.2 * k });
          Object.assign(s.fish, { x: x0 + 2 * k, z: z0 + 2 * k, y: -0.4, heading: 2.2, move: "run" });
          __phone.pose(108 + 4 * Math.sin(i / 4));
        }, { k, i, x0, z0 });
      });
      const jx = x0 + 2, jz = z0 + 2;   // the leap, about 6 m out
      c.mark("jump");
      await page.evaluate(({ jx, jz }) => __stage({ slip: 0 }, [{ type: "jump", size: 0.55, x: jx, z: jz }]), { jx, jz });
      await c.shoot(30, (i) => page.evaluate(({ k, jx, jz }) => {
        const s = FISH.G.sim.state;
        Object.assign(s.fish, { x: jx - 0.5 * k, z: jz + 0.25 * k, y: -0.05, jump: Math.min(0.99, k), move: "jump", heading: -0.9 });
        s.tfrac = 0.5;
      }, { k: (i + 1) / 30, jx, jz }));
      c.mark("splash");
      await page.evaluate(({ jx, jz }) => __stage({ fish: { y: -0.35, jump: 0, move: "swim" } }, [{ type: "splash", size: 0.6, x: jx - 0.5, z: jz + 0.25 }]), { jx, jz });
      c.mark("pump");
      await c.shoot(78, (i) => {
        const k = ease(i / 77);
        return page.evaluate(({ k, i, jx, jz }) => {
          const s = FISH.G.sim.state;
          Object.assign(s, { tfrac: 0.55 + 0.1 * Math.sin(i / 6), bend: 0.6, lineOut: 6.3 - 2.3 * k });
          Object.assign(s.fish, { x: jx - 0.5 - 1.6 * k, z: jz + 0.25 + 1.8 * k, y: -0.35 + 0.15 * k, heading: Math.PI - 0.5 * Math.sin(i / 8), move: "swim" });
          __phone.pose(100 + 18 * (0.5 - 0.5 * Math.cos(i / 6)));
        }, { k, i, jx, jz });
      });
    });
    if (want("trophy")) await record(cam, "trophy", async (c) => {
      // landed: the photo (the push-in, the flash, the gold sparks), then the card, its count-up and the TROPHY badge
      await page.evaluate(() => __phone.pose(88));
      c.mark("landed");
      await page.evaluate(() => __stage({ phase: "caught", catch: { id: "largemouth", name: "Largemouth Bass", kg: 3.9, cm: 55, junk: false }, fish: null }));
      await c.shoot(170);
      const card = await page.evaluate(() => [...document.querySelectorAll("#cbadges .badge")].map((b) => b.textContent).join(", "));
      console.log("  trophy card badges: " + card);
    });
    if (cam.errors.length) console.log("  page errors: " + cam.errors.join(" | "));
  } finally { await cam.browser.close(); }
}

// Touch play at Loon Lake: a finger turns the crank in a fight (the crank on the left, the rod pad on the right)
async function filmTouch() {
  const cam = await phone({ place: "loon", input: "touch" });
  const { page } = cam;
  try {
    await startFishing(cam, 19.4);
    const eye = await page.evaluate(() => FISH.place.stand.eye);
    await record(cam, "touch", async (c) => {
      await page.evaluate(({ eye }) => __stage({ phase: "fight", tfrac: 0.5, bend: 0.5, lineOut: 9, lure: { x: eye.x, y: -0.3, z: eye.z - 9, speed: 0 },
        fish: { id: "smallmouth", kg: 1.6, cm: 43, x: eye.x - 0.4, y: -0.4, z: eye.z - 9, heading: Math.PI, len: 0.43, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true } }, [], true), { eye });
      await c.shoot(6);
      const box = await page.evaluate(() => { const r = document.querySelector("#crankBox").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) * 0.3 }; });
      let a = -Math.PI / 2;
      const at = () => ({ x: box.x + box.r * Math.cos(a), y: box.y + box.r * Math.sin(a) });
      await page.evaluate(({ x, y }) => __press(x, y, 2), at());
      c.mark("crank");
      await c.shoot(84, (i) => {
        a += (2 * Math.PI * 1.3) / FPS;
        const p = at();
        c.finger(p.x, p.y);
        const k = i / 83;
        return page.evaluate(({ p, k, i, eye }) => {
          __move(p.x, p.y, 2);
          const s = FISH.G.sim.state;
          Object.assign(s, { tfrac: 0.5 + 0.06 * Math.sin(i / 4), lineOut: 9 - 3 * k });
          Object.assign(s.fish, { x: eye.x - 0.4 + 0.5 * Math.sin(i / 10), z: eye.z - 9 + 3 * k, heading: Math.PI + 0.4 * Math.sin(i / 10) });
        }, { p, k, i, eye });
      });
    });
    if (cam.errors.length) console.log("  page errors: " + cam.errors.join(" | "));
  } finally { await cam.browser.close(); }
}

// The four places, each with a motion cast out over its water, at an hour that shows it well
const PLACES = [["loon", "Loon Lake", 9], ["stumps", "Stump Bay", 19.4], ["river", "Cedar River", 7.2], ["sea", "Gull Rock", 17.4]];
async function filmPlace(id, hour) {
  const cam = await phone({ place: id, dpr: FMT.placeDpr });
  try {
    await startFishing(cam, hour);
    await record(cam, "place-" + id, (c) => motionCast(c, { lead: 4, after: 40 }));
    if (cam.errors.length) console.log("  page errors: " + cam.errors.join(" | "));
  } finally { await cam.browser.close(); }
}

// The end of the app preview: the title screen of the store build, as the game opens on it. It has a phone of its own,
// because the clock of a page stops once and does not run again
async function filmTitle() {
  const cam = await phone({ place: "loon" });
  try {
    await cam.page.evaluate(() => FISH.toTitle());
    await sleep(2000);
    await pauseSoon(cam.page);
    await record(cam, "title", (c) => c.shoot(96));
  } finally { await cam.browser.close(); }
}

const want = (name) => !ONLY || ONLY.includes(name);

async function film() {
  console.log("film:");
  const jobs = [];
  if (["cast", "strike", "fight", "trophy"].some(want)) jobs.push(filmLoon);
  if (FORMAT === "appstore" && want("title")) jobs.push(filmTitle);
  if (want("touch")) jobs.push(filmTouch);
  for (const [id, , hour] of PLACES) if (want("place-" + id)) jobs.push(() => filmPlace(id, hour));
  // two phones at a time: each one keeps a core busy with software WebGL
  const queue = jobs.slice();
  await Promise.all([0, 1].map(async () => { while (queue.length) await queue.shift()(); }));
}


/* ================= 2. cut ================= */

const W = 1920, H = 1080;
const CLIP_NAMES = ["cast", "strike", "fight", "trophy", "touch", ...PLACES.map(([id]) => "place-" + id), ...(FORMAT === "appstore" ? ["title"] : [])];
const readMeta = (n) => JSON.parse(fs.readFileSync(path.join(CLIPS, n, "meta.json"), "utf8"));
const sfxAt = (meta, name) => { const s = meta.sounds.find((x) => x[1] === "sfx" && x[2] === name); return s ? s[0] : null; };

// When each scene starts (s). The scenes follow the clips: the cast ends soon after the lure lands, the strike and the
// fight run whole, and the trophy holds until the card has counted up
function timeline(M) {
  const len = (n) => M[n].frames / FPS;
  const S = { cast: 0 };
  S.strike = Math.min(len("cast"), M.cast.marks.land + 0.5);
  S.fight = S.strike + len("strike");
  S.trophy = S.fight + len("fight");
  S.places = S.trophy + Math.min(len("trophy"), 5.2);
  S.touch = S.places + 5.4;
  S.end = S.touch + 3;
  S.total = S.end + 3.4;
  return S;
}

// The app preview: one shot after another, full screen, each place for placeLen s, then the title screen. Apple takes
// 15 to 30 s. A place's shot ends just after its lure lands: the camera is back on the water, and no prompt is up yet
const PLACE_LEAD = 1.25;
const placeFrom = (m) => Math.max(0, m.marks.land - PLACE_LEAD);
function timelineTall(M) {
  const len = (n) => M[n].frames / FPS;
  const S = { cast: 0, placeLen: 1.35 };
  S.strike = Math.min(len("cast"), M.cast.marks.land + 0.4);
  S.fight = S.strike + len("strike");
  S.trophy = S.fight + len("fight");
  S.places = S.trophy + Math.min(len("trophy"), 4.6);
  S.touch = S.places + 4 * S.placeLen;
  S.title = S.touch + 2.4;
  S.total = Math.min(29.9, S.title + 2.9);
  return S;
}

// The montage plays each place's cast with its flight sped up 2x, so its phone spends the time on the place, not on the
// sky: the clip time for u s after the phone came up (marks: the clip's marks), and back again for the sounds
function montageT(m, u) {
  const c0 = Math.max(0, m.back - 0.45), a = m.release + 0.25 - c0, l = m.land - 0.2;
  if (u < a) return c0 + u;
  const fast = c0 + a + 2 * (u - a);
  return fast < l ? fast : l + (u - (a + (l - c0 - a) / 2));
}
function montageU(m, ct) {
  const c0 = Math.max(0, m.back - 0.45), a = m.release + 0.25 - c0, l = m.land - 0.2;
  if (ct < c0) return null;
  if (ct < c0 + a) return ct - c0;
  return ct < l ? a + (ct - c0 - a) / 2 : a + (l - c0 - a) / 2 + (ct - l);
}

// the fonts, the titles, the labels and the finger, shared by both cuts
const CAP_CSS = `
@font-face { font-family: "Alfa Slab One"; font-weight: 400; src: url("/fonts/alfa-slab-one-latin.woff2") format("woff2"); }
@font-face { font-family: "Nunito"; font-weight: 200 1000; src: url("/fonts/nunito-latin.woff2") format("woff2"); }
#stage { position: absolute; inset: 0; overflow: hidden; }
.layer { position: absolute; left: 0; top: 0; }
.cap { position: absolute; left: 0; top: 0; white-space: nowrap; text-align: center; }
.big { font-family: "Alfa Slab One", Georgia, serif; font-weight: 400; color: ${C.cream}; line-height: 1; letter-spacing: 0.01em; }
.sub { font-family: "Nunito", sans-serif; font-weight: 900; color: ${C.ink}; text-shadow: 0 3px 14px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(0, 0, 0, 0.5); }
.label, .pill { position: absolute; left: 0; top: 0; padding: 8px 26px 10px; border-radius: 999px; background: rgba(9, 34, 41, 0.9); border: 2px solid rgba(232, 182, 74, 0.8);
  font-family: "Nunito", sans-serif; font-weight: 900; font-size: 34px; color: ${C.cream}; white-space: nowrap; }
.finger { position: absolute; left: 0; top: 0; width: 66px; height: 66px; margin: -33px 0 0 -33px; border-radius: 50%; box-sizing: border-box;
  border: 5px solid rgba(255, 255, 255, 0.95); background: rgba(255, 255, 255, 0.3); box-shadow: 0 0 24px rgba(255, 255, 255, 0.65); }`;
const CUT_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>${CAP_CSS}
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${C.deep}; }
.panel { position: absolute; left: 0; top: 0; box-sizing: border-box; border: 9px solid #0a1d22; border-radius: 46px; overflow: hidden; background: #0a1d22;
  box-shadow: 0 30px 70px rgba(2, 14, 18, 0.55), 0 0 0 2px rgba(232, 182, 74, 0.45); transform-origin: 50% 82%; }
.panel img { display: block; width: 100%; height: 100%; }
#flash { position: absolute; inset: 0; background: #fffdf2; opacity: 0; }
</style></head><body><div id="stage"></div></body></html>`;
const TALL_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>${CAP_CSS}
html, body { margin: 0; width: ${FORMATS.appstore.W}px; height: ${FORMATS.appstore.H}px; overflow: hidden; background: #000; }
.full { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
</style></head><body><div id="stage"></div></body></html>`;

// The page side of the cut: builds the stage, and window.renderAt(t) draws the frame at t (s) of the video
function director({ W, H, FPS, S, M, PL, MONTAGE }) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
  const win = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const io = (k) => { k = clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  const out = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const back = (k) => { k = clamp(k, 0, 1); return 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2); };
  const rise = (k) => { k = clamp(k, 0, 1); return 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); };   // a little overshoot
  const mk = (n, k) => M[n].marks[k];
  const len = (n) => M[n].frames / FPS;
  const stage = document.getElementById("stage");
  const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; stage.appendChild(e); return e; };
  // the title's slab shadow of the store art, for a size in px
  const slab = (px) => `0 ${0.04 * px}px 0 #e0453a, 0 ${0.08 * px}px 0 #7a1c14, 0 ${0.13 * px}px ${0.25 * px}px rgba(0, 0, 0, 0.45)`;

  // the painted water drifts slowly, and glints twinkle on it
  const bg = make("img", "layer");
  bg.src = "/art/water.png";
  const GL = Array.from({ length: 20 }, (_, i) => ({ x: (i * 397 + 140) % W, y: 70 + ((i * 263) % (H - 140)), s: 8 + (i % 4) * 4, ph: i * 1.37 }));
  const glints = make("div", "layer", `<svg width="${W}" height="${H}">${GL.map(() => `<path d="M0 -1 Q 0.18 -0.18 1 0 Q 0.18 0.18 0 1 Q -0.18 0.18 -1 0 Q -0.18 -0.18 0 -1 Z" fill="#fff2c4"/>`).join("")}</svg>`);
  const glintEls = [...glints.querySelectorAll("path")];
  // the end card: rings spread from the bobber
  const rings = make("div", "layer", `<svg width="${W}" height="${H}">${[0, 1, 2].map(() => `<ellipse fill="none" stroke="#fff6dc" stroke-linecap="round"/>`).join("")}</svg>`);
  const ringEls = [...rings.querySelectorAll("ellipse")];
  const bob = make("img", "layer");
  bob.src = "/art/bobber.png";
  // the phones, the labels under them, a finger, sparks, the camera flash
  const panels = Array.from({ length: 4 }, () => { const el = make("div", "panel"), img = document.createElement("img"); el.appendChild(img); return { el, img, src: "" }; });
  const labels = Array.from({ length: 4 }, () => make("div", "label"));
  const finger = make("div", "finger");
  const fx = make("canvas", "layer");
  fx.width = W; fx.height = H;
  const g = fx.getContext("2d");
  const flash = make("div", null);
  flash.id = "flash";

  // the titles: x, y is the middle of the text; each comes in at a and goes at b
  const caps = [];
  const cap = (text, cls, px, x, y, a, b, { color, tilt = 0 } = {}) => {
    const e = make("div", "cap " + cls, text);
    e.style.fontSize = px + "px";
    if (cls === "big") e.style.textShadow = slab(px);
    if (color) e.style.color = color;
    caps.push({ e, x, y, a, b, tilt, big: cls === "big" });
  };
  const A = { cx: 600, cy: 540, h: 880 }, B = { cx: 1320, cy: 540, h: 880 }, MID = { cx: 960, cy: 540, h: 880 };
  const shutter = S.trophy + (M.trophy.shutter != null ? M.trophy.shutter : 1.2);
  const gone = (b) => b - 0.5;   // a title goes before the phones move to the next scene
  cap("REEL IT IN", "big", 46, 218, 62, 0.5, gone(S.places));   // the titles over the places take the top
  cap("Your phone", "big", 108, 1370, 410, S.cast + 0.45, gone(S.strike));
  cap("is the rod.", "big", 108, 1370, 530, S.cast + 0.62, gone(S.strike));
  cap("Tip it back.", "sub", 56, 1370, 690, S.cast + mk("cast", "back"), gone(S.strike));
  cap("Whip it forward.", "sub", 56, 1370, 766, S.cast + mk("cast", "whip"), gone(S.strike));
  cap("Wait for the bite.", "big", 80, 600, 430, S.strike + 0.35, gone(S.fight));
  cap("Snap it up!", "big", 124, 600, 600, S.strike + mk("strike", "strike"), gone(S.fight), { tilt: -3 });
  cap("Fight every run.", "big", 92, 1370, 430, S.fight + 0.35, gone(S.trophy));
  cap("Raise the rod.", "sub", 56, 1370, 590, S.fight + 0.9, gone(S.trophy));
  cap("Reel as you lower it.", "sub", 56, 1370, 666, S.fight + 1.2, gone(S.trophy));
  cap("Land a", "big", 108, 370, 450, shutter + 0.35, gone(S.places));
  cap("trophy.", "big", 108, 370, 572, shutter + 0.5, gone(S.places));
  cap("Fish four places.", "big", 80, 960, 102, S.places + 1.05, gone(S.touch));
  cap("Play with motion or touch.", "big", 72, 960, 100, S.touch + 0.75, S.end - 0.6);
  cap("REEL", "big", 196, 1380, 392, S.end + 0.5, 1e9);
  cap("IT IN", "big", 196, 1380, 588, S.end + 0.66, 1e9);
  cap("Your phone is the rod and the reel.", "sub", 48, 1380, 768, S.end + 1.05, 1e9);
  cap("No ads · No accounts · Plays offline", "sub", 36, 1380, 842, S.end + 1.35, 1e9, { color: "#e8b64a" });

  // the phone in the cast leans with the real one: back as it tips back, forward with the whip, then upright with a wobble
  const castRot = (ct) => {
    const b0 = mk("cast", "back"), w0 = mk("cast", "whip");
    if (ct < b0) return 0;
    if (ct < w0) return -0.3 * 42 * Math.min(1, (ct - b0) / 0.42);
    const k = (ct - w0) / 0.17;
    if (k < 1) return -0.3 * (42 - 110 * (0.5 - 0.5 * Math.cos(Math.PI * k)));
    const u = ct - w0 - 0.17;
    return 0.3 * 68 * Math.exp(-5 * u) * Math.cos(9 * u);
  };
  const montageT = new Function("return " + MONTAGE)();
  const mix = (L1, L2, k) => ({ cx: lerp(L1.cx, L2.cx, k), cy: lerp(L1.cy, L2.cy, k), h: lerp(L1.h, L2.h, k) });
  const tr = (b) => io(win(t0, b - 0.25, b + 0.25));
  let t0 = 0;
  // where the one phone of the first four scenes is: it moves across between scenes
  const KEYS = [[S.strike, A, B], [S.fight, B, A], [S.trophy, A, MID]];
  const single = () => { let L = A; for (const [b, L1, L2] of KEYS) if (t0 > b - 0.25) L = mix(L1, L2, tr(b)); return L; };
  const clipT = (n, ct) => clamp(ct, 0, len(n) - 1 / FPS);

  function panelsAt(t) {
    t0 = t;
    const P = [];
    if (t < S.places + 0.4) {
      const L = single();
      if (t < S.strike) {
        const ct = t - S.cast;
        P.push({ clip: "cast", ct, ...L, cy: L.cy + (1 - back(win(t, 0.05, 0.6))) * 1000, rot: castRot(ct) });
      } else if (t < S.fight) {
        // the strike shakes the phone; the hook set snaps it up
        const ct = t - S.strike, ks = ct - mk("strike", "strike"), kj = ct - mk("strike", "set");
        const dx = ks > 0 && ks < 0.35 ? 14 * Math.sin(ks * 95) * (1 - ks / 0.35) : 0, jj = kj > 0 && kj < 0.4 ? Math.sin(Math.PI * kj / 0.4) : 0;
        P.push({ clip: "strike", ct, ...L, cx: L.cx + dx, cy: L.cy - 46 * jj, rot: -4 * jj });
      } else if (t < S.trophy) {
        // the leap punches in a little
        const ct = t - S.fight, kz = ct - mk("fight", "jump");
        P.push({ clip: "fight", ct, ...L, s: 1 + (kz > 0 && kz < 0.6 ? 0.05 * Math.sin(Math.PI * kz / 0.6) : 0) });
      } else {
        // the trophy, then it flies up and out for the places
        const ct = t - S.trophy, k = io(win(t, S.places - 0.3, S.places + 0.35));
        P.push({ clip: "trophy", ct, ...L, cy: L.cy - 1400 * k, s: 1 - 0.12 * k });
      }
    }
    if (t >= S.places - 0.2 && t < S.touch + 0.3) {
      // four places, one phone each, coming up one after the other; each casts as it lands
      const gone = io(win(t, S.touch - 0.25, S.touch + 0.25));
      PL.forEach(([id, name], i) => {
        const at = S.places - 0.15 + i * 0.22, n = "place-" + id;
        const ct = montageT(M[n].marks, Math.max(0, t - at));
        P.push({ clip: n, ct, cx: 960 + (i - 1.5) * 430, cy: 540 + (1 - rise(win(t, at, at + 0.55))) * 800 + 900 * gone, h: 640, s: 1 - 0.1 * gone,
          label: name, lop: win(t, at + 0.45, at + 0.75) * (1 - gone) });
      });
    }
    if (t >= S.touch - 0.2 && t < S.end + 0.1) {
      // motion and touch side by side: the fight's pumping rod, and a finger on the crank
      const end = io(win(t, S.end - 0.45, S.end + 0.05));
      [["fight", mk("fight", "pump") + 0.6, 700, "Motion"], ["touch", mk("touch", "crank") - 0.15, 1220, "Touch"]].forEach(([n, from, cx, label], i) => {
        const at = S.touch - 0.1 + i * 0.18;
        P.push({ clip: n, ct: from + (t - at), cx, cy: 556 + (1 - rise(win(t, at, at + 0.55))) * 800 + 900 * end, h: 720, s: 1 - 0.1 * end, op: 1,
          label, lop: win(t, at + 0.4, at + 0.7) * (1 - end), finger: n === "touch" });
      });
    }
    return P;
  }

  window.renderAt = async (t) => {
    // the water and its glints
    bg.style.transform = `translate(${-96 + 30 * Math.sin(t * 0.21)}px, ${-54 + 16 * Math.sin(t * 0.17 + 1)}px)`;
    GL.forEach((q, i) => {
      const k = Math.pow(0.5 + 0.5 * Math.sin(t * 1.9 + q.ph), 3);
      glintEls[i].setAttribute("transform", `translate(${q.x} ${q.y}) scale(${(q.s * (0.4 + 0.8 * k)).toFixed(2)})`);
      glintEls[i].setAttribute("opacity", (0.12 + 0.75 * k).toFixed(3));
    });
    // the phones and their labels
    const list = panelsAt(t), loads = [];
    let fingerAt = null;
    panels.forEach((p, i) => {
      const q = list[i], lab = labels[i];
      if (!q || (q.op != null && q.op <= 0.001) || q.cy > H + 700 || q.cy < -700) { p.el.style.display = "none"; lab.style.display = "none"; return; }
      const h = q.h, w = Math.round(((h - 18) * 9) / 16) + 18, s = q.s || 1;   // the picture inside the 9 px rim is 9:16
      p.el.style.display = "block";
      p.el.style.width = w + "px"; p.el.style.height = h + "px";
      p.el.style.opacity = q.op == null ? 1 : q.op;
      p.el.style.transform = `translate(${(q.cx - w / 2).toFixed(1)}px, ${(q.cy - h / 2).toFixed(1)}px) rotate(${(q.rot || 0).toFixed(2)}deg) scale(${s.toFixed(4)})`;
      const f = Math.round(clipT(q.clip, q.ct) * FPS), src = `/clips/${q.clip}/${String(f).padStart(4, "0")}.jpg`;
      if (p.src !== src) { p.src = src; p.img.src = src; loads.push(p.img.decode().catch(() => {})); }
      if (q.label && q.lop > 0) {
        lab.style.display = "block"; lab.textContent = q.label;
        lab.style.opacity = q.lop;
        lab.style.transform = `translate(-50%, 0) translate(${q.cx}px, ${(q.cy + (h * s) / 2 + 22 + 14 * (1 - q.lop)).toFixed(1)}px)`;
      } else lab.style.display = "none";
      if (q.finger) {
        // the finger as filmed, in the 360 x 640 phone, drawn on the panel
        const ct = clipT(q.clip, q.ct), F = M[q.clip].fingers;
        let best = null;
        for (const e of F) if (e[0] <= ct + 1e-6) best = e;
        if (best) { const k = (h - 18) / 640; fingerAt = { x: q.cx - w / 2 + 9 + best[1] * k, y: q.cy - h / 2 + 9 + best[2] * k, op: q.op == null ? 1 : q.op }; }
      }
    });
    finger.style.display = fingerAt ? "block" : "none";
    if (fingerAt) { finger.style.transform = `translate(${fingerAt.x.toFixed(1)}px, ${fingerAt.y.toFixed(1)}px)`; finger.style.opacity = fingerAt.op; }
    // the titles
    for (const c of caps) {
      const kin = win(t, c.a, c.a + 0.32), kout = win(t, c.b, c.b + 0.22);
      if (kin <= 0 || kout >= 1) { c.e.style.display = "none"; continue; }
      c.e.style.display = "block";
      const sc = c.big ? lerp(1.35, 1, back(kin)) : 1, dy = c.big ? 0 : 22 * (1 - out(kin));
      c.e.style.opacity = (Math.min(1, kin * 2.5) * (1 - kout)).toFixed(3);
      c.e.style.transform = `translate(-50%, -50%) translate(${c.x}px, ${(c.y + dy - 18 * kout).toFixed(1)}px) rotate(${c.tilt}deg) scale(${sc.toFixed(4)})`;
    }
    // the camera flash of the trophy, and its gold sparks
    flash.style.opacity = t >= shutter ? (0.6 * Math.pow(1 - win(t, shutter, shutter + 0.4), 2)).toFixed(3) : 0;
    g.clearRect(0, 0, W, H);
    const ks = (t - shutter) / 1.2;
    if (ks > 0 && ks < 1) {
      g.save();
      g.fillStyle = "#ffe7a3"; g.shadowColor = "#ffd27a"; g.shadowBlur = 14;
      for (let i = 0; i < 36; i++) {
        const a = i * 2.39996, d = (170 + 600 * out(ks)) * (0.75 + 0.5 * ((i * 37) % 11) / 11), sz = (20 - 9 * ks) * (0.6 + 0.4 * ((i * 13) % 7) / 7);
        const x = 960 + Math.cos(a) * d, y = 520 + Math.sin(a) * d * 0.8;
        g.globalAlpha = Math.pow(1 - ks, 1.4);
        g.beginPath(); g.moveTo(x, y - sz); g.quadraticCurveTo(x + sz * 0.18, y - sz * 0.18, x + sz, y); g.quadraticCurveTo(x + sz * 0.18, y + sz * 0.18, x, y + sz);
        g.quadraticCurveTo(x - sz * 0.18, y + sz * 0.18, x - sz, y); g.quadraticCurveTo(x - sz * 0.18, y - sz * 0.18, x, y - sz); g.fill();
      }
      g.restore();
    }
    // the end card: the bobber pops up, rings spread from it
    const ke = win(t, S.end - 0.1, S.end + 0.4);
    if (ke > 0) {
      const s = lerp(0.55, 1, back(ke)), bobY = 4 * Math.sin((t - S.end) * 2.6);
      bob.style.display = "block";
      bob.style.opacity = Math.min(1, ke * 3);
      bob.style.transformOrigin = "512px 512px";
      bob.style.transform = `translate(${600 - 512}px, ${560 - 512 + bobY}px) scale(${(0.664 * s).toFixed(4)})`;
      const wy = 560 + (470 + 190 * 0.42 - 512) * 0.664;
      ringEls.forEach((r, i) => {
        const u = t - (S.end + 0.35 + i * 0.8);
        if (u < 0) { r.setAttribute("opacity", 0); return; }
        const k = (u % 2.4) / 2.4, rx = 130 + 470 * out(k);
        r.setAttribute("cx", 600); r.setAttribute("cy", wy.toFixed(1)); r.setAttribute("rx", rx.toFixed(1)); r.setAttribute("ry", (rx * 0.235).toFixed(1));
        r.setAttribute("stroke-width", (7 - 4 * k).toFixed(2)); r.setAttribute("opacity", (0.55 * (1 - k)).toFixed(3));
      });
    } else { bob.style.display = "none"; ringEls.forEach((r) => r.setAttribute("opacity", 0)); }
    await Promise.all(loads);
  };
}

// The page side of the app preview: the game fills the picture, one shot after another. The titles of the cast and the
// places sit in the band of sky; in the strike, the fight and touch play the game's own prompts take that band, so their
// titles sit lower, over the far water. K: picture px per CSS px of the filmed phone. FROM: each place's first clip time
function directorTall({ W, H, FPS, S, M, PL, K, FROM }) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
  const win = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const out = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const back = (k) => { k = clamp(k, 0, 1); return 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2); };
  const mk = (n, k) => M[n].marks[k], len = (n) => M[n].frames / FPS;
  const stage = document.getElementById("stage");
  const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; stage.appendChild(e); return e; };
  const slab = (px) => `0 ${0.04 * px}px 0 #e0453a, 0 ${0.08 * px}px 0 #7a1c14, 0 ${0.13 * px}px ${0.25 * px}px rgba(0, 0, 0, 0.45)`;
  const pic = make("img", "full");
  let src = "";
  const finger = make("div", "finger");
  const caps = [];
  const cap = (text, cls, px, x, y, a, b, { color, tilt = 0 } = {}) => {
    const e = make("div", "cap " + cls, text);
    e.style.fontSize = px + "px";
    if (cls === "big") e.style.textShadow = slab(px);
    if (color) e.style.color = color;
    caps.push({ e, x, y, a, b, tilt, big: cls === "big" });
  };
  const mid = W / 2, band = Math.round(H * 0.3), low = Math.round(H * 0.41), shutter = S.trophy + (M.trophy.shutter != null ? M.trophy.shutter : 1.2);
  cap("Your phone", "big", 86, mid, band - 50, 0.35, S.strike - 0.3);
  cap("is the rod.", "big", 86, mid, band + 50, 0.5, S.strike - 0.3);
  cap("Wait for the bite.", "big", 70, mid, low, S.strike + 0.3, S.strike + mk("strike", "strike") - 0.1);
  cap("Snap it up!", "big", 100, mid, low, S.strike + mk("strike", "strike"), S.fight - 0.3, { tilt: -3 });
  cap("Fight every run.", "big", 76, mid, low, S.fight + 0.3, S.trophy - 0.3);
  cap("Land a trophy.", "big", 76, mid, Math.round(H * 0.105), shutter + 0.3, S.places - 0.25);
  cap("Fish four places.", "big", 70, mid, band - 60, S.places + 0.1, S.touch - 0.2);
  PL.forEach(([, name], i) => cap(name, "pill", 44, mid, band + 45, S.places + i * S.placeLen + 0.05, S.places + (i + 1) * S.placeLen - 0.12));
  cap("Or play with touch.", "big", 70, mid, low, S.touch + 0.2, S.title - 0.2);
  cap("No ads · No accounts · Plays offline", "sub", 38, mid, Math.round(H * 0.47), S.title + 0.5, 1e9, { color: "#e8b64a" });

  // the shot at t: the clip and its time
  function shotAt(t) {
    if (t < S.strike) return ["cast", t];
    if (t < S.fight) return ["strike", t - S.strike];
    if (t < S.trophy) return ["fight", t - S.fight];
    if (t < S.places) return ["trophy", t - S.trophy];
    if (t < S.touch) {
      // each place as its lure comes down on the water
      const i = Math.min(PL.length - 1, Math.floor((t - S.places) / S.placeLen)), n = "place-" + PL[i][0];
      return [n, FROM[n] + (t - S.places - i * S.placeLen)];
    }
    if (t < S.title) return ["touch", mk("touch", "crank") - 0.2 + (t - S.touch)];
    return ["title", t - S.title];
  }

  window.renderAt = async (t) => {
    const [n, t1] = shotAt(t), ct = clamp(t1, 0, len(n) - 1 / FPS), loads = [];
    const f = Math.round(ct * FPS), s = `/clips/${n}/${String(f).padStart(4, "0")}.jpg`;
    if (s !== src) { src = s; pic.src = s; loads.push(pic.decode().catch(() => {})); }
    // the finger on the crank in touch play, as filmed
    let fp = null;
    if (n === "touch") for (const e of M.touch.fingers) if (e[0] <= ct + 1e-6) fp = e;
    finger.style.display = fp ? "block" : "none";
    if (fp) finger.style.transform = `translate(${(fp[1] * K).toFixed(1)}px, ${(fp[2] * K).toFixed(1)}px)`;
    for (const c of caps) {
      const kin = win(t, c.a, c.a + 0.32), kout = win(t, c.b, c.b + 0.2);
      if (kin <= 0 || kout >= 1) { c.e.style.display = "none"; continue; }
      c.e.style.display = "block";
      const sc = c.big ? lerp(1.35, 1, back(kin)) : 1, dy = c.big ? 0 : 22 * (1 - out(kin));
      c.e.style.opacity = (Math.min(1, kin * 2.5) * (1 - kout)).toFixed(3);
      c.e.style.transform = `translate(-50%, -50%) translate(${c.x}px, ${(c.y + dy - 18 * kout).toFixed(1)}px) rotate(${c.tilt}deg) scale(${sc.toFixed(4)})`;
    }
    await Promise.all(loads);
  };
}

// the painted water of the store art, a little larger than the video so it can drift, and the end card's bobber
async function drawArt(page) {
  const dir = path.join(OUT, "art");
  fs.mkdirSync(dir, { recursive: true });
  const shot = async (body, w, h, file, alpha) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style></head><body>${body}</body></html>`);
    await page.waitForTimeout(150);
    fs.writeFileSync(path.join(dir, file), await page.screenshot({ type: "png", omitBackground: alpha, clip: { x: 0, y: 0, width: w, height: h } }));
  };
  await shot(svg(`${water()}<rect width="1024" height="1024" fill="#000" filter="url(#grain)"/>`, { w: 2112, h: 1188 }), 2112, 1188, "water.png", false);
  const b = { cx: 512, cy: 470, r: 190 }, [tx, ty] = stickTip(b.cx, b.cy, b.r);
  await shot(svg(`${ripples({ cx: b.cx, cy: b.cy + b.r * 0.42, rings: [[250, 58, 0.8, 9], [350, 90, 0.45, 7]] })}
    <path d="M ${tx} ${ty} C ${tx + 90} ${ty - 60}, ${tx + 200} ${ty - 120}, 1100 ${ty - 220}" stroke="${C.cream}" stroke-width="4" fill="none" opacity="0.6"/>
    ${bobber(b)}`), 1024, 1024, "bobber.png", true);
}

async function cut() {
  const M = Object.fromEntries(CLIP_NAMES.map((n) => [n, readMeta(n)]));
  M.trophy.shutter = sfxAt(M.trophy, "shutter");
  const tall = FORMAT === "appstore";
  const S = tall ? timelineTall(M) : timeline(M), frames = Math.round(S.total * FPS);
  console.log(`cut (${FORMAT}): ${frames} frames, scenes ` + Object.entries(S).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", "));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: FMT.W, height: FMT.H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("  page error: " + e.message));
  if (!tall) await drawArt(page);
  await page.setViewportSize({ width: FMT.W, height: FMT.H });
  const files = { "/clips/": CLIPS, "/art/": path.join(OUT, "art"), "/fonts/": path.join(ROOT, "public/fish/fonts") };
  await page.route("https://video.local/**", (r) => {
    const p = new globalThis.URL(r.request().url()).pathname;
    if (p === "/cut.html") return r.fulfill({ body: tall ? TALL_HTML : CUT_HTML, contentType: "text/html" });
    const k = Object.keys(files).find((d) => p.startsWith(d));
    return k ? r.fulfill({ path: path.join(files[k], decodeURIComponent(p.slice(k.length))) }) : r.fulfill({ status: 404, body: "" });
  });
  await page.goto("https://video.local/cut.html");
  await page.evaluate(() => document.fonts.ready);
  const slim = Object.fromEntries(Object.entries(M).map(([n, m]) => [n, { frames: m.frames, marks: m.marks, fingers: m.fingers, shutter: m.shutter }]));
  const PL = PLACES.map(([id, name]) => [id, name]);
  const FROM = Object.fromEntries(PLACES.map(([id]) => ["place-" + id, placeFrom(M["place-" + id])]));
  if (tall) await page.evaluate(directorTall, { W: FMT.W, H: FMT.H, FPS, S, M: slim, PL, K: FMT.W / FMT.phone[0], FROM });
  else await page.evaluate(director, { W, H, FPS, S, M: slim, PL, MONTAGE: montageT.toString() });
  await page.waitForFunction(() => [...document.images].every((i) => !i.src || i.complete));
  // STILLS=1.5,6.2 draws only those moments (s), to look at
  const stills = process.env.STILLS ? process.env.STILLS.split(",").map(Number) : null;
  const dir = stills ? path.join(OUT, "stills") : work("frames", "");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const times = stills || Array.from({ length: frames }, (_, f) => f / FPS);
  const t0 = Date.now();
  for (let i = 0; i < times.length; i++) {
    await page.evaluate((t) => window.renderAt(t), times[i]);
    const name = stills ? `t${times[i].toFixed(2)}.jpg` : String(i).padStart(4, "0") + ".jpg";
    fs.writeFileSync(path.join(dir, name), await page.screenshot({ type: "jpeg", quality: 94 }));
    if (!stills && i % 150 === 0) console.log(`  frame ${i} of ${frames} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  if (!stills) fs.writeFileSync(work("timeline", ".json"), JSON.stringify({ S, frames }));
  await browser.close();
}

/* ================= 3. sound ================= */

const SR = 48000;
const LOOPS = { setSwish: "swish", setSpool: "spool", setReel: "reel", setDrag: "drag", setTension: "tension" };

// In a page of the game: one sound rendered by audio.js (renderOffline), as two Float32 channels. A loop's curve comes
// as points [t, value], read with straight lines between them
async function renderSound(page, name, seconds, opts = {}) {
  const chans = await page.evaluate(async ({ name, seconds, opts, SR }) => {
    const { renderOffline } = await import("/fish/js/audio.js");
    const o = { ...opts, sampleRate: SR };
    if (o.points) {
      const P = o.points;
      o.curve = (t) => {
        if (t <= P[0][0]) return P[0][1];
        for (let i = 1; i < P.length; i++) if (t <= P[i][0]) { const [a, va] = P[i - 1], [b, vb] = P[i]; return va + ((vb - va) * (t - a)) / Math.max(1e-6, b - a); }
        return P[P.length - 1][1];
      };
      delete o.points;
    }
    const buf = await renderOffline(name, seconds, o);
    const enc = (a) => { const u = new Uint8Array(a.buffer.slice(0)); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    return [enc(buf.getChannelData(0)), enc(buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0))];
  }, { name, seconds, opts, SR });
  return chans.map((b) => { const u = Buffer.from(b, "base64"), ab = new ArrayBuffer(u.length); new Uint8Array(ab).set(u); return new Float32Array(ab); });
}

// add a rendered sound into the mix at `at` (s), with a gain and fades (s)
function addTo(mix, chans, at, gain = 1, fadeIn = 0, fadeOut = 0) {
  const start = Math.round(at * SR), n = chans[0].length, fi = fadeIn * SR, fo = fadeOut * SR;
  for (let i = 0; i < n; i++) {
    const j = start + i;
    if (j < 0 || j >= mix[0].length) continue;
    let k = gain;
    if (fi && i < fi) k *= i / fi;
    if (fo && i > n - fo) k *= (n - i) / fo;
    mix[0][j] += chans[0][i] * k;
    mix[1][j] += chans[1][i] * k;
  }
}

function writeWav(file, mix) {
  const n = mix[0].length, data = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { data.writeFloatLE(mix[0][i], i * 8); data.writeFloatLE(mix[1][i], i * 8 + 4); }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

async function sound() {
  const { S, frames } = JSON.parse(fs.readFileSync(work("timeline", ".json"), "utf8"));
  const M = Object.fromEntries(CLIP_NAMES.map((n) => [n, readMeta(n)]));
  const total = frames / FPS, mix = [new Float32Array(Math.ceil(total * SR)), new Float32Array(Math.ceil(total * SR))];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(new globalThis.URL("privacy.html", GAME).href);
  const tall = FORMAT === "appstore";
  // what each phone shows, in clip time from..to, starting at video time `at`; loops: whether its loops sound too
  const shows = tall ? [
    { clip: "cast", from: 0, to: S.strike, at: 0, gain: 1, loops: true },
    { clip: "strike", from: 0, to: S.fight - S.strike, at: S.strike, gain: 1, loops: true },
    { clip: "fight", from: 0, to: S.trophy - S.fight, at: S.fight, gain: 1, loops: true },
    { clip: "trophy", from: 0, to: S.places - S.trophy, at: S.trophy, gain: 1, loops: true },
    // one place after another, each as its lure comes down, as directorTall shows them. Softer: four whirs of the spool
    // in a row would be the loudest part of the mix, and the fight should be
    ...PLACES.map(([id], i) => { const n = "place-" + id, from = placeFrom(M[n]); return { clip: n, from, to: from + S.placeLen, at: S.places + i * S.placeLen, gain: 0.6, loops: true }; }),
    { clip: "touch", from: M.touch.marks.crank - 0.2, to: M.touch.marks.crank - 0.2 + (S.title - S.touch), at: S.touch, gain: 0.9, loops: true },
    { clip: "title", from: 0, to: total - S.title, at: S.title, gain: 1, loops: true },
  ] : [
    { clip: "cast", from: 0, to: S.strike, at: 0, gain: 1, loops: true },
    { clip: "strike", from: 0, to: S.fight - S.strike, at: S.strike, gain: 1, loops: true },
    { clip: "fight", from: 0, to: S.trophy - S.fight, at: S.fight, gain: 1, loops: true },
    { clip: "trophy", from: 0, to: S.places - S.trophy, at: S.trophy, gain: 1, loops: true },
    // four casts at once: only their one-shots, softer, at the times the montage shows them
    ...PLACES.map(([id], i) => { const n = "place-" + id, at = S.places - 0.15 + i * 0.22; return { clip: n, from: 0, to: 1e9, at, gain: 0.4, loops: false, warp: (ct) => montageU(M[n].marks, ct), until: S.touch - at }; }),
    { clip: "touch", from: M.touch.marks.crank - 0.15, to: M.touch.marks.crank - 0.15 + (S.end - S.touch), at: S.touch + 0.08, gain: 0.9, loops: true },
  ];
  let n = 0;
  for (const sh of shows) {
    const list = M[sh.clip].sounds.filter((e) => e[0] >= sh.from && e[0] < sh.to);
    for (const e of list) if (e[1] === "sfx") {
      const [ct, , name, v] = e, long = ["record", "newPlace", "derbyClose"].includes(name);
      const u = sh.warp ? sh.warp(ct) : ct - sh.from;
      if (u == null || u < 0 || (sh.until != null && u > sh.until)) continue;
      addTo(mix, await renderSound(page, name, long ? 4.5 : 3, { v, at: 0.25 }), sh.at + u - 0.25, sh.gain);
      n++;
    }
    if (!sh.loops) continue;
    // a loop sounds along the values the game sent it, from 0.3 s before the scene (the render needs a moment to settle)
    for (const [k, loop] of Object.entries(LOOPS)) {
      const pts = list.filter((e) => e[1] === k).map((e) => [e[0] - sh.from + 0.3, +e[2] || 0]);
      if (!pts.length || pts.every((p) => Math.abs(p[1]) < 1e-3)) continue;
      const dur = sh.to - sh.from + 0.3;
      addTo(mix, await renderSound(page, loop, dur + 0.4, { points: [[0, 0], [0.3, pts[0][1]], ...pts, [dur, pts[pts.length - 1][1]], [dur + 0.15, 0]] }), sh.at - 0.3, sh.gain, 0.3, 0.3);
      n++;
    }
  }
  // the lake under it all: Loon Lake at golden hour (a loon calls as the bite comes), each place as its phone comes up,
  // and Loon Lake again for the end, with a loon at the title
  const bed = async (place, hour, from, to, loonAt = null, gain = 0.9) =>
    addTo(mix, await renderSound(page, "ambience", to - from + 0.6, { place, hour, loonAt, seed: 11 }), from - 0.3, gain, 0.45, 0.45);
  if (tall) {
    // the app preview: each place for its own shot, then the title screen, which shows Loon Lake at its free-fishing
    // hour, and a loon calls
    await bed("loon", 19.3, 0, S.places + 0.2, S.strike + 0.6);
    for (let i = 0; i < PLACES.length; i++) { const [id, , hour] = PLACES[i], from = S.places + i * S.placeLen; await bed(id, hour, from, from + S.placeLen, null, 0.85); }
    await bed("loon", 19.4, S.touch - 0.2, S.title + 0.15, null, 0.65);
    const morning = await page.evaluate(async () => (await import("/fish/js/journey.js")).startHour("loon", "free"));
    await bed("loon", morning, S.title - 0.15, total, 1.1, 0.75);
  } else {
    await bed("loon", 19.3, 0, S.places + 0.4, S.strike + 0.6);
    for (let i = 0; i < PLACES.length; i++) {
      const [id, , hour] = PLACES[i], from = S.places - 0.15 + i * 0.22 + 0.25, to = i < PLACES.length - 1 ? from + 1.5 : S.touch + 0.4;
      await bed(id, hour, from, to, null, 0.85);
    }
    await bed("loon", 19.4, S.touch - 0.2, total, S.end + 1.3 - (S.touch - 0.2), 0.65);
    // the end card: a plop as the bobber comes up, and the title stamps
    addTo(mix, await renderSound(page, "plop", 3, { v: 0.8, at: 0.25 }), S.end + 0.12 - 0.25, 1);
    for (const at of [S.end + 0.5, S.end + 0.66]) addTo(mix, await renderSound(page, "stamp", 2, { at: 0.25 }), at - 0.25, 0.8);
  }
  await browser.close();
  let peak = 0;
  for (const ch of mix) for (const x of ch) peak = Math.max(peak, Math.abs(x));
  if (peak > 0.95) for (const ch of mix) for (let i = 0; i < ch.length; i++) ch[i] *= 0.95 / peak;
  writeWav(work("sound", ".wav"), mix);
  console.log(`sound: ${n} sounds and loops, peak ${peak.toFixed(2)}, ${total.toFixed(2)} s`);
}

/* ================= 4. mp4 ================= */

async function mp4() {
  const wav = work("sound", ".wav"), file = path.join(OUT, FMT.file);
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(work("frames", ""), "%04d.jpg")];
  let af = null;
  if (fs.existsSync(wav)) {
    // two passes of loudnorm: measure, then one gain for the whole mix, to -16 LUFS with peaks under -1.5 dBTP
    const m = spawnSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
    const j = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf("{")));
    af = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    console.log(`mp4: the mix measured ${j.input_i} LUFS, ${j.input_tp} dBTP`);
    args.push("-i", wav);
  }
  args.push("-c:v", "libx264", "-preset", "slow", "-crf", String(FMT.crf), "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", FMT.level, "-r", String(FPS), "-movflags", "+faststart");
  // Apple aims at 10 to 12 Mbps: crf 15 comes to about 10 for the app preview, and the peaks stop at the cap
  if (FMT.maxrate) args.push("-maxrate", FMT.maxrate, "-bufsize", parseInt(FMT.maxrate) * 2 + "M");
  if (af) args.push("-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", FMT.audio, "-shortest");
  args.push(file);
  execFileSync("ffmpeg", args, { stdio: "inherit" });
  console.log(`mp4: ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
}

if (STEPS.includes("film")) await film();
if (STEPS.includes("cut")) await cut();
if (STEPS.includes("sound") && !process.env.STILLS) await sound();
if (STEPS.includes("mp4") && !process.env.STILLS) await mp4();
