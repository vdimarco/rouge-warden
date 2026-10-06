// The city action in flat play, in the browser: Shift sprints and drains the energy gauge; a dive lands in a roll; the swing
// input punches a goon in reach; a rope yanks a goon off his feet; a knock-out wakes you on a safe roof; R gets into a parked car,
// W drives it and R gets out; a job marker starts a job; the first run opens with the King's comic, then the cottage room, then
// Mission 1. Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/action.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS, enterXR } from "./lib.mjs";

const { check, done } = checker("action");
watchdog(1500000, "action");
const out = SHOTS || "/tmp/swing-qa";
await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };
const SETUP = () => {
  window.QA = {
    step(n = 1) { G.test.step(1 / 60, n); },
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code })); },
    tap(code) { QA.key(code, true); QA.step(1); QA.key(code, false); QA.step(1); },
    // on the sidewalk of the z = 14 avenue in the Market, facing west along it
    street() { G.test.teleport(-150, 0, 2); G.rigYaw = Math.PI / 2; G.desktop.level(0); G.flatcam.reset(Math.PI / 2); QA.step(5); },
    hs() { const v = G.P.vel; return Math.hypot(v.x, v.z); },
  };
};

try {
  const page = await newPage({ width: 960, height: 540 });
  await page.addInitScript(quiet);
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.evaluate(SETUP);

  /* ---- sprint and energy ---- */
  const sp = await page.evaluate(() => {
    QA.street();
    QA.key("KeyW", true); QA.step(60);
    const walk = QA.hs();
    QA.key("ShiftLeft", true); QA.step(60);
    const run = QA.hs(), a1 = G.test.action();
    QA.step(300);
    const a2 = G.test.action(), tired = QA.hs();
    QA.key("ShiftLeft", false); QA.key("KeyW", false); QA.step(300);
    const a3 = G.test.action();
    return { walk, run, tired, e1: a1.energy, e2: a2.energy, e3: a3.energy, sprint1: a1.sprinting, sprint2: a2.sprinting, hud: a1.hud };
  });
  check(sp.run > sp.walk * 1.8 && sp.sprint1, "Shift sprints: " + sp.walk.toFixed(1) + " m/s walking, " + sp.run.toFixed(1) + " m/s sprinting", sp);
  check(sp.e1 < 1 && sp.hud.energy >= 0 && sp.hud.energy < 1, "the energy gauge shows and drains while you sprint", sp);
  check(sp.e2 < 0.15 && !sp.sprint2 && sp.tired < sp.walk * 1.2, "an empty gauge ends the sprint (back to walking pace; it starts to fill again 0.8 s later)", sp);
  check(sp.e3 > sp.e2 + 0.3, "the gauge fills again after you stop", sp);

  /* ---- the dive roll ---- */
  const roll = await page.evaluate(() => {
    G.test.teleport(-150, 90, 14); G.P.vel.x = 6; G.P.vel.y = 0; G.P.vel.z = 0;
    let pose = "", dove = false, landed = null;
    for (let i = 0; i < 900 && !G.P.onGround; i++) { QA.step(1); const p = G.hero.info().pose; if (p === "dive") dove = true; }
    const hsLand = QA.hs();
    const poses = [];
    for (let i = 0; i < 30; i++) { QA.step(1); poses.push(G.hero.info().pose); }
    const ev = G.test.events().filter((e) => e.type === "roll");
    return { dove, hsLand, poses, roll: ev.length, after: QA.hs() };
  });
  check(roll.dove && roll.roll >= 1 && roll.poses.includes("roll"), "a dive lands in a roll", roll);
  check(roll.hsLand >= 5.5, "the roll keeps the speed along the ground (" + roll.hsLand.toFixed(1) + " m/s)", roll);
  await page.screenshot({ path: out + "/action-roll.png" });

  /* ---- punches with the real swing input ---- */
  const fight = await page.evaluate(() => {
    QA.street();
    const id = G.test.spawnGoon(-152, 0, 2, false);
    QA.step(2);
    const kinds = [];
    for (let i = 0; i < 3; i++) {
      G.test.press(0, true); QA.step(2); G.test.press(0, false); QA.step(20);
      kinds.push(G.hero.info().pose);
      const g = G.test.action().combat.list.find((q) => q.id === id);
      if (g && g.state !== "down") G.test.teleport(g.x + 1.3, 0, g.z);
    }
    const a = G.test.action();
    return { stats: a.combat.stats, g: a.combat.list.find((q) => q.id === id), ropes: G.test.state().ropes.map((r) => r.state) };
  });
  check(fight.stats.punches + fight.stats.kicks >= 3 && fight.ropes.every((s) => s === "idle"), "in reach the swing input punches instead of firing a rope", fight);
  check(fight.stats.kicks >= 1 && (!fight.g || fight.g.state === "down" || fight.g.state === "out"), "punch, punch, kick knocks the goon down", fight);
  await page.screenshot({ path: out + "/action-fight.png" });

  /* ---- a rope yanks a goon ---- */
  const pull = await page.evaluate(() => {
    QA.street();
    const id = G.test.spawnGoon(-170, 0, 2, true);
    QA.step(3);
    const tg = G.test.action().ropeTargets;
    const g = G.test.action().combat.list.find((q) => q.id === id);
    G.test.aimAt(1, g.x, g.y + 1.1, g.z); G.test.press(1, true); QA.step(40); G.test.press(1, false); G.test.aimAt(1, null); QA.step(40);
    const a = G.test.action();
    return { tg, stats: a.combat.stats, g: a.combat.list.find((q) => q.id === id), ropes: G.test.state().ropes.map((r) => r.state) };
  });
  check(pull.tg.includes("goon:" + (pull.g ? pull.g.id : -1)) || pull.stats.pulls >= 1, "a fighting goon is a rope target", pull.tg);
  check(pull.stats.pulls >= 1 && (!pull.g || pull.g.state === "down" || pull.g.state === "out"), "a rope that catches a goon yanks him off his feet", pull);

  /* ---- a knock-out ---- */
  const ko = await page.evaluate(() => {
    QA.street();
    for (let k = 0; k < 4; k++) G.test.spawnGoon(-151 - k * 0.5, 0, 2 + k * 0.7, true);
    let hp = [];
    for (let i = 0; i < 1500; i++) { QA.step(1); if (i % 60 === 0) hp.push(G.test.action().combat.hp); if (G.test.action().combat.stats.knockouts) break; }
    return { hp };
  });
  // the wake-up is a fade (promises): let it run between steps
  for (let k = 0; k < 8; k++) await page.evaluate(() => QA.step(15));
  Object.assign(ko, await page.evaluate(() => { const a = G.test.action(); return { knockouts: a.combat.stats.knockouts, hpAfter: a.combat.hp, pos: G.test.state().pos }; }));
  check(ko.knockouts >= 1 && ko.hpAfter >= 4.9, "four goons knock the hero out; the hero wakes up with full hearts", ko);
  check(Math.hypot(ko.pos.x + 150, ko.pos.z - 2) > 5, "and wakes up away from the fight (on a safe roof)", ko.pos);

  /* ---- a car: R in, W drives, R out ---- */
  const car = await page.evaluate(() => {
    QA.street(); QA.step(30);
    const c = G.test.action().cars.list.sort((a, b) => Math.hypot(a.x + 150, a.z - 2) - Math.hypot(b.x + 150, b.z - 2))[0];
    const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw); // the driver's side is the car's left
    G.test.teleport(c.x - fx * 1.6, 0, c.z - fz * 1.6); QA.step(3);
    const prompt = G.test.action().hud.prompt;
    QA.tap("KeyR");
    const a1 = G.test.action();
    QA.key("KeyW", true); QA.step(120); QA.key("KeyW", false);
    const a2 = G.test.action();
    const cam = G.test.flat();
    QA.tap("KeyR"); QA.step(10);
    const a3 = G.test.action();
    return { prompt, in: a1.driving, hidden: !G.hero.root.visible, speed: a2.cars.driving && a2.cars.driving.speed, moved: a2.cars.driving && Math.hypot(a2.cars.driving.x - c.x, a2.cars.driving.z - c.z), dist: cam.dist, out: !a3.driving, pos: G.test.state().pos, carPos: a2.cars.driving };
  });
  check(/GET IN/.test(car.prompt), "next to a parked car the prompt says R GET IN", car.prompt);
  check(car.in && car.speed > 6 && car.moved > 5, "R gets in and W drives (" + (car.speed || 0).toFixed(1) + " m/s)", car);
  check(car.out, "R gets out again", car);
  await page.screenshot({ path: out + "/action-car.png" });

  /* ---- steal a street car: STEAL, R, the driver runs, the traffic car is hidden, W drives, R out, it stays ---- */
  const st = await page.evaluate(() => {
    QA.street(); QA.step(10);
    // a street car near the hero, mid-lane (time to spare before its lane ends)
    const list = G.test.traffic(160).list.filter((t) => t.s > 40 && t.len - t.s > 80);
    const t = list[0];
    if (!t) return { none: true };
    // stand on the road 3 m to its right (the kerb side), a little ahead of where it is
    const rx = -t.fz, rz = t.fx, lead = t.speed * (4 / 60);
    G.test.teleport(t.x + t.fx * lead + rx * 3, 0, t.z + t.fz * lead + rz * 3); QA.step(3);
    const a0 = G.test.action(), tr0 = G.test.traffic(20);
    QA.tap("KeyR");
    const a1 = G.test.action(), tr1 = G.test.traffic(20), car = a1.cars.list.find((c) => c.traffic === t.i);
    const lane = G.view.traffic().lane[t.i * 4 + 1];
    const bail = G.test.street(true).people.filter((p) => p.state === "bail");
    QA.step(20);
    const shout = G.test.action().hud.shout;
    return { t, prompt: a0.hud.prompt, near: tr0.near && tr0.near.i, in: a1.driving, car, hidden: tr1.hidden, lane, bail, shout, stolen: a1.cars.stats.stolen };
  });
  check(!st.none, "a street car drives near the sidewalk of the z = 14 avenue", st);
  check(/STEAL/.test(st.prompt) && st.near === (st.t && st.t.i), "next to a street car the prompt says R STEAL", { prompt: st.prompt, near: st.near });
  check(st.in && st.car && st.stolen === 1 && Math.abs(st.car.speed) < 0.5 && st.car.paint.every((v, k) => Math.abs(v - st.t.paint[k]) < 1e-3), "R steals it: the hero is in a stopped car in the traffic car's colour", st.car);
  check(st.hidden.includes(st.t && st.t.i) && st.lane === -500, "the stolen car's traffic instance is hidden", { hidden: st.hidden, lane: st.lane });
  check(st.bail.length >= 1 && /HEY|MY CAR/.test(st.shout), "the driver jumps out and runs off shouting (" + st.shout + ")", st.bail);
  await page.evaluate(() => G.test.render());
  await page.screenshot({ path: out + "/action-steal.png" });
  const st2 = await page.evaluate(() => {
    QA.key("KeyW", true); QA.step(120); QA.key("KeyW", false);
    const a2 = G.test.action();
    QA.step(60);
    QA.tap("KeyR"); QA.step(120);
    const a3 = G.test.action(), car = a3.cars.list.find((c) => c.traffic >= 0);
    const people = G.test.street(true).people.filter((p) => p.state === "flee" || p.state === "bail");
    // back to its door: GET IN
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    G.test.teleport(car.x + fz * 1.7, 0, car.z - fx * 1.7); QA.step(3);
    const a4 = G.test.action(), tr = G.test.traffic(5);
    return { speed: a2.cars.driving && a2.cars.driving.speed, out: !a3.driving, car, prompt: a4.hud.prompt, near: tr.near, hidden: tr.hidden, people: people.map((p) => ({ state: p.state, onWalk: p.onWalk })) };
  });
  check(st2.speed > 6, "W drives the stolen car (" + (st2.speed || 0).toFixed(1) + " m/s)", st2);
  check(st2.out && st2.car && Math.abs(st2.car.speed) < 0.5 && st2.hidden.includes(st2.car.traffic), "R gets out; the stolen car stays parked and its traffic car stays hidden", st2.car);
  check(/GET IN/.test(st2.prompt) && !st2.near, "at the stolen car's door the prompt says R GET IN", st2.prompt);

  /* ---- a job from a marker ---- */
  const job = await page.evaluate(() => {
    QA.street();
    G.test.jobOffers(true); QA.step(5);
    const offers = G.test.action().jobs.offers, o = offers.find((q) => q.type === "pizza" || q.type === "balloon") || offers[0];
    G.test.teleport(o.x + 1, o.y, o.z); QA.step(10);
    const a = G.test.action();
    G.test.render();
    return { offers, o, active: a.jobs.active, card: G.game.progress.objective, goal: G.game.progress.goal, markers: a.view.markers, state: G.state, on: a.on, driving: a.driving, pos: G.test.state().pos, stats: a.jobs.stats, ev: G.jobs.events.length };
  });
  check(job.offers.length >= 3, "job markers wait round the city once Mission 1 is done (" + job.offers.map((o) => o.type) + ")", job.offers);
  check(job.active && job.active.type === job.o.type && job.card && job.goal, "walking into a marker starts its job, with its card and a compass goal", job);
  await page.screenshot({ path: out + "/action-job.png" });

  /* ---- the map: a pin on each job marker, and travel to one takes its job ---- */
  const mp = await page.evaluate(() => {
    const before = { state: G.state, ui: G.ui.paused, ids: G.jobs.offers.map((o) => o.id), active: !!G.jobs.active };
    G.jobs.cancel(); QA.street(); QA.step(5);
    const after = { state: G.state, ui: G.ui.paused, ids: G.jobs.offers.map((o) => o.id), on: G.jobs.offersOn, cs: G.test.cutscene && G.test.cutscene() };
    G.ui.openMap(); G.test.step(1 / 60, 4);
    return { before, after, offers: G.test.action().jobs.offers, list: [...document.querySelectorAll("#fsMap button[data-id]")].map((b) => ({ id: b.dataset.id, text: b.textContent })), key: document.querySelector("#fsMap .fs-key").textContent };
  });
  const jobBtns = mp.list.filter((b) => b.id.startsWith("pin:job:"));
  check(mp.offers.length >= 3 && jobBtns.length === mp.offers.length && /odd job/i.test(mp.key), "the map has a pin and a list entry for each job marker (" + jobBtns.map((b) => b.text) + ")", mp);
  await page.screenshot({ path: out + "/action-map.png" });
  const pick = jobBtns[0], want = mp.offers.find((o) => pick && pick.id === "pin:job:" + o.id);
  if (pick) await page.click("#fsMap button[data-id='" + pick.id + "']");
  for (let i = 0; i < 12; i++) await page.evaluate(() => QA.step(8));
  const tv = await page.evaluate(() => ({ state: G.state, active: G.test.action().jobs.active, pos: G.test.state().pos }));
  check(!!want && tv.state === "play" && tv.active && tv.active.type === want.type, "a click on a job pin travels there and takes the job", { want, tv, before: mp.before, after: mp.after });
  const now = await page.evaluate(() => {
    QA.step(5);
    G.ui.openMap(); G.test.step(1 / 60, 2);
    const names = G.test.ui().map.names;
    G.ui.closePause(); G.test.step(1 / 60, 2);
    return { names };
  });
  check(now.names.some((n) => /^Your job/.test(n)) && !now.names.some((n) => /^Odd job/.test(n)), "while you are on a job the map pins that job, and no other markers", now.names);

  check(page.errors.length === 0, "no errors in flat play", page.errors);
  await page.context().close();
} catch (e) { check(false, "the flat-play run threw", e.stack || String(e)); }

/* ---- a first run: the King's comic, then the cottage room, then Mission 1 ---- */
try {
  const page = await newPage({ width: 960, height: 540 });
  await page.addInitScript(quiet);
  await open(page, "?nosw&cut");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 30); });
  const first = await page.evaluate(() => ({ state: G.state, cs: G.test.cutscene(), portal: G.test.portal().phase }));
  check(first.cs.playing && first.cs.name === "opening" && first.state === "cutscene", "a first run opens with the King's comic before the cottage room", first);
  const after = await page.evaluate(() => { for (let i = 0; i < 40 && G.test.cutscene().playing; i++) G.test.step(1 / 60, 60); return { state: G.state, cs: G.test.cutscene() }; });
  check(!after.cs.playing && after.state === "intro", "after the comic the cottage room starts", after);
  const m1 = await page.evaluate(() => { G.test.skipIntro(); G.test.step(1 / 60, 120); return { state: G.state, job: G.test.action().jobs.active, card: G.game.progress.objective }; });
  check(m1.state === "play" && m1.job && m1.job.type === "sludge" && /SLUDGE RUN/.test(m1.card && m1.card.title), "after the hand-off Mission 1, the Sludge Run, starts at once", m1);
  check(page.errors.length === 0, "no errors in the first run", page.errors);
  await page.context().close();
} catch (e) { check(false, "the first-run check threw", e.stack || String(e)); }

await close();
done();
