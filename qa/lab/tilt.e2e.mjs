// Drives Full Tilt in a real browser: NODE_PATH=$(npm root -g) node qa/lab/tilt.e2e.mjs (serve public/ first)
// 1. A phone: a finger slides down on the right half to pull the plunger, two fingers hold both flippers, a jolt of
//    the phone nudges the ball, and too many jolts tilt the table.
// 2. Keys on a computer: Space pulls, Z and / flip, A nudges. A soft launch into the green lane is a skill shot, a
//    quick drain is saved, and three drains end the game.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { open, until, pointer, shot, sleep, report, PHONE, DESK } from "./lib.mjs";

const R = report("tilt.e2e");

// a jolt of the phone: one motion event with a spike of acceleration (m/s², device axes)
const jolt = (page, x, y = 0) => page.evaluate(({ x, y }) => window.dispatchEvent(new DeviceMotionEvent("devicemotion", {
  acceleration: { x, y, z: 0 }, accelerationIncludingGravity: { x, y: y + 9.81, z: 0 }, rotationRate: { alpha: 0, beta: 0, gamma: 0 }, interval: 16,
})), { x, y });
// hold the ball still in mid-table, in play, so a nudge has something to move
const hold = (page) => page.evaluate(() => Object.assign(QA.w.ball, { x: 228, y: 520, vx: 0, vy: 0, live: true, lane: false }));

R.section("A phone");
{
  const { page, errors, close } = await open("tilt/", { ...PHONE, phone: true });
  await page.waitForSelector(".card.start .go");
  await shot(page, "tilt-phone-title");
  await page.click(".card.start .go");
  await until(page, () => window.QA && QA.phase === "play", null, 10000);
  R.check(await page.evaluate(() => QA.waiting()), "the ball waits on the plunger");
  await sleep(600);
  await shot(page, "tilt-phone-waiting");

  // the plunger: slide down on the right half
  const span = await page.evaluate(() => Math.min(220, innerHeight * 0.25));
  const x = PHONE.width * 0.78, y0 = PHONE.height * 0.45;
  await pointer(page, "pointerdown", x, y0, 1);
  for (let i = 1; i <= 8; i++) { await pointer(page, "pointermove", x, y0 + (span * 0.6 * i) / 8, 1); await sleep(16); }
  const pulled = await page.evaluate(() => QA.game.pull);
  R.check(Math.abs(pulled - 0.6) < 0.02, `a finger sliding down pulls the plunger back (${pulled.toFixed(2)} of a full pull)`);
  await shot(page, "tilt-phone-pull");
  await pointer(page, "pointerup", x, y0 + span * 0.6, 1);
  await sleep(50);
  R.check(await page.evaluate(() => QA.w.ball.live && QA.w.ball.vy > 0), "letting go launches the ball");
  await sleep(700);
  await shot(page, "tilt-phone-play");

  // two thumbs, one on each flipper
  await pointer(page, "pointerdown", PHONE.width * 0.2, PHONE.height * 0.8, 2);
  await pointer(page, "pointerdown", PHONE.width * 0.8, PHONE.height * 0.8, 3);
  await sleep(80);
  R.check(await page.evaluate(() => QA.w.flippers.every((f) => f.held && f.th === f.up)), "two thumbs hold both flippers up");
  await pointer(page, "pointerup", PHONE.width * 0.2, PHONE.height * 0.8, 2);
  await sleep(80);
  R.check(await page.evaluate(() => !QA.w.flippers[0].held && QA.w.flippers[1].held), "lifting the left thumb drops only the left flipper");
  await pointer(page, "pointerup", PHONE.width * 0.8, PHONE.height * 0.8, 3);

  // a jolt nudges the ball; the bob warns, then tilts
  await hold(page);
  await jolt(page, 8);
  const vx = await page.evaluate(() => QA.w.ball.vx);
  R.check(vx < -300, `a jolt of the phone to the right sends the ball left against the table (${vx.toFixed(0)} mm/s)`);
  R.check(await page.evaluate(() => QA.game.warnings === 0 && !QA.game.tilted), "one jolt is safe");
  const seen = [];
  for (let i = 0; i < 8 && !(await page.evaluate(() => QA.game.tilted)); i++) {
    await sleep(300);
    await hold(page);
    await jolt(page, i % 2 ? 8 : -8);
    seen.push(await page.evaluate(() => QA.game.warnings));
  }
  const tilted = await page.evaluate(() => QA.game.tilted);
  R.check(tilted && seen.includes(1) && seen.includes(2), `quick jolts warn twice, then tilt (warnings after each: ${seen.join(", ")})`);
  await sleep(100);
  await shot(page, "tilt-phone-tilt");
  await pointer(page, "pointerdown", PHONE.width * 0.2, PHONE.height * 0.8, 4);
  await sleep(80);
  R.check(await page.evaluate(() => !QA.w.flippers[0].held && QA.w.flippers[0].th === QA.w.flippers[0].rest), "a tilted table has dead flippers");
  await pointer(page, "pointerup", PHONE.width * 0.2, PHONE.height * 0.8, 4);
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("Keys on a computer");
{
  const { page, errors, close } = await open("tilt/", DESK);
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  await until(page, () => window.QA && QA.phase === "play", null, 10000);
  await page.keyboard.down("Space");
  await sleep(500);
  const pull = await page.evaluate(() => QA.game.pull);
  R.check(pull > 0.25 && pull < 0.6, `holding Space pulls the plunger back (${pull.toFixed(2)} after 0.5 s)`);
  await page.keyboard.up("Space");
  await sleep(50);
  R.check(await page.evaluate(() => QA.w.ball.live), "letting go of Space launches the ball");
  await page.keyboard.down("z");
  await page.keyboard.down("/");
  await sleep(80);
  R.check(await page.evaluate(() => QA.w.flippers.every((f) => f.held)), "Z and / hold the flippers up");
  await page.keyboard.up("z");
  await page.keyboard.up("/");
  await hold(page);
  await page.keyboard.press("a");
  R.check(await page.evaluate(() => QA.w.ball.vx < -200), "A nudges the ball to the left");
  await sleep(300);
  await shot(page, "tilt-desk-play");

  // the skill shot, run on the game's own clock: a soft launch into the green lane
  const skill = await page.evaluate(() => {
    QA.begin();
    QA.game.skill = 2;
    QA.pullStart({ y: 0 });
    QA.pullTo(0.35);
    QA.pullEnd();
    for (let i = 0; i < 120 * 3 && QA.game.skillOn; i++) QA.step(1);
    return { skills: QA.game.n.skills, score: QA.game.score, lit: QA.table.lanes[2].lit };
  });
  R.check(skill.skills === 1 && skill.score >= 5000 && skill.lit, `a launch at 35% of a full pull drops into the right lane: a skill shot (${skill.score} points)`);

  // a quick drain is saved once; then three drains end the game
  const drainNow = () => page.evaluate(() => { Object.assign(QA.w.ball, { x: 228, y: 90, vx: 0, vy: -300, live: true, lane: false }); QA.step(2); });
  await drainNow();
  let st = await page.evaluate(() => ({ ball: QA.game.ball, saved: QA.game.saved, waiting: QA.waiting(), msg: QA.game.msg }));
  R.check(st.ball === 1 && st.saved && st.waiting && st.msg === "BALL SAVED", "a drain in the first 8 s is saved: the same ball comes back to the plunger");
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { QA.pullStart({ y: 0 }); QA.pullTo(0.9); QA.pullEnd(); QA.game.save = 0; });
    await drainNow();
  }
  await until(page, () => !document.querySelector(".card.end").hidden, null, 5000);
  const title = await page.textContent(".card.end h2");
  R.check(/^[\d,]+ points$/.test(title), `three drains end the game, and the end card gives the score ("${title}")`);
  await shot(page, "tilt-desk-end");
  await sleep(400);
  await page.keyboard.press("Enter");
  await until(page, () => QA.phase === "play" && QA.game.ball === 1 && QA.game.score === 0, null, 2000);
  R.check(true, "Enter starts a new game");
  for (const e of errors) R.check(false, e);
  await close();
}

R.done();
