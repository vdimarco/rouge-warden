// Spell looks by element. Each hero casts with one element (water, fire, void, stone, wind or light); a spell that
// lands spawns that element's particles, ground mark and light in the shared effect pools, so every element still costs
// no extra draw call. impact() runs once when a spell first shows; hold() runs every frame while it lives.
import { HERO_IDENTITIES } from '../hero-identities.js';

export const ELEMENT = {
  tidewarden: 'water', 'coral-sage': 'water', dredge: 'water', embersong: 'fire', glasshand: 'fire', bloodwake: 'fire',
  voidcaller: 'void', riftblade: 'void', nightcurrent: 'void', stoneheart: 'stone', irontide: 'stone',
  skyreaver: 'wind', zephyrs: 'wind', 'the-marrow': 'wind', moonweaver: 'light', 'salt-priestess': 'light',
};
// Colours per element: core (bright), body (mid), deep (shadow or smoke).
export const PALETTE = {
  water: ['#e6fbff', '#6fd2e8', '#2c6f86'], fire: ['#fff0c4', '#ff9a3c', '#3a2a22'], void: ['#f0dcff', '#a46cff', '#1c1030'],
  stone: ['#f4e2bc', '#b99a6c', '#5a4a38'], wind: ['#f6fffb', '#b8f0e2', '#7fa6a0'], light: ['#fffbe6', '#ffd76a', '#c9a24a'],
};
// The element of an effect: its caster's identity, else the first identity that uses the effect's kit.
export function elementOf(source, kit) {
  const id = source?.kind === 'hero' ? HERO_IDENTITIES[source.identity] : null;
  return ELEMENT[(id || HERO_IDENTITIES.find(h => h.kit === kit))?.slug] || 'light';
}
const R = Math.random, TAU = Math.PI * 2;
// fx: the Effects object; d: its decals. x, z: ground point; r: radius; big: an ultimate.
export function impact(fx, el, x, z, r, big) {
  const [core, body, deep] = PALETTE[el], n = big ? 2 : 1;
  if (el === 'water') {
    for (let i = 0; i < 26 * n; i++) { const a = R() * TAU, s = 160 + R() * 260; fx.sparks.emit({ x: x + Math.cos(a) * r * .2, y: 20, z: z + Math.sin(a) * r * .2, vx: Math.cos(a) * s, vy: 380 + R() * 380, vz: Math.sin(a) * s, life: .8, size: 22 + R() * 14, color: R() < .4 ? core : body, gravity: 1300, drag: .4, frame: 2 }); }
    for (let i = 0; i < 8 * n; i++) { const a = R() * TAU; fx.smoke.emit({ x: x + Math.cos(a) * r * .5, y: 20, z: z + Math.sin(a) * r * .5, vx: Math.cos(a) * 90, vy: 30, vz: Math.sin(a) * 90, life: 1.2, size: 150, grow: 1.2, color: '#d8f2f6', alpha: .28, drag: 1.4, frame: 1 }); }
  } else if (el === 'fire') {
    for (let i = 0; i < 30 * n; i++) { const a = R() * TAU, rr = Math.sqrt(R()) * r * .7; fx.sparks.emit({ x: x + Math.cos(a) * rr, y: 10 + R() * 30, z: z + Math.sin(a) * rr, vx: Math.cos(a) * 60, vy: 260 + R() * 320, vz: Math.sin(a) * 60, life: .7 + R() * .5, size: 26 + R() * 18, color: R() < .3 ? core : body, gravity: -60, drag: 1.2, frame: R() < .5 ? 3 : 0 }); }
    for (let i = 0; i < 6 * n; i++) fx.smoke.emit({ x: x + (R() - .5) * r, y: 60, z: z + (R() - .5) * r, vx: 20, vy: 90 + R() * 60, vz: -10, life: 1.8, size: 160, grow: 1.6, color: deep, alpha: .4, drag: .6 });
  } else if (el === 'void') {
    // Motes pulled into the centre, and a dark core that swells and fades.
    for (let i = 0; i < 28 * n; i++) { const a = R() * TAU, rr = r * (.7 + R() * .5), s = rr * 2.2; fx.sparks.emit({ x: x + Math.cos(a) * rr, y: 30 + R() * 90, z: z + Math.sin(a) * rr, vx: -Math.cos(a) * s - Math.sin(a) * 120, vy: -20, vz: -Math.sin(a) * s + Math.cos(a) * 120, life: .45, size: 24 + R() * 14, color: R() < .35 ? core : body, drag: 0, frame: 1 }); }
    for (let i = 0; i < 5 * n; i++) fx.smoke.emit({ x: x + (R() - .5) * 40, y: 50, z: z + (R() - .5) * 40, vx: (R() - .5) * 40, vy: 30, vz: (R() - .5) * 40, life: 1, size: r * .9, grow: .6, color: deep, alpha: .55, drag: 1, frame: 2 });
  } else if (el === 'stone') {
    for (let i = 0; i < 22 * n; i++) { const a = R() * TAU, s = 120 + R() * 260; fx.smoke.emit({ x: x + Math.cos(a) * r * .3, y: 15, z: z + Math.sin(a) * r * .3, vx: Math.cos(a) * s, vy: 420 + R() * 380, vz: Math.sin(a) * s, life: .9, size: 26 + R() * 22, color: R() < .5 ? deep : body, alpha: 1, gravity: 1500, drag: .3, frame: 3 }); }
    fx.dust(x, z, r * .7, big ? 16 : 9, '#a8916c');
  } else if (el === 'wind') {
    // A ring of pale motes spinning outward.
    for (let i = 0; i < 34 * n; i++) { const a = R() * TAU, rr = r * (.2 + R() * .4), s = 260 + R() * 160; fx.sparks.emit({ x: x + Math.cos(a) * rr, y: 25 + R() * 60, z: z + Math.sin(a) * rr, vx: -Math.sin(a) * s + Math.cos(a) * 140, vy: 40, vz: Math.cos(a) * s + Math.sin(a) * 140, life: .6, size: 18 + R() * 12, color: R() < .5 ? core : body, drag: 1.1, frame: 1 }); }
    for (let i = 0; i < 6; i++) { const a = R() * TAU; fx.smoke.emit({ x: x + Math.cos(a) * r * .4, y: 20, z: z + Math.sin(a) * r * .4, vx: -Math.sin(a) * 160, vy: 20, vz: Math.cos(a) * 160, life: .9, size: 130, grow: 1, color: '#e6efe6', alpha: .22, drag: 1, frame: 2 }); }
  } else {
    // Light: rays up from the ground and golden sparkles drifting down.
    for (let i = 0; i < 26 * n; i++) { const a = R() * TAU, rr = Math.sqrt(R()) * r * .8; fx.sparks.emit({ x: x + Math.cos(a) * rr, y: 40 + R() * 220, z: z + Math.sin(a) * rr, vx: 0, vy: -40 - R() * 40, vz: 0, life: .9 + R() * .4, size: 22 + R() * 16, color: R() < .5 ? core : body, drag: .5, frame: 1 }); }
    for (let i = 0; i < 6 * n; i++) { const a = R() * TAU, rr = R() * r * .6; fx.sparks.emit({ x: x + Math.cos(a) * rr, y: 60, z: z + Math.sin(a) * rr, vy: 520, life: .35, size: 70, color: body, drag: 2, frame: 3 }); }
  }
  fx.burst(x, 60, z, core, big ? 8 : 4, 260, { size: big ? 90 : 60, life: .25 });
}
// Every frame while the spell lives: age 0..1, fade, k (spread). Ground marks go in the decals, glows in the ribbons.
export function hold(fx, el, x, z, r, big, age, fade, k) {
  const d = fx.decals, [core, body, deep] = PALETTE[el];
  if (el === 'water') { d.circle(x, z, r * (.25 + k * .8), { color: core, alpha: fade * .8, line: 5 * fade + 2 }); d.circle(x, z, r * (.15 + k * .55), { color: body, alpha: fade * .45, line: 3 }); d.circle(x, z, r * (.2 + k * .6), { color: body, alpha: fade * .22, fill: .8, inner: 0 }); }
  else if (el === 'fire') { d.circle(x, z, r * .75, { color: '#2a1a12', alpha: fade * .55, fill: .9, inner: 0 }); d.circle(x, z, r * (.3 + k * .6), { color: body, alpha: fade * .7, line: 9 * fade + 2 }); }
  else if (el === 'void') { d.circle(x, z, r * (.95 - k * .55), { color: body, alpha: fade * .85, line: 6 }); d.circle(x, z, r * .7, { color: deep, alpha: fade * .5, fill: .9, inner: 0 }); }
  else if (el === 'stone') { d.circle(x, z, r * .9, { color: '#3a2e22', alpha: Math.min(1, fade * 1.4) * .85, cracks: true }); d.circle(x, z, r * (.3 + k * .7), { color: body, alpha: fade * .55, line: 6 }); }
  else if (el === 'wind') { for (let i = 0; i < 3; i++) { const a0 = age * 9 + i * TAU / 3, rr = r * (.3 + k * .6); for (let j = 0; j < 3; j++) { const a = a0 + j * .35, b = a + .35; fx.ribbons.add(x + Math.cos(a) * rr, 40 + j * 10, z + Math.sin(a) * rr, x + Math.cos(b) * rr, 45 + j * 10, z + Math.sin(b) * rr, 7 * fade + 2, body, fade * .8); } } d.circle(x, z, r * (.3 + k * .7), { color: core, alpha: fade * .4, line: 3, dash: 10 }); }
  else { d.circle(x, z, r * (.3 + k * .7), { color: body, alpha: fade * .8, line: 6 }); d.circle(x, z, r * .6, { color: core, alpha: fade * .3, fill: .7, inner: 0 }); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + age * 2; fx.ribbons.add(x + Math.cos(a) * r * .5, 0, z + Math.sin(a) * r * .5, x + Math.cos(a) * r * .5, 240 * fade, z + Math.sin(a) * r * .5, 16 * fade + 3, body, fade * .6); } }
  if (big) fx.ribbons.add(x, 0, z, x, 520 * (1 - age * .5), z, 60 * fade + 8, el === 'void' ? body : core, fade * .8);
}
