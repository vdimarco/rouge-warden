// After a pipe is off, the King throws, then stomps the deck, then pulls, then belches on a spot, then sweeps a lane. A stomp costs a heart on the ground and none in the air. A pull drags an airborne hero with no rope, and costs a heart inside 16 m. A rope or the ground holds. A belch costs a heart only when you are still standing on the spot. A sweep costs a heart in that lane, on the ground or in the air. A step outside the lane does not.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("kingstomp");
watchdog(420000, "kingstomp");
const out = process.env.SHOTS || "/tmp/swing-kingstomp";
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
  const openThrow = await page.evaluate(() => {
    G.renderer.setAnimationLoop(null);
    G.test.hold(true);
    G.test.step(1 / 60, 20);
    G.game.skipTutorial();
    G.test.step(1 / 60, 8);
    G.test.wakeKing();
    const m = G.game.info().king.mouth;
    G.test.teleport(m[0], m[1] - 8, m[2] - 38);
    G.P.frozen = true;
    G.P.onGround = true;
    G.game.kingReady();
    let kind = "", wind = 0;
    for (let i = 0; i < 8; i++) {
      G.test.step(1 / 60, 1);
      const k = G.game.info().king;
      kind = k.kind; wind = k.windT;
      if (wind > 0) break;
    }
    const ob = G.game.progress.objective;
    return { kind, wind, stomps: G.game.info().king.stomps, detail: ob && ob.detail, ripped: G.game.info().pipes.some((p) => p.ripped) };
  });
  check(openThrow.kind === "throw" && openThrow.wind > 0 && openThrow.stomps === 0 && !openThrow.ripped && !/stomping/i.test(openThrow.detail || ""), "with every pipe on, he winds up a throw", openThrow);

  const stomp = await page.evaluate(() => {
    G.test.step(1 / 60, 70);
    const threw = G.game.info().king.throws;
    G.game.ripPipe(0);
    G.game.kingReady();
    G.test.step(1 / 60, 70);
    const afterThrow = G.game.info().king.throws;
    G.game.kingReady();
    let kind = "", wind = 0, detail = "", dom = "";
    for (let i = 0; i < 10; i++) {
      G.test.step(1 / 60, 1);
      const k = G.game.info().king;
      kind = k.kind; wind = k.windT;
      const ob = G.game.progress.objective;
      detail = ob ? ob.detail : "";
      const sm = document.querySelector(".fs-mission small");
      dom = sm ? sm.textContent : "";
      if (kind === "stomp" && wind > 0 && /stomping/i.test(detail) && /stomping/i.test(dom)) break;
    }
    G.test.render(0);
    return { threw, afterThrow, kind, wind, detail, dom, ripped: G.game.info().pipes[0].ripped, turn: G.game.info().king.turn };
  });
  await page.screenshot({ path: out + "/stomp.png" });
  check(stomp.ripped && stomp.afterThrow > stomp.threw && stomp.kind === "stomp" && /stomping/i.test(stomp.detail) && stomp.dom === stomp.detail, "the attack after that throw is a stomp, and the card says so", stomp);

  const pull = await page.evaluate(() => {
    G.test.step(1 / 60, 70);
    const stomps = G.game.info().king.stomps;
    G.game.kingReady();
    let kind = "", wind = 0, detail = "", dom = "";
    for (let i = 0; i < 10; i++) {
      G.test.step(1 / 60, 1);
      const k = G.game.info().king;
      kind = k.kind; wind = k.windT;
      const ob = G.game.progress.objective;
      detail = ob ? ob.detail : "";
      const sm = document.querySelector(".fs-mission small");
      dom = sm ? sm.textContent : "";
      if (kind === "pull" && wind > 0 && /pulling/i.test(detail) && /web/i.test(dom)) break;
    }
    G.test.render(0);
    return { stomps, kind, wind, detail, dom, turn: G.game.info().king.turn };
  });
  await page.screenshot({ path: out + "/pull.png" });
  check(pull.stomps > 0 && pull.kind === "pull" && /pulling/i.test(pull.detail) && /web/i.test(pull.detail) && pull.dom === pull.detail, "the attack after that stomp is a pull, and the card says to shoot a web", pull);

  const belch = await page.evaluate(() => {
    G.test.step(1 / 60, 70);
    const pulls = G.game.info().king.pulls;
    G.game.kingReady();
    let kind = "", wind = 0, detail = "", dom = "", mark = null;
    for (let i = 0; i < 10; i++) {
      G.test.step(1 / 60, 1);
      const k = G.game.info().king;
      kind = k.kind; wind = k.windT; mark = k.mark;
      const ob = G.game.progress.objective;
      detail = ob ? ob.detail : "";
      const sm = document.querySelector(".fs-mission small");
      dom = sm ? sm.textContent : "";
      if (kind === "belch" && wind > 0 && /belching/i.test(detail) && /spot/i.test(dom)) break;
    }
    G.test.render(0);
    return { pulls, kind, wind, detail, dom, mark, turn: G.game.info().king.turn };
  });
  await page.screenshot({ path: out + "/belch.png" });
  check(belch.pulls > 0 && belch.kind === "belch" && belch.mark && /belching/i.test(belch.detail) && /spot/i.test(belch.detail) && belch.dom === belch.detail, "the attack after that pull is a belch, and the card says to leave the spot", belch);

  const sweep = await page.evaluate(() => {
    G.game.progress.hearts = 3;
    G.test.step(1 / 60, 70);
    const belches = G.game.info().king.belches;
    G.game.kingReady();
    let kind = "", wind = 0, detail = "", dom = "", lane = null;
    for (let i = 0; i < 10; i++) {
      G.test.step(1 / 60, 1);
      const k = G.game.info().king;
      kind = k.kind; wind = k.windT; lane = k.lane;
      const ob = G.game.progress.objective;
      detail = ob ? ob.detail : "";
      const sm = document.querySelector(".fs-mission small");
      dom = sm ? sm.textContent : "";
      if (kind === "sweep" && wind > 0 && /sweeping/i.test(detail) && /aside/i.test(dom)) break;
    }
    G.test.render(0);
    return { belches, kind, wind, detail, dom, lane, turn: G.game.info().king.turn };
  });
  await page.screenshot({ path: out + "/sweep.png" });
  check(sweep.belches > 0 && sweep.kind === "sweep" && sweep.lane != null && /sweeping/i.test(sweep.detail) && /aside/i.test(sweep.detail) && sweep.dom === sweep.detail, "the attack after that belch is a sweep, and the card says to step aside", sweep);

  const ground = await page.evaluate(() => {
    const m = G.game.info().king.mouth, d = G.game.info().deck;
    G.test.teleport(m[0], d.y, m[2]);
    G.P.frozen = true;
    G.P.onGround = true;
    const before = G.game.progress.hearts;
    const stomps = G.game.info().king.stomps;
    G.game.kingWind("stomp");
    G.test.step(1 / 60, 70);
    const k = G.game.info().king;
    return { before, hearts: G.game.progress.hearts, stomps: k.stomps, was: stomps, dist: Math.hypot(G.P.pos.x - m[0], G.P.pos.z - m[2]) };
  });
  check(ground.dist < 2 && ground.stomps > ground.was && ground.hearts === ground.before - 1, "a stomp on the deck takes a heart", ground);

  const air = await page.evaluate(() => {
    const m = G.game.info().king.mouth, d = G.game.info().deck;
    G.test.teleport(m[0], d.y + 8, m[2]);
    G.P.frozen = true;
    G.P.onGround = false;
    const before = G.game.progress.hearts;
    G.game.kingWind("stomp");
    G.test.step(1 / 60, 70);
    return { before, hearts: G.game.progress.hearts, air: !G.P.onGround, stomps: G.game.info().king.stomps };
  });
  check(air.air && air.hearts === air.before && air.stomps > ground.stomps, "the same stomp in the air takes no heart", air);

  const yanked = await page.evaluate(() => {
    const m = G.game.info().king.perch, d = G.game.info().deck;
    const place = (x, y, ground, rope) => {
      G.test.teleport(m[0] + x, y, m[2]);
      G.P.frozen = true;
      G.P.onGround = ground;
      if (rope) {
        const r = G.P.ropes[0];
        // sticky so the wind-up does not drop a web nobody is holding; a held web stays the same way
        r.state = "attached";
        r.sticky = true;
        r.target = { tag: "building", id: 1 };
        r.anchor.x = G.P.pos.x; r.anchor.y = G.P.pos.y + 40; r.anchor.z = G.P.pos.z;
      }
    };
    const release = () => {
      const before = { hearts: G.game.progress.hearts, x: G.P.pos.x, z: G.P.pos.z, pulls: G.game.info().king.pulls };
      G.game.kingWind("pull");
      G.test.step(1 / 60, 70);
      const pos = G.P.pos;
      return {
        before: before.hearts, hearts: G.game.progress.hearts,
        pulls: G.game.info().king.pulls, was: before.pulls,
        moved: Math.hypot(pos.x - before.x, pos.z - before.z),
        from: Math.hypot(before.x - m[0], before.z - m[2]),
        dist: Math.hypot(pos.x - m[0], pos.z - m[2]),
        rope: G.P.ropes[0].state, ground: G.P.onGround,
        wall: G.P.wall, run: G.P.wallRun,
      };
    };
    place(20, d.y + 12, false, false);
    const close = release();
    place(40, d.y + 12, false, false);
    const far = release();
    place(8, d.y, true, false);
    const decked = release();
    place(8, d.y + 12, false, true);
    const held = release();
    place(20, d.y + 12, false, false);
    G.P.wall = { nx: 1, nz: 0 };
    G.P.wallRun = { dir: 1, speed: 6 };
    G.game.progress.hearts = 3;
    const clung = release();
    return { close, far, decked, held, clung };
  });
  check(yanked.close.pulls > yanked.close.was && yanked.close.moved > 13 && yanked.close.moved < 15 && yanked.close.dist < yanked.close.from && yanked.close.dist <= 16 && yanked.close.hearts === yanked.close.before - 1, "a pull in the air with no web drags you in and takes a heart inside 16 m", yanked.close);
  check(yanked.far.pulls > yanked.far.was && yanked.far.moved > 13 && yanked.far.moved < 15 && yanked.far.dist > 16 && yanked.far.hearts === yanked.far.before, "the same pull from farther away still drags you, and takes no heart past 16 m", yanked.far);
  check(yanked.decked.ground && yanked.decked.moved < 0.05 && yanked.decked.hearts === yanked.decked.before, "a pull on the ground leaves you where you are", yanked.decked);
  check(yanked.held.rope === "attached" && yanked.held.moved < 0.05 && yanked.held.hearts === yanked.held.before, "a rope holds against the pull", yanked.held);
  check(yanked.clung.pulls > yanked.clung.was && yanked.clung.moved > 13 && yanked.clung.moved < 15 && yanked.clung.wall == null && yanked.clung.run == null && yanked.clung.hearts === yanked.clung.before - 1, "a pull lets go of a wall and still drags you in", yanked.clung);

  const spat = await page.evaluate(() => {
    const d = G.game.info().deck;
    G.game.progress.hearts = 3;
    const stand = (x, y, ground) => {
      G.test.teleport(x, y, d.z);
      G.P.frozen = true;
      G.P.onGround = ground;
      G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
    };
    const release = () => {
      const before = { hearts: G.game.progress.hearts, x: G.P.pos.x, z: G.P.pos.z, belches: G.game.info().king.belches };
      const mark = G.game.info().king.mark;
      G.test.step(1 / 60, 70);
      return {
        before: before.hearts, hearts: G.game.progress.hearts,
        belches: G.game.info().king.belches, was: before.belches,
        moved: Math.hypot(G.P.pos.x - before.x, G.P.pos.z - before.z),
        dist: mark ? Math.hypot(G.P.pos.x - mark[0], G.P.pos.z - mark[1]) : null,
        ground: G.P.onGround,
      };
    };
    stand(d.x, d.y, true);
    G.game.kingWind("belch");
    const hit = release();
    stand(d.x, d.y, true);
    G.game.kingWind("belch");
    G.test.teleport(d.x + 12, d.y, d.z);
    G.P.frozen = true;
    G.P.onGround = true;
    const clear = release();
    stand(d.x, d.y + 10, false);
    G.game.kingWind("belch");
    const air = release();
    return { hit, clear, air };
  });
  check(spat.hit.ground && spat.hit.dist <= 8 && spat.hit.belches > spat.hit.was && spat.hit.hearts === spat.hit.before - 1, "a belch on the marked spot takes a heart", spat.hit);
  check(spat.clear.ground && spat.clear.dist > 8 && spat.clear.belches > spat.clear.was && spat.clear.hearts === spat.clear.before, "leaving the spot keeps the heart", spat.clear);
  check(!spat.air.ground && spat.air.dist <= 8 && spat.air.belches > spat.air.was && spat.air.hearts === spat.air.before, "the same belch in the air takes no heart", spat.air);

  const lane = await page.evaluate(() => {
    const p = G.game.info().king.perch, d = G.game.info().deck;
    G.game.progress.hearts = 3;
    const stand = (x, z, y, ground) => {
      G.test.teleport(x, y, z);
      G.P.frozen = true;
      G.P.onGround = ground;
      G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
    };
    const release = () => {
      const before = { hearts: G.game.progress.hearts, x: G.P.pos.x, z: G.P.pos.z, sweeps: G.game.info().king.sweeps };
      const heading = G.game.info().king.lane;
      G.test.step(1 / 60, 70);
      const dx = G.P.pos.x - p[0], dz = G.P.pos.z - p[2];
      let ang = Math.atan2(dz, dx) - (heading == null ? 0 : heading);
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      return {
        before: before.hearts, hearts: G.game.progress.hearts,
        sweeps: G.game.info().king.sweeps, was: before.sweeps,
        moved: Math.hypot(G.P.pos.x - before.x, G.P.pos.z - before.z),
        dist: Math.hypot(dx, dz), ang, ground: G.P.onGround,
      };
    };
    stand(p[0] + 20, p[2], d.y, true);
    G.game.kingWind("sweep");
    const hit = release();
    stand(p[0] + 20, p[2], d.y, true);
    G.game.kingWind("sweep");
    stand(p[0] + 20, p[2] + 14, d.y, true);
    const aside = release();
    stand(p[0] + 20, p[2], d.y, true);
    G.game.kingWind("sweep");
    stand(p[0] + 50, p[2], d.y, true);
    const far = release();
    stand(p[0] + 20, p[2], d.y + 10, false);
    G.game.kingWind("sweep");
    const air = release();
    return { hit, aside, far, air };
  });
  check(lane.hit.ground && lane.hit.dist <= 36 && Math.abs(lane.hit.ang) <= 0.45 && lane.hit.sweeps > lane.hit.was && lane.hit.moved < 0.05 && lane.hit.hearts === lane.hit.before - 1, "a sweep in the lane takes a heart", lane.hit);
  check(lane.aside.ground && lane.aside.dist <= 36 && Math.abs(lane.aside.ang) > 0.45 && lane.aside.sweeps > lane.aside.was && lane.aside.hearts === lane.aside.before, "a step out of the lane keeps the heart", lane.aside);
  check(lane.far.ground && lane.far.dist > 36 && lane.far.sweeps > lane.far.was && lane.far.hearts === lane.far.before, "the same heading past his reach keeps the heart", lane.far);
  check(!lane.air.ground && lane.air.dist <= 36 && Math.abs(lane.air.ang) <= 0.45 && lane.air.sweeps > lane.air.was && lane.air.hearts === lane.air.before - 1, "a jump in the lane still takes a heart", lane.air);

  check(!page.errors.length, "no page errors", page.errors);
} finally {
  await close();
}
done();
