// After a pipe is off, the King stomps the deck between throws. On the ground it costs a heart. In the air it does not.
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
    return { threw, afterThrow, kind, wind, detail, dom, ripped: G.game.info().pipes[0].ripped, alt: G.game.info().king.alt };
  });
  await page.screenshot({ path: out + "/stomp.png" });
  check(stomp.ripped && stomp.afterThrow > stomp.threw && stomp.kind === "stomp" && /stomping/i.test(stomp.detail) && stomp.dom === stomp.detail, "the attack after that throw is a stomp, and the card says so", stomp);

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

  check(!page.errors.length, "no page errors", page.errors);
} finally {
  await close();
}
done();
