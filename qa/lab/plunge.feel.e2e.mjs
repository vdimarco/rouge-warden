// Drives the feel of Take the Plunge in a real browser, at a phone size (touch) and a desktop size (keys):
// NODE_PATH=$(npm root -g) node qa/lab/plunge.feel.e2e.mjs   (serve public/ first; SHOTS=<folder> saves screenshots)
// The dive-now cue and the amber line, the slow motion at the peak burst, the times of day and the end card, the winter
// pill, words that stay on the screen, the portrait framing, and an old ghost link. Game time moves through window.QA,
// so the checks do not depend on how fast the machine is. Exit 1 on failure.
import { open, until, shot, report, PHONE, DESK } from "./lib.mjs";
import { toB64u, fromB64u } from "../../public/lab/kit/rng.js";

const R = report("plunge.feel.e2e");
const H = 1 / 120;

async function flow(name, view) {
  R.section(`${name} (${view.width}×${view.height})`);
  // a fixed seed, so the lakes are the same on every day
  const { page, errors, close } = await open("plunge/", { ...view, hash: "#s=42" });
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  await until(page, () => window.QA && QA.phase === "play");

  // The cue: glide from the start. It lights as soon as a held dive would rip with room (the line turns green or gold),
  // before the loon is over the first lake, and it stays lit long enough to answer it.
  const cue = await page.evaluate(() => {
    QA.begin();
    const lake = QA.world.find(40);
    const out = { green: -1, at: -1, x: 0, lit: 0, lake: lake.x0 };
    for (let i = 0; i < 900 && QA.s.mode === 0; i++) {
      const l = QA.line(true);
      if (out.green < 0 && (l.kind === "rip" || l.kind === "perfect")) out.green = QA.s.tick;
      if (out.at < 0 && QA.cue) { out.at = QA.s.tick; out.x = QA.s.x; }
      if (out.at >= 0) { if (QA.cue) out.lit++; else break; }
      QA.step(1, false);
    }
    // a hold that starts when the cue lights, and one that starts 0.25 s later
    const hold = (wait) => {
      QA.begin();
      while (QA.s.tick < out.at + wait) QA.step(1, false);
      while (QA.s.mode === 0) QA.step(1, true);
      return QA.s.stats.perfect ? "perfect" : QA.s.stats.rip ? "rip" : QA.s.stats.splash ? "splash" : QA.s.stats.flop ? "flop" : "thud";
    };
    out.now = hold(0);
    out.late = hold(30);
    return out;
  });
  R.check(cue.at >= 0 && cue.x < cue.lake, `the cue lights after ${(cue.at * H).toFixed(2)} s, at ${cue.x.toFixed(0)} m, before the first lake (${cue.lake.toFixed(0)} m)`);
  R.check(cue.green >= 0 && cue.at - cue.green <= 3, `it lights when the held line turns green (${cue.at - cue.green} steps apart)`);
  R.check(cue.lit * H >= 0.3, `it stays lit for ${(cue.lit * H).toFixed(2)} s if nobody holds (at least 0.3 s)`);
  R.check(/perfect|rip/.test(cue.now) && /perfect|rip/.test(cue.late), `a hold when it lights gives a ${cue.now}; a hold 0.25 s later gives a ${cue.late}`);

  // The line: amber for a rip that enters 20 m before the far shore, green or gold with room to swoop out
  const line = await page.evaluate(() => {
    QA.begin();
    let L = QA.world.find(300);
    while (L.kind !== 1 || L.x1 - L.x0 < 80) L = QA.world.find(L.x1 + 0.01);
    const at = (back) => { Object.assign(QA.s, { x: L.x1 - back - 0.6, y: 1.2, vx: 12, vy: -24, mode: 0 }); return QA.line(true); };
    return { near: at(20), far: at(60) };
  });
  R.check(line.near.kind === "short" && line.near.color === "#ffa31a" && line.near.room < 25, `an entry ${line.near.room.toFixed(1)} m before the far shore draws an amber line (${line.near.end}, ${line.near.color})`);
  R.check(/perfect|rip/.test(line.far.kind) && /#ffd766|#8ef08a/.test(line.far.color), `with ${line.far.room.toFixed(0)} m of lake left it is ${line.far.kind} (${line.far.color})`);

  // The peak: the first burst of a run. The clock stays under full speed for 0.7 s of real time, and the camera pushes in.
  // Real frames run between two page.evaluate calls, so the steps to the burst and the count after it share one call.
  await page.evaluate(() => {
    window.toBurst = () => {
      QA.begin();
      let n = 0;
      while (!QA.cue && n++ < 900) QA.step(1, false);
      while (QA.s.mode === 0 && n++ < 1800) QA.step(1, true);
      while (QA.s.stats.burst === 0 && n++ < 2700) QA.step(1, false);
      return QA.s.stats.burst;
    };
  });
  R.check(await page.evaluate(() => toBurst()) === 1, "a held dive from the cue and a swoop give the first burst");
  await until(page, () => QA.push > 0.3, null, 5000);
  R.check(await page.evaluate(() => QA.scale < 1 && QA.push > 0.3), "the camera pushes in on the loon in the slow motion");
  await shot(page, `plunge-feel-${name}-peak`);
  const slow = await page.evaluate((H) => {
    toBurst();
    let real = 0, top = 0, low = 1, push = 1;
    while (real < 0.7) { const sc = QA.scale; top = Math.max(top, sc); low = Math.min(low, sc); push = Math.min(push, QA.pushing); real += H / sc; QA.step(1, false); }
    while (QA.scale < 1 && real < 5) { real += H / QA.scale; QA.step(1, false); }
    return { top, low, push, real };
  }, H);
  R.check(slow.top < 1 && slow.low <= 0.31, `for 0.7 s after the first burst the clock runs at ${slow.low.toFixed(2)} to ${slow.top.toFixed(2)} of full speed`);
  R.check(slow.push === 1 && slow.real >= 0.8 && slow.real <= 1.2, `the camera stays pushed in through that time, and full speed is back after ${slow.real.toFixed(2)} s`);

  // The times of day: past the sunset mark the title says so, and the end card names the farthest one
  const sky = await page.evaluate(() => {
    QA.begin();
    const rung = (name) => { for (let n = 0; n < 12; n++) if (QA.rung(n).name === name) return QA.rung(n); };
    const sun = rung("Sunset"), lights = rung("Northern lights");
    Object.assign(QA.s, { x: sun.x + 5, y: 40, vx: 30, vy: 0, mode: 0 });
    QA.step(1, false);
    const out = { sun: sun.x, lights: lights.x, banner: QA.banner };
    QA.s.wx = QA.s.x + 2;
    QA.step(1, false);
    out.alive = QA.s.alive;
    return out;
  });
  R.check(sky.banner === "Sunset", `past ${sky.sun.toFixed(0)} m the title says "${sky.banner}"`);
  await until(page, () => !document.querySelector(".card.end").hidden, null, 5000);
  const rows = await page.evaluate(() => {
    const dt = [...document.querySelectorAll(".card.end dt")].map((e) => e.textContent), dd = [...document.querySelectorAll(".card.end dd")].map((e) => e.textContent);
    return Object.fromEntries(dt.map((k, i) => [k, dd[i]]));
  });
  R.check(rows.Farthest === "Sunset", `the end card says Farthest: ${rows.Farthest}`);
  R.check(/^Northern lights in \d+ m$/.test(rows.Next || ""), `and Next: ${rows.Next}`);
  R.check(/^\d+$/.test(rows.Thuds || ""), `and Thuds: ${rows.Thuds}`);
  await shot(page, `plunge-feel-${name}-end`);
  await page.waitForTimeout(400);
  await page.click(".card.end .again");
  await until(page, () => QA.phase === "play");
  const lights = await page.evaluate((x) => { Object.assign(QA.s, { x: x + 5, y: 40, vx: 30, vy: 0, mode: 0 }); QA.step(1, false); return QA.banner; }, sky.lights);
  R.check(lights === "Northern lights", `past ${sky.lights.toFixed(0)} m the title says "${lights}"`);

  // The winter pill: how far back winter is, red under 40 m
  const pill = async (gap) => {
    await page.evaluate((gap) => { QA.s.wx = QA.s.x - gap; }, gap);
    await until(page, (gap) => { const t = document.querySelector("#hWinter").textContent.match(/\d+/); return t && Math.abs(+t[0] - gap) < 6; }, gap, 5000);
    return page.evaluate(() => ({ text: document.querySelector("#hWinter").textContent, red: document.querySelector("#hWinter").classList.contains("near") }));
  };
  const far = await pill(120), close_ = await pill(30);
  R.check(!far.red && close_.red, `the HUD reads "${far.text}" and then "${close_.text}" in red`);
  const hud = await page.evaluate(() => { const r = document.querySelector("#hud").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  R.check(hud.l >= 0 && hud.r <= hud.w, `the four HUD pills fit the screen (${hud.l.toFixed(0)} to ${hud.r.toFixed(0)} of ${hud.w} px)`);

  // Words stay on the screen: a thud far to the right of where the camera is still looking
  await page.evaluate(() => {
    QA.begin();
    QA.step(30, false);
    const x = QA.s.x + 160;
    let L = QA.world.find(x);
    while (L.kind === 1) L = QA.world.find(L.x1 + 0.01);
    const at = Math.max(x, L.x0 + 5);
    Object.assign(QA.s, { x: at, y: QA.world.ground(at) + 1.5, vx: 12, vy: -10, mode: 0 });
    for (let i = 0; i < 240 && !QA.s.stats.thud; i++) QA.step(1, false);
  });
  await until(page, () => QA.labels.some((l) => l.box), null, 5000);
  const words = await page.evaluate(() => ({ list: QA.labels.filter((l) => l.box), w: innerWidth, h: innerHeight }));
  R.check(words.list.length > 0 && words.list.every((l) => l.box[0] >= 0 && l.box[2] <= words.w && l.box[1] >= 80 && l.box[3] <= words.h),
    `the words stay on the screen and under the HUD: ${words.list.map((l) => `${l.text} at ${l.box.map(Math.round).join(",")}`).join("; ")}`);

  // The framing: on a tall phone the water line and the loon sit near the middle
  if (view.height > view.width) {
    const f = await page.evaluate(() => { QA.begin(); QA.step(40, false); return QA.frame(); });
    R.check(f.water > 0.55 && f.water < 0.75 && f.loon > 0.3 && f.loon < 0.65, `the water line sits at ${Math.round(f.water * 100)}% of the height and the loon at ${Math.round(f.loon * 100)}%`);
  }
  for (const e of errors) R.check(false, e);
  await close();

  // A ghost link from the older version: the start card says so, and you fly its lakes with no ghost
  const g = await open("plunge/", view);
  await g.page.waitForSelector(".card.start .go");
  await g.page.click(".card.start .go");
  await until(g.page, () => window.QA && QA.phase === "play");
  await g.page.evaluate(() => { for (let i = 0; i < 120 * 10; i++) QA.step(1, (i % 200) < 60); });
  const link = await g.page.evaluate(() => QA.ghostLink());
  const seed = await g.page.evaluate(() => QA.seed);
  await g.close();
  const b = fromB64u(link.slice(link.indexOf("#g=") + 3));
  b[0] = 1;
  const o = await open("plunge/", { ...view, hash: "#g=" + toB64u(b) });
  await o.page.waitForSelector(".card.start .go");
  const pitch = await o.page.textContent(".card.start .pitch");
  R.check(/older version/.test(pitch), `a version 1 ghost link says so: "${pitch}"`);
  await o.page.click(".card.start .go");
  await until(o.page, () => window.QA && QA.phase === "play");
  R.check(await o.page.evaluate((seed) => QA.gs === null && QA.seed === seed, seed), "it flies the same lakes, with no ghost");
  for (const e of g.errors.concat(o.errors)) R.check(false, e);
  await o.close();
}

await flow("phone", PHONE);
await flow("desk", DESK);
R.done();
