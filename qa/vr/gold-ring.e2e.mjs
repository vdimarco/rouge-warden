// The gold-ring lesson: the rope lands on the tower, the left button is the left rope, the right button
// the right rope, at 1280 and again in a phone-shaped window. 0 page errors.
// NODE_PATH=qa/browser/node_modules node qa/vr/gold-ring.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("gold-ring");
watchdog(420000, "gold-ring");
const out = process.env.SHOTS || "/opt/cursor/artifacts/easy-swing";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});

try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => {
    G.renderer.setAnimationLoop(null);
    G.test.hold(true);
    G.test.settings({ verse: "off", bloom: "off" });
  });

  const run = await page.evaluate(() => {
    const S = G.city.start, R = G.city.goldRing;
    const canvas = document.querySelector("canvas");
    const down = (button) => canvas.dispatchEvent(new MouseEvent("mousedown", { button, bubbles: true, cancelable: true }));
    const up = (button) => document.dispatchEvent(new MouseEvent("mouseup", { button, bubbles: true }));
    const place = () => {
      up(0); up(2);
      if (G.game && G.game.progress) G.game.progress.tutorial = 0;
      G.test.teleport(S.x, S.y, S.z);
      G.test.face(R.x, R.z);
      if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(G.rigYaw, -0.42); }
      G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
      for (let i = 0; i < 20; i++) {
        G.test.step(1 / 60, 1);
        if (G.P.ropes.every((r) => r.state === "idle")) break;
      }
      G.test.step(1 / 60, 6);
    };
    const shot = (button) => {
      place();
      const mark = G.frame;
      down(button);
      let rope = null;
      for (let n = 0; n < 20; n++) {
        G.test.step(1 / 60, 1);
        const live = G.P.ropes.find((r) => r.state !== "idle");
        if (live) { rope = { side: G.P.ropes.indexOf(live), tag: live.target && live.target.tag, x: live.anchor.x, y: live.anchor.y, z: live.anchor.z, state: live.state }; break; }
      }
      const fires = G.test.events().filter((e) => e.type === "fire" && e.frame > mark).map((e) => e.side);
      return { rope, fires, tut: G.game && G.game.progress && G.game.progress.tutorial };
    };
    const left = [], right = [];
    let tower = 0;
    for (let i = 0; i < 30; i++) {
      const s = shot(0);
      if (i < 10) left.push(s);
      const on = s.rope && s.rope.side === 0 && s.rope.tag === "building" && Math.abs(s.rope.x - R.x) < 2;
      if (on) tower++;
    }
    up(0);
    for (let i = 0; i < 10; i++) right.push(shot(2));
    up(2);
    place();
    down(0);
    for (let n = 0; n < 20; n++) { G.test.step(1 / 60, 1); if (G.P.ropes.some((r) => r.state === "attached")) break; }
    G.test.render(0);
    const held = G.P.ropes.map((r) => ({ state: r.state, tag: r.target && r.target.tag, x: +r.anchor.x.toFixed(2), y: +r.anchor.y.toFixed(2) }));
    return {
      w: innerWidth, h: innerHeight, tower, left, right, held, tut: G.game.progress.tutorial,
      ring: { x: R.x, y: R.y, z: R.z },
    };
  });

  await page.screenshot({ path: out + "/gold-ring-1280x800.png" });
  const leftOk = run.left.length === 10 && run.left.every((s) => s.fires.length === 1 && s.fires[0] === 0 && s.rope && s.rope.side === 0);
  const rightOk = run.right.length === 10 && run.right.every((s) => s.fires.length === 1 && s.fires[0] === 1 && s.rope && s.rope.side === 1);
  console.log("1280", JSON.stringify({ w: run.w, h: run.h, tower: run.tower, tut: run.tut, held: run.held, left0: run.left[0], right0: run.right[0] }));
  check(run.w === 1280 && run.tower === 30, "at 1280, 30 of 30 ropes from the gold-ring lesson attach to the tower", { tower: run.tower, w: run.w, held: run.held });
  check(leftOk, "the left button fires the left rope 10 of 10 at 1280", run.left.map((s) => s.fires));
  check(rightOk, "the right button fires the right rope 10 of 10 at 1280", run.right.map((s) => s.fires));

  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const down = () => canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
    const up = () => document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
    const proj = (x, y, z) => {
      const v = G.camera.position.clone().set(x, y, z).project(G.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight, behind: v.z > 1 };
    };
    window.__goldInk = {
      swing() {
        const S = G.city.start, R = G.city.goldRing;
        up();
        if (G.game && G.game.progress) G.game.progress.tutorial = 0;
        G.test.teleport(S.x, S.y, S.z);
        G.test.face(R.x, R.z);
        if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(G.rigYaw, -0.35); }
        G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
        for (let i = 0; i < 12; i++) G.test.step(1 / 60, 1);
        down();
        const samples = [];
        let picked = null, last = null, shot = null;
        for (let n = 0; n < 1200 && !shot; n++) {
          G.test.step(1 / 60, 1);
          const r = G.P.ropes.find((q) => q.state === "attached");
          const hy = Math.hypot(R.x - G.P.pos.x, R.z - G.P.pos.z);
          const sp = Math.hypot(G.P.vel.x, G.P.vel.y, G.P.vel.z);
          const moved = Math.hypot(G.P.pos.x - S.x, G.P.pos.z - S.z);
          if (n % 60 === 0) samples.push({ n, y: +G.P.pos.y.toFixed(1), hy: +hy.toFixed(1), sp: +sp.toFixed(1), moved: +moved.toFixed(1), ground: G.P.onGround, wall: !!G.P.wall, st: r && r.state });
          last = samples[samples.length - 1];
          if (!r || Math.abs(r.anchor.x - R.x) > 2 || Math.abs(r.anchor.z - R.z) > 8) continue;
          if (G.P.onGround || G.P.wall || !(sp > 8) || moved < 14 || G.P.pos.y > S.y - 4 || G.P.pos.y < 14 || hy < 16 || hy > 52) continue;
          if (G.flatcam) {
            const dx = R.x - G.P.pos.x, dz = R.z - G.P.pos.z, hlen = Math.hypot(dx, dz) || 1;
            const yaw = Math.atan2(-dx, -dz);
            // Look a little below the ring so the rope crosses the sky above the hero, and the tower stays in frame.
            const pitch = Math.max(-0.35, Math.min(0.28, Math.atan2(R.y - (G.P.pos.y + 4), hlen) * 0.55));
            G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(yaw, pitch);
            G.test.look(0.0002, 0);
            G.test.step(1 / 60, 2);
          }
          G.test.render(0);
          const m = window.__goldInk.measure();
          const sky = m.line && m.line.inkD < 14 && m.line.sideL > 90 && m.line.width >= 1 && m.line.width <= 4;
          if (sky && m.reach != null && m.reach < 0.75 && m.anchorOnScreen && !m.ground) { picked = n; shot = m; break; }
        }
        if (!shot) {
          G.test.render(0);
          shot = window.__goldInk.measure();
        }
        shot.picked = picked; shot.samples = samples; shot.last = last;
        return shot;
      },
      fade() {
        document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
        // Hold the swing framing. The chase eases toward travel in those 100 ms, and on a short sky
        // crossing that slide puts the 2 px line on the tower, where the ink sample misses.
        const hold = G.flatcam ? { yaw: G.flatcam.yaw, pitch: G.flatcam.pitch } : null;
        for (let i = 0; i < 6; i++) {
          G.test.step(1 / 60, 1);
          if (hold && G.flatcam) {
            G.flatcam.bankOn = false;
            G.flatcam.shakeOn = false;
            G.flatcam.reset(hold.yaw, hold.pitch);
          }
        }
        G.test.render(0);
        return window.__goldInk.measure();
      },
      gone() {
        for (let i = 0; i < 3; i++) G.test.step(1 / 60, 1);
        G.test.render(0);
        const m = G.scene.getObjectByName("easyWeb");
        const hemp = G.scene.getObjectByName("ropes");
        return { n: m ? m.count : -1, fade: m && m.userData.fade, visible: !!(m && m.visible), hemp: hemp ? hemp.count : -1 };
      },
      measure() {
        const R = G.city.goldRing;
        const r = G.P.ropes.find((q) => q.inkLine || (q.state === "attached" && Math.abs(q.anchor.x - R.x) < 2)) || G.P.ropes[0];
        const mesh = G.scene.getObjectByName("easyWeb");
        const hemp = G.scene.getObjectByName("ropes");
        const glc = G.renderer.getContext();
        const bw = glc.drawingBufferWidth, bh = glc.drawingBufferHeight;
        const sx = bw / innerWidth, sy = bh / innerHeight;
        const buf = new Uint8Array(4);
        const read = (x, y) => {
          const px = Math.max(0, Math.min(bw - 1, Math.round(x * sx)));
          const py = Math.max(0, Math.min(bh - 1, Math.round(bh - 1 - y * sy)));
          glc.readPixels(px, py, 1, 1, glc.RGBA, glc.UNSIGNED_BYTE, buf);
          return [buf[0], buf[1], buf[2]];
        };
        const scratch = G.camera.position.clone();
        const proj = (x, y, z) => {
          const v = scratch.set(x, y, z).project(G.camera);
          return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight, behind: v.z > 1 };
        };
        const segs = [];
        if (mesh && mesh.count > 0) {
          const M = new mesh.matrix.constructor();
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, M);
            const e = M.elements;
            const ex = e[4] + e[12], ey = e[5] + e[13], ez = e[6] + e[14];
            const mx = e[4] * 0.5 + e[12], my = e[5] * 0.5 + e[13], mz = e[6] * 0.5 + e[14];
            segs.push({ p: proj(mx, my, mz), end: { x: ex, y: ey, z: ez } });
          }
        }
        let reach = 1e9;
        for (const s of segs) {
          const d = Math.hypot(s.end.x - r.anchor.x, s.end.y - r.anchor.y, s.end.z - r.anchor.z);
          if (d < reach) reach = d;
        }
        const hand = proj(G.hero.hand(0).x, G.hero.hand(0).y, G.hero.hand(0).z);
        const lum = (c) => 0.3 * c[0] + 0.5 * c[1] + 0.2 * c[2];
        let best = null;
        for (let i = 0; i < segs.length; i++) {
          const p = segs[i].p, q = segs[Math.min(segs.length - 1, i + 1)].p;
          if (p.behind) continue;
          let tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1;
          tx /= tl; ty /= tl;
          // The bow sits up to about 16 px off a segment end. Sample the end and the middle, and
          // take the brighter side so a tower on one side does not hide a sky crossing.
          const stations = [p];
          if (tl > 12) stations.push({ x: (p.x + q.x) * 0.5, y: (p.y + q.y) * 0.5 });
          for (const st of stations) {
            if (st.x < 8 || st.y < 8 || st.x > innerWidth - 8 || st.y > innerHeight - 8) continue;
            if (Math.hypot(st.x - hand.x, st.y - hand.y) < 18) continue;
            let width = 0, run = 0, center = null, inkD = 1e9;
            for (let s = -22; s <= 22; s++) {
              const c = read(st.x - ty * s, st.y + tx * s);
              const d = Math.hypot(c[0] - 43, c[1] - 42, c[2] - 51);
              if (d < 16) { run++; width = Math.max(width, run); } else run = 0;
              if (d < inkD) { inkD = d; center = c; }
            }
            const sideA = read(st.x - ty * 28, st.y + tx * 28);
            const sideB = read(st.x + ty * 28, st.y - tx * 28);
            const side = lum(sideA) >= lum(sideB) ? sideA : sideB;
            const sideD = center ? Math.hypot(side[0] - center[0], side[1] - center[1], side[2] - center[2]) : 0;
            const sideL = lum(side);
            const hit = { width, center, inkD: +inkD.toFixed(1), sideD: +sideD.toFixed(1), sideL: +sideL.toFixed(0), x: +st.x.toFixed(1), y: +st.y.toFixed(1) };
            const score = (h) => (h.inkD < 16 ? 0 : 500) + h.inkD + (h.sideL > 80 ? 0 : 40);
            if (!best || score(hit) < score(best)) best = hit;
          }
        }
        const ap = proj(r.anchor.x, r.anchor.y, r.anchor.z);
        let anchorInk = null;
        if (!ap.behind && ap.x >= 2 && ap.y >= 2 && ap.x < innerWidth - 2 && ap.y < innerHeight - 2) {
          let inkD = 1e9, center = null;
          for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
            const c = read(ap.x + dx, ap.y + dy);
            const d = Math.hypot(c[0] - 43, c[1] - 42, c[2] - 51);
            if (d < inkD) { inkD = d; center = c; }
          }
          anchorInk = { inkD: +inkD.toFixed(1), center, x: +ap.x.toFixed(1), y: +ap.y.toFixed(1) };
        }
        return {
          w: innerWidth, h: innerHeight,
          easy: !!r.easy, ink: !!r.inkLine, state: r.state, len: +r.len.toFixed(2),
          anchor: { x: +r.anchor.x.toFixed(2), y: +r.anchor.y.toFixed(2), z: +r.anchor.z.toFixed(2) },
          ring: { x: R.x, y: R.y, z: R.z },
          pos: { x: +G.P.pos.x.toFixed(1), y: +G.P.pos.y.toFixed(1), z: +G.P.pos.z.toFixed(1) },
          ground: G.P.onGround, wall: !!G.P.wall,
          mesh: mesh ? { n: mesh.count, fade: mesh.userData.fade, visible: mesh.visible } : null,
          hemp: hemp ? hemp.count : -1,
          reach: reach < 1e8 ? +reach.toFixed(3) : null,
          line: best, anchorInk, anchorOnScreen: !!(anchorInk),
        };
      },
    };
  });

  const ink1280 = await page.evaluate(() => window.__goldInk.swing());
  await page.screenshot({ path: out + "/gold-ink-1280-swing.png" });
  const fade1280 = await page.evaluate(() => window.__goldInk.fade());
  await page.screenshot({ path: out + "/gold-ink-1280-fade.png" });
  const gone1280 = await page.evaluate(() => window.__goldInk.gone());
  console.log("ink1280", JSON.stringify({ swing: ink1280, fade: fade1280, gone: gone1280 }));
  check(ink1280.picked != null && !ink1280.ground && !ink1280.easy && ink1280.ink && ink1280.len > 40, "at 1280 a mid-swing rope is on the gold-ring tower and is not an easy web", { picked: ink1280.picked, len: ink1280.len, easy: ink1280.easy, ink: ink1280.ink, pos: ink1280.pos, anchor: ink1280.anchor, last: ink1280.last });
  check(ink1280.hemp === 0 && ink1280.mesh && ink1280.mesh.visible && ink1280.mesh.n > 0, "at 1280 the gold-ring rope is the ink mesh, not hemp", { hemp: ink1280.hemp, mesh: ink1280.mesh });
  check(ink1280.reach != null && ink1280.reach < 0.75, "at 1280 the ink line is drawn to the anchor", ink1280.reach);
  check(ink1280.line && ink1280.line.width >= 1 && ink1280.line.width <= 4 && ink1280.line.sideL > 90, "at 1280 the ink line is about 2 px across the sky (" + (ink1280.line && ink1280.line.width) + ")", ink1280.line);
  check(ink1280.line && ink1280.line.inkD < 14, "at 1280 the line is ink #2B2A33", ink1280.line);
  check(!!ink1280.anchorOnScreen, "at 1280 the gold-ring anchor is in the frame", ink1280.anchorInk);
  check(fade1280.mesh && fade1280.mesh.n > 0 && fade1280.mesh.fade > 0.02 && fade1280.mesh.fade < 0.1, "at 1280 the line is partly faded about 100 ms after release", fade1280.mesh);
  check(fade1280.line && fade1280.line.sideD > 8, "at 1280 the faded line is still visible", fade1280.line);
  check(gone1280.n === 0 && gone1280.hemp === 0, "at 1280 the line is gone by 150 ms and the hemp cup does not zip back", gone1280);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    dispatchEvent(new Event("resize"));
    const S = G.city.start, R = G.city.goldRing;
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
    if (G.game && G.game.progress) G.game.progress.tutorial = 0;
    G.test.teleport(S.x, S.y, S.z);
    G.test.face(R.x, R.z);
    if (G.flatcam) G.flatcam.reset(G.rigYaw, -0.42);
    G.test.step(1 / 60, 8);
    document.querySelector("canvas").dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
    for (let n = 0; n < 20; n++) { G.test.step(1 / 60, 1); if (G.P.ropes.some((r) => r.state === "attached")) break; }
    G.test.render(0);
    return innerWidth;
  });
  await page.screenshot({ path: out + "/gold-ring-390x844.png" });
  const phone = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, ropes: G.P.ropes.map((r) => ({ state: r.state, tag: r.target && r.target.tag, x: r.anchor.x })) }));
  console.log("390", JSON.stringify(phone));
  check(phone.w === 390 && phone.ropes.some((r) => r.state === "attached" && r.tag === "building" && Math.abs(r.x - run.ring.x) < 2), "at 390 the rope is on the gold-ring tower", phone);

  const ink390 = await page.evaluate(() => window.__goldInk.swing());
  await page.screenshot({ path: out + "/gold-ink-390-swing.png" });
  const fade390 = await page.evaluate(() => window.__goldInk.fade());
  await page.screenshot({ path: out + "/gold-ink-390-fade.png" });
  const gone390 = await page.evaluate(() => window.__goldInk.gone());
  console.log("ink390", JSON.stringify({ swing: ink390, fade: fade390, gone: gone390 }));
  check(ink390.w === 390 && ink390.picked != null && !ink390.ground && !ink390.easy && ink390.ink && ink390.len > 40, "at 390 a mid-swing rope is on the gold-ring tower", { w: ink390.w, picked: ink390.picked, len: ink390.len, easy: ink390.easy, pos: ink390.pos, last: ink390.last });
  check(ink390.hemp === 0 && ink390.mesh && ink390.mesh.visible && ink390.mesh.n > 0 && ink390.reach != null && ink390.reach < 0.75, "at 390 the ink line is drawn to the anchor", { hemp: ink390.hemp, mesh: ink390.mesh, reach: ink390.reach });
  check(!!ink390.anchorOnScreen && ink390.line && ink390.line.inkD < 18 && ink390.line.sideL > 70, "at 390 the line is ink across the sky and the anchor is in the frame", { line: ink390.line, anchor: ink390.anchorInk });
  check(fade390.mesh && fade390.mesh.n > 0 && fade390.mesh.fade > 0.02 && fade390.mesh.fade < 0.1, "at 390 the line is partly faded about 100 ms after release", fade390.mesh);
  check(gone390.n === 0 && gone390.hemp === 0, "at 390 the line is gone by 150 ms", gone390);
  check(page.errors.length === 0, "0 page errors", page.errors);
} catch (e) {
  check(false, "the gold-ring run threw", e.stack || String(e));
} finally {
  await close();
  done();
}
