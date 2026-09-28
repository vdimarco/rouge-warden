// Drives Up the Creek in a real browser: NODE_PATH=$(npm root -g) node qa/lab/creek.e2e.mjs (serve public/ first)
// 1. A phone paddle: a virtual phone sends real orientation and motion events. The first stroke teaches the grip, a
//    rock tipped to the right is a stroke on the right (the bow turns left), and a hard tilt held still braces.
// 2. Thumbs on a phone: drag down on the right half to stroke there.
// 3. Keys on a computer: D strokes on the right, C braces. The end card says how the run went.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { open, until, pointer, drag, shot, sleep, report, PHONE, DESK } from "./lib.mjs";

const R = report("creek.e2e");

// move the virtual phone from one rod angle to another over ms, tipped by roll degrees (clockwise +)
async function rock(page, from, to, ms, roll) {
  await page.evaluate(async ({ from, to, ms, roll }) => {
    const n = Math.max(2, Math.round(ms / 16));
    for (let i = 0; i <= n; i++) {
      const u = i / n, s = u * u * (3 - 2 * u);
      window.__phone.pose(from + (to - from) * s, "portrait", roll);
      await new Promise((r) => setTimeout(r, 16));
    }
  }, { from, to, ms, roll });
}

R.section("A phone as the paddle");
{
  const { page, errors, close } = await open("creek/", { ...PHONE, phone: true });
  await page.evaluate(() => window.__phone.pose(85, "portrait", 0));
  await page.waitForSelector(".card.start .go");
  await shot(page, "creek-phone-title");
  await page.click(".card.start .go");
  await until(page, () => window.QA && QA.phase === "calibrate", null, 10000);
  R.check(true, "with motion allowed, the game asks for one stroke first");
  await shot(page, "creek-phone-calibrate");
  await sleep(200);
  await rock(page, 85, 40, 180, 0);
  await until(page, () => QA.phase === "play", null, 5000);
  R.check(await page.evaluate(() => QA.mode === "motion" && QA.pull === -1), "the first stroke (the top tipped away) teaches the grip, and play starts");
  await rock(page, 40, 85, 400, 0);
  await sleep(500);
  // a stroke tipped to the right
  const before = await page.evaluate(() => ({ n: QA.c.strokes, psi: QA.c.psi }));
  await rock(page, 85, 85, 100, 25);
  await rock(page, 85, 42, 180, 25);
  await sleep(300);
  const after = await page.evaluate(() => ({ n: QA.c.strokes, psi: QA.c.psi, side: QA.paddle.side }));
  R.check(after.n === before.n + 1 && after.side === 1, `a rock tipped to the right is one stroke on the right (${after.n - before.n})`);
  R.check(after.psi < before.psi, "and the bow turns left");
  await rock(page, 42, 85, 450, 25);
  // a hard tilt held still braces
  await rock(page, 85, 85, 150, 38);
  await sleep(400);
  R.check(await page.evaluate(() => QA.c.brace === 1), "a hard tilt to the right, held still, braces on the right");
  await rock(page, 85, 85, 150, 0);
  await sleep(200);
  R.check(await page.evaluate(() => QA.c.brace === 0), "tipping back ends the brace");
  // run a while for a picture
  await page.evaluate(() => { for (let i = 0; i < 120 * 12; i++) { if (i % 60 === 0) QA.act({ type: "stroke", side: i % 120 ? 1 : -1, power: 1 }); QA.step(1); } });
  await sleep(400);
  await shot(page, "creek-phone-river");
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("Thumbs on a phone");
{
  const { page, errors, close } = await open("creek/", PHONE);
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  // no sensors here: the game falls back to touch
  await until(page, () => QA.phase === "play" || QA.phase === "calibrate", null, 10000);
  if (await page.evaluate(() => QA.phase === "calibrate")) await page.click("#calibSkip");
  await until(page, () => QA.phase === "play");
  R.check(await page.evaluate(() => QA.mode === "touch"), "without motion, the paddle is your thumbs");
  const b = await page.evaluate(() => ({ n: QA.c.strokes, psi: QA.c.psi }));
  await drag(page, PHONE.width * 0.8, PHONE.height * 0.45, PHONE.width * 0.8, PHONE.height * 0.62, 160);
  await sleep(300);
  const a = await page.evaluate(() => ({ n: QA.c.strokes, psi: QA.c.psi }));
  R.check(a.n === b.n + 1 && a.psi < b.psi, "a drag down on the right half is a stroke on the right, and the bow turns left");
  await drag(page, PHONE.width * 0.2, PHONE.height * 0.62, PHONE.width * 0.2, PHONE.height * 0.45, 160);
  await sleep(200);
  R.check(await page.evaluate(() => QA.c.strokes) === a.n + 1, "a drag up is a back stroke");
  // hold still: a brace
  await pointer(page, "pointerdown", PHONE.width * 0.25, PHONE.height * 0.5);
  await sleep(400);
  R.check(await page.evaluate(() => QA.c.brace === -1), "a thumb held still on the left braces on the left");
  await pointer(page, "pointerup", PHONE.width * 0.25, PHONE.height * 0.5);
  await sleep(100);
  R.check(await page.evaluate(() => QA.c.brace === 0), "lifting it ends the brace");
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("Keys on a computer");
{
  const { page, errors, close } = await open("creek/", DESK);
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  await until(page, () => QA.phase === "play" || QA.phase === "calibrate", null, 10000);
  if (await page.evaluate(() => QA.phase === "calibrate")) await page.click("#calibSkip");
  await until(page, () => QA.phase === "play");
  const b = await page.evaluate(() => QA.c.psi);
  await page.keyboard.press("d");
  await sleep(400);
  R.check(await page.evaluate((b) => QA.c.strokes === 1 && QA.c.psi < b, b), "D is a stroke on the right, and the bow turns left");
  await page.keyboard.down("c");
  await sleep(100);
  R.check(await page.evaluate(() => QA.c.brace === 1), "holding C braces on the right");
  await page.keyboard.up("c");
  await sleep(100);
  R.check(await page.evaluate(() => QA.c.brace === 0), "letting go ends it");
  await page.evaluate(() => { for (let i = 0; i < 120 * 20; i++) { if (i % 55 === 0) QA.act({ type: "stroke", side: (i / 55) % 2 ? 1 : -1, power: 1 }); QA.step(1); } });
  await sleep(300);
  await shot(page, "creek-desk-river");
  await page.evaluate(() => { QA.finish(); QA.step(2); });
  await until(page, () => !document.querySelector(".card.end").hidden, null, 5000);
  const title = await page.textContent(".card.end h2"), line = await page.textContent(".card.end .line");
  R.check(/Down the creek in \d+:\d\d/.test(title) && /eddies/.test(line), `the end card says how it went ("${title}", "${line}")`);
  await shot(page, "creek-desk-end");
  await sleep(400);
  await page.click(".card.end .again");
  await until(page, () => QA.phase === "play" && QA.c.t < 1, null, 2000);
  R.check(true, "Again starts a new run at once");
  for (const e of errors) R.check(false, e);
  await close();
}

R.done();
