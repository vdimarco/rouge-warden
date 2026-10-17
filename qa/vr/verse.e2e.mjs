// The Spider-Verse look and feel of flat play, in the browser: the hero poses on twos (12 poses a second) and on ones with a full
// focus meter; the Verse pass draws (the colour plates slip off register away from the hero); a landed blow stops the world for a
// moment and shakes the camera; the third blow flashes an impact frame, at most two a second, and never with Comic motion on
// Calm; a wind-up near the hero shows the spider-sense; the zip strike carries a combo to the next goon; the camera banks in a
// swing. From the build guide: the gang on threes, squash and stretch, multiples, a kick that doubles the plates and snaps the
// view in, a finisher word a third of the view wide, and wall words that stay. Run from the repo root (the server starts itself): NODE_PATH=/opt/node22/lib/node_modules node qa/vr/verse.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("verse");
watchdog(1500000, "verse");
const out = SHOTS || "/tmp/swing-qa";
await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };
const SETUP = () => {
  window.QA = {
    step(n = 1) { G.test.step(1 / 60, n); },
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code })); },
    tap(code) { QA.key(code, true); QA.step(1); QA.key(code, false); QA.step(1); },
    street() { G.test.teleport(-150, 0, 2); G.rigYaw = Math.PI / 2; G.desktop.level(0); G.flatcam.reset(Math.PI / 2); QA.step(5); },
    // draw n frames, dt real seconds apart (what fades in real time fades)
    draw(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) G.test.render(dt); },
    clear() { for (const g of G.combat.goons) g.on = false; G.combat.update(0, null); G.combat.focus = 0; G.combat.hits = 0; G.combat.hitsT = 9; G.combat.cool = 0; G.combat.heal(); },
    punch() { G.test.press(0, true); QA.step(2); G.test.press(0, false); QA.step(1); },
    // the canvas after one real draw, shrunk to w x h, as RGBA bytes (read in the same task as the draw)
    grab(w = 192, h = 108) {
      G.test.render();
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"); x.drawImage(G.renderer.domElement, 0, 0, w, h);
      return Array.from(x.getImageData(0, 0, w, h).data);
    },
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

  /* ---- the hero on twos, and on ones with a full meter ---- */
  const twos = await page.evaluate(() => {
    QA.clear(); QA.street();
    // the hand's place on the body changes only when a new pose is drawn; walk for 60 frames and count the poses
    const count = () => {
      let n = 0, last = "";
      QA.key("KeyW", true);
      for (let i = 0; i < 60; i++) {
        QA.step(1);
        const h = G.hero.info(), p = G.P.pos, k = h.hands[1].map((v, j) => (v - [p.x, p.y, p.z][j]).toFixed(4)).join();
        if (k !== last) { n++; last = k; }
      }
      QA.key("KeyW", false); QA.step(20);
      return n;
    };
    const on2 = count(), mode = G.test.action().verse.twos;
    G.combat.focus = 1;
    const on1 = count(), mode1 = G.test.action().verse.twos;
    G.combat.focus = 0;
    return { on2, on1, mode, mode1 };
  });
  check(twos.mode === 12 && twos.on2 >= 8 && twos.on2 <= 14, "on twos, the hero takes about 12 poses a second (" + twos.on2 + " in 1 s)", twos);
  check(twos.mode1 === 0 && twos.on1 >= 40, "a full focus meter puts the hero on ones (" + twos.on1 + " poses in 1 s)", twos);

  /* ---- the Verse pass draws, and the plates slip ---- */
  const pass = await page.evaluate(() => {
    QA.clear(); QA.street(); QA.step(5);
    const on = QA.grab(), info = G.test.bloom();
    G.test.settings({ verse: "off" });
    const off = QA.grab(), infoOff = G.test.bloom();
    G.test.settings({ verse: "full" });
    // the share of pixels that differ by more than 24 in some channel, and the red-blue split (where the plates slipped)
    let diff = 0, split = 0;
    for (let i = 0; i < on.length; i += 4) {
      const d = Math.max(Math.abs(on[i] - off[i]), Math.abs(on[i + 1] - off[i + 1]), Math.abs(on[i + 2] - off[i + 2]));
      if (d > 24) diff++;
      if (Math.abs(on[i] - off[i]) > 12 && Math.abs(on[i + 2] - off[i + 2]) > 12 && Math.abs(on[i + 1] - off[i + 1]) < 8) split++;
    }
    return { verse: info.verse, verseOff: infoOff.verse, diff: diff / (on.length / 4), split: split / (on.length / 4) };
  });
  check(pass.verse === true && pass.verseOff === false, "Comic motion Full runs the Verse pass, Off does not", pass);
  check(pass.diff > 0.005 && pass.diff < 0.4, "the plates change the image at the edges only (" + (pass.diff * 100).toFixed(1) + "% of pixels)", pass);
  check(pass.split > 0.001, "where they differ, red and blue move and green stays (" + (pass.split * 100).toFixed(2) + "%)", pass);
  await page.evaluate(() => G.test.render());
  await page.screenshot({ path: out + "/verse-street.png" });

  /* ---- a blow: hit-stop and shake; the third blow: an impact frame ---- */
  const blow = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.test.spawnGoon(-151.4, 0, 2, true);
    for (const g of G.combat.goons) { g.hp = 20; g.cool = 9; }
    QA.step(40); QA.draw(12, 0.1);
    const f0 = G.frame;
    QA.punch();
    const a1 = G.test.action();
    QA.step(16); QA.punch(); QA.step(16);
    QA.punch();
    const a3 = G.test.action();
    G.test.render();
    const ev = G.test.events().filter((e) => e.type === "impact" && e.frame > f0).sort((a, b) => a.frame - b.frame);
    return { stop1: a1.hitStop, trauma1: a1.verse.cam.trauma, stop3: a3.hitStop, frame3: a3.verse.impact, ev: ev.map((e) => e.flash) };
  });
  check(blow.stop1 > 0.03 && blow.stop1 < 0.1, "a punch stops the world for " + Math.round(blow.stop1 * 1000) + " ms", blow);
  check(blow.trauma1 > 0.1, "a punch shakes the camera", blow);
  check(blow.stop3 > blow.stop1 && blow.frame3 > 0 && blow.ev.length === 3 && blow.ev[2] === true, "the third blow (the kick) stops longer and flashes an impact frame", blow);
  await page.screenshot({ path: out + "/verse-impact.png" });
  const gap = await page.evaluate(() => {
    // a second kick 0.2 s after the first: it stops the world, but flashes no frame (at most two flashes a second)
    QA.draw(6);
    const faded = G.test.action().verse.impact;
    QA.step(9);
    G.combat.combo = 1; G.combat.comboT = 0; G.combat.cool = 0;
    for (const g of G.combat.goons) if (g.on) { g.x = -151.4; g.z = 2; g.state = "idle"; g.cool = 9; } // the kick pushed him off
    QA.punch();
    const k = G.test.events().filter((e) => e.type === "impact").sort((a, b) => a.frame - b.frame).slice(-1)[0]; // (the ring wraps)
    return { faded, frame: G.test.action().verse.impact, kick: k, kicks: G.combat.stats.kicks };
  });
  check(gap.faded === 0, "the impact frame lasts under 0.1 s", gap);
  check(gap.kicks === 2 && gap.kick && gap.kick.stop >= 0.08 && gap.kick.flash === false && gap.frame === 0, "a second kick within 0.5 s flashes no new frame", gap);
  const calm = await page.evaluate(() => {
    G.test.settings({ verse: "calm" });
    QA.clear(); QA.street();
    G.test.spawnGoon(-151.4, 0, 2, true);
    for (const g of G.combat.goons) { g.hp = 20; g.cool = 9; }
    QA.step(40); QA.draw(12, 0.1);
    for (let i = 0; i < 3; i++) { QA.punch(); QA.step(16); }
    G.test.render();
    const a = G.test.action();
    G.test.settings({ verse: "full" });
    return { impact: a.verse.impact, trauma: a.verse.cam.trauma, stop: G.combat.stats.kicks };
  });
  check(calm.impact === 0 && calm.trauma === 0, "Comic motion Calm: no impact frame and no shake", calm);

  /* ---- the spider-sense ---- */
  const sense = await page.evaluate(() => {
    QA.clear(); QA.street();
    const id = G.test.spawnGoon(-151.6, 0, 2, true);
    let wind = false;
    for (let i = 0; i < 200 && !wind; i++) { QA.step(1); wind = G.test.action().combat.list.find((q) => q.id === id)?.state === "windup"; }
    QA.draw(6);
    return { wind, sense: G.test.action().verse.sense };
  });
  check(sense.wind && sense.sense > 0.3, "a wind-up near the hero shows the spider-sense", sense);
  await page.screenshot({ path: out + "/verse-sense.png" });

  /* ---- the zip strike ---- */
  const zip = await page.evaluate(() => {
    QA.clear(); QA.street();
    const a = G.test.spawnGoon(-151.4, 0, 2, true), b = G.test.spawnGoon(-158, 0, 2, false);
    for (const g of G.combat.goons) { g.cool = 9; g.hp = g.id === a ? 1 : 20; }
    QA.step(2);
    QA.punch(); // a goes down: the combo runs and nobody is in reach
    const downA = G.test.action().combat.list.find((q) => q.id === a)?.state;
    const e0 = G.test.events().length;
    QA.punch();
    const z0 = G.test.action().zip;
    let n = 0;
    for (; n < 60 && G.test.action().zip; n++) QA.step(1);
    const s = G.test.action(), gb = s.combat.list.find((q) => q.id === b), p = G.P.pos;
    return { downA, z0, n, zips: s.combat.stats.zips, bState: gb.state, d: Math.hypot(gb.x - p.x, gb.z - p.z), ev: G.test.events().slice(e0).map((e) => e.type) };
  });
  check(zip.downA === "down" && zip.z0 && zip.z0.id >= 0, "with a combo running and nobody in reach, a press zips to the next goon", zip);
  check(zip.zips === 1 && zip.bState === "stagger" && zip.d < 7 && zip.n < 42, "the zip lands a flying kick in " + zip.n + " frames, and the hero bounces off", zip);
  const noZip = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.test.spawnGoon(-158, 0, 2, false);
    QA.step(2);
    QA.punch();
    return { zip: G.test.action().zip };
  });
  check(!noZip.zip, "with no combo running, the same press does not zip", noZip);

  /* ---- the bank in a swing ---- */
  const bank = await page.evaluate(() => {
    // the camera alone, on a body that swings round a circle of 20 m at 20 m/s (a left turn): it leans into the turn
    QA.clear(); QA.street();
    const S = G.city.start, R = 20, w = 1;
    const P = { pos: { x: S.x, y: S.y + 40, z: S.z }, vel: { x: 0, y: 0, z: 0 }, onGround: false, ropes: [{ state: "attached" }, { state: "idle" }] };
    const look = { dx: 0, dy: 0 }, flags = { swinging: true, lift: false, forceFirst: false, drive: null };
    let max = 0, sign = 0;
    for (let i = 0; i < 120; i++) {
      const t = i / 60, a = w * t;
      P.pos.x = S.x + R * Math.sin(a); P.pos.z = S.z - R + R * Math.cos(a) - R;
      P.vel.x = R * w * Math.cos(a); P.vel.z = -R * w * Math.sin(a);
      const b = G.flatcam.update(1 / 60, P, null, look, flags) && G.flatcam.info().bank;
      if (Math.abs(b) > max) { max = Math.abs(b); sign = Math.sign(b); }
    }
    const P2 = { ...P, onGround: true, ropes: [{ state: "idle" }, { state: "idle" }], vel: { x: 0, y: 0, z: 0 } };
    for (let i = 0; i < 180; i++) G.flatcam.update(1 / 60, P2, null, look, flags);
    const rest = G.flatcam.info().bank;
    QA.street();
    return { max, sign, rest };
  });
  check(bank.max > 3 * Math.PI / 180 && bank.max <= 7 * Math.PI / 180 + 1e-6, "the camera leans into a swing, at most 7 degrees (" + (bank.max * 180 / Math.PI).toFixed(1) + ")", bank);
  check(Math.abs(bank.rest) < 0.005, "on the ground the lean goes back to level", bank);

  /* ---- the build guide: goons on threes, squash and stretch, multiples, key pose, words, zoom, plates ---- */
  const threes = await page.evaluate(() => {
    QA.clear(); QA.street();
    const id = G.test.spawnGoon(-140, 0, 2, true); // 10 m off: he walks at the hero
    let n = 0, last = null, moved = 0, lastX = null;
    for (let i = 0; i < 60; i++) {
      QA.step(1);
      const v = G.test.goonView(id);
      const k = v.phase.toFixed(4) + v.pose;
      if (k !== last) { n++; last = k; }
      if (lastX !== null && v.x !== lastX) moved++;
      lastX = v.x;
    }
    return { n, moved };
  });
  check(threes.n >= 5 && threes.n <= 11, "a walking goon takes about 8 poses a second (" + threes.n + " in 1 s), the hero 12", threes);
  check(threes.moved >= 50, "and his place still moves every frame", threes);
  const squash = await page.evaluate(() => {
    QA.clear(); QA.street(); QA.step(30);
    QA.key("Space", true); QA.step(1); QA.key("Space", false);
    let up = 0, down = 0;
    for (let i = 0; i < 6; i++) { QA.step(1); up = Math.max(up, G.hero.info().squash); }
    for (let i = 0; i < 120 && !G.P.onGround; i++) QA.step(1);
    for (let i = 0; i < 8; i++) { QA.step(1); down = Math.min(down, G.hero.info().squash); }
    QA.step(90);
    return { up, down, rest: G.hero.info().squash };
  });
  check(squash.up > 0.03, "a jump stretches the hero (" + squash.up.toFixed(3) + ")", squash);
  check(squash.down < -0.03, "the landing squashes him (" + squash.down.toFixed(3) + ")", squash);
  check(Math.abs(squash.rest) < 0.01, "and he settles back to his shape", squash);
  const multi = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.test.spawnGoon(-151.4, 0, 2, true);
    for (const g of G.combat.goons) { g.hp = 20; g.cool = 9; }
    QA.step(40); QA.draw(12, 0.1);
    QA.punch();
    const a = G.hero.info();
    QA.step(30);
    return { ghosts: a.ghosts, pose: a.pose, later: G.hero.info().ghosts };
  });
  check(multi.ghosts >= 1 && multi.pose === "punch", "a punch leaves a see-through multiple of the wind-up", multi);
  check(multi.later === 0, "the multiple is gone within half a second", multi);
  const heavy = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.test.spawnGoon(-151.4, 0, 2, true);
    for (const g of G.combat.goons) { g.hp = 20; g.cool = 9; }
    QA.step(40); QA.draw(12, 0.1);
    const base = G.test.action().verse.plate;
    for (let i = 0; i < 2; i++) { QA.punch(); QA.step(16); for (const g of G.combat.goons) if (g.on) { g.x = -151.4; g.z = 2; } }
    QA.draw(12, 0.1);
    QA.punch(); // the kick
    QA.draw(1, 0);
    const hit = G.test.action().verse;
    QA.draw(8, 1 / 60);
    const after = G.test.action().verse.cam.zoom;
    return { base, plate: hit.plate, zoom: hit.cam.zoom, after };
  });
  check(heavy.plate > heavy.base * 1.8, "a kick doubles the plate slip (" + heavy.base.toFixed(2) + " to " + heavy.plate.toFixed(2) + " px)", heavy);
  check(heavy.zoom >= 0.1 && heavy.zoom <= 0.15 && heavy.after < 0.02, "a kick snaps the view in by 10 to 15 %, back within 8 frames", heavy);
  const words = await page.evaluate(() => {
    QA.clear(); QA.street();
    const ids = [G.test.spawnGoon(-151.4, 0, 2, true), G.test.spawnGoon(-151.4, 0, 3.2, true)];
    QA.step(2);
    G.combat.focus = 1;
    G.combat.goons.forEach((g, k) => { g.x = -151.4; g.z = k ? 3.2 : 2; g.y = 0; g.state = "idle"; g.cool = 9; });
    QA.step(1);
    QA.tap("KeyF");
    const w = G.fx.info().words.find((q) => q.name === "KASPLASH");
    const cam = G.camera, d = Math.hypot(w.x - cam.position.x, w.y - cam.position.y, w.z - cam.position.z);
    const view = 2 * d * Math.tan(Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect));
    // a wall word stays 20 s; a seventh pushes out the oldest
    for (let i = 0; i < 7; i++) G.fx.word("BONK", { x: -150 + i * 2, y: 3, z: -6 }, { life: 20 });
    QA.step(600);
    const stay = G.fx.info().words.filter((q) => q.life > 1).length;
    QA.step(660);
    return { part: w ? w.w / view : 0, stay, gone: G.fx.info().words.filter((q) => q.life > 1).length };
  });
  check(words.part > 0.28 && words.part < 0.4, "the finisher word fills a third of the view (" + (words.part * 100).toFixed(0) + "%)", words);
  check(words.stay === 6 && words.gone === 0, "wall words stay 20 s, six at most", words);

  /* ---- the build guide, part two: ink lines, hatching, mood, the smear ---- */
  const ink = await page.evaluate(() => {
    QA.clear(); QA.street(); QA.step(5);
    // the share of pixels that turn darker (by over `by`, the three channels summed) when the lines (or the hatching) come on;
    // the hatching works on pixels that are dark already, so it moves them by less
    const W = G.renderer.domElement.width, H = G.renderer.domElement.height;
    const darker = (a, b, by) => { let n = 0; for (let i = 0; i < a.length; i += 4) if ((b[i] + b[i + 1] + b[i + 2]) - (a[i] + a[i + 1] + a[i + 2]) > by) n++; return n / (a.length / 4); };
    const tune = G.test.verse();
    G.test.verse({ lines: 0, hatch: 0 }); const none = QA.grab(W, H);
    G.test.verse({ lines: tune.lines, hatch: 0 }); const lines = QA.grab(W, H);
    G.test.verse({ lines: 0, hatch: tune.hatch }); const hatch = QA.grab(W, H);
    G.test.verse({ lines: tune.lines, hatch: tune.hatch });
    return { lines: darker(lines, none, 60), hatch: darker(hatch, none, 12) };
  });
  console.log("INFO ink", JSON.stringify(ink), new Date().toISOString());
  check(ink.lines > 0.001 && ink.lines < 0.2, "ink lines darken the edges of the street (" + (ink.lines * 100).toFixed(2) + "% of pixels)", ink);
  check(ink.hatch > 0.002 && ink.hatch < 0.3, "hatching darkens the deepest shadows (" + (ink.hatch * 100).toFixed(2) + "% of pixels)", ink);
  console.log("INFO mood start", new Date().toISOString());
  const mood = await page.evaluate(() => {
    QA.clear(); QA.street(); QA.draw(30, 0.1);
    const calm = G.test.action().verse.mood;
    G.test.spawnGoon(-151.6, 0, 2, true);
    for (let i = 0; i < 30; i++) { QA.step(2); QA.draw(1, 0.1); }
    const fight = G.test.action().verse;
    QA.clear(); G.combat.hp = 1; QA.draw(30, 0.1);
    const hurt = G.test.action().verse;
    G.combat.heal(); QA.draw(30, 0.1);
    return { calm, fight: fight.mood, fightK: fight.moodFight, hurt: hurt.mood, hurtK: hurt.moodHurt, after: G.test.action().verse.mood };
  });
  console.log("INFO mood", JSON.stringify(mood), new Date().toISOString());
  check(mood.calm < 0.02 && mood.fightK > 0.8 && mood.fight > 0.3, "a fight tints the shadows red", mood);
  check(mood.hurtK > 0.8 && mood.hurt > 0.3 && mood.after < 0.05, "one heart left tints them blue, and healing clears it", mood);
  const smear = await page.evaluate(() => {
    QA.clear();
    const S = G.city.start;
    G.test.teleport(S.x, S.y + 60, S.z); G.P.onGround = false;
    let fast = 0;
    for (let i = 0; i < 20; i++) { G.P.vel.x = 32; G.P.vel.y = -4; G.P.vel.z = 0; QA.step(1); fast = Math.max(fast, G.hero.info().smear); }
    QA.street(); QA.step(30);
    return { fast, rest: G.hero.info().smear };
  });
  check(smear.fast > 0.15 && smear.fast <= 0.3 && smear.rest === 0, "at 32 m/s the hero smears along his flight (" + smear.fast.toFixed(2) + "), at rest not at all", smear);

  check(page.errors.length === 0, "no page errors", page.errors);
  await page.context().close();
} catch (e) { check(false, "the verse check threw", e.stack || String(e)); }

/* ---- a phone: the pass runs, and the screen draws ---- */
try {
  const page = await newPage({ width: 390, height: 844 });
  await page.addInitScript(quiet);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");
    window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");
  });
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.evaluate(SETUP);
  const ph = await page.evaluate(() => { QA.street(); QA.step(5); G.test.render(); return { phone: !!G.input.easySwing, bloom: G.test.bloom(), twos: G.test.action().verse.twos }; });
  check(ph.phone && ph.bloom.verse && ph.bloom.level === "off" && ph.twos === 12, "a phone runs the Verse pass without the glow, with the hero on twos", ph);
  await page.screenshot({ path: out + "/verse-phone.png" });
  check(page.errors.length === 0, "no page errors on the phone", page.errors);
  await page.context().close();
} catch (e) { check(false, "the phone verse check threw", e.stack || String(e)); }

await close();
done();
