// The action card and the big fish, in the real page (the fish-feedback spec, "Action card in the corner", and the
// fish-fight spec, "Heavy fish look heavy"). A fight is staged with the game's QA hooks, as store-shots.mjs does:
// 1. a jump at 360x640 in motion play: the card is in the top right, at most 160 px wide, clear of the gauge and the HUD,
//    shows a moving lower-the-rod gesture with no visible prose. The gauge is at most 190 x 120 px.
// 2. the reel on the left at 412x915: the gauge is in the top right and the card in the top left.
// 3. Larger text at 360x640: the card is clear of the gauge and the HUD; the gauge is at most 220 x 140 px.
// 4. a 0.2 kg and a 5 kg fish 15 m out are drawn about 1.7x and 2.7x their length; 2 m from the rod, at their length.
// Serve public/ first, then: NODE_PATH=qa/browser/node_modules node qa/fish/cues.e2e.mjs   (FISH_URL sets the address)
// Exits with code 1 when something fails.
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { URL, installPhone, sleep, until, SEEN } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"];
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const hit = (a, b) => !!a && !!b && a.x < b.r - 1 && a.r > b.x + 1 && a.y < b.b - 1 && a.b > b.y + 1;

async function open({ W, H, reelSide = "right", large = false }) {
  const browser = await chromium.launch({ args: ARGS, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  const save = { v: 1, cuts: SEEN, input: "motion", assist: true, reelSide, place: "loon", casts: 140, caught: 61, longest: 30, seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1 } };
  await page.addInitScript(([save, large]) => { localStorage.clear(); localStorage.setItem("fish.v1", JSON.stringify(save)); if (large) localStorage.setItem("fish.text", "large"); }, [save, large]);
  await page.addInitScript(installPhone);
  await page.goto(URL);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  await sleep(400);
  await page.click("#freeBtn");
  await page.waitForFunction(() => FISH.G.phase === "cast", null, { timeout: 60000 });
  await page.evaluate(() => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); });
  return { browser, page, errors };
}
// a fight with a stand-in sim (as in store-shots.mjs); patch.fish merges into the fish. It returns the frame count
const put = (page, patch, events = []) => page.evaluate(([patch, events]) => {
  const G = FISH.G;
  if (!G.sim || !G.sim.fake) {
    G.lastEvent = {}; G.walk = false; G.hold = null; G.big = null;
    G.sim = { fake: true, events: [], step() {}, state: {
      phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.5, slip: 0, dragN: 18, breakN: 45, lineOut: 15, slack: false, bend: 0.4, spoolFrac: 0.2,
      fish: { id: "smallmouth", kg: 1.7, cm: 44, x: 0, y: -0.6, z: -15, heading: Math.PI / 2, len: 0.44, stamina: 0.7, move: "swim", jump: 0, near: 0.6, known: true },
    } };
    G.bail = "closed";
    if (G.phase !== "reel") FISH.enterReel();
  }
  const s = G.sim.state, { fish, ...rest } = patch;
  Object.assign(s, rest);
  if (fish) s.fish = { ...s.fish, ...fish };
  G.sim.events.push(...events);
  return G.frame;
}, [patch, events]);
// puts the fight in place, then waits for two game frames, so the prompt and the drawn fish show it. Under load one frame
// can take a second or more, so a fixed sleep is not enough
async function stage(page, patch, events) {
  const f = await put(page, patch, events);
  try { await until(page, (f) => FISH.G.frame >= f + 2, f); }
  catch (e) { throw new Error(`no 2 game frames in 60 s after the stage at frame ${f}: ${e.message}`); }
}
function look() {
  const box = (s) => { const e = document.querySelector(s); if (!e || e.closest("[hidden]") || !e.getClientRects().length || getComputedStyle(e).visibility === "hidden") return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const svg = document.querySelector("#prompt .p1 svg");
  const words = document.querySelector("#prompt .cue-words");
  return { card: box("#prompt .p1"), sub: box("#prompt .p2"), gauge: box("#gaugeBox"), hud: box("#hud"), text: words?.textContent || "",
    icon: document.querySelector("#prompt").dataset.icon, action: document.querySelector("#prompt").dataset.action,
    hiddenWords: !!words && getComputedStyle(words).clipPath === "inset(50%)",
    pose: svg ? [...svg.querySelectorAll("[transform]")].map(e => e.getAttribute("transform")) : [], W: innerWidth };
}
async function cardCheck(page, tag, { side, gaugeMax }) {
  const eye = await page.evaluate(() => FISH.place.stand.eye);
  await stage(page, { fish: { x: eye.x - 0.8, z: eye.z - 11, y: -0.4 } });
  await stage(page, { fish: { y: 0.9, jump: 0.8, move: "jump" } }, [{ type: "jump", size: 0.44, x: eye.x - 0.8, z: eye.z - 11 }]);
  const s = await page.evaluate(look);
  const c = s.card, g = s.gauge;
  const corner = c && (side === "right" ? s.W - c.r < 16 : c.x < 16) && c.y < 140;
  check(corner && c.w <= 160, `${tag}: the card is in the top ${side} (${c ? Math.round(c.x) + "-" + Math.round(c.r) + " x " + Math.round(c.y) + "-" + Math.round(c.b) : "none"}), ${c ? Math.round(c.w) : "-"} px wide`);
  check(!hit(c, g) && !hit(c, s.hud) && !hit(s.sub, g) && !hit(s.sub, s.hud), `${tag}: the card is clear of the gauge and the HUD`);
  check(!!g && (side === "right" ? g.x < s.W / 2 : g.r > s.W / 2) && g.w <= gaugeMax[0] + 0.5 && g.h <= gaugeMax[1] + 0.5, `${tag}: the gauge is on the other side, ${g ? Math.round(g.w) + " x " + Math.round(g.h) : "none"} px`);
  const moved = await until(page, (before) => {
    const svg = document.querySelector("#prompt .cue-art svg");
    return svg && JSON.stringify([...svg.querySelectorAll("[transform]")].map(e => e.getAttribute("transform"))) !== before;
  }, JSON.stringify(s.pose)).then(() => true, () => false);
  check(/lower/i.test(s.text) && s.icon === "low" && s.action === "low" && s.hiddenWords && moved,
    `${tag}: the lower-rod gesture moves and its instructions are visually hidden`);
}

{
  const { browser, page, errors } = await open({ W: 360, H: 640 });
  await cardCheck(page, "360x640", { side: "right", gaugeMax: [190, 120] });
  await page.evaluate(() => { FISH.G.hold = null; });
  await stage(page, { phase: "retrieve", follower: null, empty: false }, [{ type: "nibble", s: .6 }]);
  const nibble = await page.evaluate(look);
  check(nibble.action === "nibble" && nibble.hiddenWords && !!nibble.card,
    `a nibble shows the animated fish-and-wait cue without visible prose (action ${nibble.action}, headline ${nibble.text})`);
  // the big fish: a light and a heavy one 15 m out, then the heavy one 2 m from the rod
  const eye = await page.evaluate(() => FISH.place.stand.eye);
  for (const [id, kg, len, want] of [["pumpkinseed", 0.2, 0.17, 1.7], ["walleye", 5, 0.66, 2.7]]) {
    await stage(page, { fish: { id, kg, len, x: eye.x, z: eye.z - 15, y: -0.3, jump: 0, move: "swim", near: 1 } });
    const d = await page.evaluate(() => FISH.world.fishDrawn());
    check(d != null && Math.abs(d / len - want) < 0.1, `a ${kg} kg ${id} 15 m out is drawn ${d ? (d / len).toFixed(2) : "-"}x its length (about ${want}x)`);
  }
  await stage(page, { fish: { x: eye.x, z: eye.z - 2, y: -0.3 } });
  const d2 = await page.evaluate(() => FISH.world.fishDrawn());
  check(d2 != null && Math.abs(d2 / 0.66 - 1) < 0.03, `2 m from the rod it is drawn ${d2 ? (d2 / 0.66).toFixed(2) : "-"}x its length`);
  check(!errors.length, "360x640: no page errors" + (errors.length ? " (" + errors.slice(0, 3).join(" | ") + ")" : ""));
  await browser.close();
}
{
  const { browser, page, errors } = await open({ W: 412, H: 915, reelSide: "left" });
  await cardCheck(page, "412x915, reel on the left", { side: "left", gaugeMax: [190, 120] });
  check(!errors.length, "reel on the left: no page errors" + (errors.length ? " (" + errors.slice(0, 3).join(" | ") + ")" : ""));
  await browser.close();
}
{
  const { browser, page, errors } = await open({ W: 360, H: 640, large: true });
  await cardCheck(page, "360x640, Larger text", { side: "right", gaugeMax: [220, 140] });
  check(!errors.length, "Larger text: no page errors" + (errors.length ? " (" + errors.slice(0, 3).join(" | ") + ")" : ""));
  await browser.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
