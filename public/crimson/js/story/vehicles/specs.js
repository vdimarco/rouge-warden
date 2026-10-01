// js/story/vehicles/specs.js : the numbers for every vehicle kind (design 4.1). Pure data, no three.js.
// Units: meters, seconds, kilograms. Local frame of a vehicle: +z forward, +x to the left, y up, the
// origin on the ground under the middle of the wheelbase.
//
// size: w (width), h (height to the top of the roof load), l (length)
// wheelbase, track: axle spacing and wheel spacing; wheelR: wheel radius
// top: top speed on asphalt; offTop: top speed off the road (rock, sand, scrub); dirtTop: on dirt roads
// accel: full-throttle acceleration at rest (it tapers to 0 at top); brake: braking; reverse: top in reverse
// drag: aerodynamic drag, a = drag * v^2; roll: rolling resistance (m/s^2)
// steer: the widest wheel angle at rest (rad); it narrows with speed: steer / (1 + v / steerV)
// steerRate: how fast the wheels turn (rad/s)
// grip: the sideways grip by surface (m/s^2 of cornering before the tyres slide)
// seats: seat count; shown: how many seats show their occupant (tinted glass hides the rest)
// (the sedan shows none: its riders cannot sit low enough for their heads and feet to both stay inside)
// gang: carries the neon marker lights by default (neon means danger)
export const G = 9.81; // gravity on the ground (slopes)
export const AIR_G = 18; // arcade gravity while airborne (design 4.1)
export const SUBSTEP = 1 / 120; // fixed physics substep
export const MAX_SUBSTEPS = 8;

const grip = (asphalt, dirt, off) => Object.freeze({ asphalt, dirt, rock: off + 0.5, sand: off - 0.6, scrub: off, water: 2.2 });
export const PATROL_TUNE = Object.freeze({ top: 46, offTop: 27, dirtTop: 35, accel: 7.4, brake: 13.5, drag: 0.0025, steerV: 15, steerRate: 3.8, grip: grip(12.5, 8, 6.8) });

export const SPECS = Object.freeze({
  van: Object.freeze({
    label: 'the Whale', mass: 3200, size: { w: 2.05, h: 2.6, l: 6.0 }, wheelbase: 3.9, track: 1.72, wheelR: 0.38, wheelW: 0.26,
    top: 28, offTop: 18, dirtTop: 22, accel: 3.6, brake: 9, reverse: 7, drag: 0.0045, roll: 0.15,
    steer: 0.55, steerV: 9, steerRate: 2.2, grip: grip(7.5, 5, 4.5), seats: 10, shown: 2, gang: false,
  }),
  whitevan: Object.freeze({
    label: 'white van', mass: 3200, size: { w: 2.05, h: 2.4, l: 6.0 }, wheelbase: 3.9, track: 1.72, wheelR: 0.38, wheelW: 0.26,
    top: 28, offTop: 18, dirtTop: 22, accel: 3.6, brake: 9, reverse: 7, drag: 0.0045, roll: 0.15,
    steer: 0.55, steerV: 9, steerRate: 2.2, grip: grip(7.5, 5, 4.5), seats: 10, shown: 2, gang: false,
  }),
  jeep: Object.freeze({
    label: 'tour jeep', mass: 1500, size: { w: 1.86, h: 2.05, l: 4.6 }, wheelbase: 2.9, track: 1.56, wheelR: 0.42, wheelW: 0.3,
    top: 30, offTop: 22, dirtTop: 27, accel: 4.4, brake: 9.5, reverse: 7, drag: 0.005, roll: 0.14,
    steer: 0.6, steerV: 10, steerRate: 2.6, grip: grip(7.8, 6, 5.2), seats: 8, shown: 8, gang: false,
  }),
  suv: Object.freeze({
    label: 'black SUV', mass: 2500, size: { w: 2.0, h: 1.95, l: 5.1 }, wheelbase: 3.0, track: 1.7, wheelR: 0.4, wheelW: 0.28,
    top: 34, offTop: 20, dirtTop: 25, accel: 4.6, brake: 9.5, reverse: 7, drag: 0.004, roll: 0.14,
    steer: 0.56, steerV: 10, steerRate: 2.4, grip: grip(8, 5.2, 4.6), seats: 7, shown: 2, gang: true,
  }),
  suv_fbi: Object.freeze({
    label: 'FBI SUV', mass: 2500, size: { w: 2.0, h: 2.05, l: 5.1 }, wheelbase: 3.0, track: 1.7, wheelR: 0.4, wheelW: 0.28,
    top: 36, offTop: 20, dirtTop: 26, accel: 4.8, brake: 9.8, reverse: 7, drag: 0.004, roll: 0.14,
    steer: 0.56, steerV: 10, steerRate: 2.4, grip: grip(8.2, 5.4, 4.6), seats: 5, shown: 2, gang: false,
  }),
  pickup: Object.freeze({
    label: 'pickup', mass: 2300, size: { w: 2.0, h: 1.9, l: 5.6 }, wheelbase: 3.4, track: 1.72, wheelR: 0.4, wheelW: 0.28,
    top: 32, offTop: 21, dirtTop: 25, accel: 4.2, brake: 9.2, reverse: 7, drag: 0.0045, roll: 0.14,
    steer: 0.55, steerV: 10, steerRate: 2.3, grip: grip(7.6, 5.4, 4.8), seats: 3, shown: 2, gang: false,
  }),
  sedan: Object.freeze({
    label: 'sedan', mass: 1400, size: { w: 1.82, h: 1.45, l: 4.6 }, wheelbase: 2.7, track: 1.55, wheelR: 0.33, wheelW: 0.22,
    top: 36, offTop: 16, dirtTop: 22, accel: 4.8, brake: 10, reverse: 7, drag: 0.0035, roll: 0.12,
    steer: 0.58, steerV: 11, steerRate: 2.6, grip: grip(8.4, 4.8, 4), seats: 5, shown: 0, gang: false,
  }),
  rv: Object.freeze({
    label: 'RV', mass: 6000, size: { w: 2.5, h: 3.3, l: 9.0 }, wheelbase: 5.4, track: 2.05, wheelR: 0.48, wheelW: 0.32,
    top: 25, offTop: 12, dirtTop: 18, accel: 2.3, brake: 7, reverse: 5, drag: 0.0033, roll: 0.18,
    steer: 0.5, steerV: 8, steerRate: 1.8, grip: grip(6.5, 4.4, 3.6), seats: 6, shown: 2, gang: false,
  }),
});

// Damage (0..100) comes from impacts over 3 m/s: 35 dents, 60 a light out and steam, 85 smoke and 20 %
// less top speed, 100 wrecked.
export const DAMAGE = Object.freeze({ perMs: 2.2, freeMs: 3, dents: 35, light: 60, smoke: 85, wreck: 100, topLoss: 0.2, landMs: 7 });
// Contact rules
export const CONTACT = Object.freeze({
  restitution: 0.15, friction: 0.8,
  bumpMin: 0.5, // below this a touch is resting contact, not a bump
  bumpHard: 4, // a bump under this is a light touch (design P9)
  maxSpeed: 6, // default hard-hit threshold for a protected vehicle: at or above it, 'hitProtected'
  bumpGap: 0.6, // seconds between two counted bumps of the same pair
  pitAngle: 25 * Math.PI / 180, pitYaw: 2.4,
});
// Surfaces that count as off the road for top speed
export const OFFROAD = Object.freeze({ rock: true, sand: true, scrub: true, water: true });

// Traffic by quality tier (ambient only; missions spawn their own, C2)
export const TRAFFIC = Object.freeze({
  count: [5, 8, 14], spawnMin: 120, spawnMax: 300, despawn: 360, physics: 60, physicsOff: 72,
  // [kind, weight, tints]
  mix: Object.freeze([
    ['sedan', 5, ['sedanBlue', 'sedanSilver', 'sedanBrown', 'vanWhite', 'pickupDust']],
    ['pickup', 3, ['pickupRed', 'pickupDust', 'sedanSilver', 'vanWhite']],
    ['suv', 2, ['sedanSilver', 'pickupDust', 'sedanBlue', 'rvCream']],
    ['whitevan', 1.5, ['vanWhite']],
    ['jeep', 1, ['jeepTangerine']],
    ['rv', 0.7, ['rvCream']],
  ]),
});

export const specOf = (kind) => SPECS[kind] || SPECS.sedan;
// the widest wheel angle at speed v
export const steerMax = (sp, v) => sp.steer / (1 + Math.abs(v) / sp.steerV);
