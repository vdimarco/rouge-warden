// Gloam Downs: the combo. Each hit that lands on a foe or the boss adds 1, up to 3 for one swing (the hits of one play step), and a
// relic's hit adds at most 1 each 0.25 s. The combo ends when the lamplighter takes damage (a near miss does not end it), after 3.0 s
// of play with no hit, or when the place ends. Its tier raises the glim a foe drops and brightens the lamp: tier I from 5 hits, II from
// 10, III from 20 (after Devil May Cry's style meter, kept to one number and a tier). No DOM: the fight feeds it, the page shows it.
// Times are in play steps of 1/60 s, so hit stop does not eat the 3 s; the fade of the meter counts game steps.
import { emit as busEmit } from './bus.js';

export const COMBO = {
  tiers: [5, 10, 20], factor: [1, 1.2, 1.5, 2], lamp: [1, 1.15, 1.3, 1.5], dabs: [0, 6, 12, 18],
  window: 180, perSwing: 3, relicGap: 15, show: 2, fade: 24
};
export const tierOf = n => (n >= COMBO.tiers[2] ? 3 : n >= COMBO.tiers[1] ? 2 : n >= COMBO.tiers[0] ? 1 : 0);
// the glim a foe put out drops at this tier, rounded down (wisps and the boss's 30 never change)
export const comboGlim = (glim, tier = 0) => Math.floor(glim * (COMBO.factor[tier] ?? 1) + 1e-9);

/* makeCombo({ emit, best }): emit(name, detail) is the bus (bus.js, by default), which hears 'combo-tier' { tier, n } on each change of tier;
   best is the best combo of the run so far */
export function makeCombo({ emit = busEmit, best = 0 } = {}) {
  const C = { n: 0, tier: 0, left: 0, best, play: 0, game: 0, endedAt: -1e9, last: 0, swingAt: -1, swingN: 0, relicAt: -1e9 };
  const setTier = () => {
    const t = tierOf(C.n);
    if (t !== C.tier) { C.tier = t; emit?.('combo-tier', { tier: t, n: C.n }); }
  };
  /* a hit that landed: kind is the blade's cut1, cut2, fin or plunge, 'boss' for any hit on the boss, or 'relic'. -> what it added */
  C.hit = (kind = 'cut1') => {
    if (kind === 'relic') {
      if (C.play - C.relicAt < COMBO.relicGap) return 0;
      C.relicAt = C.play;
    } else {
      if (C.swingAt !== C.play) { C.swingAt = C.play; C.swingN = 0; }
      if (C.swingN >= COMBO.perSwing) return 0;
      C.swingN++;
    }
    C.n++;
    C.last = C.n;
    C.left = COMBO.window;
    C.best = Math.max(C.best, C.n);
    setTier();
    return 1;
  };
  // the combo ends: damage taken, the 3 s run out, or the place ends
  C.end = () => {
    if (!C.n) return false;
    C.n = 0; C.left = 0; C.endedAt = C.game;
    setTier();
    return true;
  };
  // one game step; play is true when the play clock runs in it
  C.tick = (play = true) => {
    C.game++;
    if (!play) return;
    C.play++;
    if (C.n && --C.left <= 0) C.end();
  };
  // set the combo as a test does: n hits with the full 3 s left
  C.set = n => { C.n = Math.max(0, n | 0); C.last = C.n || C.last; C.left = C.n ? COMBO.window : 0; C.best = Math.max(C.best, C.n); if (!C.n) C.endedAt = C.game; setTier(); return C.view(); };
  C.factor = () => COMBO.factor[C.tier];
  C.lamp = () => COMBO.lamp[C.tier];
  C.dabs = () => COMBO.dabs[C.tier];
  /* what the HUD shows: the meter from 2 hits; after the combo ends it shows the last count while it fades over 0.4 s (24 steps).
     -> { show, n, tier, left (0..1), fading } */
  C.meter = () => {
    if (C.n >= COMBO.show) return { show: true, n: C.n, tier: C.tier, left: C.left / COMBO.window, fading: false };
    const since = C.game - C.endedAt;
    if (!C.n && C.last >= COMBO.show && since < COMBO.fade) return { show: true, n: C.last, tier: tierOf(C.last), left: 0, fading: true };
    return { show: false, n: C.n, tier: C.tier, left: C.left / COMBO.window, fading: false };
  };
  C.view = () => ({ n: C.n, tier: C.tier, left: +(C.left / 60).toFixed(3) });
  return C;
}
