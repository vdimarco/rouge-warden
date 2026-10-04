// Checks the comic sound words (js/fx.js) in desktop play with the real physics: a word appears on fire (THWIP), attach
// (THUCK), yank (YANK), pump (SPLORT), a flush (FLUSH), a splash (KASPLASH), a bump (BONK) and past 20 m/s (WHOOSH, once
// every 4 s); GLUG when the King's ball hits you and FLUSH when a pipe rips off the Needle; at most 16 live; each faces the head about world up; it pops, holds and fades out; a word closer than 1.2 m to the
// head is skipped; all words are one draw call; a word really draws; and with no art nothing shows and nothing breaks.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/fx.mjs   (SHOTS=<dir> saves pictures)
import { checker, watchdog, newPage, open, close, enterXR, waitState, waitFor, shot } from "./lib.mjs";

const { check, done } = checker("fx");
watchdog(25 * 60 * 1000, "fx");
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// page-side helpers
const HELPERS = () => {
  const b = (window.__f = {
    step(n, dt = 1 / 60) { G.test.step(dt, n); },
    words: () => G.fx.info().words,
    names: () => G.fx.info().words.map((w) => w.name),
    made: (n) => G.fx.info().made[n] || 0,
    // where the words are seen from: the camera in flat play (third person puts it behind the hero), else the head
    head: () => { const f = G.test.flat(); return f.on ? f.camera : G.test.state().head; },
    // two rAF turns: the loop has rendered at least once with the current state
    frames: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))),
    // a spot on the clog's roof with a clear line from the head to the bowl (as play.mjs does)
    spot(c) {
      const S = 1.35, T = { x: c.x, y: c.y + 1.9 * S, z: c.z }, HIT = {};
      for (const r of [4.5, 6, 8, 10, 13]) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        const tb = G.city.topBelow(x, c.y + 0.4, z, 0.3);
        if (!tb || Math.abs(tb.y - c.y) > 0.05) continue;
        if (G.city.collideSphere(x, c.y + 1.25, z, 0.5) || G.city.collideSphere(x, c.y + 0.5, z, 0.4)) continue;
        const dx = T.x - x, dy = T.y - (c.y + 1.65), dz = T.z - z, d = Math.hypot(dx, dy, dz);
        if (G.city.raycast(x, c.y + 1.65, z, dx, dy, dz, d - 0.7, HIT)) continue;
        return { x, y: c.y, z };
      }
      return null;
    },
    // a facing report for every live word: from the instance matrix
    facing() {
      const m = G.fx.meshes.words.instanceMatrix.array, h = __f.head(), out = [];
      const info = G.fx.info();
      for (let i = 0; i < info.live; i++) {
        const o = i * 16, w = info.words[i];
        const nx = m[o + 8], ny = m[o + 9], nz = m[o + 10];
        const ux = m[o + 4], uy = m[o + 5], uz = m[o + 6], ul = Math.hypot(ux, uy, uz);
        const hx = h.x - m[o + 12], hz = h.z - m[o + 14], hl = Math.hypot(hx, hz) || 1;
        out.push({ name: w.name, ny, flat: Math.hypot(nx, nz), toHead: (nx * hx + nz * hz) / hl, upY: uy / ul });
      }
      return out;
    },
  });
};

/* ================= desktop play ================= */
try {
  const page = await newPage({ width: 640, height: 360 });
  await open(page, "?skipintro&god");
  await enterXR(page, "desktop");
  await page.evaluate(() => G.test.skipIntro());
  await waitState(page, { mode: "desktop", state: "play" }, 120000);
  await waitFor(page, () => G.fx && G.fx.info().ready, null, 60000);
  await page.evaluate(HELPERS);
  await page.evaluate(() => { G.test.hold(true); __f.step(30); });

  const t0 = await page.evaluate(() => {
    const i = G.fx.info(), m = G.fx.meshes.words, mat = m.material;
    return { ready: i.ready, failed: i.failed, live: i.live, max: i.max, instanced: m.isInstancedMesh, count: m.count, shader: mat.isShaderMaterial, raw: !!mat.isRawShaderMaterial, depthTest: mat.depthTest, depthWrite: mat.depthWrite, transparent: mat.transparent, order: m.renderOrder, culled: m.frustumCulled, inScene: m.parent === G.scene, tex: !!mat.uniforms.uMap.value, mip: mat.uniforms.uMap.value && mat.uniforms.uMap.value.generateMipmaps };
  });
  check(t0.ready && !t0.failed && t0.live === 0 && t0.max === 16, "the art loads and no word shows at the start", t0);
  check(t0.instanced && t0.shader && !t0.raw && t0.depthTest && !t0.depthWrite && t0.transparent && t0.order === 980 && !t0.culled && t0.inScene && t0.tex && t0.mip, "one InstancedMesh, a ShaderMaterial (no raw), depthTest on, depthWrite off, renderOrder 980, mipmapped art", t0);

  /* ---- fire, attach, yank ---- */
  const S = await page.evaluate(() => ({ ...G.city.start, ring: G.city.goldRing }));
  await page.evaluate((S) => { G.test.teleport(S.x, S.y, S.z); __f.step(3); G.test.aimAt(1, S.ring.x, S.ring.y, S.ring.z); __f.step(2); G.test.press(1, true); __f.step(4); }, S);
  const fire = await page.evaluate(() => ({ names: __f.names(), head: __f.head(), words: __f.words() }));
  const thwip = fire.words.find((w) => w.name === "THWIP");
  check(!!thwip, "a shot gives THWIP near the firing hand", fire.names);
  check(thwip && Math.hypot(thwip.x - fire.head.x, thwip.y - fire.head.y, thwip.z - fire.head.z) >= 1.2, "and it is not on your head (at least 1.2 m away)", thwip);
  await page.evaluate(() => { for (let i = 0; i < 40 && G.test.state().ropes[1].state !== "attached"; i++) __f.step(1); __f.step(1); });
  const att = await page.evaluate(() => ({ names: __f.names(), words: __f.words(), st: G.test.state() }));
  const thuck = att.words.find((w) => w.name === "THUCK"), anchor = att.st.ropes[1].anchor;
  check(att.st.ropes[1].state === "attached" && !!thuck, "the cup sticking gives THUCK", att.names);
  check(thuck && Math.hypot(thuck.x - anchor.x, thuck.y - anchor.y, thuck.z - anchor.z) < thuck.w * 0.5 + 1, "at the anchor (a little way out from the wall)", { thuck, anchor });
  await page.evaluate(() => { G.test.yank(1, 3); __f.step(3); });
  const yk = await page.evaluate(() => ({ names: __f.names(), ev: G.test.events().filter((e) => e.type === "yank").map((e) => ({ pump: e.pump, target: e.target })) }));
  check(yk.names.includes("YANK") && yk.ev.length > 0 && !yk.ev[yk.ev.length - 1].pump, "a yank on a normal target gives YANK", yk);

  // every live word faces the head: upright, its normal flat and toward the head, little roll
  const face = await page.evaluate(() => __f.facing());
  check(face.length >= 3 && face.every((f) => near(f.ny, 0, 1e-6) && f.toHead > 0.999 && f.upY > 0.97), "every word faces the head about world up (upright, normal flat and toward you, roll under about 12 degrees)", face);
  // the world keeps moving under the player while they swing: words must stay put in the world, or follow the player
  await page.evaluate(() => { G.test.press(1, false); G.test.aimAt(1, null); __f.step(2); });

  /* ---- pop, hold, fade out ---- */
  const life = await page.evaluate(() => {
    G.fx.clear();
    const h = __f.head(), out = {};
    G.fx.word("FLUSH", { x: h.x + 3, y: h.y, z: h.z }, {});
    const at = (age) => { const t = age - G.fx.info().words[0]?.age; if (t > 0) __f.step(1, t); const w = G.fx.info().words[0]; return w ? { age: +w.age.toFixed(3), scale: +w.scale.toFixed(3), alpha: +w.alpha.toFixed(3) } : null; };
    out.start = { age: 0, scale: G.fx.info().words[0].scale };
    out.peak = at(0.07);
    out.settled = at(0.13);
    out.hold = at(0.45);
    out.fading = at(0.65);
    out.late = at(0.79);
    out.gone = at(0.85);
    out.live = G.fx.info().live;
    out.count = G.fx.meshes.words.count;
    out.visible = G.fx.meshes.words.visible;
    return out;
  });
  check(life.start.scale === 0 && near(life.peak.scale, 1.2, 0.02) && near(life.settled.scale, 1, 1e-6), "it pops: scale 0, then 1.2 at 0.07 s, then 1 by 0.12 s", life);
  check(life.hold.alpha === 1 && life.fading.alpha > 0.05 && life.fading.alpha < 0.95 && life.late.alpha < life.fading.alpha && life.late.alpha < 0.1, "it holds at full strength, fades from 0.5 s, and is nearly gone at 0.8 s", life);
  check(life.gone === null && life.live === 0 && life.count === 0 && !life.visible, "it is gone after 0.8 s (the mesh draws nothing)", life);

  /* ---- the 1.2 m rule, the cap of 16, unknown names ---- */
  const rules = await page.evaluate(() => {
    G.fx.clear();
    const h = __f.head(), out = {}, s0 = G.fx.info().skipped;
    out.close = G.fx.word("YANK", { x: h.x + 0.5, y: h.y, z: h.z });
    out.close2 = G.fx.word("YANK", { x: h.x, y: h.y + 1.19, z: h.z });
    out.far = G.fx.word("YANK", { x: h.x + 1.3, y: h.y, z: h.z });
    out.skipped = G.fx.info().skipped - s0;
    out.live1 = G.fx.info().live;
    // dir pushes the centre out: a word 1.0 m away with dir along +x ends past 1.2 m only if the push (0.3 of its width) is enough
    G.fx.clear();
    out.unknown = G.fx.word("NOPE", { x: h.x + 4, y: h.y, z: h.z });
    out.nopos = G.fx.word("YANK", null);
    for (let i = 0; i < 24; i++) G.fx.word(i % 2 ? "THWIP" : "BONK", { x: h.x + 3 + (i % 5) * 0.3, y: h.y + (i % 3) * 0.3, z: h.z - 1 - i * 0.1 });
    const info = G.fx.info();
    out.live = info.live; out.count = G.fx.meshes.words.count; out.dropped = info.dropped; out.spawned = info.spawned;
    G.fx.clear();
    return out;
  });
  check(rules.close === false && rules.close2 === false && rules.far === true && rules.skipped === 2 && rules.live1 === 1, "a word closer than 1.2 m to the head is skipped (0.5 m and 1.19 m: no; 1.3 m: yes)", rules);
  check(rules.unknown === false && rules.nopos === false, "an unknown name or no position adds nothing", rules);
  check(rules.live === 16 && rules.count === 16 && rules.dropped >= 8, "at most 16 words live: a full pool gives up its oldest", rules);

  /* ---- one draw call ---- */
  await page.evaluate(() => { G.fx.clear(); const h = __f.head(); for (let i = 0; i < 12; i++) G.fx.word(["THWIP", "THUCK", "YANK", "SPLORT"][i % 4], { x: h.x + 2 + (i % 4), y: h.y + (i % 3) - 1, z: h.z - 4 - i * 0.5 }); });
  await page.evaluate(() => __f.frames());
  const on = await page.evaluate(() => ({ calls: G.test.renderInfo().calls, live: G.fx.info().live, count: G.fx.meshes.words.count }));
  await page.evaluate(() => { G.fx.meshes.words.visible = false; return __f.frames(); });
  const off = await page.evaluate(() => G.test.renderInfo().calls);
  await page.evaluate(() => { G.fx.meshes.words.visible = true; });
  check(on.live === 12 && on.count === 12 && on.calls - off === 1, "12 live words are exactly one draw call (" + on.calls + " with, " + off + " without)", { on, off });

  /* ---- a word really draws, and its edges are crisp (a picture check) ---- */
  const draw = await page.evaluate(async () => {
    G.fx.clear();
    const cam = G.camera, h = __f.head(), f = new cam.position.constructor(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new cam.quaternion.constructor()));
    const pos = { x: h.x + f.x * 3, y: h.y + f.y * 3, z: h.z + f.z * 3 };
    G.fx.word("FLUSH", pos, { scale: 3 });
    __f.step(10); // past the pop
    const v = new cam.position.constructor(pos.x, pos.y, pos.z).project(cam);
    const grid = [];
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) grid.push([(v.x + 1) / 2 + a * 0.03, (1 - v.y) / 2 + b * 0.05]);
    const withWord = await G.test.sample(grid);
    G.fx.meshes.words.visible = false;
    await __f.frames();
    const without = await G.test.sample(grid);
    G.fx.meshes.words.visible = true;
    const diff = withWord.map((p, i) => Math.abs(p[0] - without[i][0]) + Math.abs(p[1] - without[i][1]) + Math.abs(p[2] - without[i][2]));
    return { ndc: [v.x, v.y, v.z], changed: diff.filter((d) => d > 60).length, of: diff.length, alpha: withWord.every((p) => p[3] === 255) };
  });
  await shot(page, "fx-word");
  check(draw.changed >= 8 && draw.alpha, "a word really draws: " + draw.changed + " of " + draw.of + " sample points changed, and the frame stays opaque (alpha 1)", draw);

  /* ---- a pump gives SPLORT, the flush gives FLUSH ---- */
  const clogTest = await page.evaluate(() => {
    G.fx.clear();
    const c = G.city.clogs[0], sp = __f.spot(c);
    if (!sp) return { err: "no spot" };
    G.test.press(1, false); G.test.aimAt(1, null);
    G.test.teleport(sp.x, sp.y, sp.z); __f.step(3);
    const bowl = { x: c.x, y: c.y + 1.9 * 1.35, z: c.z };
    G.test.aimAt(1, bowl.x, bowl.y, bowl.z); G.test.press(1, true);
    let n = 0;
    for (; n < 60 && G.test.state().ropes[1].state !== "attached"; n++) __f.step(1);
    const out = { attached: G.test.state().ropes[1].state === "attached", tag: G.test.state().ropes[1].tag, clog: { x: c.x, y: c.y, z: c.z } };
    if (!out.attached) return out;
    G.fx.clear();
    G.test.yank(1, 3.2); __f.step(1);
    out.afterPump = __f.words().map((w) => ({ name: w.name, y: w.y, w: w.w }));
    __f.step(30); // past the yank cooldown (0.35 s), or the next pull would not count
    G.fx.clear();
    for (let i = 0; i < 2 && !G.game.info().clogs[c.id].done; i++) { G.test.yank(1, 3.2); __f.step(1); __f.step(30); }
    out.done = G.game.info().clogs[c.id].done;
    out.afterFlush = __f.words().map((w) => ({ name: w.name, y: w.y, w: w.w, x: w.x, z: w.z }));
    G.test.press(1, false); G.test.aimAt(1, null); __f.step(2);
    return out;
  });
  check(clogTest.attached && clogTest.tag === "clog", "the rope sticks to a clog", clogTest);
  check(clogTest.attached && clogTest.afterPump.some((w) => w.name === "SPLORT"), "a pump gives SPLORT at the clog", clogTest.afterPump);
  const flushWord = clogTest.afterFlush && clogTest.afterFlush.find((w) => w.name === "FLUSH");
  check(clogTest.done && !!flushWord && flushWord.y >= clogTest.clog.y + 3 && flushWord.w > 1, "the flush gives a big FLUSH above the clog", clogTest.afterFlush);

  /* ---- a splash ---- */
  const spl = await page.evaluate(() => {
    G.fx.clear();
    // over the lake, a few metres up: it falls in
    G.test.teleport(-90, 3, 380); __f.step(2);
    const f0 = G.frame;
    let hit = false;
    for (let i = 0; i < 90 && !hit; i++) { __f.step(1); hit = G.test.events().some((e) => e.type === "splash" && e.frame > f0); }
    return { hit, names: __f.names(), head: __f.head(), words: __f.words().filter((w) => w.name === "KASPLASH") };
  });
  check(spl.hit && spl.names.includes("KASPLASH"), "falling into the lake gives KASPLASH", spl);
  check(spl.words[0] && Math.hypot(spl.words[0].x - spl.head.x, spl.words[0].y - spl.head.y, spl.words[0].z - spl.head.z) >= 1.2 - 1e-6, "and it is not on your head", spl.words);
  // the respawn fades out, moves you to a roof and fades in: promises, so step in short runs and let them settle in between
  for (let i = 0; i < 40; i++) { await page.evaluate(() => __f.step(10)); if (!(await page.evaluate(() => G.test.state().dead))) break; }
  await page.evaluate(() => { __f.step(60); G.fx.clear(); });

  /* ---- a bump gives BONK ---- */
  const bump = await page.evaluate(() => {
    G.fx.clear();
    const S = G.city.start, HIT = {};
    // a tall wall face, 14 to 70 m from the roof, at some height above it
    for (const [dx, dz, up] of [12, 20, 30, 45, 60].flatMap((u) => Array.from({ length: 16 }, (_, k) => [Math.cos((k / 16) * Math.PI * 2), Math.sin((k / 16) * Math.PI * 2), u]))) {
      const y = S.y + up;
      const h = G.city.raycast(S.x, y, S.z, dx, 0, dz, 70, HIT);
      if (!h || HIT.t < 14 || Math.abs(HIT.ny) > 0.1) continue;
      const x = HIT.x - dx * 9, z = HIT.z - dz * 9;
      if (G.city.collideSphere(x, y, z, 1)) continue;
      G.test.teleport(x, y, z);
      __f.step(2);
      const P = G.P;
      P.pos.x = x; P.pos.y = y; P.pos.z = z; P.vel.x = dx * 14; P.vel.y = 0; P.vel.z = dz * 14; P.onGround = false;
      const f0 = G.frame;
      let got = false;
      for (let i = 0; i < 90 && !got; i++) { __f.step(1); got = G.test.events().some((e) => e.type === "bump" && e.frame > f0); }
      return { got, wall: { x: HIT.x, y: HIT.y, z: HIT.z, nx: HIT.nx, nz: HIT.nz }, names: __f.names(), words: __f.words().filter((w) => w.name === "BONK"), head: __f.head() };
    }
    return { err: "no wall" };
  });
  check(bump.got && bump.names.includes("BONK"), "flying into a wall gives BONK", bump);
  check(bump.words && bump.words[0] && Math.hypot(bump.words[0].x - bump.head.x, bump.words[0].y - bump.head.y, bump.words[0].z - bump.head.z) >= 1.2 - 1e-6, "and it is not on your head", bump.words);

  /* ---- WHOOSH: once as you cross 20 m/s, at most every 4 s ---- */
  const wh = await page.evaluate(() => {
    G.fx.clear();
    const S = G.city.start, P = G.P, out = {};
    G.test.teleport(S.x, S.y + 120, S.z); __f.step(2);
    P.frozen = true; // the body stays where it is; only its speed matters here
    const speed = (v) => { P.vel.x = 0; P.vel.y = 0; P.vel.z = -v; };
    speed(12); __f.step(3); out.slow = __f.made("WHOOSH");
    speed(25); __f.step(2); out.first = __f.made("WHOOSH");
    const w = __f.words().find((q) => q.name === "WHOOSH"), h = __f.head();
    out.ahead = w ? { dz: +(w.z - h.z).toFixed(2), dist: +Math.hypot(w.x - h.x, w.y - h.y, w.z - h.z).toFixed(2), w: +w.w.toFixed(2) } : null;
    speed(10); __f.step(30); // under 17 m/s it re-arms
    speed(25); __f.step(30); out.within4 = __f.made("WHOOSH"); // 1 s after the first: too soon
    speed(10); __f.step(30);
    speed(25); __f.step(240); // more than 4 s after the first
    speed(10); __f.step(30);
    speed(25); __f.step(2); out.after4 = __f.made("WHOOSH");
    P.frozen = false; P.vel.x = P.vel.y = P.vel.z = 0;
    return out;
  });
  check(wh.slow === 0 && wh.first === 1 && wh.ahead && wh.ahead.dz < -8, "crossing 20 m/s gives one WHOOSH ahead of you (12 m/s gives none)", wh);
  check(wh.within4 === 1 && wh.after4 === 2, "and no second WHOOSH within 4 s, but another after it", wh);

  /* ---- the King: GLUG when his ball hits you ---- */
  const kg = await page.evaluate(() => {
    G.flags.god = true; // a hit costs no heart
    G.fx.clear();
    G.test.wakeKing(); __f.step(300);
    const out = {}, M = G.game.info().king.mouth;
    // 38 m in front of his mouth and 8 m lower, held still: in his open line of sight (as play.mjs does), so a ball comes at your chest
    G.test.teleport(M[0], M[1] - 8, M[2] - 38); G.P.frozen = true; __f.step(3);
    let n = 0;
    for (; n < 60 * 45 && !__f.made("GLUG"); n++) __f.step(1);
    out.n = n; out.glug = __f.made("GLUG"); out.king = G.game.info().king.state; out.throws = G.game.info().king.throws;
    out.word = __f.words().find((w) => w.name === "GLUG") || null;
    out.head = __f.head();
    G.P.frozen = false;
    return out;
  });
  check(kg.glug >= 1 && !!kg.word, "the King's ball hitting you gives GLUG (after " + (kg.n / 60).toFixed(1) + " s)", kg);
  check(kg.word && Math.hypot(kg.word.x - kg.head.x, kg.word.y - kg.head.y, kg.word.z - kg.head.z) >= 1.2 - 1e-6, "and it is in the air between you and him, not on your head", kg.word);

  /* ---- a pipe rips off the Needle: FLUSH ---- */
  const rip = await page.evaluate(() => {
    const out = {}, p = G.city.needle.pipes[0], tip = G.game.info().pipes[0].tip;
    // in front of pipe 0, 34 m out along its outward normal, 6 m lower, held still
    G.test.teleport(tip[0] + p.nx * 34, tip[1] + p.ny * 34 - 6, tip[2] + p.nz * 34); G.P.frozen = true; __f.step(2);
    G.test.press(1, false); __f.step(1); G.test.aimAt(1, tip[0], tip[1], tip[2]); G.test.press(1, true);
    for (let n = 0; n < 60 && G.test.state().ropes[1].state !== "attached"; n++) __f.step(1);
    out.tag = G.test.state().ropes[1].tag;
    G.fx.clear();
    for (let i = 0; i < 3; i++) { G.test.yank(1, 3.2); __f.step(1); if (i < 2) __f.step(30); }
    out.ripped = G.game.info().pipes[0].ripped;
    out.flush = __f.words().find((w) => w.name === "FLUSH") || null;
    out.tip = tip;
    G.test.press(1, false); G.test.aimAt(1, null); __f.step(2);
    G.P.frozen = false;
    return out;
  });
  check(rip.tag === "pipe" && rip.ripped, "the rope sticks to a pipe and three pumps rip it off", rip);
  check(rip.flush && Math.hypot(rip.flush.x - rip.tip[0], rip.flush.y - (rip.tip[1] + 2), rip.flush.z - rip.tip[2]) < 0.5 && rip.flush.w > 3, "a ripped pipe gives a big FLUSH at its tip", rip.flush);

  const errs = page.errors.slice();
  check(errs.length === 0, "no errors in desktop play", errs);
  await page.context().close();
} catch (e) { check(false, "the desktop run threw", e.stack || String(e)); }

/* ================= no art: words do not show and nothing breaks ================= */
try {
  const page = await newPage({ width: 320, height: 180 });
  await page.route("**/art/words.webp", (r) => r.abort());
  await open(page, "?skipintro&god");
  await enterXR(page, "desktop");
  await page.evaluate(() => G.test.skipIntro());
  await waitState(page, { mode: "desktop", state: "play" }, 120000);
  await waitFor(page, () => G.fx && G.fx.info().failed, null, 60000);
  const r = await page.evaluate(() => {
    G.test.hold(true);
    const h = G.test.state().head, S = G.city.start, out = {};
    out.word = G.fx.word("THWIP", { x: h.x + 3, y: h.y, z: h.z });
    G.test.teleport(S.x, S.y, S.z); G.test.step(1 / 60, 3);
    G.test.aimAt(1, G.city.goldRing.x, G.city.goldRing.y, G.city.goldRing.z); G.test.step(1 / 60, 2); G.test.press(1, true); G.test.step(1 / 60, 40);
    out.attached = G.test.state().ropes[1].state === "attached";
    out.info = { live: G.fx.info().live, ready: G.fx.info().ready, failed: G.fx.info().failed };
    out.visible = G.fx.meshes.words.visible;
    return out;
  });
  check(r.word === false && r.info.live === 0 && r.info.failed && !r.info.ready && !r.visible && r.attached, "with no art no word shows, and the game still works (a rope still sticks)", r);
  // the browser logs the failed request itself: nothing else may be an error
  const other = page.errors.filter((e) => !/words\.webp|Failed to load resource|ERR_FAILED/i.test(e));
  check(other.length === 0, "and nothing else errors", other);
  await page.context().close();
} catch (e) { check(false, "the no-art run threw", e.stack || String(e)); }

await close();
done();
