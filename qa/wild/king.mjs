// Plays the whole Porcelain King fight with a simple bot that uses the normal controls: it jumps shockwaves
// and toilet paper, rolls away from the lid chomp, runs from the flush, steps out of landing marks, and swings
// when he is open. Checks that all three rounds happen, that plunging works, that the sludge wall holds you in,
// and that everything is cleaned up after the fight and after a death.
import { open, newGame } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const { browser, page, errors } = await open();
await newGame(page);

const r = await page.evaluate(async () => {
  const P = G.player, I = G.inp, H = G.hazards, W = G.world, C = W.court;
  const b = G.bosses.find((x) => x.id === "king");
  const out = { moves: {}, phases: [1], plunges: 0, staggers: 0, hurt: 0, hits: 0, outside: 0, t: 0 };
  // count the damage the bot takes; give it plenty of hearts, since it is a bot and not a player
  P.maxHp = P.hp = 60;
  const hurt0 = P.hurt.bind(P);
  P.hurt = (q, x, z, k) => { const ok = hurt0(q, x, z, k); if (ok) { out.hurt += q; out.hits++; } return ok; };
  const n0 = G.scene.children.length;
  // walk onto the court: the fight starts and the wall rises
  P.place(C.x, C.z + C.r - 3); QA.clear();
  QA.step(10);
  out.started = b.active && C.sealOn;
  // world direction to stick input, for the fixed test camera
  const stick = (wx, wz) => { const cy = G.cam.yaw, l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l; I.move.x = wx * Math.cos(cy) - wz * Math.sin(cy); I.move.y = -(wx * Math.sin(cy) + wz * Math.cos(cy)); };
  let last = "";
  for (let i = 0; i < 30 * 600 && b.alive; i++) {
    QA.clear();
    if (G.ui.modal) QA.closeModals();
    if (b.state !== last) { last = b.state; out.moves[last] = (out.moves[last] || 0) + 1; if (last === "dizzy") out.staggers++; }
    if (b.phaseN !== out.phases[out.phases.length - 1]) out.phases.push(b.phaseN);
    const dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz), st = b.state;
    let busy = false;
    // shockwaves and paper: jump
    for (const w of H.rings) { const dd = Math.hypot(P.x - w.x, P.z - w.z); if (dd > w.r && dd - w.r < 1.1 && !w.hit) I.jump = true; }
    if (st === "whirl" && b.streamLen > 3 && d < b.streamLen + 3) {
      const toP = Math.atan2(-dx, -dz);
      for (const s of [1, -1]) { const a = b.yaw + s * Math.PI / 2, off = Math.atan2(Math.sin(toP - a), Math.cos(toP - a)); if (off * Math.sign(b.spinW) < 0 && Math.abs(off) * d < 2.4) I.jump = true; }
    }
    // the lid chomp: roll away; the flush: run
    if ((st === "rear" && d < 10) || st === "flushUp" || st === "flush") { stick(-dx, -dz); I.sprint = true; if (st === "rear" && b.t < 0.3) I.roll = true; busy = true; }
    // landing marks and sludge: step out
    for (const m of H.marks) {
      if (!m.userData.T) continue;
      const mx = P.x - m.position.x, mz = P.z - m.position.z, md = Math.hypot(mx, mz);
      if (md < m.scale.x + 0.8) { stick(mx || 1, mz); I.sprint = true; busy = true; }
    }
    if (!busy) {
      if (b.exposed && d < b.r + 3) I.attack = true;
      else if (["stuck", "dizzy", "recover", "idle", "gargle", "volley", "summon"].includes(st) || b.exposed) {
        const foe = G.foes.find((f) => f.alive && f.boss === b && Math.hypot(f.x - P.x, f.z - P.z) < 3);
        if (foe) { I.attack = i % 6 === 0; stick(foe.x - P.x, foe.z - P.z); I.move.x *= 0.2; I.move.y *= 0.2; }
        else if (d > b.r + 1.6) stick(dx, dz);
        else I.attack = i % 5 === 0;
      }
    }
    const was = !!G.plunge;
    G.test.step(1 / 30);
    if (!was && G.plunge) out.plunges++;
    out.t += 1 / 30;
    if (Math.hypot(P.x - C.x, P.z - C.z) > C.r + 0.8) out.outside++;
    if (P.hp < 10) P.hp = P.maxHp;
    if (i % 600 === 0) await new Promise((res) => setTimeout(res, 0));
  }
  out.dead = !b.alive;
  // the ending waits a few seconds of real time, then talks
  for (let i = 0; i < 60; i++) { G.test.step(1 / 30); if (G.ui.modal) QA.closeModals(); await new Promise((res) => setTimeout(res, 100)); }
  out.sealAfter = C.sealOn;
  out.hazardsAfter = H.shots.length + H.rings.length + H.pools.length + H.marks.length;
  out.grown = G.scene.children.length - n0;
  out.done = G.save.done;
  return out;
});
console.log(JSON.stringify(r));
check(r.started, "the fight did not start, or the wall did not rise");
check(r.dead, `the King is still standing after ${r.t.toFixed(0)} s`);
check(r.phases.join() === "1,2,3", "rounds seen: " + r.phases.join());
check(r.plunges > 0, "never plunged the King");
check(r.outside === 0, `the hero left the court ${r.outside} times during the fight`);
check(!r.sealAfter, "the wall is still up after the fight");
check(r.hazardsAfter === 0, r.hazardsAfter + " hazards left after the fight");
check(r.grown < 20, "the scene grew by " + r.grown + " objects");
check(r.done, "the ending did not run");

// a death in the middle of the fight puts everything back
const { browser: b2, page: p2, errors: e2 } = await open();
await newGame(p2);
const r2 = await p2.evaluate(() => {
  const P = G.player, C = G.world.court, b = G.bosses.find((x) => x.id === "king");
  P.place(C.x, C.z + C.r - 3); QA.step(30);
  b.hp = b.maxHp * 0.5; QA.step(200, () => { if (G.ui.modal) QA.closeModals(); });
  P.hp = 1; P.invuln = 0; P.roll = 0; P.hurt(9, P.x + 1, P.z);
  return new Promise((res) => setTimeout(() => {
    QA.closeModals(); G.test.step(1 / 30);
    res({ hp: b.hp, max: b.maxHp, active: b.active, seal: C.sealOn, phase: b.phaseN, marks: G.hazards.marks.length, raccoons: G.foes.filter((f) => f.alive && f.boss === b).length, cine: P.cine || null });
  }, 2200));
});
console.log(JSON.stringify(r2));
check(r2.hp === r2.max && !r2.active && !r2.seal && r2.phase === 1 && r2.marks === 0 && r2.raccoons === 0 && !r2.cine, "the King did not reset after a death: " + JSON.stringify(r2));
check(errors.length + e2.length === 0, "errors: " + [...errors, ...e2].join(" | "));
await browser.close(); await b2.close();
console.log(fails.length ? "FAIL\n" + fails.join("\n") : "PASS: king");
process.exit(fails.length ? 1 : 0);
