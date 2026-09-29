// Full screen by default (js/fullscreen.js):
// 1. The title is not full screen before any input (a browser does not allow it).
// 2. The first tap on a phone goes full screen.
// 3. After leaving full screen (the back gesture), the next tap goes back in.
// 4. Turned off (the pause menu's FULL SCREEN), it leaves full screen, a tap does not go back in, and the
//    choice is remembered after a reload. Turned on again, it goes back in.
// 5. A phone held upright shows a prompt to turn it; sideways, it goes away.
// 6. On a desktop the first key goes full screen; Esc leaves, and a key does not pull it back in.
// No page errors.
import { open, finish } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const full = (page) => page.evaluate(() => !!document.fullscreenElement);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// phone
{
  const { browser, page, errors } = await open({ query: "?nomusic", width: 844, height: 390, touch: true });
  const tap = async () => { await page.touchscreen.tap(420, 60); await wait(300); };
  check(!(await full(page)), "the title starts windowed (no input yet)");
  await tap();
  check(await full(page), "the first tap goes full screen");
  await page.evaluate(() => document.exitFullscreen()); await wait(300);
  check(!(await full(page)), "leaving full screen works");
  await tap();
  check(await full(page), "the next tap goes back to full screen");
  await page.evaluate(() => window.CrimsonFullscreen.set(false)); await wait(300);
  check(!(await full(page)), "turned off, it leaves full screen");
  await tap();
  check(!(await full(page)), "turned off, a tap does not go back in");
  await page.reload(); await wait(1500);
  await tap();
  check(!(await full(page)) && (await page.evaluate(() => window.CrimsonFullscreen.on)) === false, "the off choice is remembered after a reload");
  await page.evaluate(() => window.CrimsonFullscreen.set(true)); await wait(300);
  await tap();
  check(await full(page), "turned on again, a tap goes full screen");
  await page.evaluate(() => { try { localStorage.removeItem("crimson.fullscreen"); } catch (e) { /* none */ } });
  if (errors.length) fails.push("phone page errors: " + errors.slice(0, 5).join(" | "));
  await browser.close();
}

// phone held upright: a prompt to turn it; turned sideways, the prompt goes
{
  const { browser, page, errors } = await open({ query: "?nomusic", width: 390, height: 844, touch: true });
  const shown = () => page.evaluate(() => { const e = document.getElementById("turnPhone"); return !!e && getComputedStyle(e).display !== "none"; });
  check(await shown(), "upright: the turn-your-phone prompt covers the game");
  await page.setViewportSize({ width: 844, height: 390 }); await wait(300);
  check(!(await shown()), "sideways: the prompt goes away");
  if (errors.length) fails.push("upright page errors: " + errors.slice(0, 5).join(" | "));
  await browser.close();
}

// desktop
{
  const { browser, page, errors } = await open({ query: "?nomusic", width: 1280, height: 720 });
  check(!(await page.evaluate(() => !!document.getElementById("turnPhone"))), "desktop: no turn-your-phone prompt");
  await page.keyboard.press("KeyW"); await wait(300);
  check(await full(page), "desktop: the first key goes full screen");
  await page.evaluate(() => document.exitFullscreen()); await wait(300);
  await page.keyboard.press("KeyW"); await wait(300);
  check(!(await full(page)), "desktop: after leaving, a key does not pull it back in");
  await page.mouse.click(640, 60); await wait(300);
  check(await full(page), "desktop: a click goes back to full screen");
  await finish("fullscreen", fails, browser, errors);
}
