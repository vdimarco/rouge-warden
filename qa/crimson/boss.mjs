// Golden trace of the arena fight. With ?seed=7&god a bot fights Gabe in stepped time: it parries a
// blow that is about to land, cuts in range, strikes the deathblow on a broken posture, and rolls out
// of the unblockable moves. It must fight through the transform and win. Gabe's life, posture, state
// and form every 60 ticks must match qa/crimson/golden/boss_seed7.json exactly. --update writes it.
// (Commit B adds the stepped end screen and credits checks, once those run on game-time timers.)
import { open, loop, finish, here, UPDATE } from "./lib.mjs";
import { readFileSync, writeFileSync, existsSync } from "fs";

const MAX_TICKS = 240 * 60;
const GOLDEN = here("golden/boss_seed7.json");
const { browser, page, errors } = await open({ query: "?seed=7&god" });
const fails = [];
await page.evaluate(() => { __crimson.seed(7); __crimson.startGame(); });
if ((await page.evaluate(() => __crimson.game.state)) !== "fight") fails.push("the fight did not start");

// runs in the page before every tick
function bot(arg, i) {
  const C = __crimson, g = C.game, p = C.player, b = C.boss, I = C.input, K = I.keys, now = g.time;
  const B = window.__bot || (window.__bot = { trace: [], atk: null, atkId: 0, parried: "", dodged: "", shiftUntil: -1, lastCut: -9, transformed: false, deadAt: -1 });
  const r = (v) => Math.round(v * 1000) / 1000;
  if (i % 60 === 0) B.trace.push([i, r(b.hp), r(b.posture), b.state, b.form]);
  if (b.state === "transform") B.transformed = true;
  if (b.state === "dead") { B.deadAt = i; B.trace.push([i, r(b.hp), r(b.posture), b.state, b.form]); return true; }
  K.KeyW = K.KeyA = K.KeyS = K.KeyD = false;
  const dist = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) - (b.form === "bear" ? 1.15 : 0.55);
  if (b.atk !== B.atk) { B.atk = b.atk; B.atkId++; }
  let busy = false;
  if (b.state === "attack" && b.atk) {
    const s = b.atk.spec, soon = b.nextHit != null ? b.nextHit - b.clipT : 9;
    if (s.unblock) {
      busy = true;
      const id = String(B.atkId);
      // the charge: roll to the side once he is close; the call and the grab: roll just before the blow
      const go = s.charge ? b.t > s.windup && dist < 3.5 : soon < 0.3 && soon > -0.05 && dist < (s.pipe ? 9 : 4);
      if (go && B.dodged !== id) { B.dodged = id; I.buf.dodge = now; if (s.charge || s.pipe) K.KeyD = true; }
    } else if (b.nextHit != null && soon < 0.6) {
      busy = true;
      const id = B.atkId + ":" + b.nextHit;
      if (soon < 0.25 && soon > -0.05 && B.parried !== id) { B.parried = id; I.buf.parry = now; B.shiftUntil = now + 0.4; }
    }
  }
  K.ShiftLeft = now < B.shiftUntil;
  if (busy || b.state === "transform") return false;
  if (dist > (b.state === "broken" ? 1.2 : 1.9)) K.KeyW = true;
  const free = p.state === "move" || p.state === "guard" || (p.state === "attack" && p.t > 0.35);
  if (free && now - B.lastCut > 0.3 && dist < (b.state === "broken" ? 4 : 2.3)) { I.buf.light = now; B.lastCut = now; }
  return false;
}

const res = await loop(page, MAX_TICKS, bot);
const out = await page.evaluate(() => ({ trace: __bot.trace, deadAt: __bot.deadAt, transformed: __bot.transformed, form: __crimson.boss.form, state: __crimson.boss.state, parries: __crimson.game.parries, phase2: __crimson.game.phase2 }));
console.log(`boss ${out.state} as ${out.form} at tick ${out.deadAt} (${(out.deadAt / 60).toFixed(1)} s), ${out.parries} deflects, ${out.trace.length} trace rows`);
if (!out.transformed || !out.phase2) fails.push("Gabe never turned into the bear");
if (out.state !== "dead" || !res.stopped) fails.push(`Gabe did not die within ${MAX_TICKS / 60} s (state ${out.state}, form ${out.form})`);
if (out.state === "dead" && out.form !== "bear") fails.push(`Gabe died in form ${out.form}`);

const golden = { seed: 7, query: "?seed=7&god", deadAt: out.deadAt, parries: out.parries, rows: "[tick, hp, posture, state, form]", trace: out.trace };
if (UPDATE) { if (!fails.length) { writeFileSync(GOLDEN, JSON.stringify(golden, null, 0).replace(/\],\[/g, "],\n[") + "\n"); console.log("wrote " + GOLDEN); } }
else if (!existsSync(GOLDEN)) fails.push(`no golden at ${GOLDEN}; run with --update`);
else {
  const want = JSON.parse(readFileSync(GOLDEN, "utf8"));
  if (want.deadAt !== out.deadAt) fails.push(`death at tick ${out.deadAt}, golden has ${want.deadAt}`);
  if (want.parries !== out.parries) fails.push(`${out.parries} deflects, golden has ${want.parries}`);
  const n = Math.max(want.trace.length, out.trace.length);
  for (let k = 0; k < n; k++) {
    if (JSON.stringify(want.trace[k]) !== JSON.stringify(out.trace[k])) { fails.push(`trace differs at row ${k}: got ${JSON.stringify(out.trace[k])}, golden ${JSON.stringify(want.trace[k])}`); break; }
  }
  if (!fails.length) console.log(`trace matches the golden (${out.trace.length} rows)`);
}
await finish("boss", fails, browser, errors);
