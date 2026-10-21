// The second flush is a rescue, the fourth a balloon, the fifth a chase, the sixth a pizza, the seventh a mugging,
// the eighth a washer, the ninth a getaway car, the tenth a brawl, and the clog card comes back after each.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("clogbeat");
watchdog(420000, "clogbeat");
const out = process.env.SHOTS || "/tmp/swing-clogbeat";
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
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); G.game.skipTutorial(); G.test.step(1 / 60, 10); });

  const one = await page.evaluate(() => {
    const ids = G.game.targets().filter((t) => t.kind === "clog" && !t.done).map((t) => t.id);
    G.test.clearClog(ids[0]);
    let n = 0;
    for (; n < 80; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.n === 1 && /FLUSH THE CLOGS/.test(ob.title || "") && !G.test.action().jobs.active) break;
    }
    const ob = G.game.progress.objective;
    return { n, title: ob && ob.title, count: ob && ob.n, of: ob && ob.of, job: G.test.action().jobs.active && G.test.action().jobs.active.type, left: ids.length };
  });
  check(one.left >= 8 && !one.job && one.title === "FLUSH THE CLOGS" && one.count === 1 && one.of === 12, "one flush is still the clog card", one);

  const edge = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "catch" && ob && /OVER THE EDGE/.test(ob.title || "") && /CATCH/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type, king: G.game.progress.king };
  });
  await page.screenshot({ path: out + "/edge.png" });
  check(edge.job === "catch" && /OVER THE EDGE/.test(edge.title || "") && /CATCH/.test(edge.title || "") && !/FLUSH THE CLOGS/.test((edge.title || "") + " " + (edge.detail || "")) && edge.king !== "awake", "the second flush is a falling rescue, and the King still sleeps", edge);

  const afterEdge = await page.evaluate(() => {
    const killed = G.test.finishJob();
    G.P.onGround = true;
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (!job && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 2) break;
    }
    const ob = G.game.progress.objective;
    return { n, killed, title: ob && ob.title, count: ob && ob.n, job: G.test.action().jobs.active && G.test.action().jobs.active.type };
  });
  check(afterEdge.killed && !afterEdge.job && afterEdge.title === "FLUSH THE CLOGS" && afterEdge.count === 2, "after the rescue the clog card returns", afterEdge);

  const early = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 80; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.n === 3 && /FLUSH THE CLOGS/.test(ob.title || "") && !G.test.action().jobs.active) break;
    }
    const ob = G.game.progress.objective;
    return { n, title: ob && ob.title, count: ob && ob.n, of: ob && ob.of, job: G.test.action().jobs.active && G.test.action().jobs.active.type };
  });
  check(!early.job && early.title === "FLUSH THE CLOGS" && early.count === 3 && early.of === 12, "three flushes are still the clog card", early);

  const air = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "balloon" && ob && /BALLOON/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type };
  });
  await page.screenshot({ path: out + "/balloon.png" });
  check(air.job === "balloon" && /UP FOR AIR/.test(air.title || "") && /BALLOON/.test(air.title || "") && !/FLUSH THE CLOGS/.test((air.title || "") + " " + (air.detail || "")), "the fourth flush is a balloon, not another clog", air);

  const back = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (!job && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 4) break;
    }
    const ob = G.game.progress.objective;
    return { n, killed, title: ob && ob.title, count: ob && ob.n, job: G.test.action().jobs.active && G.test.action().jobs.active.type };
  });
  check(back.killed && !back.job && back.title === "FLUSH THE CLOGS" && back.count === 4, "after the balloon the clog card returns", back);

  const purse = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "thief" && ob && /PURSE RUN/.test(ob.title || "") && /THIEF/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type, king: G.game.progress.king };
  });
  check(purse.job === "thief" && /PURSE RUN/.test(purse.title || "") && /THIEF/.test(purse.title || "") && !/FLUSH THE CLOGS/.test((purse.title || "") + " " + (purse.detail || "")) && purse.king !== "awake", "the fifth flush is a chase, and the King still sleeps", purse);

  const afterPurse = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (!job && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 5) break;
    }
    const ob = G.game.progress.objective;
    return { n, killed, title: ob && ob.title, count: ob && ob.n, job: G.test.action().jobs.active && G.test.action().jobs.active.type };
  });
  check(afterPurse.killed && !afterPurse.job && afterPurse.title === "FLUSH THE CLOGS" && afterPurse.count === 5, "after the chase the clog card returns", afterPurse);

  const pie = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "pizza" && ob && /HOT PIE/.test(ob.title || "") && /PIZZA/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type };
  });
  await page.screenshot({ path: out + "/pie.png" });
  check(pie.job === "pizza" && /HOT PIE/.test(pie.title || "") && /PIZZA/.test(pie.title || "") && /Deliver to the roof/.test(pie.detail || "") && !/FLUSH THE CLOGS/.test((pie.title || "") + " " + (pie.detail || "")), "the sixth flush is a pizza, not another clog", pie);

  const afterPie = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (!job && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 6) break;
    }
    const ob = G.game.progress.objective;
    return { n, killed, title: ob && ob.title, count: ob && ob.n, job: G.test.action().jobs.active && G.test.action().jobs.active.type };
  });
  check(afterPie.killed && !afterPie.job && afterPie.title === "FLUSH THE CLOGS" && afterPie.count === 6, "after the pizza the clog card returns", afterPie);

  const alley = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "mugging" && ob && /THE ALLEY/.test(ob.title || "") && /MUGGING/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type, king: G.game.progress.king };
  });
  await page.screenshot({ path: out + "/alley.png" });
  check(alley.job === "mugging" && /THE ALLEY/.test(alley.title || "") && /MUGGING/.test(alley.title || "") && /goons left/.test(alley.detail || "") && !/FLUSH THE CLOGS/.test((alley.title || "") + " " + (alley.detail || "")) && alley.king !== "awake", "the seventh flush is a mugging, and the King still sleeps", alley);

  const afterAlley = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (!job && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 7) break;
    }
    const ob = G.game.progress.objective;
    return { n, killed, title: ob && ob.title, count: ob && ob.n, job: G.test.action().jobs.active && G.test.action().jobs.active.type };
  });
  check(afterAlley.killed && !afterAlley.job && afterAlley.title === "FLUSH THE CLOGS" && afterAlley.count === 7, "after the alley the clog card returns", afterAlley);

  const down = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "washer" && ob && /WASHER|GET HIM DOWN/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type, timer: job && job.timer };
  });
  await page.screenshot({ path: out + "/washer.png" });
  check(down.job === "washer" && /GET HIM DOWN/.test(down.title || "") && /WASHER/.test(down.title || "") && !/FLUSH THE CLOGS|BALLOON/.test((down.title || "") + " " + (down.detail || "")), "the eighth flush is a carry down, not the balloon", down);
  check(down.timer <= 36 && down.timer > 34 && /3[4-6] s/.test(down.title || "") && !/60 s/.test(down.title || ""), "the eighth flush counts from 36 s, not a minute", down);

  const nine = await page.evaluate(() => {
    G.test.finishJob();
    // The carry ends on the street. The test hero is still up on a roof, so stand where the ground is the street.
    const S = G.city.start;
    let spot = null;
    for (let z = S.z - 90; z <= S.z + 90 && !spot; z += 6) {
      for (let x = S.x - 90; x <= S.x + 90; x += 6) {
        const g = G.city.groundY(x, z);
        const tb = G.city.topBelow(x, 80, z, 0.4);
        if (g < 1 && (!tb || tb.y < 1) && !G.city.isWater(x, z)) { spot = { x, y: g + 0.05, z }; break; }
      }
    }
    if (spot) { G.test.teleport(spot.x, spot.y, spot.z); G.P.onGround = true; }
    let back = 0;
    for (; back < 240; back++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (!G.test.action().jobs.active && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 8) break;
    }
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "getaway" && ob && /STOP THAT CAR/.test(ob.title || "") && /GETAWAY/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { back, n, spot: !!spot, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type, king: G.game.progress.king };
  });
  await page.screenshot({ path: out + "/car.png" });
  check(nine.job === "getaway" && /STOP THAT CAR/.test(nine.title || "") && /GETAWAY/.test(nine.title || "") && /Rope the car/.test(nine.detail || "") && !/FLUSH THE CLOGS/.test((nine.title || "") + " " + (nine.detail || "")) && nine.king !== "awake", "the ninth flush is a getaway car, and the King still sleeps", nine);

  const roof = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let back = 0, returned = "";
    for (; back < 240; back++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (!G.test.action().jobs.active && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 9) { returned = ob.title; break; }
    }
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "brawl" && ob && /ROOF CREW/.test(ob.title || "") && /BRAWL/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { killed, back, returned, n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type, king: G.game.progress.king };
  });
  await page.screenshot({ path: out + "/roof.png" });
  check(roof.killed && /FLUSH THE CLOGS/.test(roof.returned || ""), "stopping the car brings the clog card back at 9/12", roof);
  check(roof.job === "brawl" && /ROOF CREW/.test(roof.title || "") && /BRAWL/.test(roof.title || "") && /Wave 1/.test(roof.detail || "") && !/FLUSH THE CLOGS/.test((roof.title || "") + " " + (roof.detail || "")) && roof.king !== "awake", "the tenth flush is a roof fight, and the King still sleeps", roof);

  const eleven = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let back = 0;
    for (; back < 240; back++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (!G.test.action().jobs.active && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 10) break;
    }
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 80; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.n === 11 && /FLUSH THE CLOGS/.test(ob.title || "") && !G.test.action().jobs.active) break;
    }
    const ob = G.game.progress.objective;
    return { killed, back, n, title: ob && ob.title, count: ob && ob.n, job: G.test.action().jobs.active && G.test.action().jobs.active.type, king: G.game.progress.king };
  });
  check(eleven.killed && eleven.title === "FLUSH THE CLOGS" && eleven.count === 11 && !eleven.job && eleven.king !== "awake", "eleven flushes are the clog card, and the King still sleeps", eleven);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
