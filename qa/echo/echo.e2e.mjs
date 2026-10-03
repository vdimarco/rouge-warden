// Drives Loon Echo in a real browser at a phone size (touch) and a desktop size.
// cd public && python3 -m http.server 8787, then:
// LAB_URL=http://localhost:8787/lab/ NODE_PATH=$(npm root -g) node qa/echo/echo.e2e.mjs   (SHOTS=<folder> saves screenshots)
// The test stops the frame clock and moves game time by hand (window.__echo.advance), so a slow machine gives the same result.
import { open, until, shot, report, PHONE, DESK } from "../lab/lib.mjs";

const R = report("echo.e2e");
const STEP = 1 / 60;

// Puts n chicks of the current clutch in the line, the loon on the nest, and the eels and boats out of the way.
const lineUp = (page, n) => page.evaluate((n) => {
  const r = __echo.run;
  r.eels.forEach((e) => { e.active = false; }); r.boats = []; r.boatTimer = 1e9;
  r.flock = []; for (const c of r.chicks) if (c.state === "following") c.state = "waiting";
  for (let i = 0; i < n; i++) { r.chicks[i].state = "following"; r.flock.push(i); }
  r.x = .5; r.y = .3; r.target = { x: .5, y: .205 }; r.trail = [{ x: .5, y: .5, angle: 0, d: 0 }];
}, n);

// Moves game time one frame at a time until the bank, then while the big-bank moment lasts.
const bank = (page) => page.evaluate((STEP) => {
  const E = __echo, r = E.run, trips = r.trips, first = E.sounds.at(-1)?.n || 0;
  let frames = 0, banked = -1, active = 0, sim0 = 0, text = "", hudStart = "", maxHops = 0;
  for (let i = 0; i < 60 * 8; i++) {
    E.advance(STEP); frames++;
    if (banked < 0 && r.trips > trips) banked = frames;
    maxHops = Math.max(maxHops, E.hops);
    if (E.celebration) {
      if (!active) { sim0 = r.elapsed; text = E.celebration.text; hudStart = document.getElementById("chapter").textContent; }
      active++;
    } else if (active || (banked >= 0 && frames - banked > 90)) break;
  }
  const sounds = E.sounds.filter((s) => s.n > first);
  return { banked: banked >= 0, seconds: active * STEP, sim: r.elapsed - sim0, text, hudStart, hudEnd: document.getElementById("chapter").textContent,
    score: r.score, clutch: r.clutch, maxHops, hops: sounds.filter((s) => s.tag === "hop").map((s) => s.freq), fireworks: sounds.filter((s) => s.tag === "firework").length };
}, STEP);

async function flow(name, view) {
  R.section(`${name} (${view.width}×${view.height})`);
  const { page, ctx, errors, close } = await open("../echo/", view);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.waitForFunction(() => window.__echo && document.getElementById("start"));
  await shot(page, `echo-${name}-menu`);

  const t0 = Date.now();
  await page.click("#start");
  await until(page, () => __echo.run && !__echo.run.ended && !document.getElementById("controls").hidden);
  R.check(Date.now() - t0 < 2000, `Play starts a run in under 2 s (${Date.now() - t0} ms)`);
  await page.evaluate(() => __echo.manual(true));

  // Today's lake: the date at the cottage sets the lake number, and the number sets the lake.
  const today = await page.evaluate(async () => {
    const m = await import("/echo/crossing.js"), r = __echo.run;
    const p = {}; for (const x of new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())) p[x.type] = x.value;
    const n = m.lakeNumber(`${p.year}-${p.month}-${p.day}`), want = m.createRun(m.lakeSeed(n));
    return { n, label: document.getElementById("lake-label").textContent, card: document.getElementById("today").textContent, same: JSON.stringify([r.rocks, r.fish, r.lanes]) === JSON.stringify([want.rocks, want.fish, want.lanes]) };
  });
  R.check(today.label === `LAKE #${today.n}` && today.card === `TODAY: LAKE #${today.n}`, `the HUD and the start card name today's lake (${today.label})`);
  R.check(today.same, `the run swims lake #${today.n}: its rocks, fish and boat lanes come from that lake's seed`);

  // The pause button must not cover HONK or DIVE, and all three must be on the screen.
  const boxes = await page.evaluate(() => ["call", "dive", "pause"].map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { id, l: b.left, t: b.top, r: b.right, b: b.bottom }; }));
  const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  R.check(!boxes.some((a, i) => boxes.some((b, j) => i < j && overlap(a, b))), "HONK, DIVE and pause do not overlap");
  R.check(boxes.every((b) => b.l >= 0 && b.r <= view.width && b.b <= view.height), "HONK, DIVE and pause are fully on the screen");

  // A bank of five: the big-bank moment.
  await lineUp(page, 5);
  const five = await bank(page);
  R.check(five.banked && five.score === 2500, `five chicks bank for 100 × 5² = 2,500 (score ${five.score})`);
  R.check(five.seconds >= 0.6, `the five-chick celebration holds for at least 0.6 s (${five.seconds.toFixed(2)} s)`);
  R.check(five.hops.length === 5, `the five chicks land on five notes (${five.hops.length})`);
  R.check(five.hops.every((f, i) => !i || f > five.hops[i - 1]), `the notes rise (${five.hops.join(", ")} Hz)`);
  R.check(five.sim < five.seconds * 0.5, `the lake runs in slow motion during the celebration (${five.sim.toFixed(2)} s of game time in ${five.seconds.toFixed(2)} s)`);
  R.check(five.text === "+100 × 5²", `the moment shows "${five.text}"`);
  R.check(/^5 to rescue · 0 pts$|· [0-9,]+ pts/.test(five.hudStart) && Number(five.hudStart.replace(/\D/g, "").slice(1)) < 2500 && /2,500 pts/.test(five.hudEnd), `the HUD score counts up ("${five.hudStart}" to "${five.hudEnd}")`);

  // A bank of two: quick hops and one tone, no slow motion.
  await lineUp(page, 2);
  const two = await bank(page);
  R.check(two.banked && two.seconds === 0 && two.maxHops === 2 && two.hops.length === 0, "a bank of two hops home without the slow-motion moment");

  // The last chick, then eight at once: fireworks, and the next clutch after the moment.
  await lineUp(page, 1);
  await page.evaluate(() => { const r = __echo.run; r.chicks.forEach((c, i) => { if (i > 0 && c.state !== "saved") c.state = "saved"; }); r.home = 7; });
  const finish = await bank(page);
  R.check(finish.clutch === 2, `filling the nest hatches clutch 2 (clutch ${finish.clutch})`);
  await page.evaluate(() => __echo.advance(1.5));
  await lineUp(page, 8);
  const eight = await bank(page);
  await page.evaluate(() => __echo.advance(.4));
  const after = await page.evaluate(() => ({ fireworks: __echo.sounds.filter((s) => s.tag === "firework").length, banner: __echo.banner, particles: __echo.particles }));
  R.check(eight.hops.length === 8 && eight.seconds >= 0.6, `eight chicks land on eight notes in a moment of ${eight.seconds.toFixed(2)} s`);
  R.check(after.fireworks >= 4, `eight at once sets off fireworks (${after.fireworks} bursts)`);
  R.check(after.banner === "CLUTCH 3", `the clutch 3 banner shows after the moment ("${after.banner}")`);
  await page.evaluate(() => { __echo.manual(false); });
  await shot(page, `echo-${name}-clutch3`);

  // A big bank in the middle of play, for a picture.
  await page.evaluate(() => __echo.manual(true));
  await lineUp(page, 6);
  await page.evaluate(() => { for (let i = 0; i < 60 && !__echo.celebration; i++) __echo.advance(1 / 60); __echo.advance(.35); });
  await shot(page, `echo-${name}-big-bank`);

  // The end of the run: a short end moment, then the card, then a restart.
  const endRun = () => page.evaluate(() => {
    const r = __echo.run; r.hearts = 1; r.invincible = 0; r.diving = false; r.x = .5; r.y = .6; r.target = { x: .5, y: .6 }; r.boats = [{ x: .5, y: .6, direction: 1, age: 1.6, speed: .3 }];
    const first = __echo.sounds.at(-1)?.n || 0; __echo.advance(.5);
    const during = { ended: r.ended, card: !document.getElementById("panel").hidden };
    __echo.advance(.6);
    return { ...during, after: !document.getElementById("panel").hidden, notes: __echo.sounds.filter((s) => s.n > first && s.tag === "end").length, hud: document.getElementById("chapter").textContent, score: r.score };
  });
  const end = await endRun();
  R.check(end.ended && !end.card && end.after, "the run ends with a short moment, then the card shows");
  R.check(end.notes === 3, `the end plays three falling notes (${end.notes})`);
  R.check(end.hud.includes(end.score.toLocaleString("en-US")), `the HUD shows the final score (${end.hud})`);
  const card = await page.evaluate(() => document.getElementById("panel").innerText);
  R.check(/A BOAT ENDED THE RESCUE/.test(card), "the end card names what ended the run");
  R.check(/\b5 deliveries\b/.test(card), `the end card counts the deliveries (${(card.match(/\d+ deliver\w+/) || [""])[0]})`);
  R.check(/Clutch 3: \d of 8 home/.test(card), "the end card shows how close the next clutch was");
  const line = await page.evaluate(() => document.getElementById("share-line").textContent.replace(/\u00a0/g, " "));
  R.check(new RegExp(`^Lake #${today.n} · 3 clutches · 22 home · \\d+:\\d\\d$`).test(line), `the end card shows the share line ("${line}")`);
  await page.click("#copy");
  await until(page, () => /COPIED|SELECT/.test(document.getElementById("copy").textContent));
  const copied = await page.evaluate(async () => ({ button: document.getElementById("copy").textContent, text: await navigator.clipboard.readText().catch(() => "") }));
  R.check(copied.button === "COPIED" && copied.text.includes(line) && copied.text.includes(`/echo/#lake=${today.n}`), `COPY puts the line and a link to the lake on the clipboard (${JSON.stringify(copied.text)})`);
  await shot(page, `echo-${name}-end`);
  const t1 = Date.now();
  await page.click("#again");
  await until(page, () => __echo.run && __echo.run.elapsed < 1 && !__echo.run.ended && document.getElementById("panel").hidden);
  R.check(Date.now() - t1 < 2000, `SWIM AGAIN starts a new run in under 2 s (${Date.now() - t1} ms)`);
  await lineUp(page, 1);
  await bank(page);
  await endRun();
  const one = await page.evaluate(() => document.getElementById("panel").innerText);
  R.check(/\b1 delivery\b/.test(one), `one bank shows "1 delivery" (${(one.match(/\d+ deliver\w+/) || [""])[0]})`);
  R.check(/^Lake #\d+ · 1 clutch · 1 home · 0:\d\d$/.test(await page.evaluate(() => document.getElementById("share-line").textContent.replace(/\u00a0/g, " "))), "the share line says \"1 clutch\" for one clutch");

  await close();

  // A shared link opens the same lake on another day.
  const linked = await open("../echo/", { ...view, hash: "#lake=12" });
  await linked.page.waitForFunction(() => window.__echo);
  await linked.page.click("#start");
  const twelve = await linked.page.evaluate(async () => {
    const m = await import("/echo/crossing.js"), want = m.createRun(m.lakeSeed(12)), r = __echo.run;
    return { label: document.getElementById("lake-label").textContent, card: document.getElementById("today").textContent, same: JSON.stringify([r.rocks, r.fish, r.lanes, r.chicks.map((c) => [c.x, c.y])]) === JSON.stringify([want.rocks, want.fish, want.lanes, want.chicks.map((c) => [c.x, c.y])]) };
  });
  R.check(twelve.label === "LAKE #12" && twelve.card === "LAKE #12" && twelve.same, `a #lake=12 link opens lake #12 (${twelve.label}, same lake: ${twelve.same})`);
  await linked.close();
  return [...errors, ...linked.errors];
}

// A small phone: the HUD keeps one line per column, and the whole end card fits on the screen.
async function small(view) {
  R.section(`small phone (${view.width}×${view.height})`);
  const { page, errors, close } = await open("../echo/", view);
  await page.waitForFunction(() => window.__echo);
  await page.click("#start");
  await page.evaluate(() => { __echo.manual(true); const r = __echo.run; for (let i = 0; i < 4; i++) { r.chicks[i].state = "following"; r.flock.push(i); } __echo.advance(.1); });
  const hud = await page.evaluate(() => ["flock", "chapter", "hearts"].map((id) => { const el = document.getElementById(id); return el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight === "normal" ? parseFloat(getComputedStyle(el).fontSize) * 1.2 : getComputedStyle(el).lineHeight); }));
  R.check(hud.every((lines) => lines < 1.6), `the HUD keeps one line per column (${hud.map((v) => v.toFixed(1)).join(", ")} lines)`);
  await page.evaluate(() => { const r = __echo.run; r.hearts = 1; r.invincible = 0; r.boats = [{ x: r.x, y: r.y, direction: 1, age: 1.6, speed: .3 }]; __echo.advance(1.2); });
  const card = await page.evaluate(() => { const p = document.getElementById("panel"), b = document.getElementById("again").getBoundingClientRect(); return { fits: p.scrollHeight <= p.clientHeight, again: b.bottom <= innerHeight && b.top >= 0 }; });
  R.check(card.fits && card.again, "the whole end card fits, and SWIM AGAIN is on the screen");
  await shot(page, `echo-small-end`);
  await close();
  return errors;
}

const errors = [...await flow("phone", PHONE), ...await flow("desk", DESK), ...await small({ width: 360, height: 640, touch: true })];
R.done(errors);
