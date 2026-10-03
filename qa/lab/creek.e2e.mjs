// Drives Up the Creek in a real browser: NODE_PATH=$(npm root -g) node qa/lab/creek.e2e.mjs (serve public/ first)
// 1. A phone paddle: a virtual phone sends real orientation and motion events. The first stroke teaches the grip, a
//    rock tipped to the right is a stroke on the right (the bow turns left), and a hard tilt held still braces.
// 2. Thumbs on a phone: drag down on the side you want to turn to (the paddle goes in on the other side).
// 3. Catching an eddy: the ring is empty while the bow points downstream, and it fills while you hold the catch.
// 4. No lost runs: the log jam stops a canoe that paddles upstream and an arrow points downstream, Restart in the top
//    bar starts again at once, and Share on the end card gives a link to today's river.
// 5. The ledge: a straight run is a boof in slow motion, and time runs again after it. A run 60° off rolls you over,
//    after the warning.
// 6. Keys on a computer: D turns the bow right, W paddles straight, C braces. The end card says how the run went.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { open, until, pointer, drag, shot, sleep, report, PHONE, DESK, BASE } from "./lib.mjs";

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
  const a = await page.evaluate(() => ({ n: QA.c.strokes, psi: QA.c.psi, last: QA.lastAct }));
  R.check(a.n === b.n + 1 && a.psi > b.psi && a.last.type === "stroke" && a.last.side === -1, "a drag down on the right half turns the bow right: the paddle goes in on the left");
  await drag(page, PHONE.width * 0.2, PHONE.height * 0.62, PHONE.width * 0.2, PHONE.height * 0.45, 160);
  await sleep(200);
  const back = await page.evaluate(() => ({ n: QA.c.strokes, last: QA.lastAct }));
  R.check(back.n === a.n + 1 && back.last.type === "back" && back.last.side === -1, "a drag up on the left half is a back stroke on the left, which turns the bow left");
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

R.section("Catching an eddy");
{
  const { page, errors, close } = await open("creek/", { ...PHONE, hash: "#s=7" });
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  await until(page, () => QA.phase === "play" || QA.phase === "calibrate", null, 10000);
  if (await page.evaluate(() => QA.phase === "calibrate")) await page.click("#calibSkip");
  await until(page, () => QA.phase === "play");
  // sit in the core of an eddy worth catching and drift with its water: first the bow downstream, then upstream.
  // All in one call, in game time, so a busy machine does not change the result.
  const r = await page.evaluate(() => {
    const river = QA.river, q = river.targets[2], c = QA.c, out = { fills: [] };
    const sit = (psi) => {
      c.x = q.ex; c.y = q.ey; c.psi = psi; c.om = 0; c.phi = 0; c.dphi = 0; c.pushes.length = 0; c.turns.length = 0;
      const f = river.flow(c.x, c.y); c.vx = f.vx; c.vy = f.vy; c.eddyT = 0; c.inEddy = null;
    };
    sit(Math.atan2(q.tx, q.ty));
    QA.step(3);
    out.wrong = QA.hold;
    sit(Math.atan2(-q.tx, -q.ty));
    for (let i = 0; i < 90 && QA.hold.caught === 0; i++) { QA.step(1); out.fills.push(QA.hold.fill); }
    out.caught = QA.hold.caught;
    QA.snap();
    return out;
  });
  R.check(r.wrong.id != null && r.wrong.bow === false && r.wrong.fill === 0, "in an eddy with the bow downstream, the ring is empty and the page shows the turn to upstream");
  const f = r.fills.slice(0, -1), top = Math.max(...f);
  R.check(f.length > 30 && f.every((v, i) => i === 0 || v >= f[i - 1]) && top > 0.9, `with the bow upstream the ring fills to ${Math.round(top * 100)}% in ${f.length} steps`);
  await sleep(300);
  R.check(r.caught === 1 && /Eddies 1\//.test(await page.textContent("#hEddies")), "then the eddy is caught, and the count goes up");
  await shot(page, "creek-phone-eddy");
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("No lost runs: the log jam, Restart and Share");
{
  const { page, ctx, errors, close } = await open("creek/", PHONE);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(BASE).origin });
  await page.waitForSelector(".card.start .go");
  R.check(await page.isHidden(".labbar .restart"), "no Restart on the start card");
  await page.click(".card.start .go");
  await until(page, () => QA.phase === "play" || QA.phase === "calibrate", null, 10000);
  if (await page.evaluate(() => QA.phase === "calibrate")) await page.click("#calibSkip");
  await until(page, () => QA.phase === "play");
  R.check(await page.isVisible(".labbar .restart"), "Restart shows in the top bar during a run");
  // turn round at the put-in and paddle upstream for 60 s of game time
  const up = await page.evaluate(() => {
    const r = QA.river, c = QA.c, [tx, ty] = r.tan(c.y);
    c.psi = Math.atan2(-tx, -ty); c.om = 0;
    let last = -9, alt = 1, minY = c.y;
    for (let i = 0; i < 120 * 60; i++) {
      if (QA.c.t - last > 0.45) { last = QA.c.t; alt = -alt; QA.act({ type: "stroke", side: alt, power: 1.2 }); }
      QA.step(1);
      minY = Math.min(minY, QA.c.y);
    }
    QA.snap();
    return { minY, lost: QA.lost };
  });
  R.check(up.minY > -15, `60 s of strokes upstream stop at the log jam (lowest y ${up.minY.toFixed(1)} m; -300 m before)`);
  R.check(up.lost, "an arrow at the edge of the screen points downstream");
  await sleep(200);
  await shot(page, "creek-phone-jam");
  // Restart, with a tap
  const t0 = Date.now();
  await page.click(".labbar .restart");
  await until(page, () => QA.phase === "play" && QA.c.t < 0.5 && Math.abs(QA.c.y - 6) < 0.5 && !QA.lost, null, 5000);
  const ms = Date.now() - t0;
  R.check(ms < 2000, `Restart puts you back at the put-in in ${ms} ms`);
  // the end card: today's river, and a link to it
  const seed = await page.evaluate(() => QA.seed);
  await page.evaluate(() => { QA.finish(); QA.step(2); });
  await until(page, () => !document.querySelector(".card.end").hidden, null, 5000);
  R.check(await page.isHidden(".labbar .restart"), "Restart hides on the end card");
  R.check(/^Today's river: /.test(await page.textContent(".card.end .line")), "the end card says it was today's river");
  await sleep(300);
  await page.click(".card.end .share");
  await until(page, () => document.querySelector(".card.end .note").textContent.length > 0, null, 5000);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  R.check(link === `${new URL(BASE).origin}/lab/creek/#s=${seed}`, `Share gives a link to this river (${link})`);
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("The ledge");
{
  const { page, errors, close } = await open("creek/", { ...PHONE, hash: "#s=7" });
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  await until(page, () => QA.phase === "play" || QA.phase === "calibrate", null, 10000);
  if (await page.evaluate(() => QA.phase === "calibrate")) await page.click("#calibSkip");
  await until(page, () => QA.phase === "play");
  // 3 m above the lip, in the middle, moving with the water, at an angle; step game time until the lip
  const put = (offDeg) => page.evaluate((offDeg) => {
    const r = QA.river, L = r.ledge, c = QA.c;
    c.x = L.x - 3 * L.tx; c.y = L.y - 3 * L.ty; c.psi = Math.atan2(L.tx, L.ty) + offDeg / 57.2958;
    c.om = 0; c.phi = 0; c.dphi = 0; c.pushes.length = 0; c.turns.length = 0; c.ledge = null;
    const f = r.flow(c.x, c.y); c.vx = f.vx; c.vy = f.vy;
    QA.snap();
    for (let i = 0; i < 240 && !QA.ledge; i++) QA.step(1);
    return { ledge: QA.ledge, slow: QA.slow };
  }, offDeg);
  const boof = await put(0);
  R.check(boof.ledge === "boof" && boof.slow < 0.5, `a straight run over the ledge is a boof, and time slows (x${boof.slow})`);
  await sleep(350);
  await shot(page, "creek-phone-boof");
  await until(page, () => QA.slow === 1, null, 6000);
  R.check(true, "then time runs again");
  const crooked = await put(60);
  const after = await page.evaluate(() => {
    let warn = null;
    for (let i = 0; i < 360 && QA.c.swim <= 0; i++) { QA.step(1); if (warn == null && QA.c.warn) warn = QA.c.t; }
    return { swim: QA.c.swim > 0, lead: warn == null ? 0 : QA.c.t - warn };
  });
  R.check(crooked.ledge === "crooked" && after.swim && after.lead >= 0.3, `a run 60° off rolls you over, ${after.lead.toFixed(2)} s after the warning`);
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
  R.check(await page.evaluate((b) => QA.c.strokes === 1 && QA.c.psi > b && QA.lastAct.side === -1, b), "D turns the bow right: the paddle goes in on the left");
  await page.keyboard.press("w");
  const w1 = await page.evaluate(() => QA.lastAct.side);
  await page.keyboard.press("w");
  R.check(await page.evaluate((w1) => QA.c.strokes === 3 && QA.lastAct.side === -w1, w1), "W paddles on each side in turn, so it goes straight");
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
