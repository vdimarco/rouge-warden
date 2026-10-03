// js/story/combat/playermoves.js : the hero's moves and weapons. Timing comes from js/moves.js (PATK for
// the ronin set, GABE_ATK for the fists), in seconds of the source clip: clip time = spec.from + actor.t.
// A move: {clip, from, at, speed, hit:[t0,t1], dmg, post, reach, arc, cost, next, cancel, lunge:[t0,t1,v], snd, end}
// - at: where in the cut the move starts (two jabs share one clip); end: the clip time the move is over
//   (else the cut's end).
import { PATK, GABE_ATK, CREW, TUNE } from '../../moves.js';

const ronin = (name) => { const p = PATK[name]; return { ...p, clip: `ronin:${p.cut}`, at: 0 }; };
const J = GABE_ATK;

// the ronin set: foam katana, pool cue, the Ranger's Staff (and the stool's one swing)
const BLADE = {
  l1: ronin('l1'), l2: ronin('l2'), l3: ronin('l3'), heavy: ronin('heavy'), deathblow: ronin('deathblow'),
};
// Fists: Gabe's punches on the crew body. Jab x2 (the two strikes of 'jabs'), a kick, the flying kick as
// the heavy, and the counter after a deflect.
const FISTS = {
  l1: { clip: 'gabe:jabs', from: J.jabs.from, at: 0, speed: 1.5, hit: [J.jabs.hits[0][0], J.jabs.hits[0][1]], dmg: 20, post: 5, reach: 1.8, arc: 1.0, cost: 8, next: 'l2', cancel: 0.84, end: 1.0, lunge: [0.4, 0.7, 2.4], snd: 'punch' },
  l2: { clip: 'gabe:jabs', from: J.jabs.from, at: 0.78, speed: 1.5, hit: [J.jabs.hits[1][0], J.jabs.hits[1][1]], dmg: 22, post: 6, reach: 1.8, arc: 1.0, cost: 8, next: 'l3', cancel: 1.46, end: 1.62, lunge: [1.0, 1.3, 2.4], snd: 'punch' },
  l3: { clip: 'gabe:kick', from: J.kick.from, at: 0.35, speed: 1.55, hit: [J.kick.hits[0][0], J.kick.hits[0][1]], dmg: 30, post: 9, reach: 2.1, arc: 1.2, cost: 14, next: 'l1', cancel: 2.45, lunge: [1.4, 2.1, 3], snd: 'bossSwing' },
  heavy: { clip: 'gabe:fly', from: J.fly.from, at: 0.45, speed: 1.55, hit: [J.fly.hits[0][0], J.fly.hits[0][1]], dmg: 52, post: 16, reach: 2.2, arc: 1.0, cost: 26, cancel: 3.35, lunge: [1.5, 2.8, 5.2], snd: 'heavy' },
  counter: { clip: 'gabe:counter', from: J.counter.from, at: 2.7, speed: 1.6, hit: [J.counter.hits[0][0], J.counter.hits[0][1]], dmg: 40, post: 22, reach: 2.0, arc: 1.0, cost: 0, cancel: 5.45, lunge: [4.6, 5.1, 4], snd: 'punch' },
  deathblow: { clip: 'gabe:counter', from: J.counter.from, at: 2.7, speed: 1.4, hit: [J.counter.hits[0][0], J.counter.hits[0][1]], dmg: 0, post: 0, reach: 3.6, arc: 1.7, cost: 0, cancel: 5.6, lunge: [4.5, 5.0, 7], snd: 'heavy' },
};
// the stool: one big overhead swing, whatever button
const STOOL = { heavy: { ...BLADE.heavy, dmg: 55, post: 18, reach: 2.4 }, deathblow: BLADE.deathblow };
STOOL.l1 = STOOL.heavy;

// dmg and post are multipliers on the move; reach replaces the move's reach where given; uses: hits
// before it breaks (Infinity for good). prop: the S.cast prop in the right hand.
export const WEAPONS = Object.freeze({
  pistol: { id: 'pistol', name: 'PISTOL', ranged: true, prop: 'pistol', set: FISTS, uses: Infinity },
  goldenEagle: { id: 'goldenEagle', name: 'GOLDEN EAGLE', ranged: true, prop: 'goldenEagle', set: FISTS, uses: Infinity },
  ak47: { id: 'ak47', name: 'AK-47', ranged: true, prop: 'ak47', set: FISTS, uses: Infinity },
  bearSpray: { id: 'bearSpray', name: 'BEAR SPRAY', ranged: true, prop: 'bearSpray', set: FISTS, uses: Infinity },
  katana: { id: 'katana', name: 'KATANA', dmg: 1.7, post: 1.3, reach: 2.8, uses: Infinity, prop: 'katana', set: BLADE },
  baseballBat: { id: 'baseballBat', name: 'BASEBALL BAT', dmg: 1.2, post: 2, reach: 2.3, uses: Infinity, prop: 'baseballBat', set: BLADE },
  fists: { id: 'fists', name: 'FISTS', dmg: 0.7, post: 1.0, reach: null, uses: Infinity, prop: null, set: FISTS },
  foamKatana: { id: 'foamKatana', name: 'FOAM KATANA', dmg: 0.6, post: 1.2, reach: null, uses: Infinity, prop: 'foamKatana', set: BLADE },
  cue: { id: 'cue', name: 'POOL CUE', dmg: 0.9, post: 1.0, reach: 2.6, uses: 12, prop: 'cue', set: BLADE, breaks: 'The cue breaks.' },
  stool: { id: 'stool', name: 'BAR STOOL', dmg: 1.4, post: 1.3, reach: null, uses: 3, prop: 'stool', set: STOOL, heavyOnly: true, breaks: 'The stool breaks.' },
  staff: { id: 'staff', name: "RANGER'S STAFF", dmg: 1.0, post: 1.1, reach: 2.8, uses: Infinity, prop: 'staff', set: BLADE },
});
// the move spec for a weapon, with its reach applied
export function moveOf(weaponId, name) {
  const w = WEAPONS[weaponId] || WEAPONS.fists, m = w.set[name] || w.set.l1;
  return w.reach && m.dmg ? { ...m, reach: Math.max(m.reach, w.reach) } : m;
}
// Reward a good read without flattening the existing deflect -> recoil payoff.
export function openingReward(state, moveName) {
  const open = state === 'recover' || state === 'recoil' || state === 'stagger';
  if (!open) return { open: false, damage: 1, posture: 1 };
  return {
    open: true,
    damage: moveName === 'heavy' ? 1.55 : 1.4,
    posture: state === 'recoil' ? 1.6 : 1.45,
  };
}

// the canteen: the ronin's sip (heals TUNE.heal)
export const SIP = { clip: 'ronin:sip', speed: 2.0, heal: TUNE.heal, at: 0.8, dur: 1.3 };
// the roll
export const ROLL = { clip: 'ronin:rollc', speed: 2.25, end: 0.6, cancel: 0.5 };

// Crew perks (CREW in js/moves.js), plus New Balance's longer roll i-frames as a perk field
export function crewStats(i) {
  const stats = { maxHp: 100, dmg: 1, speed: 4.6, parryWin: TUNE.parryWin, dodgeCost: 22, iframeBonus: 0 };
  const c = CREW[i] || CREW[2];
  c.apply(stats);
  if (c.name === 'New Balance') stats.iframeBonus = 0.06;
  return stats;
}
