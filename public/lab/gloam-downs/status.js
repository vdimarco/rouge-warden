// Gloam Downs: the foe states that abilities and buffs put on a foe (gloam-downs-growth design.md "The abilities", gloam-downs-hub
// design.md "New foe states"). No imports, so foes.js, abilities.js and build.js can all use it with no import loop. A state is a
// count of play steps on the foe's own `status`:
//   stun: it stands, and a wind-up under way stops; hold: the same, from a snare; slow: it walks and winds up at `slowK` of its speed;
//   burn: it is burning (Ember glass reads it; a burn with `burnDps` deals that a second here, the bomb's own burn is abilities.js's);
//   char: stacks (to 5), each 1 a second, lasting 4 s from the last added; the 5th bursts for 20 and clears them;
//   soot: 2 a second for 6 s; a sooted foe put out passes 4 s of Soot to each foe within 2.5 m, once;
//   blind: the next attack it starts in it misses (it plays and deals 0); mark: the lamplighter's next hit bursts it for 22.
// A heavy foe (an Ironback, or any elite) is never held, only slowed, and a stun or a blind on it lasts half as long. The Barrow Reeve
// is no zone's foe, so it takes no state at all, but Char's burst: its stacks count, and the 5th bursts.
// Ticks (Char, Soot, a state's burn, and every other tick a caller sends through tickHit) never make a foe flinch, never wear its poise,
// never stop a wind-up, add nothing to the combo and give no glim on their own; on one foe they deal at most 8 a second together.
const S = sec => Math.round(sec * 60);
export const STATES = {
  char: { max: 5, dps: 1, life: S(4), burst: 20 },
  soot: { dps: 2, life: S(6), pass: S(4), r: 2.5 },
  blind: { life: S(3) },
  mark: { life: S(4), burst: 22 },
  // the most ticks deal on one foe in each second of its own play steps
  cap: 8, capSpan: 60,
  // a burn of `N s` from the new sources (Wick lash, Spill glass, the Flame set, ...): 3 a second, as the Lantern bomb's
  burnDps: 3
};
export const heavyOf = f => !f?.T?.light || !!f?.elite;
export const isFoe = t => !!(t && t.zone && typeof t.zone === 'object' && t.T && t.type !== 'B');
const isBoss = t => !!(t && t.type === 'B');
const blank = () => ({ stun: 0, hold: 0, slow: 0, slowK: 1, burn: 0, burnDps: 0, char: 0, charLeft: 0, soot: 0, sootPassed: false, blind: 0, mark: 0, age: 0, ticks: [], acc: 0 });
const stOf = f => {
  const st = (f.status ||= blank());
  for (const [k, v] of Object.entries(blank())) if (!(k in st)) st[k] = v;
  return st;
};
/* put a state on a foe (a longer state wins over a shorter one). n is play steps, but Char's n is the stacks to add. o.ev: where a
   burst's events go (a hit the combo counts, its hit stop and the `char` cue); o.from: where the burst came from; o.dps: a burn's
   damage a second. -> the state put on ('stun', 'hold', 'slow', 'burn', 'char', 'soot', 'blind', 'mark', 'burst') or null when the foe
   takes none */
export function statusHit(f, kind, n, o = {}) {
  if (kind === 'char' && isBoss(f) && f.alive !== false && n > 0) {
    // the Reeve counts its stacks (none fade, it takes no ticks) and takes the burst at 5
    f.charStacks = (f.charStacks | 0) + Math.round(n);
    if (f.charStacks < STATES.char.max) return 'char';
    f.charStacks = 0;
    burst(f, STATES.char.burst, 'char', o);
    return 'burst';
  }
  if (!isFoe(f) || f.out || !(n > 0)) return null;
  const st = stOf(f);
  const heavy = heavyOf(f);
  if (kind === 'hold' && heavy) { kind = 'slow'; o = { k: o.slowK ?? 0.5 }; }
  if ((kind === 'stun' || kind === 'blind') && heavy) n = Math.round(n / 2);
  if (kind === 'slow') { const k = o.k ?? 0.5; st.slowK = st.slow > 0 ? Math.min(st.slowK, k) : k; st.slow = Math.max(st.slow, n); return 'slow'; }
  if (kind === 'burn') { st.burn = Math.max(st.burn, n); if (o.dps > 0) st.burnDps = Math.max(st.burnDps, o.dps); return 'burn'; }
  if (kind === 'stun' || kind === 'hold' || kind === 'blind' || kind === 'mark') { st[kind] = Math.max(st[kind], n); return kind; }
  // Soot passed on by a foe put out marks itself, so it does not pass again; a fresh Soot renews it and may pass
  if (kind === 'soot') {
    if (!o.passed) { st.soot = Math.max(st.soot, n); st.sootPassed = false; } else if (n > st.soot) { st.soot = n; st.sootPassed = true; }
    return 'soot';
  }
  if (kind === 'char') {
    st.char = Math.min(STATES.char.max, st.char + Math.round(n));
    st.charLeft = STATES.char.life;
    if (st.char < STATES.char.max) return 'char';
    st.char = 0; st.charLeft = 0;
    burst(f, STATES.char.burst, 'char', o);
    return 'burst';
  }
  return null;
}
// a burst of Char or Mark: a hit under the fair-fight rules (it interrupts as a blade hit does), with its hit stop and its cue
function burst(f, n, why, o = {}) {
  const dmg = f.hit(n, { from: o.from || null, push: 0, knock: 0, kind: 'ability', ability: why, state: why, interrupt: true });
  if (dmg === false || !o.ev) return dmg;
  o.ev.push({ type: 'hit', kind: 'relic', state: why, target: f, dmg }, { type: 'stop', n: 2 }, { type: 'cue', cue: 'char', state: why, on: [f.type || 'post'] });
  return dmg;
}
/* the lamplighter's hit landed on a marked foe: the mark bursts for 22 (once). foes.js calls it after every hit that is not a tick and
   not a burst itself. -> the burst's damage, or 0 */
export function markHit(f, how = {}, ev = null) {
  const st = f?.status;
  if (!st || !(st.mark > 0) || how.tick || how.state) return 0;
  st.mark = 0;
  const d = burst(f, STATES.mark.burst, 'mark', { ev, from: how.from });
  return d === false ? 0 : d;
}
/* one tick on a foe: raw damage, inside the 8-a-second cap that every tick on the foe shares, sent as a tick (foes.js: the damage and
   its flash, nothing else). -> the damage dealt (0 when the cap is spent) */
export function tickHit(f, raw, ev = null, o = {}) {
  // the Barrow Reeve takes no ticks at all (only Char's burst, statusHit)
  if (!f?.alive || isBoss(f)) return 0;
  let n = Math.round(raw);
  // the cap: the ticks of the last 60 play steps of this foe (a rolling second) add to at most 8
  if (o.capped !== false && isFoe(f)) {
    const st = stOf(f);
    st.ticks = (st.ticks || []).filter(([at]) => st.age - at < STATES.capSpan);
    n = Math.min(n, STATES.cap - st.ticks.reduce((a, [, k]) => a + k, 0));
    if (n > 0) st.ticks.push([st.age, n]);
  }
  if (!(n > 0)) return 0;
  const dmg = f.hit(n, { from: o.from || null, push: 0, knock: 0, kind: 'tick', tick: true, ability: o.id || 'tick', interrupt: false });
  if (dmg === false) return 0;
  if (ev) ev.push({ type: 'tick', target: f, dmg, id: o.id || 'tick' });
  return dmg;
}
/* one play step of the ticking states, before the foe's mind (foes.js): Char's stacks, Soot and a burn with its damage a second deal
   their share (whole numbers as they add up), inside the cap; Char, Soot, Blind and Mark count down. ctx.ev: the step's events */
export function statusTick(f, ctx = {}) {
  const st = f?.status;
  if (!st || !isFoe(f) || f.out) return;
  st.age++;
  if (!f.alive) return;
  let rate = 0;
  if (st.char > 0) rate += st.char * STATES.char.dps;
  if (st.soot > 0) rate += STATES.soot.dps;
  if (st.burn > 0 && st.burnDps > 0) rate += st.burnDps;
  st.acc += rate / 60;
  if (st.acc >= 1 - 1e-9) { const n = Math.floor(st.acc + 1e-9); st.acc = Math.max(0, st.acc - n); tickHit(f, n, ctx.ev, { id: 'state' }); }
  if (!rate) st.acc = 0;
  if (st.charLeft > 0 && --st.charLeft === 0) st.char = 0;
  if (st.soot > 0) st.soot--;
  if (st.blind > 0) st.blind--;
  if (st.mark > 0) st.mark--;
  if (st.burn <= 0) st.burnDps = 0;
}
/* a foe put out: a sooted foe passes 4 s of Soot to each foe within 2.5 m, once (Soot passed on does not pass again). -> the foes it
   passed to */
export function statusOut(f, foes = []) {
  const st = f?.status;
  if (!st || !(st.soot > 0) || st.sootPassed) return [];
  const out = [];
  for (const g of foes) {
    if (g === f || !g.alive || g.out || !isFoe(g)) continue;
    if (Math.hypot(g.x - f.x, g.z - f.z) - (g.r || 0) > STATES.soot.r - (g.r || 0) || Math.abs(g.y - f.y) > 2) continue;
    if (statusHit(g, 'soot', STATES.soot.pass, { passed: true })) out.push(g);
  }
  st.soot = 0;
  return out;
}
// a foe starts an attack: blind, it misses (the blind is spent). -> true when this attack misses
export function blindMiss(f) {
  const st = f?.status;
  if (!st || !(st.blind > 0)) return false;
  st.blind = 0;
  return true;
}
/* one play step of a foe's states: -> { stop, speed }. stop: it does nothing this step (a stun or a hold); speed: the share of its walk
   and wind-up it keeps (a slow). Each count goes down by one */
export function statusStep(f) {
  const st = f.status;
  if (!st) return { stop: false, speed: 1 };
  const stop = st.stun > 0 || st.hold > 0;
  const speed = st.slow > 0 ? st.slowK : 1;
  for (const k of ['stun', 'hold', 'slow', 'burn']) if (st[k] > 0) st[k]--;
  if (st.slow <= 0) st.slowK = 1;
  return { stop, speed };
}
// what the page and the tests read of a foe's new states
export const statesOf = f => {
  const st = f?.status;
  return st ? { char: st.char | 0, soot: st.soot > 0, blind: st.blind > 0, mark: st.mark > 0, burn: st.burn > 0 } : { char: 0, soot: false, blind: false, mark: false, burn: false };
};
