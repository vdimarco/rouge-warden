// One button leaves the start roof: the swing input walks the hero toward the web (swing-moves).
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("swingstart");
watchdog(240000, "swingstart");
const out = SHOTS || "/tmp/swing-start";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 30); });

  const before = await page.evaluate(() => {
    const hints = document.querySelector("#keyHints");
    const row = document.querySelector(".fs-train li");
    return {
      ground: G.P.onGround,
      hint: hints ? hints.textContent : "",
      row: row ? row.textContent : "",
      said: (document.querySelector(".fs-sub") || {}).textContent || "",
    };
  });
  await page.screenshot({ path: out + "/roof.png" });
  check(before.ground, "the hero starts on the roof", before);
  check(/LEFT MOUSE \(OR E\): SWING\./.test(before.hint) && !/HOLD W/.test(before.hint), "the hint names the swing button and not W", before.hint);
  check(/LEFT MOUSE/.test(before.row) && !/HOLD W/.test(before.row), "the training row names the mouse and not a forward hold", before.row);

  const left = await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
    let n = 0;
    for (; n < 360 && (G.P.onGround || n < 40); n++) G.test.step(1 / 60, 1);
    const leftAt = n / 60, ground = G.P.onGround;
    G.test.step(1 / 60, 50);
    const ropes = G.test.state().ropes.map((r) => r.state);
    return { secs: leftAt, ground, y: G.P.pos.y, ropes, air: !G.P.onGround };
  });
  await page.screenshot({ path: out + "/air.png" });
  check(!left.ground && left.air && left.secs <= 4 && left.ropes.some((s) => s === "attached"), "E alone leaves the roof within 4 s and is still swinging a moment later", left);
  check(page.errors.length === 0, "no page errors", page.errors);
} catch (e) {
  check(false, "the one-button run threw", e.stack || String(e));
}
await close();
done();
