// js/story/look/presets.js : the looks as data (design 3.6). One post pass does them all: day is colour,
// night is ink, neon means danger, crimson marks the crew and objectives.
// Each preset lists the post settings, fog, sky, light and toon ramp. look.js flattens them into one set of
// numbers (colours become linear RGB) and tweens between them.
import { PALETTE } from './palette.js';

const C = PALETTE;
// the base every preset starts from: the arena's post values, a night sky and no lights
const BASE = {
  comic: 0, ink: 1, crimsonKey: 1, exposure: 1, grade: [1, 1, 1], lift: 0, sat: 1, edge: 0.55, grain: 1, scratch: 1, memory: 0, vig: 1.2,
  bloomThresh: 0.92, bloomGain: 1, hotColor: 0, hueNeon: 1, neonBoost: 1, hangover: 0, smear: 0, dissolve: 0.08, dissolveUp: 0, skyEdge: 1,
  // fog: colour, near and far (m); view 0 caps far at the tier's day view distance, 1 at the night one (C8)
  fog: { color: C.fogNight, near: 4, far: 260, view: 1 },
  // sky: day 1 shows the day painting, 0 the ink night painting; top and horizon colour the dome
  sky: { show: 1, day: 0, top: 0x0b0b0c, horizon: 0x1c1c1e, tint: [1, 1, 1], bright: 0.9, stars: 1, haze: 0.45, sunDisc: 0 },
  // key: the one shadow-casting light; from 0 puts it at the sun, 1 at the moon. fill: a soft light from
  // the camera's side (the arena's fill). hemi: sky and ground bounce. point: the two warm points.
  key: { color: C.moon, int: 2.0, from: 1 }, fill: { color: 0xffffff, int: 0.7 }, hemi: { sky: 0x9aa2b0, ground: 0x1a1816, int: 0.55 },
  point: { color: C.lamp, int: 0 },
  ramp: [40, 110, 190, 255],
};
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...a[k], ...v } : v; return o; };

const DAY = merge(BASE, {
  ink: 0, exposure: 1.3, grade: [1.05, 1.0, 0.95], sat: 1.05, edge: 0.3, grain: 0.4, scratch: 0, vig: 0.75,
  bloomThresh: 0.8, bloomGain: 0.45, hotColor: 1, skyEdge: 0.35,
  fog: { color: C.fogDay, near: 250, far: 1400, view: 0 },
  sky: { day: 1, top: C.skyTop, horizon: C.skyHorizon, tint: [1, 1, 1], bright: 1, stars: 0, haze: 0.28, sunDisc: 1 },
  key: { color: C.sun, int: 2.6, from: 0 }, fill: { color: 0xc8d4ff, int: 0.25 }, hemi: { sky: C.hemiSky, ground: C.hemiGround, int: 0.6 },
  ramp: [80, 145, 210, 255],
});
const NIGHT = merge(BASE, {});
export const PRESETS = Object.freeze({
  DAY,
  // a flashback: warmer, lifted blacks, a soft film gate; the UI shows the camcorder stamp
  MEMORY: merge(DAY, { grade: [1.12, 1.03, 0.86], lift: 0.05, sat: 0.92, memory: 1, vig: 1.35, grain: 0.8, scratch: 0.5, bloomThresh: 0.72, bloomGain: 0.7,
    fog: { color: C.fogMemory }, sky: { tint: [1.06, 1.0, 0.9] } }),
  NIGHT,
  COMIC: merge(NIGHT, {
    comic: 1, ink: 0, exposure: 1.05, sat: 1.25, grade: [1.08, 0.94, 1.16], lift: 0.04,
    edge: 0.32, grain: 0.08, scratch: 0, vig: 0.45, bloomThresh: 0.8, bloomGain: 0.45,
    fog: { color: 0x211139, near: 12, far: 300 },
    sky: { top: 0x170826, horizon: 0x572653, tint: [1.1, 0.6, 1.4], bright: 1.15, stars: 1 },
    key: { color: 0xffcc83, int: 2.4 }, fill: { color: 0x74e6ff, int: 1.0 },
    hemi: { sky: 0xe06dcb, ground: 0x301b5e, int: 0.75 }, ramp: [45, 100, 190, 255],
  }),
  MEMORY_NIGHT: merge(NIGHT, { memory: 1, vig: 1.35, grain: 1.2, scratch: 1.2, bloomGain: 1.15 }),
  // the halfway looks of the clock: colour with ink creeping in through the shadows
  DUSK: merge(DAY, { ink: 0.15, skyEdge: 0.5, exposure: 1.25, grade: [1.14, 0.94, 0.82], sat: 1.12, edge: 0.4, grain: 0.6, scratch: 0.2, vig: 1.0, bloomThresh: 0.72, bloomGain: 0.6, dissolve: 0.22,
    fog: { color: C.fogDusk, near: 180, far: 1000 }, sky: { tint: [1.12, 0.74, 0.6], bright: 0.78, stars: 0.25, haze: 0.45, top: 0x33447e, horizon: 0xe0906a },
    key: { color: 0xffa860, int: 1.6, from: 0 }, fill: { color: 0x7080b0, int: 0.35 }, hemi: { sky: 0xb090b0, ground: 0x6a3a2a, int: 0.45 }, ramp: [55, 125, 195, 255] }),
  DAWN: merge(DAY, { ink: 0.15, skyEdge: 0.5, dissolveUp: 1, exposure: 1.2, grade: [1.06, 0.97, 0.98], sat: 0.95, edge: 0.4, grain: 0.6, scratch: 0.2, vig: 1.0, dissolve: 0.22,
    fog: { color: C.fogDawn, near: 150, far: 900 }, sky: { tint: [1.0, 0.84, 0.82], bright: 0.82, stars: 0.3, haze: 0.45, top: 0x405080, horizon: 0xe8b090 },
    key: { color: 0xffc8a0, int: 1.3, from: 0 }, fill: { color: 0x8890c0, int: 0.3 }, hemi: { sky: 0xa0a8c8, ground: 0x6a4a3a, int: 0.45 }, ramp: [55, 125, 195, 255] }),
  // indoors: the sun is off and two warm points light the room; the ink stays as it was ('keep')
  INTERIOR: merge(NIGHT, { ink: 'keep', exposure: 1.2, grade: [1.08, 1.0, 0.9], edge: 0.5, fog: { color: C.fogInterior, near: 6, far: 45, view: 1 },
    sky: { show: 0 }, key: { int: 0 }, fill: { color: 0xffd8b0, int: 0.35 }, hemi: { sky: 0xffd8b0, ground: 0x3a2a20, int: 0.5 }, point: { color: C.lamp, int: 28 } }),
  // the morning after: the frame sways, colours split, bright things bloom
  HANGOVER: merge(DAY, { hangover: 1, exposure: 1.55, sat: 0.92, grade: [1.08, 1.0, 0.9], bloomThresh: 0.6, bloomGain: 0.85, vig: 1.1 }),
  // the vortex sight: the world drains to ink, and bad men show their animal in neon
  VORTEX: merge(NIGHT, { hueNeon: 1.25, neonBoost: 1.4, edge: 0.7, grain: 1.2, scratch: 1.3, vig: 1.55, fog: { color: 0x07070a, near: 2, far: 140 },
    sky: { top: 0x020202, horizon: 0x0a0a0c, stars: 0.4, bright: 0.6 }, key: { color: 0xd0d8f0, int: 1.4 }, fill: { int: 0.5 }, hemi: { sky: 0x606878, ground: 0x0a0a0a, int: 0.25 }, ramp: [30, 90, 170, 255] }),
  // the ranch with the generator cut: deeper ink, a short view
  DEEP_INK: merge(NIGHT, { edge: 0.65, vig: 1.5, fog: { color: 0x050506, near: 2, far: 110 }, sky: { stars: 0.7, bright: 0.7 },
    key: { color: 0xc0c8e0, int: 0.8 }, fill: { int: 0.3 }, hemi: { int: 0.15 }, ramp: [20, 70, 150, 255] }),
});
// the clock's windows (S.day hours): dusk 18:45 to 19:45, dawn 05:15 to 06:15
export const CLOCK = Object.freeze({ duskStart: 18.75, duskEnd: 19.75, dawnStart: 5.25, dawnEnd: 6.25 });
export const CLOCK_LOOKS = Object.freeze(['DAY', 'DUSK', 'NIGHT', 'DAWN']);
// which clock look an hour falls in
export function clockLook(h) {
  if (h >= CLOCK.duskStart && h < CLOCK.duskEnd) return 'DUSK';
  if (h >= CLOCK.dawnStart && h < CLOCK.dawnEnd) return 'DAWN';
  return h >= CLOCK.dawnEnd && h < CLOCK.duskStart ? 'DAY' : 'NIGHT';
}
