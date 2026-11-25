// Gloam Downs: the foe states that abilities put on a foe (gloam-downs-growth design.md "The abilities"). No imports, so foes.js and
// abilities.js can both use it with no import loop. A state is a count of play steps on the foe's own `status`:
//   stun: it stands, and a wind-up under way stops; hold: the same, from a snare; slow: it walks and winds up at `slowK` of its speed;
//   burn: it is burning (Ember glass reads it; the burn's damage is abilities.js's).
// A heavy foe (an Ironback, or any elite) is never held, only slowed, and a stun on it lasts half as long. The Barrow Reeve is no
// zone's foe, so it takes no state at all: abilities only hurt it.
export const heavyOf = f => !f?.T?.light || !!f?.elite;
export const isFoe = t => !!(t && t.zone && typeof t.zone === 'object' && t.T && t.type !== 'B');
/* put a state on a foe for n play steps (a longer state wins over a shorter one). -> the state put on ('stun', 'hold', 'slow', 'burn')
   or null when the foe takes none */
export function statusHit(f, kind, n, o = {}) {
  if (!isFoe(f) || f.out || !(n > 0)) return null;
  const st = (f.status ||= { stun: 0, hold: 0, slow: 0, slowK: 1, burn: 0 });
  const heavy = heavyOf(f);
  if (kind === 'hold' && heavy) { kind = 'slow'; o = { k: o.slowK ?? 0.5 }; }
  if (kind === 'stun' && heavy) n = Math.round(n / 2);
  if (kind === 'slow') { const k = o.k ?? 0.5; st.slowK = st.slow > 0 ? Math.min(st.slowK, k) : k; st.slow = Math.max(st.slow, n); return 'slow'; }
  if (kind === 'stun' || kind === 'hold' || kind === 'burn') { st[kind] = Math.max(st[kind], n); return kind; }
  return null;
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
