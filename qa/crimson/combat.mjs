// The COMBAT package: the hero on foot, many enemies at once, the bosses, the Bear Call and stealth.
// All on stepped game time in the real Sedona (the open meadow at Red Rock Crossing):
// - 5 guards over 60 s: never more than 2 of them in an attack at once (the tokens), tokens go round to
//   most of them, nothing turns NaN. Run once at ?q=0 as well: the rules are the same on every tier (C2).
// - A heavy swing cleaves 3 enemies in its arc; lockCycle visits all 5; a posture break then a light
//   attack is a TAKEDOWN, and the downed guard is zip-tied ('tied') after the fight.
// - Rattler and Voss reach phase two at half life: 'bossPhase', S.look.vortex, the ink body and the
//   vortex parts. The Scorpion's tail sting goes through a guard and is dodged by the roll's i-frames.
// - The four Legends (E9) spawn as ink forms with their names; a boss at 0 needs a held E to be tied.
// - Hero hp 0 fires 'heroDown' once and never goes below 0; with ?god the hero keeps full life.
// - Stealth: a guard 10 m ahead in daylight spots a standing hero in under 3 s; a crouched hero in a
//   juniper 20 m away stays under 0.5 for 10 s; a silent takedown from behind ties the guard.
// - The Bear Call staggers grunts in its cone and needs 40 s to charge; hitstop slows only the combat
//   clock; a freeze stops the enemies; the combat files use no setTimeout.
// Pass --shots to save pictures to /tmp/combat_*.png.
import { open, step, stepUntil, storyReady, finish, shot, loop, freeRoam } from "./lib.mjs";
import { readFileSync, readdirSync } from "fs";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const SHOTS = process.argv.includes("--shots");
const PUB = new URL("../../public/crimson/", import.meta.url).pathname;
const MEADOW = [-255, 555];
const allErrors = [];

/* ---------------- source rules ---------------- */
for (const f of readdirSync(PUB + "js/story/combat")) {
  const src = readFileSync(PUB + "js/story/combat/" + f, "utf8");
  check(!/setTimeout|setInterval|\.then\(/.test(src), `combat/${f}: no setTimeout, setInterval or promise chains for flow (G2)`);
  check(!/\bS\.q\b/.test(src), `combat/${f}: gameplay never reads S.q (C2)`);
}
{
  const fx = readFileSync(PUB + "js/fx.js", "utf8");
  check(/pos\.groundY \?\? 0/.test(fx) && /floor = 0\.03\) \{/.test(fx), "fx.js: groundY defaults to 0 and sparks keep a per-spark floor (arena calls unchanged)");
}

async function session(query, { full = true } = {}) {
  const { browser, page, errors } = await open({ query, width: 800, height: 450 });
  const r = await storyReady(page);
  check(r.ok, `${query}: the story is ready (${r.sec} s stepped)`);
  await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
  check((await freeRoam(page)).ok, `${query}: free roam, F1's mission quit`);
  await step(page, 3);
  // the gang body loads before the fights (placeholders fight just as well, D2)
  await page.evaluate(async () => { const S = __crimson.story.S; const h = S.cast.preload(["gang", "rattler", "voss", "boone"]); const t0 = performance.now(); while (!h.done && performance.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 100)); });
  await page.evaluate(([mx, mz]) => {
    const S = __crimson.story.S, T = S.test.combat;
    const log = window.__log = [];
    for (const e of ["down", "takedown", "tied", "heroDown", "bossPhase", "finisher", "deflect", "evaded", "spotted", "end"]) S.combat.on(e, (d) => log.push([e, d && (d.id || (d.f && d.f.id)) || "", S.time]));
    window.__cq = {
      S, T,
      reset(x = mx, z = mz, yaw = 0) {
        S.combat.clear(); S.combat.end(); T.stealth.clear(); S.input.clear(); S.freeze = false; S.hitstop = 0; S.slowT = 0;
        const H = S.hero; H.hp = H.maxHp; H.st = 100; H.state = "move"; H.atk = null; H.crouch = false; H.iframe = false;
        H.place(x, z, yaw); H.resetGround(); T.K.lock = null; log.length = 0;
      },
      // an enemy at a distance and bearing from the hero's facing
      at(id, d, ang, o = {}) { const H = S.hero, a = H.face + ang; const f = T.spawn(id, H.pos.x + Math.sin(a) * d, H.pos.z + Math.cos(a) * d, o); return f; },
      // an enemy that stands where it is (a long stagger)
      still(f) { f.state = "stagger"; f.stunT = 1e9; f.t = 0; f.atk = null; f.queue = []; f.token = false; },
      finite() { const S2 = S; const bad = []; const fin = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z); if (!fin(S2.hero.pos)) bad.push("hero"); for (const f of S2.combat.enemies) { if (!fin(f.pos) || !Number.isFinite(f.hp) || !Number.isFinite(f.posture) || !Number.isFinite(f.face)) bad.push(f.id); if (f.a && !fin(f.a.root.position)) bad.push(f.id + " body"); } if (!fin(S2.camera.position)) bad.push("camera"); return bad; },
    };
    __cq.reset();
  }, MEADOW);
  const tap = async (a) => { await page.evaluate((a) => __cq.S.input.set({ [a]: true }), a); await step(page, 1 / 60); await page.evaluate((a) => __cq.S.input.set({ [a]: false }), a); };
  return { browser, page, errors, tap };
}

/* ---------------- tokens: 5 guards, 60 s ---------------- */
async function tokens(page, label, sec = 60) {
  await page.evaluate(() => { __cq.reset(); __cq.S.combat.begin({ legend: false }); for (let i = 0; i < 5; i++) __cq.at("guard", 6 + (i % 2), i / 5 * Math.PI * 2); });
  const r = await loop(page, sec * 60, (arg, tick) => {
    const S = __cq.S, T = __cq.T, H = S.hero;
    const w = window.__tk || (window.__tk = { max: 0, maxTok: 0, holders: new Set(), bad: [], attacks: 0, prev: new Set() });
    if (H.hp < 40) H.hp = H.maxHp; // the test keeps the hero standing
    const n = T.attacking(); w.max = Math.max(w.max, n); w.maxTok = Math.max(w.maxTok, T.tokens());
    for (const f of S.combat.enemies) { if (f.token) w.holders.add(f.id); if (f.state === "attack" && !w.prev.has(f)) w.attacks++; }
    w.prev = new Set(S.combat.enemies.filter((f) => f.state === "attack"));
    if (tick % 30 === 0) { const b = __cq.finite(); if (b.length) w.bad.push(...b); }
    return false;
  });
  const w = await page.evaluate(() => { const w = window.__tk; window.__tk = null; return { max: w.max, maxTok: w.maxTok, holders: w.holders.size, bad: [...new Set(w.bad)], attacks: w.attacks, hp: __cq.S.hero.hp }; });
  check(r.ticks === sec * 60, `${label}: ${sec} s of fighting stepped`);
  check(w.max <= 2 && w.maxTok <= 2, `${label}: never more than 2 guards attack at once (most at once ${w.max}, tokens held ${w.maxTok})`);
  check(w.holders >= 4 && w.attacks >= 12, `${label}: tokens are granted again and again (${w.holders} of 5 guards held one; ${w.attacks} attacks)`);
  check(w.bad.length === 0, `${label}: no NaN in any fighter, body or the camera${w.bad.length ? ": " + w.bad.join(", ") : ""}`);
}

/* ================================================================ the main session */
{
  const { browser, page, errors, tap } = await session("?chapter=f1&seed=7&nomusic&q=2");
  const K = await page.evaluate(() => __crimson.story.contract());
  check(K.length === 0, `every CONTRACT member is on S with its type${K.length ? ": " + K.slice(0, 5).join("; ") : ""}`);

  await tokens(page, "q=2");
  if (SHOTS) { await page.evaluate(() => { __cq.reset(); __cq.S.combat.begin({ legend: true }); for (let i = 0; i < 5; i++) __cq.at("guard", 5 + i * 0.4, -0.9 + i * 0.45); }); await step(page, 2.2, { draw: true }); await shot(page, "/tmp/combat_legend.png"); }

  /* ---- cleave ---- */
  const cleave = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false }); S.combat.setWeapon("foamKatana");
    const fs = [-0.5, 0, 0.5].map((a) => __cq.at("guard", 1.9, a));
    fs.forEach((f) => __cq.still(f));
    return fs.map((f) => f.id);
  });
  await step(page, 0.3);
  await tap("heavy");
  await step(page, 1.6);
  const cl = await page.evaluate(() => __cq.S.combat.enemies.map((f) => ({ id: f.id, hp: f.hp, max: f.maxHp })));
  check(cl.length === 3 && cl.every((f) => f.hp < f.max), `a heavy swing cleaves all 3 guards in its arc (${cl.map((f) => `${f.id} ${Math.round(f.hp)}/${f.max}`).join(", ")})`);

  /* ---- lock-on cycle ---- */
  const lock = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false });
    const fs = [0, 1, 2, 3, 4].map((i) => __cq.at("driver", 5 + i * 2, -1.2 + i * 0.6)); fs.forEach((f) => __cq.still(f));
    const seen = []; for (let i = 0; i < 6; i++) { const f = S.combat.lockCycle(1); seen.push(f && f.id); }
    const back = []; for (let i = 0; i < 5; i++) { const f = S.combat.lockCycle(-1); back.push(f && f.id); }
    return { seen, back, n: fs.length, first: __cq.T.lock() };
  });
  check(new Set(lock.seen.filter(Boolean)).size === 5 && lock.seen[5] === lock.seen[0], `lockCycle(1) visits all 5 enemies and comes round again (${lock.seen.join(" > ")})`);
  check(new Set(lock.back.filter(Boolean)).size === 5, `lockCycle(-1) visits all 5 the other way (${lock.back.join(" < ")})`);

  /* ---- posture break, TAKEDOWN, tied after the fight ---- */
  await page.evaluate(() => { __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false }); S.combat.setWeapon("foamKatana"); const f = __cq.at("driver", 1.8, 0); __cq.still(f); f.posture = f.maxPosture - 1; window.__f = f; });
  await tap("light");
  await step(page, 0.8);
  const br = await page.evaluate(() => ({ state: window.__f.state, posture: window.__f.posture }));
  check(br.state === "broken", `a light attack on a full posture bar breaks it (state '${br.state}')`);
  await step(page, 0.3);
  await tap("light");
  await step(page, 1.2);
  const td = await page.evaluate(() => ({ down: window.__f.downed, tied: window.__f.tied, log: window.__log.map((e) => e[0]) }));
  check(td.down && td.log.includes("takedown") && td.log.includes("down"), `then a light attack is a TAKEDOWN: 'takedown' and 'down' (${td.log.join(", ")})`);
  await step(page, 1.4);
  const ti = await page.evaluate(() => ({ tied: window.__f.tied, active: __cq.S.combat.active, log: window.__log.map((e) => e[0]) }));
  check(ti.tied && ti.log.includes("tied") && !ti.active, `after the fight the guard is zip-tied: 'tied', and the fight ends (${ti.log.join(", ")})`);

  /* ---- bosses: phase two at half life ---- */
  for (const id of ["rattler", "voss"]) {
    await page.evaluate((id) => {
      __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false, music: true }); S.combat.setWeapon("staff");
      const f = window.__f = __cq.at(id, 2.0, 0); f.hp = f.maxHp * 0.5 + 5; f.cooldown = 99; window.__vortexCalls = 0;
      const v = S.look.vortex; S.look.vortex = (...a) => { if (a[0]) window.__vortexCalls++; return v.apply(S.look, a); };
    }, id);
    await tap("light");
    await step(page, 2.6);
    const p2 = await page.evaluate(() => { const f = window.__f, S = __cq.S; return { phase: f.phase, name: f.name, vortex: S.look.overlay.vortex, calls: window.__vortexCalls, ink: f.a.inkK, parts: !!f.parts, boss: S.combat.boss === f, log: window.__log.map((e) => e[0]), hp: f.hp / f.maxHp }; });
    check(p2.phase === 2 && p2.log.includes("bossPhase") && p2.hp < 0.5, `${id}: phase two at half life ('bossPhase', now ${p2.name})`);
    check(p2.calls > 0 && p2.vortex, `${id}: S.look.vortex(true) was called and the overlay is on`);
    check(p2.ink > 0.99 && p2.parts, `${id}: the body is ink and the vortex parts are on (${p2.ink}, ${p2.parts})`);
    if (SHOTS) { await page.evaluate(() => { __cq.S.hero.face = Math.atan2(window.__f.pos.x - __cq.S.hero.pos.x, window.__f.pos.z - __cq.S.hero.pos.z) + 0.6; __cq.T.K.cam.yaw = __cq.S.hero.face; }); await step(page, 0.6, { draw: true }); await shot(page, `/tmp/combat_${id}2.png`); }
  }
  // the Scorpion's tail sting: unblockable (a guard does not stop it), dodged by the roll's i-frames
  const stingGuard = await page.evaluate(() => {
    const S = __cq.S, f = window.__f, H = S.hero;
    H.hp = H.maxHp; f.cooldown = 99; f.pos.set(H.pos.x + Math.sin(H.face) * 3.5, H.pos.y, H.pos.z + Math.cos(H.face) * 3.5); f.face = f.yaw = H.face + Math.PI;
    S.input.set({ parry: true }); window.__hp0 = H.hp;
    __cq.T.K.beginMove(f, "sting");
    return f.atk && f.atk.spec.unblock;
  });
  await step(page, 0.3); // the guard goes up and stays up
  await step(page, 1.8);
  const sg = await page.evaluate(() => { __cq.S.input.set({ parry: false }); return { hp: __cq.S.hero.hp, hp0: window.__hp0, state: __cq.S.hero.state }; });
  check(stingGuard && sg.hp < sg.hp0, `the tail sting is unblockable: a raised guard still takes it (${sg.hp0} > ${Math.round(sg.hp)})`);
  await step(page, 2.5);
  await page.evaluate(() => {
    const S = __cq.S, f = window.__f, H = S.hero;
    H.hp = H.maxHp; H.state = "move"; f.cooldown = 99; f.pos.set(H.pos.x + Math.sin(H.face) * 3.5, H.pos.y, H.pos.z + Math.cos(H.face) * 3.5); f.face = f.yaw = H.face + Math.PI; f.state = "idle";
    window.__hp0 = H.hp; __cq.T.K.beginMove(f, "sting"); window.__log.length = 0;
  });
  // roll just before the sting lands (it lands 0.95 s in)
  await step(page, 0.85);
  await page.evaluate(() => __cq.S.input.set({ move: { x: 1, y: 0 } }));
  await tap("dodge");
  await step(page, 0.5);
  const sd = await page.evaluate(() => { __cq.S.input.set({ move: { x: 0, y: 0 } }); return { hp: __cq.S.hero.hp, hp0: window.__hp0, log: window.__log.map((e) => e[0]) }; });
  check(sd.hp === sd.hp0 && sd.log.includes("evaded"), `the tail sting is dodged by the roll's i-frames (hp ${Math.round(sd.hp)}, ${sd.log.join(", ")})`);

  /* ---- a boss at 0 is down, and a held E ties it; the finisher fires ---- */
  await page.evaluate(() => { const S = __cq.S, f = window.__f; f.hp = 1; f.state = "idle"; f.invuln = false; f.cooldown = 99; __cq.still(f); f.pos.set(S.hero.pos.x + Math.sin(S.hero.face) * 1.8, S.hero.pos.y, S.hero.pos.z + Math.cos(S.hero.face) * 1.8); window.__log.length = 0; });
  await tap("light"); await step(page, 1.0);
  const bd = await page.evaluate(() => ({ down: window.__f.downed, tied: window.__f.tied, log: window.__log.map((e) => e[0]), opt: __cq.S.interact.current && __cq.S.interact.current.label }));
  check(bd.down && !bd.tied && bd.log.includes("finisher") && bd.opt === "TIE UP", `a boss at 0 is down, 'finisher' fires, and TIE UP is offered (${bd.log.join(", ")}; ${bd.opt})`);
  await page.evaluate(() => __cq.S.input.set({ use: true }));
  await step(page, 0.5);
  const half = await page.evaluate(() => window.__f.tied);
  await step(page, 0.7);
  const bt = await page.evaluate(() => { __cq.S.input.set({ use: false }); return { tied: window.__f.tied, vortex: __cq.S.look.overlay.vortex }; });
  check(!half && bt.tied && !bt.vortex, `holding E for 1 s ties the boss (not after 0.5 s), and the vortex ends`);

  /* ---- the Legends (E9) ---- */
  const leg = await page.evaluate(() => {
    const out = [];
    for (const v of ["javelina", "vulture", "gila", "tarantula"]) {
      __cq.reset(); const S = __cq.S; S.combat.begin({ legend: true });
      const f = __cq.at("legend", 5, 0, { variant: v });
      out.push({ v, name: f.name, ink: f.a.inkK, boss: S.combat.boss === f, marks: !!f.marks, legend: S.look.overlay.legend });
    }
    let bad = ""; try { __cq.T.spawn("legend", 0, 0); } catch (e) { bad = e.message; }
    return { out, bad };
  });
  for (const l of leg.out) check(l.name.startsWith("THE ") && l.ink === 1 && l.boss && l.marks && l.legend, `legend ${l.v}: ${l.name}, an ink form with neon marks and the boss bar, in the legend ink bleed`);
  check(/variant/.test(leg.bad), "a legend without a variant is refused");
  // a Legend fights: 20 s with the hero standing by, and it lands blows
  await page.evaluate(() => { __cq.reset(); __cq.S.combat.begin({ legend: true }); window.__f = __cq.at("legend", 5, 0, { variant: "javelina" }); window.__hp0 = __cq.S.hero.hp; });
  await loop(page, 20 * 60, () => { const H = __cq.S.hero; if (H.hp < 30) { window.__dmg = (window.__dmg || 0) + 1; H.hp = H.maxHp; } return false; });
  const lf = await page.evaluate(() => ({ hp: __cq.S.hero.hp, hp0: window.__hp0, refills: window.__dmg || 0, bad: __cq.finite() }));
  check((lf.hp < lf.hp0 || lf.refills > 0) && !lf.bad.length, `THE JAVELINA attacks the hero (life ${Math.round(lf.hp)}, refills ${lf.refills})`);
  if (SHOTS) { await step(page, 0.1, { draw: true }); await shot(page, "/tmp/combat_javelina.png"); }

  /* ---- the Scorpion's trick step and ink clones; the Rattlesnake's strike ---- */
  await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false });
    const f = window.__f = __cq.at("voss", 4, 0); f.hp = f.maxHp * 0.49; f.cooldown = 99;
  });
  await step(page, 2.4); // the change to the Scorpion
  await page.evaluate(() => { const f = window.__f; f.cooldown = 99; f.state = "idle"; __cq.T.K.beginMove(f, "trick"); window.__log.length = 0; });
  await step(page, 0.45);
  const tr0 = await page.evaluate(() => ({ vis: window.__f.a.visible, state: window.__f.state }));
  await step(page, 0.4);
  const tr1 = await page.evaluate(() => { const f = window.__f, H = __cq.S.hero; const behind = Math.cos(Math.atan2(f.pos.x - H.pos.x, f.pos.z - H.pos.z) - H.face); return { vis: f.a.visible, behind, d: Math.hypot(f.pos.x - H.pos.x, f.pos.z - H.pos.z), state: f.state }; });
  check(tr0.state === "vanish" && !tr0.vis && tr1.vis && tr1.behind < -0.5 && tr1.d < 3.5, `the Scorpion's trick step: gone in ink, then back behind the hero (${tr1.d.toFixed(1)} m, ${tr1.state})`);
  const cl2 = await page.evaluate(() => {
    const f = window.__f, n0 = __cq.S.combat.enemies.length; f.hp = f.phase2Hp * 0.59; f.state = "idle"; f.cooldown = 99;
    for (let i = 0; i < 3; i++) __crimson.step(1 / 60, false);
    const c = __cq.S.combat.enemies.find((e) => e.clone);
    return { n0, n: __cq.S.combat.enemies.length, hp: c && c.hp, ink: c && c.a.inkK, id: c && c.id };
  });
  check(cl2.n === cl2.n0 + 1 && cl2.hp === 1 && cl2.ink === 1, `the Scorpion splits: an ink clone with 1 life at 60% of the second phase (${cl2.id})`);
  await page.evaluate(() => { const S = __cq.S, H = S.hero, c = S.combat.enemies.find((e) => e.clone); __cq.still(c); c.pos.set(H.pos.x + Math.sin(H.face) * 1.6, H.pos.y, H.pos.z + Math.cos(H.face) * 1.6); window.__f.pos.set(H.pos.x - Math.sin(H.face) * 6, H.pos.y, H.pos.z - Math.cos(H.face) * 6); window.__f.cooldown = 99; });
  await tap("light"); await step(page, 0.8);
  check(await page.evaluate(() => !__cq.S.combat.enemies.some((e) => e.clone)), "a clone bursts into ink at one blow");
  // the Rattlesnake's strike: unblockable, the rattle sounds before it
  await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false });
    const f = window.__f = __cq.at("rattler", 5, 0); f.hp = f.maxHp * 0.49; f.cooldown = 99;
  });
  await step(page, 2.4);
  const rs = await page.evaluate(() => {
    const S = __cq.S, f = window.__f, H = S.hero; H.hp = H.maxHp; window.__hp0 = H.hp; f.cooldown = 99; f.state = "idle";
    f.pos.set(H.pos.x + Math.sin(H.face) * 6, H.pos.y, H.pos.z + Math.cos(H.face) * 6);
    S.input.set({ parry: true }); __cq.T.K.beginMove(f, "strike");
    return { unblock: f.atk.spec.unblock, tell: f.atk.spec.tell, hit: f.atk.spec.hits[0][0], leap: f.atk.spec.leapMax };
  });
  await step(page, 2.4);
  const rs2 = await page.evaluate(() => { __cq.S.input.set({ parry: false }); return { hp: __cq.S.hero.hp, hp0: window.__hp0 }; });
  check(rs.unblock && rs.leap === 7 && rs.tell < rs.hit && rs2.hp < rs2.hp0, `the Rattlesnake's 7 m strike is unblockable, with the rattle before it (hp ${rs2.hp0} > ${Math.round(rs2.hp)})`);

  /* ---- the legend ink bleed: on at the start of a daytime fight, off 1.2 s after the last enemy falls ---- */
  const lg = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.look.set("DAY", { dur: 0 }); S.combat.begin({});
    const on = S.look.overlay.legend; const f = __cq.at("driver", 3, 0); __cq.still(f); window.__f = f;
    return on;
  });
  await page.evaluate(() => __cq.T.ko(0));
  await step(page, 0.9);
  const lg1 = await page.evaluate(() => __cq.S.look.overlay.legend);
  await step(page, 0.6);
  const lg2 = await page.evaluate(() => ({ on: __cq.S.look.overlay.legend, active: __cq.S.combat.active }));
  check(lg && lg1 && !lg2.on && !lg2.active, `a daytime fight bleeds to ink at its start and back 1.2 s after the last enemy falls (${lg}, ${lg1}, ${lg2.on})`);

  /* ---- data for the UI ---- */
  const ui = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false });
    const f = __cq.at("guard", 2.2, 0); f.cooldown = 0; f.token = true; window.__f = f;
    const w = S.stealth.watch(__cq.at("guard", 12, 1.2, { alert: false }), {});
    let hint = null;
    for (let i = 0; i < 180 && !hint; i++) { __crimson.step(1 / 60, false); const h = S.combat.parryHint; if (h.t != null && h.from === f) hint = { t: h.t, unblock: h.unblock }; }
    const s = S.stealth.list[0];
    return { hint, screen: s && s.screen && ["x", "y", "on"].every((k) => k in s.screen), level: s && typeof s.level, lock: "lock" in S.combat, call: S.combat.bearCall };
  });
  check(ui.hint && ui.hint.t >= -0.1 && ui.screen && ui.level === "number" && ui.lock && ui.call && "cooldown" in ui.call, `the UI gets its data: the parry hint (${ui.hint && ui.hint.t.toFixed(2)} s), the watchers' screen spots and levels, the lock, the Bear Call`);

  /* ---- hero down ---- */
  await page.evaluate(() => { __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false }); const f = __cq.at("driver", 1.6, 0); f.cooldown = 0; f.token = true; S.hero.hp = 1; window.__f = f; });
  const hd = await loop(page, 10 * 60, () => __cq.S.hero.hp <= 0 && window.__log.some((e) => e[0] === "heroDown"));
  const hd0 = await page.evaluate(() => ({ hp: __cq.S.hero.hp, down: __cq.S.hero.down }));
  // (in free roam MISSIONS fades out and stands the hero up at the A-frame once he is down: hp only reads 0 or full)
  let hdMin = 0;
  for (let i = 0; i < 8; i++) { await step(page, 0.25); hdMin = Math.min(hdMin, await page.evaluate(() => __cq.S.hero.hp)); }
  const hdr = await page.evaluate(() => ({ max: __cq.S.hero.maxHp, hp: __cq.S.hero.hp, n: window.__log.filter((e) => e[0] === "heroDown").length, down: __cq.S.hero.down, state: __cq.S.hero.state }));
  check(hd.stopped && hd0.hp === 0 && hd0.down && hdMin === 0 && hdr.n === 1 && (hdr.down ? hdr.hp === 0 : hdr.hp === hdr.max), `hero hp 0 fires 'heroDown' once and hp stays at 0, never below (hp ${hdr.hp}, events ${hdr.n}, state ${hdr.state})`);
  await page.evaluate(() => { __cq.S.hero.hp = 50; });
  await step(page, 0.2);
  check(await page.evaluate(() => __cq.S.hero.state === "move"), "life given back (a checkpoint) stands the hero up");
  await stepUntil(page, () => !__crimson.story.S.lockControl && !__crimson.story.S.modal, { maxSec: 4 }); // (the free-roam respawn, if it ran, is over)

  /* ---- stealth ---- */
  const see = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S, H = S.hero; S.look.set("DAY");
    const f = __cq.at("guard", 10, 0, { alert: false }); f.face = f.yaw = f.homeYaw = H.face + Math.PI;
    S.stealth.watch(f, {}); window.__f = f; window.__t0 = S.time; return f.alert;
  });
  const sp = await loop(page, 5 * 60, () => __cq.S.stealth.spotted);
  const spt = await page.evaluate(() => ({ t: __cq.S.time - window.__t0, alert: window.__f.alert }));
  check(!see && sp.stopped && spt.t < 3 && spt.alert, `a guard 10 m ahead in daylight spots a standing hero in ${spt.t.toFixed(2)} s (under 3 s)`);
  // a crouched hero in a juniper 20 m away
  const jun = await page.evaluate(() => {
    const S = __cq.S; let tree = null;
    for (let r = 20; r < 400 && !tree; r += 20) S.world.colliders.query(-255, 555, r, (it) => { if (it.tag === "tree" && it.r < 1.2) { tree = it; return false; } });
    if (!tree) return null;
    __cq.reset(tree.x + 0.9, tree.z, 0); const H = S.hero; S.look.set("DAY");
    // a guard 20 m away that looks straight at the hero, where nothing stands between them
    let best = null;
    for (let k = 0; k < 24 && !best; k++) {
      const a = k / 24 * Math.PI * 2, x = H.pos.x + Math.sin(a) * 20, z = H.pos.z + Math.cos(a) * 20, y = S.world.surface(x, z);
      const t = S.world.colliders.raycast({ x, y: y + 1.6, z }, { x: H.pos.x, y: H.pos.y + 0.8, z: H.pos.z });
      if (t == null) best = { x, z };
    }
    if (!best) best = { x: H.pos.x + 20, z: H.pos.z };
    const f = __cq.T.spawn("guard", best.x, best.z, { alert: false }); f.face = f.yaw = f.homeYaw = Math.atan2(H.pos.x - f.pos.x, H.pos.z - f.pos.z);
    f.patrol = null; S.stealth.watch(f, {}); H.crouch = true; window.__max = 0; window.__f = f;
    return { tree: [tree.x, tree.z], exp: __cq.T.stealth.exposure };
  });
  if (!jun) check(false, "a juniper was found near the meadow");
  else {
    await loop(page, 10 * 60, () => { const S = __cq.S; window.__max = Math.max(window.__max, S.stealth.level()); S.hero.crouch = true; return false; });
    const jr = await page.evaluate(() => ({ max: window.__max, exp: __cq.S.stealth.exposure, d: Math.hypot(window.__f.pos.x - __cq.S.hero.pos.x, window.__f.pos.z - __cq.S.hero.pos.z), alert: window.__f.alert }));
    check(jr.max < 0.5 && !jr.alert && Math.abs(jr.exp - 0.175) < 1e-6, `a crouched hero in a juniper ${jr.d.toFixed(1)} m away stays under 0.5 for 10 s (most ${jr.max.toFixed(3)}, exposure ${jr.exp.toFixed(3)})`);
  }
  // a silent takedown from behind ties the guard
  await page.evaluate(() => {
    __cq.reset(); const S = __cq.S, H = S.hero; S.look.set("DAY");
    const f = __cq.at("guard", 1.3, 0, { alert: false }); f.face = f.yaw = f.homeYaw = H.face; f.patrol = null; S.stealth.watch(f, {}); window.__f = f;
  });
  await step(page, 0.1);
  const opt = await page.evaluate(() => __cq.S.interact.current && __cq.S.interact.current.label);
  await tap("use");
  await step(page, 0.5);
  const tk = await page.evaluate(() => ({ down: window.__f.downed, tied: window.__f.tied, log: window.__log.map((e) => e[0]) }));
  check(opt === "TAKEDOWN" && tk.down && tk.tied && tk.log.includes("takedown") && tk.log.includes("tied"), `a silent takedown from behind ties the guard (${opt}; ${tk.log.join(", ")})`);

  /* ---- the Bear Call ---- */
  await page.evaluate(() => { __cq.reset(); const S = __cq.S; S.look.set("DAY"); S.combat.begin({ legend: false }); S.flags.bearCall = true; window.__f = __cq.at("driver", 4, 0); window.__g = __cq.at("driver", 4, 2.4); window.__b = __cq.at("rattler", 5, 0.2); window.__f.cooldown = window.__g.cooldown = window.__b.cooldown = 99; });
  await tap("bearcall");
  await step(page, 1.3);
  const bc = await page.evaluate(() => ({ f: window.__f.state, g: window.__g.state, post: window.__b.posture, cd: __cq.S.combat.bearCall.cooldown, hero: __cq.S.hero.state }));
  check(bc.f === "stagger" && bc.g !== "stagger", `the Bear Call staggers a grunt in its cone and not one behind (${bc.f}, ${bc.g})`);
  check(bc.post >= 20, `the Bear Call gives a boss 20 posture (${bc.post.toFixed(1)})`);
  check(bc.cd > 37 && bc.cd <= 40, `the Bear Call then needs 40 s to charge (${bc.cd.toFixed(1)} s left)`);
  if (SHOTS) { await page.evaluate(() => { __cq.S.hero.state = "move"; __cq.S.combat.bearCall; }); }

  /* ---- hitstop and freeze ---- */
  const hs = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S, K = __cq.T.K;
    const t0 = S.time, c0 = K.ct, h0 = S.day.hour; S.hitstop = 0.5;
    for (let i = 0; i < 20; i++) __crimson.step(1 / 60, false);
    return { dt: S.time - t0, ct: K.ct - c0, day: (S.day.hour - h0) * 3600 };
  });
  check(Math.abs(hs.dt - 1 / 3) < 0.01 && hs.ct < 0.05 && hs.day > 0, `hitstop slows only the combat clock (story ${hs.dt.toFixed(3)} s, combat ${hs.ct.toFixed(3)} s)`);
  const fz = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false }); const f = __cq.at("driver", 8, 0); f.cooldown = 99;
    for (let i = 0; i < 30; i++) __crimson.step(1 / 60, false);
    const p0 = f.pos.clone(), t0 = f.t, k0 = __cq.T.K.ct; S.freeze = true;
    for (let i = 0; i < 60; i++) __crimson.step(1 / 60, false);
    const moved = f.pos.distanceTo(p0), ft = f.t - t0, ct = __cq.T.K.ct - k0; S.freeze = false;
    for (let i = 0; i < 60; i++) __crimson.step(1 / 60, false);
    return { moved, ft, ct, after: __cq.T.K.ct - k0 };
  });
  check(fz.moved === 0 && fz.ft === 0 && fz.ct === 0 && fz.after > 0.9, `a freeze stops the enemies and the combat clock; they go on after it (moved ${fz.moved}, clock ${fz.after.toFixed(2)} s after)`);

  /* ---- canteen, weapons ---- */
  await page.evaluate(() => { __cq.reset(); __cq.S.hero.hp = 40; window.__c0 = __cq.S.hero.canteen; });
  await tap("canteen"); await step(page, 1.6);
  const ca = await page.evaluate(() => ({ hp: __cq.S.hero.hp, c: __cq.S.hero.canteen, c0: window.__c0 }));
  check(ca.hp === 90 && ca.c === ca.c0 - 1, `a sip from the canteen gives 50 life (hp ${ca.hp}, sips ${ca.c0} > ${ca.c})`);
  const wp = await page.evaluate(() => {
    __cq.reset(); const S = __cq.S; S.combat.begin({ legend: false }); S.combat.give("stool", { uses: 3 });
    const f = __cq.at("boone", 2.0, 0); __cq.still(f); window.__f = f; return S.hero.weapon;
  });
  for (let i = 0; i < 3; i++) { await tap("light"); await step(page, 1.8); }
  const wb = await page.evaluate(() => ({ w: __cq.S.hero.weapon, hp: window.__f.hp, max: window.__f.maxHp }));
  check(wp === "stool" && wb.w !== "stool" && wb.hp < wb.max, `the bar stool swings heavy and breaks after 3 hits (${wp} > ${wb.w})`);

  // performance in a fight: 5 guards and the hero
  await page.evaluate(() => { __cq.reset(); __cq.S.combat.begin({ legend: false }); for (let i = 0; i < 5; i++) __cq.at("guard", 6, i / 5 * Math.PI * 2); });
  await step(page, 2, { draw: true });
  const info = await page.evaluate(() => { const r = __cq.S.renderer.info; return { calls: __crimson.lastInfo.calls, tris: __crimson.lastInfo.triangles, geo: r.memory.geometries, tex: r.memory.textures, prog: r.programs.length }; });
  console.log(`info  a fight with 5 guards: ${info.calls} draws, ${info.tris} triangles, ${info.geo} geometries, ${info.tex} textures, ${info.prog} programs`);
  check(info.calls < 400 && info.tris < 900000, "a fight with 5 guards stays inside a sane draw budget");
  if (SHOTS) await shot(page, "/tmp/combat_fight.png");

  // SAVE & QUIT leaves nothing behind
  await page.evaluate(() => { __cq.reset(); __cq.S.combat.begin({ legend: true }); __cq.at("guard", 5, 0); __cq.S.test.ui.quit(); });
  await step(page, 0.1);
  const q = await page.evaluate(() => ({ state: __crimson.game.state, n: __cq.S.combat.enemies.length, active: __cq.S.combat.active, hero: __cq.S.hero.actor }));
  check(q.state === "title" && q.n === 0 && !q.active && q.hero === null, "SAVE & QUIT clears the fight and the hero");
  allErrors.push(...errors);
  await browser.close();
}

/* ================================================================ ?q=0: the same rules on the lowest tier */
{
  const { browser, page, errors } = await session("?chapter=f1&seed=7&nomusic&q=0");
  const q0 = await page.evaluate(() => ({ q: __cq.S.q, max: __cq.T.MAX_TOKENS }));
  check(q0.q === 0 && q0.max === 2, `q=0: the tier is 0 and the token limit is still 2`);
  await tokens(page, "q=0", 30);
  allErrors.push(...errors);
  await browser.close();
}

/* ================================================================ ?god keeps the hero's life */
{
  const { browser, page, errors } = await session("?chapter=f1&seed=7&nomusic&q=2&god");
  await page.evaluate(() => { __cq.reset(); __cq.S.combat.begin({ legend: false }); for (let i = 0; i < 3; i++) __cq.at("driver", 2, -0.6 + i * 0.6); });
  await step(page, 15);
  const g = await page.evaluate(() => ({ hp: __cq.S.hero.hp, max: __cq.S.hero.maxHp, hits: window.__log.length, down: __cq.S.hero.down }));
  check(g.hp === g.max && !g.down, `?god: the hero keeps full life under 15 s of blows (${g.hp}/${g.max})`);
  allErrors.push(...errors);
  await browser.close();
}
await finish("combat", fails, null, allErrors);
