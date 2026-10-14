// Ahead of the Light: the director (final.md 7.5, 11.7). A breather after a peak (Alien: Isolation, Left 4 Dead):
// when your ship leaves the glare, or after 4 s inside it, survival emits `breather`. For BREATHER_S the director then
// drops every optional item more than 1.3 s and less than 5 s ahead of you, and any knot in that window within 30°
// and 2 beats of one it keeps. Nothing else adapts: no density change after a hit or a death, no hidden help. It
// runs inside the step, so it stays deterministic. Leg items are frozen, so what it drops lives in
// race.director.dropped ({ [itemId]: true }); handle.js and the renderer skip those (isDropped). Pure.
import { TUNE } from '../tune.js';
import { beatsPerS, wrap } from '../ringmath.js';

const NEAR_DEG = 30, NEAR_BEATS = 2;

// Has the director dropped this item?
export const isDropped = (race, item) => !!(race.director && race.director.dropped && race.director.dropped[item.id]);

export function stepDirector(race, events, tune = TUNE) {
  const you = race.ships && race.ships[0];
  if (!you || !race.leg) return;
  const D = race.director || (race.director = { breatherUntil: 0 });
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'breather' && e.ship === you.id) D.breatherUntil = race.t + tune.BREATHER_S;
  }
  if (!(race.t < D.breatherUntil)) return;
  if (!D.dropped) D.dropped = {};
  if (!D.decided) D.decided = {};
  const bps = beatsPerS(you.eta, tune, you.lightspeed);
  const lo = you.dist + tune.TICK_LEAD * bps, hi = you.dist + 5 * bps;
  const items = race.leg.items;
  const from = race.win ? race.win.lo : 0, to = race.win ? race.win.hi : items.length;
  for (let k = from; k < to; k++) {
    const it = items[k];
    if (it.beat <= lo || it.beat >= hi || D.decided[it.id]) continue;
    D.decided[it.id] = true;
    if (it.opt) { D.dropped[it.id] = true; continue; }
    if (it.kind !== 'knot' && it.kind !== 'pulse') continue;
    // a knot kept in the window, or decided earlier and still ahead, within 30° and 2 beats: drop this one
    for (let j = from; j < to; j++) {
      const o = items[j];
      if (o === it || (o.kind !== 'knot' && o.kind !== 'pulse') || !D.decided[o.id] || D.dropped[o.id]) continue;
      if (o.beat > it.beat || it.beat - o.beat > NEAR_BEATS || o.beat <= you.dist) continue;
      if (Math.abs(wrap(o.psi - it.psi)) < NEAR_DEG) { D.dropped[it.id] = true; break; }
    }
  }
}
