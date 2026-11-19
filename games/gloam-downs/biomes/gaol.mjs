// The Sunken Gaol: a prison sunk into a bowl in the moor, seen by moonlight. You arrive on the south rim at a ruined gate and look down
// into the yard. Across it the far side climbs in tiers: each tier is a block of barred cells with torches at their mouths, and the
// cracked watch-keep stands on the top with a low moon behind it. Cold blue stone, black-green moor, orange fire.
//
// The start camera looks down at a low pitch: the top of its picture is only about 1.8 degrees above level. So the start stands high on
// the rim and the summit is a little lower than the start, which puts the keep and the moon in the top band of the first picture. The
// beacon stands on a stepped pyre, so it is still well above the start.
import { brazier, steps, wall, tower, deadTree, rocks, shrubs, yawAx } from '../lib/props.mjs';
import { lib, polyDist, tile } from '../lib/common.mjs';

// heights of the levels
const Y = { start: 7.0, yard: 0, t1: 2.6, t2: 4.6, top: 6.4 };
const START = [3, 27];
// the walked line: down from the rim, across the yard, up the west stair, east along the first tier, up the east stair, west along
// the second tier, through the inner arch and onto the top
const PATH = [[3, 27], [2.6, 22.5], [1.5, 17], [0.2, 11], [-3, 5.5], [-8, 2.6], [-10.4, 1], [-10.4, -3.2], [-9, -6.2], [0, -6.4],
  [8.6, -6.2], [9.4, -8.6], [9.4, -12.4], [4, -12.8], [0, -13], [0, -16.6], [2.2, -18.4]];
// the keep and the beacon pyre on the top
const KEEP = [-2.6, -24];
const PYRE = [3.4, -18.8];

export default {
  id: 'gaol',
  name: 'The Sunken Gaol',
  sub: 'Cells cut into the moor, and the keep on the hill',
  hint: 'Climb to the keep. Light the beacon.',
  seed: 11,
  palette: [
    ['sky', [0x04050b]],
    ['skyband', [0x0a0e1e, 0x141b36, 0x222b50, 0x36406c]],
    ['fog', [0x0d1122]],
    ['ink', [0x020308]],
    ['shade', [0x06080e]],
    ['moor', [0x07100c, 0x0d1a13, 0x15281b, 0x223a24, 0x35502e]],
    ['mud', [0x0f0b0c, 0x221715, 0x3a2822, 0x564030]],
    ['stone', [0x0a0e18, 0x151b2c, 0x232c45, 0x37445f, 0x56658a]],
    ['moss', [0x15241a, 0x2a4226]],
    ['wood', [0x120c0a, 0x281b13, 0x45301f]],
    ['rust', [0x1f120d, 0x4a2a1a]],
    ['moon', [0x8e9ab4, 0xdfe3d2]]
  ],
  // the key light is the moon, high in the north-west for form (the moon you see sits low in the north)
  light: { sun: [-0.45, 0.62, -0.62], amb: 0.1, sky: 0.16, sunK: 0.44, shK: 7 },
  fog: { color: 'fog', far: 60, start: 0.5, max: 0.88 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 3,
    bumps: [
      [-1, -22, 16, 2], // the summit hill
      [19, 2, 13, 3.6], // the east hill
      [-20, 4, 12, 2.6], // the west hill
      [-12, 30, 12, 3.2], [17, 29, 11, 3.4], [3, 36, 10, 3], // the south rim
      [-42, -36, 20, 6], [40, -40, 20, 7], // far hills either side of the keep
      [0, -96, 72, -12] // the land falls away north, so the keep and the moon stand against the sky
    ],
    fbm: { amp: 0.5, freq: 1 / 11, oct: 3 },
    warp: { amp: 3, freq: 1 / 22 },
    far: { amp: 8, start: 36, end: 62 },
    pits: [[1, 6, 19, 4]],
    flats: [
      { at: [0, 6], box: [10, 8], blend: 7, y: Y.yard }, // the yard
      { at: START, r: 3.5, blend: 6, y: Y.start }, // the rim at the start
      { at: [0, -20.5], r: 6.5, blend: 3, y: Y.top }, // the top
      { at: [0, -12.6], box: [10, 1.7], blend: 0.8, y: Y.t2 }, // the second tier
      { at: [0, -6.4], box: [11.5, 2.1], blend: 0.8, y: Y.t1 } // the first tier
    ],
    paths: [{ pts: PATH, w: 2.2, depth: 0.1 }],
    box: [-116, 116, -116, 116]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
  }
};
