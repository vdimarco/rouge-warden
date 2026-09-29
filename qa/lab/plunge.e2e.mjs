// Drives Take the Plunge in a real browser at a phone size (touch) and a desktop size (keys):
// NODE_PATH=$(npm root -g) node qa/lab/plunge.e2e.mjs   (serve public/ first; SHOTS=<folder> saves screenshots)
// Start, hold and let go, a dive under the water, winter at the end, Again in under 2 s, and a ghost link. Exit 1 on failure.
import { open, until, pointer, shot, sleep, report, PHONE, DESK } from "./lib.mjs";

const R = report("plunge.e2e");

async function flow(name, view) {
  R.section(`${name} (${view.width}×${view.height})`);
  const { page, errors, close } = await open("plunge/", view);
  await page.waitForSelector(".card.start .go");
  await shot(page, `plunge-${name}-title`);
  await page.click(".card.start .go");
  await until(page, () => window.QA && QA.phase === "play");
  R.check(true, "the Fly button starts a run");

  // hold and let go
  const vw = view.width, vh = view.height;
  if (view.touch) {
    await pointer(page, "pointerdown", vw / 2, vh * 0.6);
    await sleep(250);
    const held = await page.evaluate(() => QA.held && QA.s.tuck);
    await pointer(page, "pointerup", vw / 2, vh * 0.6);
    await sleep(120);
    const free = await page.evaluate(() => !QA.held);
    R.check(held && free, "a finger held on the screen tucks the wings, and lifting it lets go");
  } else {
    await page.keyboard.down(" ");
    await sleep(250);
    const held = await page.evaluate(() => QA.held && QA.s.tuck);
    await page.keyboard.up(" ");
    await sleep(120);
    const free = await page.evaluate(() => !QA.held);
    R.check(held && free, "holding Space tucks the wings, and letting go opens them");
  }
  // the sound button is not a hold
  await page.click(".labbar .snd");
  R.check(await page.evaluate(() => !QA.held), "pressing the sound button does not tuck the wings");
  await page.click(".labbar .snd");

  // dive into the first lake and swoop: step the sim by hand for an exact picture
  const dive = await page.evaluate(() => {
    const out = { entered: false, under: false, exited: false };
    for (let i = 0; i < 600; i++) {
      const s = QA.s;
      QA.step(1, s.mode === 0);
      if (QA.s.mode === 1) out.under = true;
      if (out.under && QA.s.mode === 0) { out.exited = true; break; }
    }
    out.x = QA.s.x;
    return out;
  });
  R.check(dive.under && dive.exited, `a held dive goes into the lake and comes back out (x = ${dive.x.toFixed(0)} m)`);
  await sleep(300);
  await shot(page, `plunge-${name}-flight`);

  // under the water, for a picture
  await page.evaluate(() => { for (let i = 0; i < 2000 && QA.s.mode !== 1; i++) QA.step(1, QA.s.mode === 0 && QA.s.vy < 0); });
  await sleep(200);
  await shot(page, `plunge-${name}-under`);

  // winter wins in the end
  await page.evaluate(() => { let n = 0; while (QA.s.alive && n++ < 120 * 600) QA.step(1, false); });
  await until(page, () => !document.querySelector(".card.end").hidden, null, 5000);
  const endTitle = await page.textContent(".card.end h2");
  R.check(/Caught at/.test(endTitle), `the end card says how far you got ("${endTitle}")`);
  await shot(page, `plunge-${name}-end`);

  // Again in under 2 seconds (the card ignores taps in its first 250 ms, so a finger still down at the crash does not restart)
  await sleep(400);
  const t0 = Date.now();
  await page.click(".card.end .again");
  await until(page, () => QA.phase === "play" && QA.s.tick < 240, null, 2000);
  R.check(Date.now() - t0 < 2000, `Again starts a new run in ${Date.now() - t0} ms`);

  // a ghost link: fly a bit, end, make the link, open it
  await page.evaluate(() => { for (let i = 0; i < 120 * 20; i++) QA.step(1, (i % 200) < 60); });
  const link = await page.evaluate(() => QA.ghostLink());
  R.check(/#g=[A-Za-z0-9_-]+$/.test(link), `the run makes a ghost link (${link.length} characters)`);
  const hash = link.slice(link.indexOf("#"));
  const seed = await page.evaluate(() => QA.seed);
  await close();

  const g = await open("plunge/", { ...view, hash });
  await g.page.waitForSelector(".card.start .go");
  const pitch = await g.page.textContent(".card.start .pitch");
  R.check(/ghost/.test(pitch), "a ghost link says so on the start card");
  await g.page.click(".card.start .go");
  await until(g.page, () => QA.phase === "play" && QA.gs);
  const same = await g.page.evaluate((seed) => QA.seed === seed, seed);
  await g.page.evaluate(() => QA.step(120 * 5, false));
  const gx = await g.page.evaluate(() => QA.gs.tick === QA.s.tick && QA.gs.x !== 0);
  R.check(same && gx, "the ghost flies the same lakes, in step with you");
  await sleep(200);
  await shot(g.page, `plunge-${name}-ghost`);
  for (const e of errors.concat(g.errors)) R.check(false, e);
  await g.close();
}

await flow("phone", PHONE);
await flow("desk", DESK);
R.done();
