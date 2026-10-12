// Speech is mocked before the game loads; events still travel through the real reel loop and Settings switches.
// Serve public/ first, then run: NODE_PATH=qa/browser/node_modules node qa/fish/voice-cues.e2e.mjs
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { URL, installPhone, SEEN, until } from "./lib.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"],
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
const fails = [];
const check = (ok, message) => {
  if (!ok) fails.push(message);
  console.log((ok ? "ok   " : "FAIL ") + message);
};
// A new screen ignores a second pointer tap for 300 ms, to prevent accidental double taps.
const tap = async (selector) => { await page.waitForTimeout(350); await page.click(selector); };
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/three.module.min.js", (route) => route.fulfill({
  path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript",
}));
await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ body: "", contentType: "text/css" }));
await page.addInitScript((save) => {
  localStorage.clear();
  localStorage.setItem("fish.v1", JSON.stringify(save));
  // Keep speaking=true until cancel() so a strike must interrupt the nibble rather than queue after it.
  const calls = window.__speechCalls = [];
  let speaking = false;
  const voices = [
    { name: "US Default", lang: "en-US", localService: true },
    { name: "Daniel", lang: "en-GB", localService: true },
  ];
  const synthesis = {
    pending: false,
    get speaking() { return speaking; },
    getVoices() { return voices; },
    speak(utterance) {
      calls.push({ kind: "speak", text: utterance.text, lang: utterance.lang,
        voice: utterance.voice?.name, rate: utterance.rate, pitch: utterance.pitch });
      speaking = true;
    },
    cancel() { calls.push({ kind: "cancel" }); speaking = false; },
  };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synthesis });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: class SpeechSynthesisUtterance { constructor(text) { this.text = text; } },
  });
}, { v: 1, cuts: SEEN, input: "motion", assist: true, reelSide: "right", place: "loon", casts: 30, caught: 12, seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1 } });
await page.addInitScript(installPhone);

try {
  await page.goto(URL);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  await tap("#setBtn");
  await page.waitForSelector("#settings:not([hidden])");
  check(await page.locator("#optVoice").isChecked(), "Voice hints defaults on when speech is available");
  await page.locator("#optVoice").uncheck();
  check(await page.evaluate(() => localStorage.getItem("fish.voiceHints") === "false"), "the Voice hints switch persists off");
  await tap("#settings [data-close]");
  await tap("#freeBtn");
  await until(page, () => FISH.G.phase === "cast", null, 30000).catch(async () => {
    const state = await page.evaluate(() => ({ phase: FISH.G.phase, screen: document.body.dataset.screen, errors: window.__speechCalls }));
    throw new Error(`game did not reach cast: ${JSON.stringify(state)}`);
  });
  await page.evaluate(() => {
    const G = FISH.G;
    G.lastEvent = {}; G.hold = null; G.bail = "closed";
    G.sim = { fake: true, events: [], step() {}, state: {
      phase: "retrieve", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45,
      lineOut: 20, slack: false, bend: 0.3, spoolFrac: 0.2,
      fish: { id: "smallmouth", kg: 1.7, cm: 44, x: 0, y: -0.6, z: -15, heading: 0, len: 0.44, stamina: 0.7, move: "swim", jump: 0, near: 0.6, known: true },
    } };
    FISH.enterReel();
  });

  const emit = async (type) => {
    await page.evaluate((type) => { FISH.G.sim.events.push({ type, s: 0.6 }); }, type);
    await until(page, (type) => !!FISH.G.lastEvent[type], type);
  };
  const spoken = () => page.evaluate(() => window.__speechCalls.filter((call) => call.kind === "speak").map((call) => call.text));
  const settings = async (change) => {
    await tap("#pauseBtn");
    await tap("#pSet");
    await page.waitForSelector("#settings:not([hidden])");
    await change();
    await tap("#settings [data-close]");
    await tap("#resumeBtn");
  };

  await emit("nibble");
  check((await spoken()).length === 0, "a nibble stays silent while Voice hints is off");

  await settings(async () => {
    await page.locator("#optVoice").check();
    await page.locator("#optSound").uncheck();
  });
  await emit("strike");
  check((await spoken()).length === 0, "a strike stays silent while Sound is off");

  await settings(async () => { await page.locator("#optSound").check(); });
  await emit("nibble");
  await until(page, () => window.__speechCalls.some((call) => call.text === "A nibble. Hold steady."));
  const nibbleCalls = await page.evaluate(() => window.__speechCalls.slice(-1));
  check(nibbleCalls[0]?.kind === "speak" && nibbleCalls[0].lang === "en-GB"
    && nibbleCalls[0].voice === "Daniel" && nibbleCalls[0].rate === 0.9 && nibbleCalls[0].pitch === 0.9,
  "a nibble selects the British voice and measured delivery");

  await emit("strike");
  await until(page, () => window.__speechCalls.some((call) => call.text === "Set the hook!"));
  const tail = await page.evaluate(() => window.__speechCalls.slice(-2));
  check(tail[0]?.kind === "cancel" && tail[1]?.kind === "speak" && tail[1].text === "Set the hook!",
    "the hook cue interrupts the active nibble hint");
  check(!errors.length, "the page has no script errors" + (errors.length ? ` (${errors.join(" | ")})` : ""));
} finally {
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
