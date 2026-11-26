// Gloam Downs: the elites. One in each place: the place's own foe at 1.25 times the size, with an ember crown, more health, 15 glim,
// and a special move with a clear warning of at least 0.5 s. It stands in a zone that the seed picks, never the first zone or a guard
// zone. When it is put out it drops a relic (run.js and relics.js). Here also the Ember rules that change every foe of a place (the
// cooldowns at Ember 2, the elites' health at Ember 1 and their special move at Ember 4).
// foes.js calls eliteKit once, after its zones are set up, and kit.think(f, ev) at the start of each foe's mind: it returns
// { want } while an elite's special move runs (the foe's velocity, as runMove's), or null to let the plain mind go on. No DOM.
// design.md "Elites".
import { stream, ember, emberOf } from './run.js';
import { emit } from './bus.js';

const S = sec => Math.round(sec * 60);
const DEG = Math.PI / 180, STEP = 1 / 60, LAMP_R = 0.35;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export const ELITE = { size: 1.25, glim: 15, share: 0.4, cap: 6 };
/* the five elites. special: the move's phases in play steps, in order (w wind-up, a active, r recovery), and its numbers */
export const ELITES = {
  gaol: {
    id: 'wardmother', name: 'The Wardmother', type: 'S', hp: 120, move: 'double hook',
    special: { kind: 'hooks', phases: [['w', S(0.55)], ['a', S(0.15)], ['w', S(0.35)], ['a', S(0.15)], ['r', S(0.7)]], range: 3.2, dmg: 16 }
  },
  ramparts: {
    id: 'rookchief', name: 'The Rookchief', type: 'P', hp: 70, move: 'three coals',
    special: { kind: 'coals', phases: [['w', S(1.0)], ['a', S(0.15)], ['r', S(0.4)]], min: 3, range: 11, ring: 1.2, apart: 2.5, dmg: 18, release: 4, flight: S(0.65), rise: 1.6 }
  },
  fen: {
    id: 'fenwick', name: 'The Fen-wick', type: 'M', hp: 40, move: 'split or a double pulse',
    special: { kind: 'pulses', phases: [['w', S(0.5)], ['a', S(0.15)], ['w', S(0.5)], ['a', S(0.15)], ['r', S(0.6)]], range: 2.0, ring: 2.2, rise: 1.8, dmg: 18 },
    split: { at: 0.5, hp: 14, n: 2 }
  },
  bells: {
    id: 'bellwether', name: 'The Bellwether', type: 'I', hp: 220, move: 'a bent charge',
    special: { kind: 'bent', phases: [['w', S(0.9)], ['a', S(0.7)], ['r', S(1.4)]], min: 3, range: 9, fix: S(0.4), part: 3.5, bend: 40 * DEG, v: 10, width: 1.6, dmg: 24, push: 3, drop: 0.6, past: 3 }
  },
  barrows: {
    id: 'cairnwarden', name: 'The Cairnwarden', type: 'S', hp: 140, move: 'a full-turn sweep',
    special: { kind: 'sweep', phases: [['w', S(0.8)], ['a', S(0.15)], ['r', S(0.8)]], range: 3.2, track: 1.2, near: 1.6, ring: 2.6, dmg: 20, rise: 1.0, air: 0.35 }
  }
};
export const ELITE_LIST = Object.values(ELITES);
// the steps the whole move warns for before the first active step, and the total length
export const specialSteps = sp => sp.phases.reduce((n, [, k]) => n + k, 0);
// the phase of a special move at t steps: { ph: 'w' | 'a' | 'r' | 'end', i (the phase's index), at (steps into it), n (its length) }
export function specialPhase(sp, t) {
  let left = t;
  for (let i = 0; i < sp.phases.length; i++) {
    const [ph, n] = sp.phases[i];
    if (left < n) return { ph, i, at: left, n };
    left -= n;
  }
  return { ph: 'end', i: sp.phases.length, at: 0, n: 0 };
}

/* the zone that holds a place's elite: a zone the bake marked (mix.js may set `elite`), or else one the seed's `elite/<place>` stream
   picks from the zones that are not the first, a guard or the arena. A zone with a foe of the elite's type is preferred; else the
   elite is added to a zone with room under the cap of six. -> the zone's index in zones, or -1 */
export function eliteZone(zones, place, seed) {
  const def = ELITES[place];
  if (!def || !zones?.length) return -1;
  // mix.js marks the zone with the elite's index in its foes, and that index may be 0
  const marked = zones.findIndex(z => Number.isInteger(z.elite) || z.elite === true);
  if (marked >= 0) return marked;
  const all = zones.map((z, i) => ({ z, i })).filter(({ z }) => !z.guard && !z.boss), ok = all.filter(({ i }) => i > 0);
  const holds = ({ z }) => [...(z.foes || '')].includes(def.type);
  const own = ok.filter(holds);
  /* when only the first zone holds the type (The Bell Knoll's one Ironback, in B1), the elite stands there: a second Ironback added to
     another zone would wait for the pool's one Ironback slot, and the zone it joined could stay asleep while B1 is awake */
  const first = all.filter(holds);
  const room = ok.filter(({ z }) => [...(z.foes || '')].length < ELITE.cap);
  const list = own.length ? own : first.length ? first : room;
  if (!list.length) return -1;
  return list[Math.floor(stream(seed, `elite/${place}`)() * list.length)].i;
}
// what the page draws for a foe (fight.js): its size and the ember crown of six spark dabs in slot 34 that circle its head
export const dressOf = f => ({ size: f?.size || 1, crown: !!f?.elite, slot: 34, dabs: f?.elite ? 6 : 0, glow: f?.special?.glow ?? null });
// the clip an elite's special move poses with: the base move's own clips (fight.js poses the foe with it in place of poseOf)
export function eliteClip(f) {
  const sp = f?.special;
  if (!sp) return null;
  const P = specialPhase(sp.def, sp.t), base = { hooks: 'hook', coals: 'lob', pulses: 'pulse', bent: 'charge', sweep: 'slam' }[sp.def.kind];
  const part = P.ph === 'w' ? 'windup' : P.ph === 'a' ? 'attack' : 'recover';
  return { clip: `${base}.${part}`, t: P.at / 60 };
}

/* ---------------- the kit in makeFoes ----------------
   ctx gives what the kit needs of foes.js: walk, meta, seed, place, lamp(), mayAttack(f, kind), strike(f, dmg, from, ev, o),
   groundY(x, z, y), faceLamp(f, s), towards(f, x, z, v), inLeash(f, x, z), sees(f, s), hookReaches(f, M, s), coolOf(T), inRing,
   makeFoe(zone, type, k, home), homeSpots(walk, zone, n), place(f, p) */
export function eliteKit(F, ctx) {
  const K = { foe: null, at: -1, rng: stream(ctx.seed, `elite-moves/${ctx.placeId}`) };
  const def = ELITES[ctx.placeId];
  const zones = F.zones.filter(Z => !Z.boss);
  const zi = def ? eliteZone(zones.map(Z => ({ id: Z.id, foes: Z.members.map(m => m.type).join(''), guard: Z.guard, boss: Z.boss, elite: (ctx.meta.zones || []).find(z => z.id === Z.id)?.elite })), ctx.placeId, ctx.seed) : -1;
  if (zi >= 0) {
    const Z = zones[zi];
    // the foe mix.js marked, when it is of the elite's type; else the zone's first foe of that type
    const k = (ctx.meta.zones || []).find(z => z.id === Z.id)?.elite;
    let f = Number.isInteger(k) && Z.members[k]?.type === def.type ? Z.members[k] : Z.members.find(m => m.type === def.type);
    if (!f) {
      // no foe of its type there: the elite joins the zone, and the zone's homes are laid again for one more
      const spots = ctx.homeSpots(ctx.walk, Z, Z.members.length + 1);
      Z.members.forEach((m, k) => { m.home = spots[k]; ctx.placeFoe(m, spots[k]); });
      f = ctx.makeFoe(Z, def.type, Z.members.length, spots[Z.members.length]);
      f.yaw = Z.members[0]?.yaw ?? 0;
      Z.members.push(f);
      Z.foes = Z.members.map(m => m.type).join('');
      F.foes.push(f);
    }
    makeElite(f, def);
    K.foe = f;
    K.zone = Z.id;
  }
  F.elite = () => K.foe;
  function makeElite(f, d) {
    f.elite = d;
    f.size = ELITE.size;
    f.T = { ...f.T, hp: d.hp, glim: ELITE.glim, r: f.T.r * ELITE.size };
    f.hp = d.hp;
    f.r = f.T.r;
    if (f.body) f.body.P.radius = f.T.r;
    f.pick = null;
  }
  const lv = () => emberOf(F.runner?.rs.run);
  // the Ember rules on a foe, once, on its first think: cooldowns 15% shorter (the warnings keep their length) and the elite's health
  function emberOnce(f) {
    f.embered = true;
    const E = ember(lv());
    if (E.cool !== 1) f.T = { ...f.T, cool: f.T.cool.map(c => c * E.cool) };
    if (f.elite && E.eliteHp !== 1) { const hp = Math.round(f.elite.hp * E.eliteHp); f.hp = Math.round(f.hp * E.eliteHp); f.T = { ...f.T, hp }; }
  }
  // a token held by a foe with no move (a special move cut short by a knock-down, a stun or a death) goes back
  function tidy() {
    if (K.at === F.step) return;
    K.at = F.step;
    for (const g of F.melee) if (g.elite && !g.move && !g.special) F.melee.delete(g);
    // the runner learns which foe is the elite, so its fall drops the relic (run.js eliteOut)
    if (F.runner && K.foe) F.runner.elite = K.foe;
  }
  function end(f) {
    const sp = f.special;
    F.melee.delete(f);
    if (F.coal === f && !F.coals.some(c => c.f === f)) F.coal = null;
    if (!F.coals.some(c => c.f === f)) { f.marker = null; f.markers = null; }
    f.lane = null;
    f.special = null;
    f.pick = null;
    return sp;
  }
  K.think = (f, ev) => {
    tidy();
    if (!f.embered) emberOnce(f);
    if (!f.elite) return null;
    const s = ctx.lamp();
    if (!s) return null;
    if (F.runner) F.runner.elite = f;
    if (!f.alerted) {
      f.alerted = true;
      ev.push({ type: 'elite', what: 'alert', name: f.elite.name, place: ctx.placeId, foe: f.id, zone: f.zone.id });
      emit('elite-alert', { place: ctx.placeId, type: f.type, name: f.elite.name });
    }
    // the Fen-wick at half health: two Mirelights stand in its place when two Mirelight slots are free
    if (f.elite.split && !f.split && f.hp <= f.T.hp * f.elite.split.at && f.hp > 0) {
      f.split = true;
      if (ctx.freeOf('M') >= f.elite.split.n && F.awake().length - 1 + f.elite.split.n <= ELITE.cap) {
        if (f.special) end(f);
        const at = [f.x, f.y, f.z], yaw = f.yaw;
        ctx.putOut(f, ev, at);
        const ids = [];
        for (let k = 0; k < f.elite.split.n; k++) {
          const a = yaw + Math.PI / 2 + k * Math.PI, r = F.spawn('M', at[0] + Math.sin(a) * 0.8, at[2] + Math.cos(a) * 0.8, yaw);
          if (r.ok) { const m = F.find(r.id); m.hp = f.elite.split.hp; ids.push(r.id); }
        }
        ev.push({ type: 'elite', what: 'split', foe: f.id, into: ids });
        return { want: null };
      }
    }
    // a special move cut short (a knock-down, a stun, a sink) ends; one under way runs this step
    if (f.special && f.special.at !== F.step - 1) end(f);
    if (f.special) { f.special.at = F.step; return { want: run(f, s, ev) }; }
    if (!f.aware || f.cool > 0) { f.pick = null; return null; }
    if (f.flinch > 0) return null;
    // after each attack the elite picks its next: the special move 40% of the time, or 80% at Ember 4
    if (f.pick === null) f.pick = K.rng() < Math.min(1, ELITE.share * ember(lv()).special);
    if (!f.pick || !ready(f, s)) return null;
    start(f, s, ev);
    return { want: null };
  };
  // the steps from a special move's start to its first blow (a coal's landing for the three coals), for the spacing (foes.js)
  const firstBlow = sp => { let t = 0; for (const [ph, n] of sp.phases) { if (ph === 'a') break; t += n; } return t + (sp.kind === 'coals' ? sp.release + sp.flight : 0); };
  function ready(f, s) {
    const sp = f.elite.special, d = Math.hypot(s.x - f.x, s.z - f.z), level = Math.abs(s.y - f.y) < 1.6;
    if (sp.kind === 'coals') {
      if (!(d >= sp.min && d <= sp.range && ctx.sees(f, s))) { f.ready = 0; return false; }
      f.ready++;
      return ctx.mayAttack(f, 'coal', firstBlow(sp));
    }
    const ok = sp.kind === 'bent' ? d >= sp.min && d <= sp.range && level && ctx.sees(f, s) : d <= sp.range && level && ctx.sees(f, s);
    if (!ok) { f.ready = 0; return false; }
    f.ready++;
    return ctx.mayAttack(f, 'melee', firstBlow(sp));
  }
  function start(f, s, ev) {
    const sp0 = f.elite.special, off = F.offOf(f);
    // off screen, the first wind-up is 0.25 s longer (foes.js FAIR.offWind), and its tell keeps a voice
    const sp = off ? { ...sp0, phases: sp0.phases.map(([ph, n], i) => [ph, i === 0 ? n + S(0.25) : n]) } : sp0;
    if (sp.kind === 'coals') F.coal = f;
    else F.melee.add(f);
    f.special = { def: sp, t: 0, at: F.step, landed: false, glow: null };
    f.ready = 0;
    f.marker = null; f.markers = null;
    if (sp.kind === 'coals') {
      const aim = [s.x, ctx.groundY(s.x, s.z, s.y), s.z], dx = aim[0] - f.x, dz = aim[2] - f.z, l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l;
      f.special.aims = [-1, 0, 1].map(k => { const x = aim[0] + px * k * sp.apart, z = aim[2] + pz * k * sp.apart; return [x, ctx.groundY(x, z, aim[1]), z]; });
      f.markers = f.special.aims.map(a => ({ kind: 'ring', x: a[0], y: a[1], z: a[2], full: sp.ring }));
      f.marker = f.markers[1];
    } else if (sp.kind === 'pulses' || sp.kind === 'sweep') {
      f.marker = { kind: 'ring', x: f.x, y: ctx.groundY(f.x, f.z, f.y), z: f.z, full: sp.ring };
    } else if (sp.kind === 'bent') {
      lane(f, s);
    }
    ev.push({ type: 'cue', cue: { hooks: 'scrape', coals: 'whistle', pulses: 'hum', bent: 'paw', sweep: 'rear' }[sp.kind], foe: f.id, elite: sp.kind, ...(off ? { off: true } : {}) });
  }
  // the bent charge's lane: a first part along the facing, and a second bent by up to 40° toward the lamplighter at its end
  function lane(f, s) {
    const sp = f.elite.special, ux = Math.sin(f.yaw), uz = Math.cos(f.yaw), mx = f.x + ux * sp.part, mz = f.z + uz * sp.part;
    const bend = clamp(wrap(Math.atan2(s.x - mx, s.z - mz) - f.yaw), -sp.bend, sp.bend);
    f.lane = { x: f.x, y: f.y, z: f.z, yaw: f.yaw, mx, mz, bend, yaw2: f.yaw + bend };
    f.marker = { kind: 'lane', x: f.x, y: f.y, z: f.z, yaw: f.yaw, full: sp.part, bend: { x: mx, z: mz, yaw: f.yaw + bend, full: sp.part } };
  }
  // one play step of a special move -> the velocity it wants, as runMove's
  function run(f, s, ev) {
    const sp = f.special, d = sp.def, P = specialPhase(d, sp.t);
    sp.t++;
    if (P.ph === 'end') { end(f); f.cool = ctx.coolOf(f.T); return null; }
    // the token is held to the end of the recovery (end gives it back); each blow's first active step counts for the spacing
    if (P.ph === 'a' && P.at === 0 && d.kind !== 'coals') F.blowNow();
    if (P.ph === 'w' && P.at === 0) sp.landed = false;
    // an elite that hit steps back in its recovery
    if (P.ph === 'r' && f.back > 0) return F.backOff(f);
    sp.glow = P.ph === 'w' && P.i > 0 ? { k: P.at / P.n } : null;
    switch (d.kind) {
      case 'hooks': {
        const M = f.T.moves.hook;
        if (P.ph === 'w') {
          ctx.faceLamp(f, s);
          const dist = Math.hypot(s.x - f.x, s.z - f.z);
          return P.i === 0 && dist > f.T.r + LAMP_R + 1.0 ? ctx.towards(f, ...ctx.inLeash(f, s.x, s.z), M.track) : { hard: [0, 0] };
        }
        if (P.ph === 'a') {
          if (!sp.landed && ctx.hookReaches(f, M, s)) sp.landed = ctx.strike(f, d.dmg, [f.x, f.z], ev);
          if (P.at === P.n - 1) ev.push({ type: 'cue', cue: 'scrape', foe: f.id });
          const v = (M.step * 60) / P.n, ux = Math.sin(f.yaw), uz = Math.cos(f.yaw), c = f.zone.c;
          if (Math.hypot(f.x + ux * v * STEP - c[0], f.z + uz * v * STEP - c[2]) > f.zone.leash) return { hard: [0, 0] };
          return { hard: [ux * v, uz * v] };
        }
        return { hard: [0, 0] };
      }
      case 'coals': {
        if (P.ph === 'w') { ctx.turnTo(f, Math.atan2(sp.aims[1][0] - f.x, sp.aims[1][2] - f.z)); return null; }
        if (P.ph === 'a' && P.at === d.release) {
          const hand = [f.x + Math.sin(f.yaw) * 0.3, f.y + 1.9, f.z + Math.cos(f.yaw) * 0.3];
          for (const a of sp.aims) F.coals.push({ f, from: hand.slice(), to: a.slice(), t: 0, n: d.flight, R: d.ring, dmg: d.dmg, rise: d.rise });
          ev.push({ type: 'cue', cue: 'whistle', foe: f.id });
        }
        return null;
      }
      case 'pulses': {
        if (P.ph === 'w') { f.marker = { kind: 'ring', x: f.x, y: ctx.groundY(f.x, f.z, f.y), z: f.z, full: d.ring }; return { hard: [0, 0] }; }
        if (P.ph === 'a') {
          const m = f.marker;
          if (P.at === 0) ev.push({ type: 'burst', kind: 'pulse', x: m.x, y: m.y, z: m.z, r: d.ring }, { type: 'cue', cue: 'pulse', foe: f.id });
          if (!sp.landed && ctx.inRing(s, m.x, m.y, m.z, d.ring, d.rise)) sp.landed = ctx.strike(f, d.dmg, [f.x, f.z], ev);
        }
        return { hard: [0, 0] };
      }
      case 'bent': {
        if (P.ph === 'w') {
          // the lane follows the aim until 0.4 s before the run, then stands still with both its parts shown
          if (P.at < P.n - d.fix) { ctx.faceLamp(f, s); lane(f, s); }
          return { hard: [0, 0] };
        }
        if (P.ph === 'a') {
          const L = f.lane;
          if (!L) return { hard: [0, 0] };
          if (P.at === 0) { ev.push({ type: 'cue', cue: 'charge', foe: f.id }); L.run = 0; L.px = f.x; L.pz = f.z; }
          // the run so far: the first part along the lane, then the second along the bend
          L.run += Math.hypot(f.x - L.px, f.z - L.pz);
          L.px = f.x; L.pz = f.z;
          const yaw = L.run < d.part ? L.yaw : L.yaw2, ux = Math.sin(yaw), uz = Math.cos(yaw);
          f.yaw = yaw;
          const b = f.body.s, ahead = f.T.r + 0.15 + d.v * STEP, fl = ctx.walk.floorAt(b.x + ux * ahead, b.z + uz * ahead, b.y + 0.65, b.y), c = f.zone.c;
          const gone = L.run >= 2 * d.part;
          if (fl < b.y - d.drop || gone || Math.hypot(b.x + ux * d.v * STEP - c[0], b.z + uz * d.v * STEP - c[2]) > f.zone.leash + d.past) {
            sp.t = specialSteps(d) - d.phases.at(-1)[1];
            f.marker = null;
            b.vx = b.vz = 0;
            return { hard: [0, 0] };
          }
          if (!sp.landed && Math.hypot(s.x - f.x, s.z - f.z) <= f.T.r + LAMP_R + d.width / 2 - 0.3 && Math.abs(s.y - f.y) <= 1.6)
            sp.landed = ctx.strike(f, d.dmg, [f.x, f.z], ev, { push: d.push });
          if (P.at === P.n - 1) { f.marker = null; return { hard: [0, 0] }; }
          return { hard: [ux * d.v, uz * d.v], wall: true };
        }
        return { hard: [0, 0] };
      }
      case 'sweep': {
        if (P.ph === 'w') { ctx.faceLamp(f, s); f.marker = { kind: 'ring', x: f.x, y: ctx.groundY(f.x, f.z, f.y), z: f.z, full: d.ring }; return Math.hypot(s.x - f.x, s.z - f.z) > d.near ? ctx.towards(f, ...ctx.inLeash(f, s.x, s.z), d.track) : { hard: [0, 0] }; }
        if (P.ph === 'a') {
          const m = f.marker;
          if (P.at === 0) ev.push({ type: 'burst', kind: 'slam', x: m.x, y: m.y, z: m.z, r: d.ring }, { type: 'cue', cue: 'slam', foe: f.id });
          // a jump passes it: the feet more than 0.35 m over the ground
          const air = !s.ground && s.y - ctx.groundY(s.x, s.z, s.y) > d.air;
          if (!sp.landed && !air && ctx.inRing(s, m.x, m.y, m.z, d.ring, d.rise + 1)) sp.landed = ctx.strike(f, d.dmg, [f.x, f.z], ev);
          if (P.at === P.n - 1) f.marker = null;
        }
        return { hard: [0, 0] };
      }
    }
    return null;
  }
  return K;
}
