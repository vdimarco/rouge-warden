// Gloam Downs: the relics. An elite put out drops one where it fell; a touch takes it, and it changes one move until the run ends. A
// relic held with the wick of its pair kindles into a stronger effect. Here are the relics' data, the draw from the seed's `relic`
// stream, the kindlings, and the fires, sparks, pulses and burns that the runner (run.js) steps on play steps. The blade's own changes
// (Hooked cut, Bellows cut, Echo blade, Tinder guard, Spark third's throw and Ember trail's line) start in moves.js. No DOM, so the
// Node tests and the bot use it as it is. design.md "Relics" and "Kindlings".
import { hash2, mulberry } from '../kit/rng.js';
import { emit } from './bus.js';
import { statusHit, STATES } from './status.js';

const S = sec => Math.round(sec * 60);
export const RELIC_MAX = 5;
export const RELICS = [
  { id: 'trail', name: 'Ember trail', move: 'roll', text: 'the roll leaves fire', mark: 'Tr' },
  { id: 'spark', name: 'Spark third', move: 'finisher', text: 'the finisher throws a spark', mark: 'Sp' },
  { id: 'heel', name: 'Coal heel', move: 'plunge', text: 'the plunge leaves a burning ring', mark: 'He' },
  { id: 'hooked', name: 'Hooked cut', move: 'first cut', text: 'the first cut pulls a foe in', mark: 'Ho' },
  { id: 'bellows', name: 'Bellows cut', move: 'second cut', text: 'the second cut blows foes back', mark: 'Be' },
  { id: 'moth', name: 'Moth lamp', move: 'flask', text: 'a drink sends out a pulse', mark: 'Mo' },
  { id: 'tinder', name: 'Tinder guard', move: 'near miss', text: 'a near miss readies the finisher', mark: 'Ti' },
  { id: 'echo', name: 'Echo blade', move: 'finisher', text: 'the finisher strikes twice', mark: 'Ec' },
  // the four of gloam-downs-hub design.md "New buffs"
  { id: 'charedge', name: 'Char edge', move: 'first cut', text: 'the first cut adds 1 Char', mark: 'Ch', char: 1 },
  { id: 'soot', name: 'Soot heel', move: 'plunge', text: 'the plunge leaves a Soot cloud', mark: 'So', r: 2.5, life: 3 },
  { id: 'glass', name: 'Glass drink', move: 'flask', text: 'a drink gives a shell', mark: 'Gd', shell: 20, life: 5 },
  { id: 'thorn', name: 'Thorn roll', move: 'near miss', text: 'a near miss cuts the foe that swung', mark: 'Th', dmg: 12 }
];
export const RELIC_IDS = RELICS.map(r => r.id);
export const relicOf = id => RELICS.find(r => r.id === id) || null;
// the pairs that kindle, and what each kindled effect is
export const KINDLE = [
  { wick: 'heels', relic: 'trail', text: 'the trail lasts 2.5 s' },
  { wick: 'heavy', relic: 'heel', text: 'the ring is 2.5 m and lasts 3 s' },
  { wick: 'keen', relic: 'spark', text: 'the spark passes through to a second foe' },
  { wick: 'oil', relic: 'moth', text: 'the pulse is 4.5 m' },
  { wick: 'charw', relic: 'charedge', text: 'the first cut adds 2 Char', char: 2 },
  { wick: 'heavy', relic: 'soot', text: 'the cloud is 3.5 m', r: 3.5 },
  { wick: 'oil', relic: 'glass', text: 'the shell is 30', shell: 30 },
  { wick: 'heels', relic: 'thorn', text: 'the cut deals 20', dmg: 20 }
];
export const kindled = (run, relic) => KINDLE.some(k => k.relic === relic && (run?.relics || []).includes(relic) && (run?.wicks || []).includes(k.wick));
export const kindlings = run => KINDLE.filter(k => (run?.relics || []).includes(k.relic) && (run?.wicks || []).includes(k.wick)).map(k => k.relic);
// the toast of a relic taken: "<name> · <what it does>", and " · Kindled" when its wick burns
export const relicLine = (id, run = null) => { const r = relicOf(id); return r ? `${r.name} · ${r.text}${run && kindled(run, id) ? ' · Kindled' : ''}` : ''; };
/* the k-th relic of a run (k counts the elites put out before), from the seed's `relic` stream: one of the relics the run does not
   hold. Its own hash, so no other choice moves it */
export function drawRelic(seed, k, held = []) {
  const left = RELIC_IDS.filter(id => !held.includes(id));
  if (!left.length) return null;
  const r = mulberry(hash2(seed | 0, k + 1, 0x4e11c));
  return left[Math.floor(r() * left.length)];
}

// the numbers of each relic's effect
export const FIRE = {
  trail: { life: S(1.5), kindled: S(2.5), every: S(0.25), dmg: 4, cap: 12, w: 0.7, gap: 0.25, len: 4 },
  heel: { r: 2, kr: 2.5, life: S(2), kindled: S(3), every: S(0.5), dmg: 5 },
  spark: { range: 6, v: 20, r: 0.45, dmg: 12 },
  moth: { r: 3, kr: 4.5, dmg: 10, push: 2 },
  tongue: { dmg: 2, every: S(2 / 3), ticks: 3 },
  // the hub's relics: Soot heel's cloud sets Soot on the foes in it every 0.5 s; Thorn roll's cut finds the foe within 1.5 m of the blow
  soot: { every: S(0.5) },
  thorn: { near: 1.5 },
  touch: 1.1,
  stop: 2
};

/* ---------------- the relics in one place ----------------
   makeRelics(R): R is the runner. ground lists the relics lying where an elite fell; fires, sparks and burns are the effects under way.
   take(ev) on each play step takes a relic the lamplighter stands on; step(ev) ticks the effects; scan(ev) reads what the fighter and
   the foes did this step (the relic events of moves.js, hits, the plunge's ring, a drink) and starts what the relics and wicks add */
export function makeRelics(R) {
  const G = { ground: [], fires: [], sparks: [], burns: [], age: 0 };
  const run = () => R.rs.run;
  const s = () => R.fighter.body.s;
  const holds = id => (run()?.relics || []).includes(id);
  const wick = id => (run()?.wicks || []).includes(id);
  const raw = n => n * (1 + (R.bonus?.() ?? 0));
  // a relic's hit: blade damage with Edge and Keen edge, a hit stop of 2 steps, and a hit event the combo counts
  function hitOn(t, n, from, ev, relic, more = {}) {
    if (!t.alive) return false;
    const dmg = t.hit(raw(n), { from, push: more.push || 0, knock: 0, kind: 'relic', relic });
    if (dmg === false) return false;
    ev.push({ type: 'hit', kind: 'relic', relic, target: t, dmg }, { type: 'stop', n: FIRE.stop });
    return dmg;
  }
  G.drop = (id, at) => { if (id) G.ground.push({ id, x: at[0], y: at[1], z: at[2] }); };
  G.take = ev => {
    const p = s(), r = run();
    if (!r) return;
    for (const g of G.ground.slice()) {
      if (Math.hypot(p.x - g.x, p.z - g.z) > FIRE.touch || Math.abs(p.y - g.y) > 1.6) continue;
      G.ground.splice(G.ground.indexOf(g), 1);
      if (r.relics.includes(g.id) || r.relics.length >= RELIC_MAX) continue;
      r.relics.push(g.id);
      const k = kindled(r, g.id);
      ev.push({ type: 'relic', what: 'take', relic: g.id, kindled: k, text: relicLine(g.id, r) }, { type: 'store' }, { type: 'cue', cue: 'wisp', relic: g.id });
      emit('relic-take', { id: g.id, kindled: k });
    }
  };
  G.scan = ev => {
    const r = run();
    if (!r) return;
    for (const e of ev.slice()) {
      if (e.type === 'ring' && holds('soot')) {
        // Soot heel: the plunge leaves a Soot cloud for 3 s, 2.5 m (3.5 m kindled with Heavy fall)
        const R0 = relicOf('soot'), k = kindled(r, 'soot'), rr = k ? KINDLE.find(x => x.relic === 'soot').r : R0.r;
        G.fires.push({ kind: 'soot', x: e.x, y: e.y, z: e.z, r: rr, t: 0, life: S(R0.life) });
        ev.push({ type: 'relicFx', kind: 'ring', x: e.x, y: e.y, z: e.z, r: rr, life: R0.life, soot: true }, { type: 'cue', cue: 'soot', relic: 'soot' });
      }
      if (e.type === 'drink' && holds('glass') && r.flasks > 0) {
        // Glass drink: a drink gives a 20 shell for 5 s (30 kindled with Spare oil)
        const R0 = relicOf('glass'), n = kindled(r, 'glass') ? KINDLE.find(x => x.relic === 'glass').shell : R0.shell;
        R.build?.addShell(n, S(R0.life), 'glass');
      }
      if (e.type === 'relic' && e.what === 'trail') {
        let fire = G.fires.find(f => f.kind === 'trail' && f.open);
        if (e.first || !fire) {
          if (fire) fire.open = false;
          fire = { kind: 'trail', open: true, pts: [], t: 0, life: kindled(r, 'trail') ? FIRE.trail.kindled : FIRE.trail.life, ticks: new Map(), y: e.y };
          G.fires.push(fire);
        }
        const last = fire.pts.at(-1);
        if (!last || Math.hypot(e.x - last[0], e.z - last[2]) >= FIRE.trail.gap) {
          fire.pts.push([e.x, e.y, e.z]);
          // the page draws the fire as a line of cracks from the last point (fight.js relicFx)
          if (last) ev.push({ type: 'relicFx', kind: 'line', a: last.slice(), b: [e.x, e.y, e.z], life: fire.life / 60 });
        }
      } else if (e.type === 'relic' && e.what === 'spark') {
        G.sparks.push({ x: e.x, y: e.y, z: e.z, x0: e.x, z0: e.z, ux: Math.sin(e.yaw), uz: Math.cos(e.yaw), gone: 0, hit: new Set(), left: kindled(r, 'spark') ? 2 : 1 });
      } else if (e.type === 'ring' && holds('heel')) {
        const k = kindled(r, 'heel');
        const ring = { kind: 'ring', x: e.x, y: e.y, z: e.z, r: k ? FIRE.heel.kr : FIRE.heel.r, t: 0, life: k ? FIRE.heel.kindled : FIRE.heel.life };
        G.fires.push(ring);
        ev.push({ type: 'relicFx', kind: 'ring', x: ring.x, y: ring.y, z: ring.z, r: ring.r, life: ring.life / 60 });
      } else if (e.type === 'drink' && holds('moth') && r.flasks > 0) {
        const p = s(), rr = kindled(r, 'moth') ? FIRE.moth.kr : FIRE.moth.r;
        ev.push({ type: 'relic', what: 'pulse', relic: 'moth', x: p.x, y: p.y, z: p.z, r: rr }, { type: 'relicFx', kind: 'ring', x: p.x, y: p.y, z: p.z, r: rr, life: 0.5 });
        for (const t of R.targets()) if (t.alive && Math.hypot(t.x - p.x, t.z - p.z) - t.r <= rr && Math.abs(t.y - p.y) <= 1.8) hitOn(t, FIRE.moth.dmg, [p.x, p.z], ev, 'moth', { push: FIRE.moth.push });
      } else if (e.type === 'hit' && e.kind !== 'relic' && e.kind !== 'plunge' && wick('tongue') && e.target?.alive) {
        // Ember tongue: each blade hit burns for 6 more over 2 s
        G.burns.push({ t: e.target, left: FIRE.tongue.ticks, n: 0 });
      } else if (e.type === 'glim' && wick('heart')) {
        // Glim heart: each mote taken heals 1, up to 20 a place
        if ((G.healed || 0) < 20 && r.hp < R.max()) { r.hp += 1; G.healed = (G.healed || 0) + 1; }
      }
    }
  };
  G.step = ev => {
    G.age++;
    const r = run();
    if (!r) return;
    const T = R.targets();
    for (const f of G.fires.slice()) {
      f.t++;
      if (f.kind === 'trail') {
        if (f.t % FIRE.trail.every === 0) for (const t of T) {
          if (!t.alive || (f.ticks.get(t) || 0) * FIRE.trail.dmg >= FIRE.trail.cap) continue;
          if (!f.pts.some(p => Math.hypot(t.x - p[0], t.z - p[2]) <= FIRE.trail.w + t.r && Math.abs(t.y - p[1]) <= 1.6)) continue;
          if (hitOn(t, FIRE.trail.dmg, [t.x, t.z], ev, 'trail') !== false) f.ticks.set(t, (f.ticks.get(t) || 0) + 1);
        }
      } else if (f.kind === 'soot' && f.t % FIRE.soot.every === 1) {
        for (const t of T) if (t.alive && Math.hypot(t.x - f.x, t.z - f.z) - t.r <= f.r && Math.abs(t.y - f.y) <= 1.8) statusHit(t, 'soot', STATES.soot.life);
      } else if (f.kind === 'ring' && f.t % FIRE.heel.every === 0) {
        for (const t of T) if (t.alive && Math.hypot(t.x - f.x, t.z - f.z) - t.r <= f.r && Math.abs(t.y - f.y) <= 1.6) hitOn(t, FIRE.heel.dmg, [f.x, f.z], ev, 'heel');
      }
      if (f.t >= f.life) G.fires.splice(G.fires.indexOf(f), 1);
    }
    const v = FIRE.spark.v / 60;
    for (const k of G.sparks.slice()) {
      k.x += k.ux * v; k.z += k.uz * v; k.gone += v;
      for (const t of T) {
        if (!t.alive || k.hit.has(t) || Math.hypot(t.x - k.x, t.z - k.z) > FIRE.spark.r + t.r || Math.abs(t.y - k.y) > 1.8) continue;
        k.hit.add(t);
        if (hitOn(t, FIRE.spark.dmg, [k.x - k.ux, k.z - k.uz], ev, 'spark') !== false && --k.left <= 0) break;
      }
      if (k.left <= 0 || k.gone >= FIRE.spark.range) {
        G.sparks.splice(G.sparks.indexOf(k), 1);
        ev.push({ type: 'relicFx', kind: 'spark', from: [k.x0, k.y + 0.9, k.z0], to: [k.x, k.y + 0.9, k.z] });
      }
    }
    for (const b of G.burns.slice()) {
      if (++b.n % FIRE.tongue.every) continue;
      if (b.t.alive) hitOn(b.t, FIRE.tongue.dmg, [b.t.x, b.t.z], ev, 'tongue');
      if (--b.left <= 0 || !b.t.alive) G.burns.splice(G.burns.indexOf(b), 1);
    }
  };
  /* Thorn roll: a near miss cuts the foe that swung (the live target nearest the blow, within 1.5 m of where it came from) for 12 (20
     kindled with Quick heels). It does not interrupt: no flinch, and no wind-up stopped */
  G.thorn = (from, ev) => {
    const r = run();
    if (!r || !from || !holds('thorn')) return false;
    let foe = null, best = FIRE.thorn.near;
    for (const t of R.targets()) { const d = Math.hypot(t.x - from[0], t.z - from[1]); if (t.alive && d < best) { foe = t; best = d; } }
    if (!foe) return false;
    const n = kindled(r, 'thorn') ? KINDLE.find(x => x.relic === 'thorn').dmg : relicOf('thorn').dmg;
    const dmg = foe.hit(raw(n), { from: [s().x, s().z], push: 0, knock: 0, kind: 'relic', relic: 'thorn', interrupt: false });
    if (dmg === false) return false;
    ev.push({ type: 'hit', kind: 'relic', relic: 'thorn', target: foe, dmg }, { type: 'stop', n: FIRE.stop }, { type: 'relicFx', kind: 'spark', from: [s().x, s().y + 0.9, s().z], to: [foe.x, foe.y + 0.9, foe.z] });
    return dmg;
  };
  // what the page draws (fight.js): the relic lamps on the ground, the fire lines, the burning rings and the sparks in the air
  G.view = () => ({
    ground: G.ground.map(g => ({ ...g })),
    fires: G.fires.map(f => (f.kind === 'trail' ? { kind: 'trail', pts: f.pts.map(p => p.slice()), k: f.t / f.life } : { kind: f.kind === 'soot' ? 'soot' : 'ring', x: f.x, y: f.y, z: f.z, r: f.r, k: f.t / f.life })),
    sparks: G.sparks.map(k => ({ x: k.x, y: k.y + 0.9, z: k.z }))
  });
  return G;
}
// the relic lamps lying on the ground of a place: [{ id, x, y, z }] (fight.js draws them in lamp slots 46 and 47)
export const groundRelics = R => (R?.relics?.ground || []).map(g => ({ ...g }));

/* ---------------- the page ----------------
   relicEvent(e, page) runs for each event of the runner's step, after fight.event: a toast for an elite that wakes or falls and for a
   relic taken, and the HUD. page: { toast(html, ms), hud() } */
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
export function relicEvent(e, page) {
  if (e.type === 'elite' && e.what === 'alert') page.toast(`<b>${esc(e.name)}</b> wakes`, 2200);
  else if (e.type === 'elite' && e.what === 'fall') page.toast(`<b>${esc(e.name)}</b> falls · a relic lies where it fell${e.flask ? ' · a flask fills' : ''}`, 2600);
  else if (e.type === 'relic' && e.what === 'take') { page.toast(`<b>✦</b> ${esc(e.text)}`, 2600); page.hud(); }
  else if (e.type === 'relic' && e.what === 'last') { page.toast('<b>Last ember</b> · you stand again', 2400); page.hud(); }
}
