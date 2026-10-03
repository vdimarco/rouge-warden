// Drives Neon Ronin in a real browser. Serve public/ first, for example on port 8786:
//   cd public && python3 -m http.server 8786
//   LAB_URL=http://localhost:8786/lab/ node qa/neon/neon.e2e.mjs
// WebGL can be very slow on a test machine, so the checks step game time with the window.QA hooks
// instead of waiting for real frames. SHOTS=<folder> saves screenshots. Exit code 1 on failure.
// 1. A 390x844 phone: the title, the line and both play buttons fit the first screen.
// 2. Touch play: windups start on screen, every windup frame shows the warning edge, no hint says Space,
//    and a parry slows time.
// 3. A virtual phone in gyro mode: steady motion keeps the gyro on after the 3 s check.
// 4. A 1280x800 computer: the menu and the duel.
import { open, until, shot, sleep, report, PHONE, DESK } from "../lab/lib.mjs";

const R = report("neon.e2e");
const NEON = "../neon/";
const errors = [];
const ready = (page) => until(page, () => window.QA && document.getElementById("start"), null, 120000);
// Is the element fully inside the viewport, with nothing on top of its middle?
const onScreen = (page, id, w, h) => page.evaluate(({ id, w, h }) => {
  const el = document.getElementById(id), b = el.getBoundingClientRect(), top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return { inside: b.top >= 0 && b.left >= 0 && b.bottom <= h && b.right <= w && b.height > 0, clear: top === el || el.contains(top), top: Math.round(b.top), bottom: Math.round(b.bottom) };
}, { id, w, h });

R.section("A phone: the first screen and touch play");
{
  const { page, errors: e, close } = await open(NEON, PHONE);
  await ready(page);
  await sleep(500);
  await shot(page, "neon-phone-menu");
  for (const id of ["gyroStart", "start"]) {
    const r = await onScreen(page, id, PHONE.width, PHONE.height);
    R.check(r.inside, `${id} is fully on the first screen (${r.top} to ${r.bottom} px of ${PHONE.height})`);
    R.check(r.clear, `nothing covers ${id}`);
  }
  // A closed details element skips its content, but getBoundingClientRect() still lays it out, so ask what shows.
  R.check(await page.evaluate(() => { const howto = document.querySelector("#panel details"); return !!howto && !howto.open && [...howto.querySelectorAll("p")].every((p) => !p.checkVisibility()); }),
    "desktop and tablet help wait, closed, behind How to play");
  R.check(await page.evaluate(() => [...document.querySelectorAll("#hud small")].map((s) => s.textContent).join() === "INTEGRITY,ROUND,SCORE"), "the HUD counts ROUND, as the objective does");

  await page.tap("#start");
  await until(page, () => QA.state === "play", null, 30000);
  // The frame loop stops; from here only QA.step moves the game.
  const run = await page.evaluate(() => {
    QA.hold = true;
    const out = { hints: new Set(), windups: 0, windOn: 0, frames: 0, edge: 0 };
    let last = null;
    // A player who does nothing. Stop while some health is left, for the parry check below.
    for (let i = 0; i < 30 * 30 && QA.state === "play" && QA.health > 40; i++) {
      QA.step(1 / 30, 1 / 30, false);
      const a = QA.duel.active;
      if (a && a !== last) { out.windups++; if (QA.inView(a)) out.windOn++; }
      if (a?.phase === "windup") { out.frames++; if (QA.warning) out.edge++; }
      last = a;
      out.hints.add(document.getElementById("hint").textContent);
    }
    return { ...out, hints: [...out.hints], state: QA.state, health: QA.health };
  });
  R.check(run.windups >= 4 && run.windOn / run.windups >= 0.9, `windups start on screen: ${run.windOn} of ${run.windups}`);
  R.check(run.frames > 0 && run.edge === run.frames, `every windup frame shows the warning edge (${run.edge} of ${run.frames})`);
  R.check(!run.hints.some((h) => /space/i.test(h)), `no hint says Space on a touch screen (${run.hints.length} hints seen)`);
  R.check(run.hints.some((h) => /HOLD GUARD AS THE BLADE FALLS/.test(h)), "the touch hint says HOLD GUARD AS THE BLADE FALLS");

  // A windup on screen, for a picture, then a parry: guard in the last 0.6 s.
  await page.evaluate(() => { QA.step(0); });
  const parry = await page.evaluate(() => {
    for (let i = 0; i < 600 && !(QA.duel.active?.phase === "windup" && QA.duel.active.attack !== "sweep" && QA.duel.active.timer < 0.45); i++) QA.step(1 / 30, 1 / 30, false);
    QA.step(0);
    return !!QA.duel.active;
  });
  await shot(page, "neon-phone-windup");
  if (parry) {
    const after = await page.evaluate(() => { const f = QA.duel.active; QA.setGuard(true); for (let i = 0; i < 60 && QA.duel.active === f; i++) QA.step(1 / 60, 1 / 60, false); QA.step(0.1, 1 / 60); return { phase: f.phase, slow: QA.slow }; });
    R.check(after.phase === "open" && after.slow > 0, `a parry opens the guard and slows time (${after.phase}, slow ${after.slow.toFixed(2)} s)`);
    await shot(page, "neon-phone-parry");
    await page.evaluate(() => { QA.setGuard(false); QA.step(0.5, 1 / 30); });
    await shot(page, "neon-phone-cut-now");
  } else R.check(false, "a windup came, for the parry check");
  // Run to the end and look at the end card.
  await page.evaluate(() => { for (let i = 0; i < 3000 && QA.state === "play"; i++) QA.step(1 / 30, 1 / 30, false); });
  R.check(await page.evaluate(() => QA.state === "over" && /Round \d/.test(document.getElementById("panel").textContent) && /at \d+\/\d+ HP|down/.test(document.getElementById("panel").textContent)), "the end card shows the round and how close the run came");
  const retry = await onScreen(page, "retry", PHONE.width, PHONE.height);
  R.check(retry.inside && retry.clear, "RUN IT BACK is on screen");
  await shot(page, "neon-phone-end");
  errors.push(...e);
  await close();
}

R.section("A phone in gyro mode");
{
  const { page, errors: e, close } = await open(NEON, { ...PHONE, phone: true });
  await ready(page);
  await page.evaluate(() => { QA.hold = true; window.__phone.pose(80, "portrait", 0); });
  await page.tap("#gyroStart");
  await until(page, () => QA.state === "play" && QA.gyro && !!QA.raw, null, 30000);
  await sleep(3600);
  R.check(await page.evaluate(() => QA.gyro && QA.state === "play"), "steady motion keeps the gyro on after the 3 s check");
  R.check(await page.evaluate(() => document.getElementById("guard").hidden && getComputedStyle(document.getElementById("walkStick")).display !== "none"), "gyro mode hides the guard button and keeps the stick for dodges");
  await page.evaluate(() => QA.step(1.5, 1 / 30));
  await shot(page, "neon-phone-gyro");
  errors.push(...e);
  await close();
}

R.section("A computer");
{
  const { page, errors: e, close } = await open(NEON, DESK);
  await ready(page);
  await sleep(500);
  await shot(page, "neon-desk-menu");
  for (const id of ["start", "gyroStart"]) {
    const r = await onScreen(page, id, DESK.width, DESK.height);
    R.check(r.inside && r.clear, `${id} is on screen and clear`);
  }
  R.check(await page.evaluate(() => document.getElementById("start").textContent === "PLAY WITH MOUSE"), "the computer offers the mouse first");
  await page.click("#start");
  await until(page, () => QA.state === "play", null, 30000);
  await page.evaluate(() => { QA.hold = true; QA.step(3, 1 / 30); });
  await shot(page, "neon-desk-duel");
  errors.push(...e);
  await close();
}

R.done(errors);
