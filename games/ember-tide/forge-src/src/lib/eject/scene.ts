// Sprite-stack fighter scene — a small software renderer.
//
// Everything is drawn into one low-resolution pixel buffer, the way the technique works:
//   · the jet is a stack of horizontal slices drawn 1 px apart, turned to any angle
//   · the islands and the clouds are stacks too (a height per ground pixel)
// The buffer is then shown scaled up with hard pixels.
//
// Two views share one camera: the overhead sprite-stack view, and a chase view from behind
// the jet. The camera slides between them, so the switch is a single continuous move.

import {
  JET_W, JET_L, JET_H, JET_PALETTE, decodeJet,
  JET_PIVOT_K, JET_PIVOT_Y, JET_ENGINE_A, JET_ENGINE_Y, JET_ENGINE_R, JET_NOZZLE_K,
  JET_WINGTIP_A, JET_WINGTIP_K, JET_WINGTIP_Y,
} from '../jet-model.ts?v=a0cd024d6694faa1ab4403b2613f0df65f542270954fd119f6b4d611908f7b73'
import { PILOT_W, PILOT_L, PILOT_H, PILOT_PIVOT, PILOT_SILL, PILOT_RISER, PILOT_SEAT_BASE, decodePilot } from '../pilot-model.ts?v=248cab24d5de3d6778034234d1846709dd8a727882df1840412cc9e1a4b43c53'
import { createVoxelPainter, shellOf } from '../voxel-sprite.ts?v=e3859d92344f2f891eee66f32d797734637b02cc9111ec10bc2e8591a516e7ea'
import { createPost } from '../post.ts?v=48b655027dfe65e1c0b32d651edbab7b912ac57581e0869fad4f8b8cd16678d8'
import { buildCockpit, drawCockpit } from '../cockpit.ts?v=17e4b30d9971e952b5018446481c3e668842856126324f91b84ff48eae1c5795'


 




























































export const DEFAULT_PARAMS = {
  speed: 92,
  boost: 1.8,
  agility: 1.25,
  altitude: 64,
  ceiling: 300,
  clearance: 7,
  bank: 52,
  spread: 1,
  jetScale: 1,
  cameraFollow: 0.6,
  view: 'top',
  chaseDistance: 2.6,
  chaseAngle: 12,
  chaseSize: 0.19,
  transition: 1.4,
  timeOfDay: 'day',
  clouds: 0.45,
  land: 0.33,
  seed: 7,
  afterburner: 0.8,
  flameStyle: 'pixel',
  trails: true,
  wingmen: 0,
  shadow: true,
  followPointer: true,
  invertY: true,
  crash: true,
  ejectZoom: 0.8,
  bloom: 0.5,
  vivid: 0.25,
  vignette: 0.3,
  grain: 0,
  flash: 0.6,
  shake: 1,
  wake: 1,
  weapons: true,
  enemies: 3,
  foeFire: true,
  cloudCut: true,
  slowMo: 1.3,
  ammo: 300,
  missiles: 6,
  reload: 5,
  stunts: true,
  intro: true,
  bodyColor: '#545969',
  accentColor: '#f0580e',
  canopyColor: '#1e8ca0',
}

// ───────────────────────────────────────────────────────────── constants
const N = 2048 // world size (wraps)
const NM = N - 1
const NSHIFT = 11
const HMAX = 40 // tallest terrain stack, trees included

const NC = 1024 // cloud map size (wraps)
const NCM = NC - 1
const NCSHIFT = 10
const CK = 8 // cloud stack height
const CLOUD_ALT = 40

const PIV_K = JET_PIVOT_K // pivot along the fuselage
const PIV_Y = JET_PIVOT_Y // pivot slice (wing level)
const ENGINE_A = JET_ENGINE_A // engines, px off the centre line
const ENGINE_Y = JET_ENGINE_Y // engine centre height
const ENGINE_R = JET_ENGINE_R
const NOZZLE_K = JET_NOZZLE_K
const WINGTIP_A = JET_WINGTIP_A
const WINGTIP_K = JET_WINGTIP_K
const WINGTIP_Y = JET_WINGTIP_Y

const TRAIL_N = 160
const SMOKE_N = 360 // puffs of smoke kept alive at once
const SMOKE_F = 10 // numbers kept per puff
const DEBRIS_N = 56 // bits of wreckage (and sparks) in the air at once
const DEBRIS_F = 8 // numbers kept per bit: x y z, speed x y z, when it was thrown, what it is
const SHOT_N = 72 // cannon rounds in the air at once
const SHOT_F = 8 // numbers kept per round: x y z, speed x y z, when it was fired, whose it is (0 the player's, 1 the enemy's)
const SHOT_SPEED = 620 // how fast a round leaves the jet, px per second
const SHOT_LIFE = 0.95 // seconds it flies
const SHOT_RATE = 18 // rounds a second, from the two guns in turn
const GUN_A = 9 // where the guns are slung: this far out along each wing, in jet pixels
const GUN_B = 2 // … this far ahead of the jet's middle
const GUN_H = -1.8 // … and this far under the wing
const GUN_MEET = 520 // the two streams are set to cross this far ahead, px
const RAIL_A = 13.5 // the missiles hang further out, near the wingtips
const CASE_N = 48 // spent cartridge cases in the air at once
const CASE_F = 7 // numbers kept per case: x y z, speed x y z, when it was thrown out
const CASE_LIFE = 1.5 // seconds one is followed for as it falls
const MISSILE_N = 6 // missiles in the air at once
const MISSILE_DROP = 0.34 // seconds a missile falls clear of the wing before its motor lights
const MISSILE_RAMP = 0.5 // … and the motor then takes to reach full thrust
const MISSILE_BURN = 1.9 // … and burns for
const MISSILE_PUSH = 430 // full thrust, px per second per second
const MISSILE_TOP = 400 // the fastest it flies, px per second faster than the jet's cruise
const MISSILE_TURN = 3.4 // how sharply one that has a target can turn after it, rad per second
const FOE_MAX = 5 // enemy jets at once
const FOE_HP = 5 // cannon rounds one takes
const HULL = 6 // cannon rounds the player's jet takes
const FOE_SHOT = 380 // how fast an enemy's round flies, px per second: slower than the player's, so it can be seen coming
const FOE_MISSILE_HIT = 4 // what one of the enemy's missiles takes off the player's hull
const PARRY = 0.6 // a roll throws a missile off if it is no further through than this when the missile arrives (it takes 0.85 s)
const SLOW_RATE = 0.13 // how fast time goes in the slow motion of a missile thrown off
const COUNTER_OPEN = 0.6 // seconds after the slow motion in which a missile fired is still a counter-attack
const VOLLEY = 3 // missiles in a counter-attack
const VOLLEY_GAP = 0.12 // seconds between them (by the clock, not by the slowed time)
const FOE_REACH = 430 // an enemy opens fire from this far, px
const CUT_N = 1 << 16 // cells of cloud cut away at once
const CUT_HEAL = 11 // seconds a cut in a cloud takes to close up
const LOCK_RANGE = 950 // how far away an enemy can be locked on to, px
const LOCK_TIME = 0.8 // seconds it must be held in the sights for the lock
const BLAST_N = 6 // their explosions
const WAKE_N = 150 // marks of a jet's wake on the water kept at once
const WAKE_F = 6 // numbers kept per mark: x y, when it was made, how strong, and which way is across the wake (x y)
const WAKE_REACH = 24 // a jet this low over the water (px) starts to raise a wake
const WAKE_LIFE = 2.8 // seconds a mark of it lasts
// the stages of an ejection
const EJ_FLY = 0 // in the jet, flying
const EJ_ROCKET = 1 // the seat's rocket is carrying the pilot up
const EJ_CHUTE = 2 // under the parachute, with a new jet on its way
const EJ_DROP = 3 // parachute cut loose: dropping into the cockpit
const EJ_SEAL = 4 // in the seat: the canopy closes
const DRIFT = 13 // how fast the parachute carries him along, px per second
const MEET = 2.8 // seconds from the parachute opening to the pilot being in the new jet
const FALL = 0.42 // … the last of which he spends falling into it
const HANDOVER = 1.3 // seconds before he lands that the camera starts to leave him for the jet
const SINK = 15 // how fast he comes down under it
const LINES = 15 // length of the parachute's lines, in jet pixels
const CHUTE = 1.15 // the size of the parachute against the jet (1 = a canopy 25 jet pixels across)
const PILOT_SIZE = 0.27 // the size of one of the pilot's voxels, in jet pixels: he fits under the canopy, and is that size out of it too

const ZTOP = CLOUD_ALT + CK // the tallest thing in the world
const VIEW_DIST = 1500 // how far the chase view sees
const FOG_START = 300
const FOG_STEPS = 10 // shades of haze between here and the horizon
const NSKY = 8 // bands in the sky gradient
const EPS = 1e-5
const HOLD = 0.2 // seconds: shorter is a click (roll), longer is a hold (thrusters)
const STEEP = 1.4 // the steepest it climbs, rad: all but straight up
const DIVE = 0.62 // the steepest the stick dives it, rad: a pilot pulls far harder than he can push
const LOOP_T = 3.6 // seconds a loop takes
const TILT = 0.9 // how far the camera behind the jet looks up the sky in a vertical climb (and down in a dive), rad
const TILT_IN = 1.2 // the steepest the cockpit's camera can look up or down, rad
const COCKPIT_LOOK = 64 // the cockpit view is centred this far ahead of the jet, px
const COCKPIT_EYE = 3 // the pilot's eyes, px above the jet's middle
const FLAME_MAX = 6 // smooth flames: two a jet
const FLAME_F = 16 // numbers kept per smooth flame
const FLAME_GROW = 1.3 // a smooth flame fades out along its length, so it is drawn this much longer

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

// ───────────────────────────────────────────────────────────── helpers
const pack = (r, g, b) =>
  ((255 << 24) | (clamp255(b) << 16) | (clamp255(g) << 8) | clamp255(r)) >>> 0
/** one colour over another, k parts in 256 */
function blend(bg, fg, k) {
  const r = ((bg & 255) * (256 - k) + (fg & 255) * k) >> 8
  const g = (((bg >> 8) & 255) * (256 - k) + ((fg >> 8) & 255) * k) >> 8
  const b = (((bg >> 16) & 255) * (256 - k) + ((fg >> 16) & 255) * k) >> 8
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}
// an explosion, from its first flash to soot; and the colours of a parachute
const FIRE = [pack(255, 250, 224), pack(255, 214, 96), pack(250, 140, 40), pack(206, 66, 24), pack(52, 46, 50)]
const SILK = [pack(244, 244, 238), pack(206, 210, 220), pack(150, 156, 172)]
const SPRAY = [pack(255, 255, 255), pack(206, 232, 250)]
const DUST = pack(196, 180, 150)
// the sights: an enemy, one being locked on to, one that is locked
const HUD_FOE = pack(255, 96, 84)
const HUD_SEEK = pack(255, 236, 110)
const HUD_LOCK = pack(255, 40, 48)
const FOE_TRACER = [pack(255, 226, 214), pack(255, 104, 84)] // an enemy's rounds: red, where the player's are yellow
const MIST = pack(236, 244, 255)
const BRASS = [pack(255, 240, 170), pack(232, 184, 78), pack(150, 106, 40)] // a spent case: its glint, its side, its shade
// the light that falls into the cockpit
const SUN_DAY = pack(255, 246, 222)
const SUN_SUNSET = pack(255, 170, 92)
const SUN_NIGHT = pack(150, 190, 255)
function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

function mulberry32(seed) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash8(o) {
  let h = Math.imul(o ^ (o >>> 13), 0x5bd1e995)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  return (h >>> 24) & 255
}
function wrapAngle(a) {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2))
}

export function parseColor(str, fallback) {
  if (!str) return fallback
  let s = String(str).trim()
  if (s[0] === '#') {
    s = s.slice(1)
    if (s.length === 3 || s.length === 4) s = s.split('').map((ch) => ch + ch).join('')
    if (s.length >= 6) {
      const n = parseInt(s.slice(0, 6), 16)
      if (!isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    return fallback
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(/[ ,/]+/).map(parseFloat)
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return [parts[0], parts[1], parts[2]]
  }
  return fallback
}

/** colour grading per time of day (amount 0..1) */
function grade(c, tod, amount) {
  if (tod === 'day' || amount <= 0) return c
  let r, g, b
  if (tod === 'sunset') {
    r = 0.95 * c[0] + 0.1 * c[1] + 12
    g = 0.72 * c[1] + 0.05 * c[0] + 4
    b = 0.7 * c[2] + 0.08 * c[0] + 10
  } else {
    r = 0.22 * c[0] + 2
    g = 0.3 * c[1] + 6
    b = 0.5 * c[2] + 22
  }
  return [c[0] + (r - c[0]) * amount, c[1] + (g - c[1]) * amount, c[2] + (b - c[2]) * amount]
}

// tileable value noise, one octave added into `field`
function addOctave(field, n, cell, amp, rnd) {
  const P = n / cell
  const lat = new Float32Array(P * P)
  for (let i = 0; i < lat.length; i++) lat[i] = rnd()
  const x0 = new Int32Array(n)
  const x1 = new Int32Array(n)
  const tx = new Float32Array(n)
  for (let x = 0; x < n; x++) {
    const g = x / cell
    const i = Math.floor(g)
    const f = g - i
    x0[x] = i % P
    x1[x] = (i + 1) % P
    tx[x] = f * f * (3 - 2 * f)
  }
  for (let y = 0; y < n; y++) {
    const ra = x0[y] * P
    const rb = x1[y] * P
    const ty = tx[y]
    const row = y * n
    for (let x = 0; x < n; x++) {
      const a0 = lat[ra + x0[x]]
      const b0 = lat[rb + x0[x]]
      const va = a0 + (lat[ra + x1[x]] - a0) * tx[x]
      const vb = b0 + (lat[rb + x1[x]] - b0) * tx[x]
      field[row + x] += amp * (va + (vb - va) * ty)
    }
  }
}
function normalise(field) {
  let mn = Infinity
  let mx = -Infinity
  for (let i = 0; i < field.length; i++) {
    const v = field[i]
    if (v < mn) mn = v
    if (v > mx) mx = v
  }
  const k = 1 / (mx - mn || 1)
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - mn) * k
}

// ───────────────────────────────────────────────────────────── materials
// index: 0 deep · 1 mid · 2 shallow · 3 surf · 4 sand · 5 sand speck · 6 grass · 7 grass dark · 8 grass light
//        9 tree top · 10 tree · 11 tree edge · 12 rock · 13 rock dark · 14 rock light · 15 snow · 16 snow shade
const MAT_TOP = [
  [36, 104, 180], [44, 124, 198], [66, 160, 216], [104, 204, 214],
  [238, 220, 164], [222, 200, 140],
  [96, 178, 52], [70, 148, 44], [134, 206, 76],
  [70, 158, 64], [42, 122, 54], [28, 92, 46],
  [146, 140, 134], [118, 112, 110], [178, 172, 162],
  [246, 250, 255], [214, 226, 244],
]
const MAT_SIDE = [
  [36, 104, 180], [44, 124, 198], [66, 160, 216], [104, 204, 214],
  [204, 180, 122], [204, 180, 122],
  [56, 120, 44], [50, 108, 42], [60, 128, 46],
  [24, 78, 42], [22, 72, 40], [20, 64, 38],
  [96, 90, 92], [86, 82, 86], [104, 98, 98],
  [186, 202, 228], [176, 192, 220],
]
const NMAT = MAT_TOP.length





























function makeJet(x, y, z, yaw) {
  return {
    x, y, z, yaw, yawRate: 0, roll: 0, pitch: 0, stunt: -1, stuntDir: 1, stuntDelay: 0, loop: -1, loopDir: 1, loopDelay: 0, vx: 0, vy: 0,
    trail: [new Float32Array(TRAIL_N * 4), new Float32Array(TRAIL_N * 4)],
    trailHead: 0, trailLen: 0, g: 0, lastTrailX: x, lastTrailY: y,
    lid: 0, glass: true, away: false,
  }
}

export function createScene(initial) {
  let p = { ...initial }

  // ── the jet's slices as lists of voxels
  const slices = decodeJet()
  const sliceA = []
  const sliceB = []
  const sliceC = []
  const shadowMask = new Uint8Array(JET_W * JET_L)
  let firstSlice = JET_H
  for (let y = 0; y < JET_H; y++) {
    const s = slices[y]
    let n = 0
    for (let o = 0; o < s.length; o++) if (s[o]) n++
    const a = new Float32Array(n)
    const b = new Float32Array(n)
    const c = new Uint8Array(n)
    let j = 0
    for (let k = 0; k < JET_L; k++) {
      for (let i = 0; i < JET_W; i++) {
        const v = s[k * JET_W + i]
        if (!v) continue
        a[j] = i - (JET_W - 1) / 2
        b[j] = PIV_K - k
        c[j] = v
        j++
        shadowMask[k * JET_W + i] = 1
      }
    }
    if (n && y < firstSlice) firstSlice = y
    sliceA.push(a)
    sliceB.push(b)
    sliceC.push(c)
  }
  // where the canopy's glass is: it lifts like a lid, hinged at its back edge, and the seat is under it
  let lidB0 = 1e9
  let lidB1 = -1e9
  let lidY0 = JET_H
  for (let y = 0; y < JET_H; y++) {
    for (let v = 0; v < sliceC[y].length; v++) {
      if ((sliceC[y][v] - 1) >> 4 !== 2) continue
      if (sliceB[y][v] < lidB0) lidB0 = sliceB[y][v]
      if (sliceB[y][v] > lidB1) lidB1 = sliceB[y][v]
      if (y < lidY0) lidY0 = y
    }
  }
  if (lidB0 > lidB1) { lidB0 = 6; lidB1 = 14; lidY0 = Math.round(PIV_Y) + 3 } // a jet with no glass: a guess
  const SEAT_B = (lidB0 + lidB1) / 2
  const SEAT_H = lidY0 - PIV_Y

  // the pilot and his ejection seat: small voxel models in the jet's own colours
  const pilotGrids = decodePilot()
  const pilotSeated = shellOf(pilotGrids.seated, PILOT_W, PILOT_L, PILOT_H, PILOT_PIVOT)
  const pilotHanging = shellOf(pilotGrids.hanging, PILOT_W, PILOT_L, PILOT_H, PILOT_PIVOT)
  const seatModel = shellOf(pilotGrids.seat, PILOT_W, PILOT_L, PILOT_H, PILOT_PIVOT)
  const painter = createVoxelPainter()
  const post = createPost() // the finish over each frame: glow, colour, corners, grain
  const look = { bloom: 0, vivid: 0, vignette: 0, grain: 0, flash: 0 }

  // the jet from above, for the cockpit's status screen: 0 empty, 1 body, 2 paint, 3 glass
  const jetTop = { w: JET_W, h: JET_L, cells: new Uint8Array(JET_W * JET_L) }
  for (let y = JET_H - 1; y >= 0; y--) {
    for (let o = 0; o < JET_W * JET_L; o++) {
      const v = slices[y][o]
      if (v && jetTop.cells[o] === 0) jetTop.cells[o] = 1 + Math.min(2, (v - 1) >> 4)
    }
  }

  // ── palettes (rebuilt when colours or the time of day change)
  const jetPal = new Uint32Array(96)
  const jetPalLit = new Uint32Array(96) // one tone up, for surfaces turned to the sun
  const jetPalDim = new Uint32Array(96) // one tone down, for surfaces turned away
  const foePal = new Uint32Array(96) // the same three for an enemy's jet: rust red, with yellow markings and dark glass
  const foePalLit = new Uint32Array(96)
  const foePalDim = new Uint32Array(96)
  let outlineCol = 0
  const topLit = new Uint32Array(NMAT)
  const topShade = new Uint32Array(NMAT)
  const sideLit = new Uint32Array(NMAT)
  const sideShade = new Uint32Array(NMAT)
  const cloudTop = new Uint32Array(CK)
  const cloudSide = new Uint32Array(CK)
  const flamePal = new Uint32Array(6)
  const trailPal = new Uint32Array(3)
  const skyPal = new Uint32Array(NSKY)
  let hazeCol = 0
  let cloudUnder = 0
  let sunCol = 0
  let sunGlow = 0
  let sparkA = 0
  let sparkB = 0
  let foamCol = 0
  let sunX = 0.45
  let sunY = 0.3

  function rebuildPalettes() {
    const tod = p.timeOfDay
    // jet: recolour each family from its key tone
    const keys = {
      0: { key: 4, col: parseColor(p.bodyColor, [84, 89, 105]), def: [84, 89, 105] },
      1: { key: 3, col: parseColor(p.accentColor, [240, 88, 14]), def: [240, 88, 14] },
      2: { key: 3, col: parseColor(p.canopyColor, [30, 140, 160]), def: [30, 140, 160] },
    }
    const keyLum = {}
    for (const row of JET_PALETTE) {
      const fam = row[4]
      if (fam < 3 && ((row[0] - 1) & 15) === keys[fam].key) keyLum[fam] = lum([row[1], row[2], row[3]])
    }
    const jetAmount = tod === 'sunset' ? 0.5 : tod === 'night' ? 0.16 : 0
    const paint = (pal, lit, dim, cols) => {
      for (const row of JET_PALETTE) {
        const idx = row[0]
        const fam = row[4]
        let c = [row[1], row[2], row[3]]
        if (fam < 3) {
          const k = keys[fam]
          const col = cols[fam]
          const same = col[0] === k.def[0] && col[1] === k.def[1] && col[2] === k.def[2]
          if (!same) {
            const l = lum(c)
            const kl = keyLum[fam] || 100
            if (l <= kl) {
              const f = l / kl
              c = [col[0] * f, col[1] * f, col[2] * f]
            } else {
              const f = (l - kl) / (255 - kl)
              c = [col[0] + (255 - col[0]) * f, col[1] + (255 - col[1]) * f, col[2] + (255 - col[2]) * f]
            }
          }
          c = grade(c, tod, jetAmount)
        }
        pal[idx] = pack(c[0], c[1], c[2])
      }
      for (const row of JET_PALETTE) {
        const idx = row[0]
        const fam = row[4]
        lit[idx] = fam < 3 && pal[idx + 1] ? pal[idx + 1] : pal[idx]
        dim[idx] = fam < 3 && ((idx - 1) & 15) > 0 ? pal[idx - 1] : pal[idx]
      }
    }
    paint(jetPal, jetPalLit, jetPalDim, [keys[0].col, keys[1].col, keys[2].col])
    paint(foePal, foePalLit, foePalDim, [[136, 58, 50], [246, 206, 64], [46, 44, 56]])
    cockpit = null // repainted in the new colours shortly
    cockpitDue = 0.3
    const oc = tod === 'night' ? [44, 64, 118] : grade([13, 15, 26], tod, 0.3)
    outlineCol = pack(oc[0], oc[1], oc[2])
    // world
    for (let m = 0; m < NMAT; m++) {
      const t = grade(MAT_TOP[m], tod, 1)
      const s = grade(MAT_SIDE[m], tod, 1)
      topLit[m] = pack(t[0], t[1], t[2])
      sideLit[m] = pack(s[0], s[1], s[2])
      topShade[m] = pack(t[0] * 0.62, t[1] * 0.67, t[2] * 0.8)
      sideShade[m] = pack(s[0] * 0.62, s[1] * 0.67, s[2] * 0.8)
    }
    for (let k = 0; k < CK; k++) {
      const f = k / (CK - 1)
      const ft = Math.min(1, k / 2)
      const ca = tod === 'night' ? 0.72 : 1
      const t = grade([218 + 37 * ft, 230 + 25 * ft, 247 + 8 * ft], tod, ca)
      const s = grade([158 + 44 * f, 182 + 36 * f, 222 + 18 * f], tod, ca)
      cloudTop[k] = pack(t[0], t[1], t[2])
      cloudSide[k] = pack(s[0], s[1], s[2])
    }
    const sa = tod === 'sunset' ? [255, 170, 110] : tod === 'night' ? [70, 110, 190] : [120, 190, 236]
    const sb = tod === 'sunset' ? [255, 226, 170] : tod === 'night' ? [170, 200, 240] : [236, 250, 255]
    const fm = tod === 'sunset' ? [255, 226, 214] : tod === 'night' ? [110, 140, 200] : [240, 252, 255]
    sparkA = pack(sa[0], sa[1], sa[2])
    sparkB = pack(sb[0], sb[1], sb[2])
    foamCol = pack(fm[0], fm[1], fm[2])
    const flames = [[255, 252, 224], [255, 224, 120], [255, 164, 44], [246, 96, 20], [176, 48, 26], [96, 34, 40]]
    for (let i = 0; i < 6; i++) flamePal[i] = pack(flames[i][0], flames[i][1], flames[i][2])
    const tr = [grade([255, 255, 255], tod, 0.8), grade([214, 232, 250], tod, 0.8), grade([170, 204, 240], tod, 0.8)]
    for (let i = 0; i < 3; i++) trailPal[i] = pack(tr[i][0], tr[i][1], tr[i][2])
    // sky: from the horizon up
    const skyA = tod === 'sunset' ? [255, 198, 132] : tod === 'night' ? [36, 56, 110] : [198, 232, 250]
    const skyM = tod === 'sunset' ? [238, 122, 130] : tod === 'night' ? [18, 28, 70] : [122, 190, 240]
    const skyB = tod === 'sunset' ? [84, 68, 150] : tod === 'night' ? [7, 10, 34] : [62, 142, 222]
    for (let i = 0; i < NSKY; i++) {
      const f = i / (NSKY - 1)
      const a = f < 0.5 ? skyA : skyM
      const b = f < 0.5 ? skyM : skyB
      const g = f < 0.5 ? f * 2 : f * 2 - 1
      skyPal[i] = pack(a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g, a[2] + (b[2] - a[2]) * g)
    }
    const hz = tod === 'sunset' ? [250, 182, 134] : tod === 'night' ? [28, 44, 92] : [188, 224, 246]
    hazeCol = pack(hz[0], hz[1], hz[2])
    const cu = grade([138, 160, 200], tod, tod === 'night' ? 0.72 : 1)
    cloudUnder = pack(cu[0], cu[1], cu[2])
    const sc2 = tod === 'night' ? [232, 238, 255] : [255, 244, 200]
    const sg = tod === 'night' ? [70, 96, 160] : [255, 222, 150]
    sunCol = pack(sc2[0], sc2[1], sc2[2])
    sunGlow = pack(sg[0], sg[1], sg[2])
    if (tod === 'sunset') { sunX = 0.95; sunY = 0.5 } else if (tod === 'night') { sunX = 0.3; sunY = 0.42 } else { sunX = 0.5; sunY = 0.32 }
    // what glows: fire, the engines' nozzles and flames, the sun (or the moon and stars), glints on the sea
    const fl = [[255, 252, 224], [255, 224, 120], [255, 164, 44], [246, 96, 20]]
    const shine = [[sunCol, 1], [sparkB, tod === 'night' ? 0.2 : 0.32]]
    for (let i = 0; i < 4; i++) {
      shine.push([FIRE[i], 1 - i * 0.2], [pack(fl[i][0], fl[i][1], fl[i][2]), 1 - i * 0.2])
      shine.push([jetPal[53 - i], 0.9 - i * 0.22])
    }
    post.setHot(shine)
  }

  // ── the world: a height and a material per ground pixel
  const heightMap = new Uint8Array(N * N)
  const matMap = new Uint8Array(N * N)
  const cloudN = new Uint8Array(NC * NC)
  // the clouds as they were made, and the cells cut out of them since (which, and when): a jet
  // flying through a cloud tears a channel through it, and the oldest cuts are put back in turn
  const cloudBase = new Uint8Array(NC * NC)
  const cutIdx = new Int32Array(CUT_N)
  const cutAt = new Float32Array(CUT_N)
  let cutHead = 0
  let cutTail = 0
  const nz = new Uint8Array(256 * 256)
  let spawnX = N / 2
  let spawnY = N / 2

  function buildWorld() {
    const rnd = mulberry32((p.seed | 0) * 7919 + 13)
    for (let i = 0; i < nz.length; i++) nz[i] = (rnd() * 256) | 0

    const E = new Float32Array(N * N)
    addOctave(E, N, 512, 0.55, rnd)
    addOctave(E, N, 256, 1, rnd)
    addOctave(E, N, 128, 0.5, rnd)
    addOctave(E, N, 64, 0.25, rnd)
    addOctave(E, N, 32, 0.11, rnd)
    addOctave(E, N, 16, 0.05, rnd)
    normalise(E)

    // sea level from the wanted share of land
    const bins = new Uint32Array(1024)
    for (let o = 0; o < E.length; o++) bins[(E[o] * 1023) | 0]++
    const land = clamp(p.land, 0.02, 0.9)
    let acc = 0
    let sea = 1
    const target = (1 - land) * E.length
    for (let b = 0; b < 1024; b++) {
      acc += bins[b]
      if (acc >= target) { sea = (b + 1) / 1023; break }
    }
    const SAND = 0.012
    const span = Math.max(0.05, 1 - sea - SAND)

    for (let y = 0; y < N; y++) {
      const row = y << NSHIFT
      const rowNW = ((y - 2) & NM) << NSHIFT
      const rowSE = ((y + 2) & NM) << NSHIFT
      for (let x = 0; x < N; x++) {
        const o = row | x
        const e = E[o]
        const hs = hash8(o)
        const d = e - sea
        if (d < 0) {
          const dd = -d + (hs - 128) * 0.00004
          matMap[o] = dd > 0.07 ? 0 : dd > 0.03 ? 1 : dd > 0.008 ? 2 : 3
          heightMap[o] = 0
          continue
        }
        if (d < SAND) {
          matMap[o] = hs < 34 ? 5 : 4
          heightMap[o] = 0
          continue
        }
        const hr = (d - SAND) / span
        // terraces: 8 grass levels (2 px each), 4 rock levels and the snow cap (3 px each)
        let lv = hr < 0.5 ? 1 + ((hr * 16) | 0) : hr < 0.78 ? 9 + (((hr - 0.5) / 0.07) | 0) : 13 + (((hr - 0.78) / 0.09) | 0)
        if (lv > 15) lv = 15
        heightMap[o] = lv <= 8 ? lv * 2 : 16 + (lv - 8) * 3
        const g = E[rowNW | ((x - 2) & NM)] - E[rowSE | ((x + 2) & NM)]
        const lit = g < -0.007
        const shaded = g > 0.007
        if (lv >= 13) matMap[o] = shaded ? 16 : 15
        else if (lv >= 9) matMap[o] = lit ? 14 : shaded ? 13 : hs < 26 ? 13 : 12
        else matMap[o] = lit ? 8 : shaded ? 7 : hs < 22 ? 7 : hs > 240 ? 8 : 6
      }
    }

    // forests: little cones of leaves
    const STEP = 5
    for (let gy = 0; gy < N; gy += STEP) {
      for (let gx = 0; gx < N; gx += STEP) {
        const hs = hash8(gy * 977 + gx * 131 + 7)
        const cx = (gx + (hs & 3)) & NM
        const cy = (gy + ((hs >> 2) & 3)) & NM
        const o = (cy << NSHIFT) | cx
        const m = matMap[o]
        if (m < 6 || m > 8) continue
        const h0 = heightMap[o]
        if (h0 > 14) continue
        const f = E[(((cy + 613) & NM) << NSHIFT) | ((N - 1 - cx + 911) & NM)]
        const pr = (f - sea) * 30
        if (pr <= 0 || pr * 255 < hash8(o + 99)) continue
        const r = 2 + ((hs >> 4) & 1)
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > r + 0.3) continue
            const oo = (((cy + dy) & NM) << NSHIFT) | ((cx + dx) & NM)
            if (matMap[oo] < 4) continue
            const nh = h0 + 1 + Math.round((1 - dist / (r + 0.5)) * (r + 1))
            if (nh > heightMap[oo]) {
              heightMap[oo] = nh
              matMap[oo] = dist < 1.1 ? 9 : dist < r - 0.5 ? 10 : 11
            }
          }
        }
      }
    }

    // a start over open water next to land
    let best = -1
    for (let tries = 0; tries < 400; tries++) {
      const x = (rnd() * N) | 0
      const y = (rnd() * N) | 0
      const here = matMap[(y << NSHIFT) | x]
      if (here > 2) continue
      let landNear = 0
      for (let a = 0; a < 8; a++) {
        const xx = (x + Math.cos(a * 0.785) * 120) & NM
        const yy = (y + Math.sin(a * 0.785) * 120) & NM
        if (matMap[(yy << NSHIFT) | xx] >= 4) landNear++
      }
      if (landNear > best && landNear <= 5) { best = landNear; spawnX = x; spawnY = y }
    }

    // clouds: clusters of round puffs. Each cell holds (rank << 4) | thickness; a cloud shows
    // when its rank is under the cover setting, so the slider adds and removes whole clouds.
    cloudN.fill(0)
    for (let i = 0; i < 200; i++) {
      const rank = i & 15
      const cx = rnd() * NC
      const cy = rnd() * NC
      const sc = 0.6 + rnd() * rnd() * 1.25
      const ang = 0.35 + (rnd() - 0.5) * 1.3
      const len = (12 + rnd() * 24) * sc
      const puffs = 4 + ((rnd() * 7) | 0)
      for (let q = 0; q < puffs; q++) {
        const t = (q / (puffs - 1)) * 2 - 1
        const pxc = cx + Math.cos(ang) * t * len + (rnd() - 0.5) * 9 * sc
        const pyc = cy + Math.sin(ang) * t * len + (rnd() - 0.5) * 9 * sc
        const r = (6 + rnd() * 8) * sc * (1 - 0.45 * Math.abs(t))
        const maxT = clamp(Math.round(r * 0.6), 2, CK)
        const ri = Math.ceil(r)
        for (let dy = -ri; dy <= ri; dy++) {
          for (let dx = -ri; dx <= ri; dx++) {
            const d2 = (dx * dx + dy * dy) / (r * r)
            if (d2 > 1) continue
            const tk = Math.max(1, Math.round(Math.sqrt(1 - d2) * maxT))
            const xx = (Math.round(pxc) + dx) & NCM
            const yy = (Math.round(pyc) + dy) & NCM
            const oo = (yy << NCSHIFT) | xx
            if (tk > (cloudN[oo] & 15)) cloudN[oo] = (rank << 4) | tk
          }
        }
      }
    }
    cloudBase.set(cloudN)
    cutHead = 0
    cutTail = 0
  }

  // ── state
  let W = 0
  let H = 0
  let fb = new Uint32Array(0)
  let bytes = new Uint8ClampedArray(0)
  let jetMask = new Uint8Array(0)
  let time = 0
  let introT = 0
  let spreadNow = p.spread
  let holding = false
  let holdT = 0
  let pointerOn = false
  let pointerX = 0
  let pointerY = 0
  let pointerIdle = 99
  let autoStunt = 6
  let burn = 0 // afterburner, eased in after the intro
  let boost = 0 // 0..1: how hard the thrusters are being pushed (hold)
  let boostKey = false
  let padThrust = 0 // 0..1: how far a game controller's trigger is squeezed
  let keyTurn = 0 // flying with the keys: −1 left … +1 right
  let keyClimb = 0 // −1 dive … +1 climb
  let keyMode = false // the keys fly the jet until the pointer moves again
  let climbV = 0 // how fast it is climbing, px per second (smoothed)
  let climbTilt = 0 // the jet's climb angle, which the chase camera leans with
  let climbCmd = 0 // the climb angle being asked for, rad (eased: the stick is not a switch)
  let climbNow = 0 // the angle it is really climbing at, rad
  let riseNow = 0 // how fast the lead jet is gaining height this moment, px per second
  let flipping = false // true while it is being flown right round by hand: on over the top, or on under
  let flipDir = 1 // … which way: 1 back over the top, -1 forward and under
  let energy = 1 // the jet's speed against what its engines give it: it gathers some in a dive and loses some in a climb
  let worldDirty = 0 // seconds until the world is rebuilt (waits for a slider to settle)
  let reseat = false
  const cam = { x: 0, y: 0, yaw: 0, alt: p.altitude } // what the view is centred on (yaw: the overhead heading)
  const follow = { x: 0, y: 0, alt: p.altitude } // the same point as it trails the jet; the cockpit locks on instead
  let jets = []
  let colY = new Int32Array(0) // per screen column: the highest row the ground has reached
  let zbuf = new Float32Array(0) // per pixel: how deep into the view the world is, so it can hide a jet behind it
  // the cockpit view is drawn on a larger square sheet and then turned (the horizon rolls)
  let sheetSide = 0
  let sheet = new Uint32Array(0)
  let sheetMask = new Uint8Array(0)
  let sheetColY = new Int32Array(0)
  let sheetZ = new Float32Array(0)
  let pivotY = 0 // the screen row the cockpit view rolls about
  let turnY = 0 // the screen row this frame is turned about: that one in the cockpit, the jet's own from behind
  let cockpit = null
  let cockpitDue = 0.3 // seconds until the cockpit is (re)painted; it is done ahead of time, never mid-move
  let colLo = 0 // the columns and rows being drawn (all of them, except on the sheet)
  let colHi = 0
  let rowLo = 0
  let rowHi = 0
  let frameH = 0 // height of the frame on screen (H is the sheet's while the world is drawn on it)
  let backdrop = new Uint32Array(0) // what was behind a jet, kept while it fades in or out
  let sheetBackdrop = new Uint32Array(0)

  // the view: 0 = overhead, 1 = behind the jet, 2 = in the cockpit, and anywhere between while it moves
  const viewIndex = (v) => (v === 'cockpit' ? 2 : v === 'chase' ? 1 : 0)
  let viewTarget = viewIndex(p.view)
  // How much of each view the camera is in. Each weight glides to its goal through three soft
  // stages, so a change starts and ends gently, goes straight from any view to any other, and
  // can be redirected half-way without a jolt.
  const wChase = [0, 0, 0]
  const wCock = [0, 0, 0]
  wChase.fill(viewTarget === 1 ? 1 : 0)
  wCock.fill(viewTarget === 2 ? 1 : 0)
  let vC = wChase[2] // chase
  let vK = wCock[2] // cockpit (what is left over is the overhead view)
  let jetFade = 1 // how solid the leader is drawn: it fades out as the camera moves into it
  let camSpin = 0 // 1 while the camera is going round with a roll that began in the cockpit
  let chaseYaw = 0 // heading of the chase camera (lags the jet a little in turns)
  let yawDiff = 0 // how far the chase heading is from the overhead one, kept continuous
  let vQ = 0 // 1 / camera distance: 0 is the flat sprite-stack view
  let vTan = 1 // how steeply the camera looks down
  let vS = 1 // scale at the jet
  let vCx = 0 // where the jet sits on screen
  let vCy = 0
  let vCos = 1
  let vSin = 0
  let vYaw = 0
  let vIn = 0 // 0..1: how far into the cockpit the camera is
  const smoke = new Float32Array(SMOKE_N * SMOKE_F) // x, y, z, born, size, push x, push y, strength, life
  let smokeHead = 0
  let smokeClock = 0
  let vRoll = 0 // the camera's roll (cockpit only)
  let vSteerY = 0 // the screen row that means "hold this height" when pointing to climb or dive
  let vLean = 1 // how steeply the chase camera would look down if nothing were in its way
  let camFix = 0 // how far the chase camera is moved up or down to stay clear of hills and clouds, px
  let camFloor = 0 // the lowest the chase camera may sit right now, px
  let floorS = 0 // the lowest the jet may fly right now (the ground ahead plus clearance), smoothed
  let speedNow = p.speed

  // ── crash and ejection
  // Hold a dive into the ground and, a moment before the jet hits, the pilot is thrown clear:
  // his seat rockets him up, a parachute opens, a new jet slides in beneath him, he cuts the
  // parachute loose, drops into the cockpit, and the canopy closes over him.
  let ej = EJ_FLY
  let ejT = 0 // seconds since he left the jet
  let ejAt = 0 // ejT when the present stage began
  let ejHead = 0 // the heading the jet had
  let ejSpeed = 0 // how fast the new jet flies while it takes him aboard
  let meetT = 0 // ejT at which he lands in the new jet
  let hangZ = 0 // the height he would be hanging at, had he not let go: the jet flies up to just under it
  let riseV = 0 // how fast the new jet is climbing or sinking, kept so that it levels off gently
  let kick = 0 // 1 → 0: the push of the thrusters as the jet flies off with him
  let handed = 0 // 0..1: how far the camera has left the pilot for the jet that is coming for him
  let centred = 0 // 0..1: how far the frame has moved from the flying one (jet low) to the rescue's (middle)
  let rig = 0 // 0..1: how much room the frame is leaving above the pilot for his parachute
  let dropZ = 0 // how far above the seat he was when he cut the parachute
  let diveHold = 0 // seconds a dive has been held against the safe height
  let safeT = 0 // seconds after a pick-up during which the jet will not crash again
  let speedEase = 1 // the new jet gathers speed again afterwards
  let cine = 0 // 0..1: how far the camera has moved round to watch
  let wide = 0 // 0..1: how far it has drawn back, to keep the pilot and the crash in one picture
  let near = 0 // 0..1: how far it has come in on the pilot under his parachute, so he can be seen
  let shake = 0 // how hard the picture shakes (an explosion)
  let flash = 0 // 1 → 0: the light of an explosion over the whole frame
  let wreck = null // the jet he left, until it meets the ground
  let wreckVz = 0
  const pilot = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, swing: 0, swingV: 0 }
  const ghost = makeJet(0, 0, 0, 0) // stands in for a jet while he has none: the camera follows it
  const seat = { x: 0, y: 0, z: 0 }
  const chute = { on: false, open: 0, free: false, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }
  const boom = { on: false, wet: false, t: 0, x: 0, y: 0, z: 0, puff: 0 }
  const debris = new Float32Array(DEBRIS_N * DEBRIS_F).fill(-1)
  let debrisHead = 0
  // the cannon and the missiles
  const shots = new Float32Array(SHOT_N * SHOT_F).fill(-1e9)
  let shotHead = 0
  // the spent cases the guns throw out: they fall away behind and below, turning over
  const cases = new Float32Array(CASE_N * CASE_F).fill(-1e9)
  let caseHead = 0
  let firing = false // the trigger is held
  // what is left to fire: rounds in the cannon, missiles on the rails. Once either has run out it
  // is a while reloading (the seconds of that still to go; 0 while it is not)
  let roundsLeft = 0
  let gunLoad = 0
  let missilesLeft = 0
  let missileLoad = 0
  const ammoOut = { rounds: 0, roundsMax: 0, gunLoad: 0, missiles: 0, missilesMax: 0, missileLoad: 0 }
  let gunDue = 0 // seconds until the next round
  let gunSide = 1 // the rounds leave one side of the nose, then the other
  let muzzleL = 0 // 1 → 0: the flash at each gun's muzzle
  let muzzleR = 0
  // (a missile: where it is, the way it points, how fast it flies that way, how fast it is still
  // dropping from the wing, and which enemy it is after, if any)
  const missiles = Array.from({ length: MISSILE_N }, () => ({ on: false, lit: false, sure: false, t: 0, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, s: 0, drop: 0, target: -1, puff: 0 }))
  let missileSide = 1 // … and the missiles one wing, then the other
  let missileWait = 0 // seconds until the next may go
  const blasts = Array.from({ length: BLAST_N }, () => ({ on: false, t: 0, x: 0, y: 0, z: 0, wet: false, size: 1 }))
  // the enemy: jets that wander the sky near the player (0 flying, 1 shot down and falling, 2 gone: another is on its way)
  // (… atk: it is after the player; atkT: seconds until it changes its mind; burst, due, cool: its gun)
  const foes = []
  let hull = HULL // how many more hits the player's jet will take
  let hullT = 99 // seconds since it was last hit (left alone a while, it is patched up)
  let truce = 0 // seconds the enemy holds its fire: while the pilot has no jet, and a little after
  let foeGun = 0 // 0..1: how loud the enemy's guns are from here
  let burning = false // the jet the pilot left was shot down: it falls on fire
  let hurtDue = 0
  // the enemy's missiles (lost: thrown off, it flies on blind for a moment and goes off)
  const inbound = Array.from({ length: 2 }, () => ({ on: false, lost: false, from: -1, t: 0, lostT: 0, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, s: 0, puff: 0 }))
  let foeMissileWait = 16 // seconds until the enemy may fire another
  let threatT = 99 // seconds until the nearest of them arrives (99: none is coming)
  let threatFrom = 0 // … and where it is coming from, measured round from dead ahead, rad
  let evades = 0 // missiles thrown off so far
  // a missile thrown off: time slows as it goes by (measured by the clock, which does not slow)
  let slowT = 0 // seconds of it left
  let slowAmt = 0 // 0..1: how far into it things are, eased in and out
  // … and a missile fired in that moment is a counter-attack: three, one after another, at whoever fired
  let counterT = 0 // seconds left in which to fire it
  let counterFoe = -1 // who fired the missile that was thrown off
  let volley = 0 // missiles of a counter-attack still to leave
  let volleyDue = 0
  let volleyAt = -1 // … and who they are for
  let counters = 0 // counter-attacks made so far
  let inCloud = false // the lead jet is in a cloud
  let mist = 0 // 0..1: cloud over the cockpit's glass
  let vapourDue = 0
  let lockOn = -1 // the enemy in the sights: being locked on to, or locked
  let lockT = 0 // … and for how long it has been held there
  let kills = 0
  let drill = ''
  let hands = false // the player is flying the jet himself (not the autopilot)
  // what the player has done so far and how things stand, for the tutorial to tick off
  const did = {
    rolls: 0, back: 0, fwd: 0, rounds: 0, launched: 0, downed: 0, struck: 0, evades: 0, counters: 0,
    yaw: 0, z: 0, height: 0, boost: 0, lock: 0, threat: 99, hands: false, out: false, counterOpen: false, foe: false, gunDry: false, missilesDry: false,
  }
  let blastHead = 0
  // a jet low over the sea tears a wake out of it: two lines of foam that spread and fade, and spray
  const wake = new Float32Array(WAKE_N * WAKE_F).fill(-1e9)
  let wakeHead = 0
  let wakeDue = 0 // px a jet has still to fly before its next mark
  let sprayDue = 0
  let spray = 0 // 0..1: how hard the lead jet is tearing at the water (for the sound)
  // what there is to hear: the things that have just happened, and how things stand
  const heard = []
  const sound = (name) => { if (heard.length < 16) heard.push(name) }
  const audio = { boost: 0, speed: 1, cockpit: 0, jet: 1, air: 0, alarm: 0, spray: 0, gun: 0, lock: 0, cloud: 0, threat: 0, slow: 0 }
  let warn = false // true while a dive is being pushed past the safe height
  /** what the camera follows: the jet, or the pilot while he is out of one */
  /** where the pilot is: his jet, or the stand-in for him while he is out of one */
  const pilotAt = () => (ej !== EJ_FLY && handed < 1 ? ghost : jets[0])
  /** what the camera follows */
  const focus = pilotAt
  // the pilot's head, swaying with the flying (design pixels; right and down are positive)
  let headX = 0
  let headY = 0
  let headVX = 0
  let headVY = 0
  // Smooth flames are not drawn into the picture: the fire layer over it draws them. For each:
  // nozzle x y, a point straight behind it x y, tip x y (frame px), radius at the nozzle,
  // how much larger things are at the tip, thrust 0..1, strength 0..1, how much of the nozzle,
  // middle and tip can be seen, which flame it is, the afterburner setting, and its true
  // length in nozzle radii.
  const flameData = new Float32Array(FLAME_MAX * FLAME_F)
  const flameOut = { count: 0, data: flameData }
  const flameSeen = new Float32Array(FLAME_MAX * 3).fill(1)
  const flameV = [0, 0, 0]

  /**
   * How a camera goes right round with the jet in a loop. This picture can be turned to face any
   * way and rolled to any angle, but it cannot look straight up or straight down: only so far
   * (TILT). So the camera's own tilt follows the nose exactly in ordinary flying and eases up to
   * that limit as the nose comes to the vertical, never stopping on the way; and at the vertical
   * itself, where looking up one way is the same as looking up the other way upside down, it
   * changes over to that: facing back the way it came, rolled right over. From there it comes
   * down the far side just as it went up.
   * Sets `lean`: the angle to look up at, what to add to the heading and the roll, and how far
   * the tilt has been eased off the nose's own angle (0 not at all … 1 at the vertical).
   */
  const lean = { pitch: 0, yaw: 0, roll: 0, eased: 0 }
  function leanOf(nose, limit) {
    const up = Math.PI / 2
    const a = Math.abs(nose)
    const over = a > up
    const n = over ? Math.PI - a : a
    lean.eased = Math.pow(n / up, up / (up - limit))
    const tilt = n - (up - limit) * lean.eased
    lean.pitch = (nose < 0 ? -1 : 1) * tilt
    lean.yaw = over ? Math.PI : 0
    lean.roll = over ? Math.PI : 0
  }
  /** the overhead view's scale: 1 near the ground, and the higher the jet flies the more of the map there is to see */
  const highUp = () => 1 / (1 + Math.max(0, cam.alt - 170) / 1500)
  /** 0..1: how far the cockpit has slid into place round the camera */
  function cockpitIn() {
    const u = clamp((vK - 0.16) / 0.84, 0, 1)
    return u * u * u * (u * (u * 6 - 15) + 10)
  }

  function updateView() {
    const sc = jetSize()
    const lead = focus()
    const top = 1 - vC - vK
    const jolt = shake > 0 ? shake * 3.2 * clamp(p.shake, 0, 3) : 0
    vCx = (W >> 1) + Math.round(Math.sin(time * 91) * jolt)
    vIn = vK
    cam.x = follow.x
    cam.y = follow.y
    cam.alt = follow.alt
    if ((vC === 0 && vK === 0) || !lead) {
      // the plain overhead view, exactly
      vQ = 0
      vTan = 1
      vLean = 1
      vS = highUp()
      vCy = H >> 1
      vSteerY = vCy
      vRoll = 0
      jetFade = 1
      vYaw = cam.yaw
    } else {
      // Each view is a camera pose; the frame shows a blend of the three.
      // chase: behind the jet (under boost it closes in a little, which widens the view)
      // (while the pilot is out of the jet it also draws back and lifts, to take everything in)
      const dist = clamp(p.chaseDistance, 1, 8) * JET_L * sc * (1 - 0.16 * boost) * (1 + 0.2 * cine)
      const zoom = Math.max(1, (clamp(p.chaseSize, 0.05, 0.6) * W) / (JET_W * sc)) * (1 - 0.16 * cine - 0.36 * wide) * (1 + clamp(p.ejectZoom, 0, 2) * near)
      // cockpit: at the pilot's eyes, looking at a point ahead of the nose
      const focalIn = W * 0.6 * (1 - 0.1 * boost)
      // (the cockpit goes right round with the jet in a loop: see leanOf. The camera behind it stays
      // the right way up and watches it go round, looking up as it climbs and down as it dives.)
      const with3d = vK > 0.5 && ej === EJ_FLY ? 1 : 0
      const limit = TILT_IN
      leanOf(wrapAngle(lead.pitch), limit)
      const nose = lean.pitch
      let ahead = COCKPIT_LOOK * vK * Math.max(0.05, Math.cos(nose))
      // (diving through the vertical, the cockpit's camera is drawn back until the ground in the
      // middle of the frame is the ground right under the jet: it is then the same ground whichever
      // way round the camera is, so nothing jumps as it changes over)
      if (nose < 0) ahead -= lean.eased * vK * (Math.max(0, lead.z - groundAt(lead.x, lead.y)) / Math.tan(-nose))
      const sn = Math.sin(lead.yaw - lean.yaw * with3d)
      const cs = Math.cos(lead.yaw - lean.yaw * with3d)
      cam.x += (lead.x + sn * ahead - follow.x) * vK
      cam.y += (lead.y - cs * ahead - follow.y) * vK
      cam.alt += (lead.z + COCKPIT_EYE * sc - follow.alt) * vK
      vQ = vC / dist + vK / COCKPIT_LOOK
      vS = Math.exp(top * Math.log(highUp()) + vC * Math.log(zoom) + vK * Math.log(focalIn / COCKPIT_LOOK))
      // how steeply it looks down: 45° overhead, the chase angle behind, level in the cockpit.
      // The chase camera drops behind the jet as it climbs and rises over it as it dives, and
      // camFix lifts or lowers it to stay clear of the hills and out of the cloud layer.
      const angle = (45 * top + (clamp(p.chaseAngle, 2, 40) + 19 * cine) * vC) * (Math.PI / 180)
      // (the chase camera drops behind and looks up the sky as the jet climbs, and over it as it dives)
      const up = TILT * Math.sin(lead.pitch) // (level again when the jet is on its back at the top of a loop)
      vLean = Math.tan(clamp(angle - up * vC * (1 - cine), -1.2, 1.2))
      const free = 1 - vK
      vTan = Math.max(vLean + camFix * vQ * free, (camFloor - cam.alt) * vQ * free, (2 - cam.alt) * vQ)
      // where the jet (or, in the cockpit, the horizon) sits in the frame; a climb drops the horizon
      const focal = vS / vQ
      // (flying, the jet sits low in the frame, to see ahead; a rescue is framed in the middle of it,
      // with the pilot low only by as much as his parachute stands above him)
      const room = Math.min(H * 0.16, rig * 0.36 * (hemAbove() + 9.5 * CHUTE * sc) * vS)
      const cyChase = (H >> 1) + H * ((0.14 + 0.07 * cine) * (1 - centred) + 0.02 * centred - 0.03 * boost) + room
      const cyIn = pivotY + focal * Math.tan(clamp(nose, -limit, limit))
      vCy = top * (H >> 1) + vC * cyChase + vK * cyIn
      vSteerY = top * (H >> 1) + vC * cyChase + vK * H * 0.34
      // in the cockpit the view rolls and turns exactly with the jet
      // (a full roll is followed either all the way round or not at all, so it always ends level)
      vRoll = lead.roll * vK + spinOf(lead) * camSpin + lean.roll * with3d
      const behind = cam.yaw + yawDiff
      vYaw = cam.yaw + yawDiff * (vC + vK) + wrapAngle(-lead.yaw - behind) * vK + lean.yaw * with3d
      // the jet fades away as the camera moves into it
      const f = clamp((vK - 0.12) / 0.4, 0, 1)
      jetFade = 1 - f * f * (3 - 2 * f)
    }
    if (jolt > 0) vCy += Math.round(Math.cos(time * 77) * jolt)
    vCos = Math.cos(vYaw)
    vSin = Math.sin(vYaw)
  }

  /** how long the afterburner flames are, in jet pixels (before the flicker) */
  function flameLength() {
    return (0.07 + 0.17 * p.afterburner) * JET_L * burn * clamp(1.6 - spreadNow * 0.6, 0, 1) * (1 + 1.6 * boost)
  }
  /** how far the flames bend: the exhaust trails round the inside of a turn */
  function flameBend() {
    const lead = jets[0]
    return lead ? clamp(lead.yawRate / Math.max(0.1, p.agility), -1, 1) * 0.36 : 0
  }
  /** how far through a full roll a jet is, as an angle (0 when it is not rolling) */
  function spinOf(j) {
    if (j.stunt < 0 || j.stuntDelay > 0) return 0
    const t = j.stunt
    return j.stuntDir * Math.PI * 2 * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  }
  /** how far round a loop a jet is, rad (0 when it is not in one): slow into it, quickest over the top, slow out */
  function loopOf(j) {
    if (j.loop < 0 || j.loopDelay > 0) return 0
    return j.loopDir * (Math.PI * 2 * j.loop - Math.sin(Math.PI * 2 * j.loop))
  }
  /** a jet's bank angle, including any roll it is half-way through */
  function rollOf(j) {
    return j.roll + spinOf(j)
  }
  const groundAt = (x, y) => heightMap[(((y | 0) & NM) << NSHIFT) | ((x | 0) & NM)]
  /** the tallest ground under a jet and along the next stretch of its path */
  function groundAhead(j, speed) {
    const sn = Math.sin(j.yaw)
    const cs = Math.cos(j.yaw)
    let top = 0
    for (let i = 0; i <= 4; i++) {
      const d = speed * 0.16 * i
      for (let side = -1; side <= 1; side++) {
        const h = groundAt(j.x + sn * d + cs * side * 7, j.y - cs * d + sn * side * 7)
        if (h > top) top = h
      }
    }
    return top
  }

  const jetSize = () => clamp(p.jetScale || 1, 0.4, 2)
  const formX = () => JET_W * 1.2 * jetSize() + 2
  const formY = () => JET_L * 0.74 * jetSize()

  function resetFlight() {
    const yaw = 0.9
    jets = [makeJet(spawnX, spawnY, p.altitude, yaw)]
    cam.x = follow.x = spawnX
    cam.y = follow.y = spawnY
    cam.yaw = -yaw * p.cameraFollow
    cam.alt = follow.alt = p.altitude
    camFix = 0
    camFloor = 0
    floorS = 0
    chaseYaw = -yaw
    yawDiff = wrapAngle(chaseYaw - cam.yaw)
    introT = p.intro ? 0 : 99
    burn = p.intro ? 0 : 1
    autoStunt = 7
    climbV = 0
    climbTilt = 0
    boost = 0
    ej = EJ_FLY
    wreck = null
    chute.on = false
    boom.on = false
    debris.fill(-1)
    cine = 0
    wide = 0
    near = 0
    flash = 0
    kick = 0
    handed = 0
    centred = 0
    rig = 0
    shake = 0
    speedEase = 1
    climbCmd = 0
    climbNow = 0
    flipping = false
    energy = 1
    diveHold = 0
  }
  function syncWingmen() {
    const want = 1 + clamp(Math.round(p.wingmen), 0, 2)
    const lead = jets[0]
    while (jets.length < want) {
      const side = jets.length === 1 ? -1 : 1
      const j = makeJet(
        lead.x + Math.cos(lead.yaw) * side * formX() - Math.sin(lead.yaw) * formY(),
        lead.y + Math.sin(lead.yaw) * side * formX() + Math.cos(lead.yaw) * formY(),
        lead.z, lead.yaw,
      )
      jets.push(j)
    }
    if (jets.length > want) jets.length = want
    syncFoes()
  }

  rebuildPalettes()
  buildWorld()
  resetFlight()
  syncWingmen()

  const roundsMax = () => clamp(Math.round(p.ammo), 0, 9999)
  const missilesMax = () => clamp(Math.round(p.missiles), 0, 99)
  const reloadTime = () => clamp(p.reload, 0, 120)
  /** the cannon full and every rail loaded: a new jet, or the settings changed */
  function rearm() {
    roundsLeft = roundsMax()
    missilesLeft = missilesMax()
    gunLoad = 0
    missileLoad = 0
  }
  rearm()
  /** the cannon's trigger is held and there is something for it to fire */
  const shooting = () => firing && armed() && gunLoad <= 0
  function setParams(next) {
    const prev = p
    p = { ...next }
    if (prev.ammo !== p.ammo || prev.missiles !== p.missiles) rearm()
    if (prev.seed !== p.seed) { worldDirty = 0.2; reseat = true }
    if (prev.land !== p.land) worldDirty = 0.2
    if (
      prev.timeOfDay !== p.timeOfDay || prev.bodyColor !== p.bodyColor ||
      prev.accentColor !== p.accentColor || prev.canopyColor !== p.canopyColor
    ) rebuildPalettes()
    if (prev.intro !== p.intro && p.intro) { introT = 0; burn = 0 }
    if (prev.view !== p.view) viewTarget = viewIndex(p.view)
    syncWingmen()
  }

  function resize(w, h) {
    W = Math.max(8, w | 0)
    H = Math.max(8, h | 0)
    const buf = new ArrayBuffer(W * H * 4)
    fb = new Uint32Array(buf)
    bytes = new Uint8ClampedArray(buf)
    jetMask = new Uint8Array(W * H)
    colY = new Int32Array(W)
    zbuf = new Float32Array(W * H)
    // the square sheet reaches every corner of the frame however far the view is rolled
    pivotY = Math.round(H * 0.34)
    cockpit = null
    cockpitDue = 0.3
    sheetSide = (Math.ceil(Math.sqrt((W / 2) * (W / 2) + H * H)) + 2) * 2 // (it may be turned about any row)
    sheet = new Uint32Array(sheetSide * sheetSide)
    sheetMask = new Uint8Array(sheetSide * sheetSide)
    sheetColY = new Int32Array(sheetSide)
    sheetZ = new Float32Array(sheetSide * sheetSide)
    backdrop = new Uint32Array(W * H)
    sheetBackdrop = new Uint32Array(sheetSide * sheetSide)
    updateView()
  }

  function pointerMove(x, y) {
    keyMode = false
    pointerOn = true
    pointerX = x
    pointerY = y
    pointerIdle = 0
  }
  function pointerLeave() {
    pointerOn = false
    holding = false
    firing = false
  }
  function press() {
    holding = true
    holdT = 0
  }
  function release() {
    if (holding && holdT < HOLD) startRoll() // a click rolls; a hold was the thrusters
    holding = false
  }
  /**
   * Arrow keys / WASD or a game controller's stick: turn −1..1, climb −1..1, whether the boost
   * key is down, and how far a controller's trigger is squeezed (0..1: it opens the thrusters
   * part of the way).
   */
  function setKeys(turn, climb, boostHeld, thrust = 0) {
    keyTurn = clamp(turn, -1, 1)
    keyClimb = clamp(climb, -1, 1)
    boostKey = boostHeld
    padThrust = clamp(thrust, 0, 1)
    if (keyTurn !== 0 || keyClimb !== 0) keyMode = true
  }
  function startRoll(mine = true) {
    const lead = jets[0]
    if (lead.stunt >= 0) return
    if (mine) did.rolls++
    const dir = lead.yawRate >= 0 ? 1 : -1
    camSpin = vK > 0.5 ? 1 : 0
    sound('roll')
    jets.forEach((j, i) => {
      j.stunt = 0
      j.stuntDir = dir
      j.stuntDelay = i * 0.16
    })
  }
  /**
   * A loop, flown for you: back over the top (1), or forward and under (-1). Forward takes it down
   * by the height of the loop before it comes up again: it needs that much air under it, and
   * flown without, it ends in the ground like any other loop. The wingmen follow one after another.
   */
  function startLoop(dir = 1, from = 0) {
    const lead = jets[0]
    if (lead.loop >= 0 || flipping || ej !== EJ_FLY || introT <= 1.9) return
    const way = dir < 0 ? -1 : 1
    // (begun with the nose already down or up, it is taken up from there, not from level)
    let lo = 0
    let hi = 0.5
    const want = Math.min(Math.PI, Math.max(0, from * way))
    for (let n = 0; n < 24; n++) {
      const mid = (lo + hi) / 2
      if (Math.PI * 2 * mid - Math.sin(Math.PI * 2 * mid) < want) lo = mid
      else hi = mid
    }
    jets.forEach((j, i) => {
      j.loop = i === 0 ? lo : 0
      j.loopDir = way
      j.loopDelay = i * 0.12
    })
  }
  /** on to the next view: overhead → behind the jet → cockpit → overhead */
  function toggleView() {
    viewTarget = (viewTarget + 1) % 3
    sound('swish')
  }
  function replayIntro() {
    introT = 0
    burn = 0
  }

  // ── crash and ejection: what happens

  /** where the seat is in the world, for a jet */
  function seatOf(j) {
    const ax = axes(j)
    const sc = jetSize()
    const b = SEAT_B * sc
    const h = (SEAT_H + 0.5) * sc
    seat.x = j.x + b * ax.fx + h * ax.ux
    seat.y = j.y + b * ax.fy + h * ax.uy
    seat.z = j.z + b * ax.fz + h * ax.uz
  }
  function addSmoke(x, y, z, size, pushX, pushY, strength, life, kind) {
    const o = smokeHead * SMOKE_F
    smoke[o] = x
    smoke[o + 1] = y
    smoke[o + 2] = z
    smoke[o + 3] = time
    smoke[o + 4] = size
    smoke[o + 5] = pushX
    smoke[o + 6] = pushY
    smoke[o + 7] = strength
    smoke[o + 8] = life
    smoke[o + 9] = kind
    smokeHead = (smokeHead + 1) % SMOKE_N
  }
  /** kind: 0 a piece of the jet, 1 a burning piece, 2 the canopy, 3 the seat */
  function addDebris(x, y, z, vx, vy, vz, kind) {
    const o = debrisHead * DEBRIS_F
    debris[o] = x
    debris[o + 1] = y
    debris[o + 2] = z
    debris[o + 3] = vx
    debris[o + 4] = vy
    debris[o + 5] = vz
    debris[o + 6] = time
    debris[o + 7] = kind
    debrisHead = (debrisHead + 1) % DEBRIS_N
  }
  function syncGhost() {
    // (the camera leaves him for the new jet little by little, so it never changes speed in a step)
    const nj = jets[0]
    const w = nj.away ? 0 : handed
    ghost.x = pilot.x + (nj.x - pilot.x) * w
    ghost.y = pilot.y + (nj.y - pilot.y) * w
    ghost.z = pilot.z + (nj.z - pilot.z) * w
    ghost.vx = pilot.vx + (nj.vx - pilot.vx) * w
    ghost.vy = pilot.vy + (nj.vy - pilot.vy) * w
    ghost.yaw = ejHead
    ghost.pitch = nj.pitch * w
  }

  // ── the cannon and the missiles
  /** true while the lead jet can fire: it is being flown, by a pilot who is in it */
  const armed = () => p.weapons && ej === EJ_FLY && introT > 1.9 && !jets[0].away
  /** a point on the lead jet, in the world: a across (right), b forward of its middle, h up, in jet pixels */
  const mount = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0 }
  function mountAt(a, b, h) {
    const j = jets[0]
    const ax = axes(j)
    const sc = jetSize()
    mount.x = j.x + (a * ax.rx + b * ax.fx + h * ax.ux) * sc
    mount.y = j.y + (a * ax.ry + b * ax.fy + h * ax.uy) * sc
    mount.z = j.z + (a * ax.rz + b * ax.fz + h * ax.uz) * sc
    mount.fx = ax.fx
    mount.fy = ax.fy
    mount.fz = ax.fz
    mount.rx = ax.rx
    mount.ry = ax.ry
    mount.rz = ax.rz
  }
  /**
   * A missile leaves its rail. An ordinary one (nth < 0) is let go and drops before its motor lights,
   * and goes after `target` if there is one. One of a counter-attack (nth 0, 1, 2 …) lights at once,
   * fans out from the others, and then comes round on its target however that turns.
   */
  function launchMissile(target, nth) {
    if (!armed()) return
    const m = missiles.find((o) => !o.on) || missiles.reduce((a, o) => (o.t > a.t ? o : a))
    const j = jets[0]
    const sure = nth >= 0
    const side = sure ? [-1, 1, 0][nth % 3] : missileSide
    if (!sure) missileSide = -missileSide
    mountAt(side * RAIL_A, -3, -2)
    m.on = true
    m.lit = false
    m.sure = sure
    m.t = 0
    m.puff = 0
    m.x = mount.x
    m.y = mount.y
    m.z = mount.z
    m.fx = mount.fx
    m.fy = mount.fy
    m.fz = mount.fz
    if (sure) {
      // (they leave fanned out: to either side and up, the third straight over the top)
      const ax = axes(j)
      const out = side * 0.6
      const up = side === 0 ? 0.75 : 0.4
      m.fx += ax.rx * out + ax.ux * up
      m.fy += ax.ry * out + ax.uy * up
      m.fz += ax.rz * out + ax.uz * up
      const l = Math.hypot(m.fx, m.fy, m.fz) || 1
      m.fx /= l
      m.fy /= l
      m.fz /= l
    }
    // it leaves with the jet's own speed and nothing more: it is only let go
    m.s = Math.hypot(j.vx, j.vy, riseNow)
    m.drop = sure ? 0 : -8
    m.target = target
    did.launched++
    if (!sure) sound('release')
  }
  /**
   * The missile button. In the moment after one of the enemy's has been thrown off it is a
   * counter-attack: three, one after another, at whoever fired it (or, if he is gone, whoever is
   * locked on to, or nearest). Otherwise one missile, at whoever is locked on to.
   */
  function fireMissile() {
    if (!armed()) return
    if (counterT > 0 && volley === 0) {
      let at = counterFoe >= 0 && counterFoe < foes.length && foes[counterFoe].state === 0 ? counterFoe : lockOn >= 0 && lockT >= LOCK_TIME ? lockOn : -1
      if (at < 0) {
        let near = 1e9
        for (let i = 0; i < foes.length; i++) {
          if (foes[i].state !== 0) continue
          const d = Math.hypot(foes[i].j.x - jets[0].x, foes[i].j.y - jets[0].y)
          if (d < near) { near = d; at = i }
        }
      }
      if (at >= 0) {
        counterT = 0
        counters++
        volley = VOLLEY
        volleyDue = 0
        volleyAt = at
        missileWait = 0.5
        return
      }
    }
    if (missileWait > 0) return
    missileWait = 0.38
    // (none left on the rails: nothing but a click until they are reloaded)
    if (missileLoad > 0) { sound('empty'); return }
    launchMissile(lockOn >= 0 && lockT >= LOCK_TIME ? lockOn : -1, -1)
    if (missilesMax() > 0 && --missilesLeft <= 0) {
      missilesLeft = 0
      missileLoad = reloadTime()
      if (missileLoad <= 0) missilesLeft = missilesMax()
    }
  }
  /** something goes off: a missile's warhead, or a jet that has been hit */
  function blastAt(x, y, z, size = 1, noise = 'blast') {
    const b = blasts[blastHead]
    blastHead = (blastHead + 1) % BLAST_N
    b.on = true
    b.t = 0
    b.x = x
    b.y = y
    b.z = z
    const at = (((y | 0) & NM) << NSHIFT) | ((x | 0) & NM)
    b.wet = matMap[at] < 4 && z - heightMap[at] < 6
    b.size = size
    shake = Math.max(shake, 0.3 * size)
    flash = Math.max(flash, 0.3 * size)
    for (let i = 0; i < 10; i++) {
      const a = (hash8(i * 59 + blastHead * 7) / 255) * Math.PI * 2
      const out = 20 + (hash8(i * 31 + 9) / 255) * 70
      addDebris(x, y, z + 2, Math.sin(a) * out, -Math.cos(a) * out, 30 + (hash8(i * 43 + 21) / 255) * 90, 4)
    }
    if (b.wet) {
      // on the water: spray thrown out all round, that hangs and drifts down
      const sc = jetSize()
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + hash8(i * 7 + blastHead) * 0.01
        const out = (26 + (hash8(i * 23 + 3) / 255) * 44) * size
        addSmoke(x, y, z + 1 + (hash8(i * 11) / 255) * 5 * size, (2 + (hash8(i * 5 + 1) / 255) * 2.5) * sc * size, Math.sin(a) * out, -Math.cos(a) * out, 0.7, 0.8 + (hash8(i * 3) / 255) * 0.8, 1)
      }
    }
    sound(noise)
  }

  // ── cutting through cloud
  /**
   * A jet in the cloud layer tears a channel through it: the cloud within `r` of it is cut away
   * (ragged at its edge, and thinned a little beyond), to close up again later. Clouds drift, and
   * the cut drifts with them. Answers whether there was cloud where the jet is.
   */
  function cutCloud(x, y, z, r) {
    if (!p.cloudCut || z < CLOUD_ALT - 3 || z > ZTOP + 3) return false
    const rankMax = Math.round(clamp(p.clouds, 0, 1) * 16)
    if (rankMax <= 0) return false
    const mx = (x - ((time * 7) % NC) + NC) | 0
    const my = (y - ((time * 3) % NC) + NC) | 0
    const here = cloudBase[((my & NCM) << NCSHIFT) | (mx & NCM)]
    const ri = Math.ceil(r) + 4
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const xx = (mx + dx) & NCM
        const yy = (my + dy) & NCM
        const oo = (yy << NCSHIFT) | xx
        const cv = cloudN[oo]
        if (cv === 0) continue
        const d = Math.sqrt(dx * dx + dy * dy) - (hash8(xx * 7 + yy * 13) / 255 - 0.5) * 3
        let next = cv
        if (d <= r) next = 0
        else if (d <= r + 3 && cv === cloudBase[oo] && (cv & 15) > 1) next = (cv & 0xf0) | Math.max(1, (cv & 15) - 2)
        if (next === cv) continue
        cloudN[oo] = next
        const full = ((cutHead + 1) & (CUT_N - 1)) === cutTail
        if (full) { cloudN[cutIdx[cutTail]] = cloudBase[cutIdx[cutTail]]; cutTail = (cutTail + 1) & (CUT_N - 1) }
        cutIdx[cutHead] = oo
        cutAt[cutHead] = time
        cutHead = (cutHead + 1) & (CUT_N - 1)
      }
    }
    return here !== 0 && here >> 4 < rankMax
  }
  function stepClouds(dt) {
    // the oldest cuts close up
    while (cutTail !== cutHead && time - cutAt[cutTail] > CUT_HEAL) {
      const oo = cutIdx[cutTail]
      // (a cell still inside a newer cut stays cut: that one will put it back)
      cloudN[oo] = cloudBase[oo]
      cutTail = (cutTail + 1) & (CUT_N - 1)
    }
    const sc = jetSize()
    const r = 8 * sc + 4
    const was = inCloud
    inCloud = false
    for (let n = 0; n < jets.length; n++) {
      const j = jets[n]
      if (j.away) continue
      const hit = cutCloud(j.x, j.y, j.z, r)
      if (n === 0) inCloud = hit
      if (!hit) continue
      // vapour torn off it: curling away from the wingtips and streaming behind
      vapourDue -= dt * 60
      while (vapourDue <= 0) {
        vapourDue += 1
        const k = smokeHead
        const side = k & 1 ? 1 : -1
        const sp = Math.hypot(j.vx, j.vy) || 1
        const fx = j.vx / sp
        const fy = j.vy / sp
        const out = (5 + (hash8(k * 13 + 3) / 255) * 7) * sc * side
        addSmoke(
          j.x - fy * out - fx * 4 * sc, j.y + fx * out - fy * 4 * sc, j.z + (hash8(k * 5) / 255 - 0.5) * 4 * sc,
          (1.8 + (hash8(k * 7 + 1) / 255) * 2.2) * sc, -fy * side * 26 - fx * sp * 0.35, fx * side * 26 - fy * sp * 0.35,
          0.55, 0.5 + (hash8(k * 11 + 9) / 255) * 0.6, 1,
        )
      }
    }
    for (const f of foes) if (f.state !== 2) cutCloud(f.j.x, f.j.y, f.j.z, r)
    if (wreck) cutCloud(wreck.x, wreck.y, wreck.z, r)
    if (inCloud && !was && ej === EJ_FLY && introT > 2.5) {
      // into it: the cloud bursts open round the jet in a ring of vapour
      sound('cloud')
      const j = jets[0]
      const sp = Math.hypot(j.vx, j.vy) || 1
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2
        const side = Math.cos(a) * 34
        const up = Math.sin(a) * 5 * sc
        addSmoke(j.x + (j.vx / sp) * 6 * sc, j.y + (j.vy / sp) * 6 * sc, j.z + up, (2.6 + (hash8(k * 7 + smokeHead) / 255) * 2) * sc, (-j.vy / sp) * side + j.vx * 0.25, (j.vx / sp) * side + j.vy * 0.25, 0.6, 0.7 + (hash8(k * 11) / 255) * 0.5, 1)
      }
    }
    // cloud over the cockpit's glass while the jet is in it
    mist += ((inCloud && ej === EJ_FLY ? 1 : 0) - mist) * (1 - Math.exp(-dt * (inCloud ? 9 : 4)))
    if (mist < 0.004) mist = 0
  }

  // ── the enemy
  /** puts an enemy jet in the sky: somewhere ahead of the player to begin with, further off and anywhere round after */
  function placeFoe(i, first) {
    const f = foes[i]
    const me = pilotAt()
    const n = i * 37 + ((time * 10) | 0) * 3
    const a = me.yaw + (hash8(n + 5) / 255 - 0.5) * (first ? 2 : 5.4)
    const d = (first ? 360 : 640) + (hash8(n + 11) / 255) * 260
    const j = f.j
    j.x = me.x + Math.sin(a) * d
    j.y = me.y - Math.cos(a) * d
    j.z = Math.max(groundAt(j.x, j.y) + 40, me.z + (hash8(n + 17) / 255 - 0.5) * 50)
    j.yaw = me.yaw + (hash8(n + 23) / 255 - 0.5) * 2.4
    if (drill) {
      // a training flight: the target comes in far ahead and off to one side (it is for the player to
      // turn to), flying his way; the attacker behind, after him
      const back = drill === 'attack'
      const b = me.yaw + (back ? Math.PI + (hash8(n + 5) / 255 - 0.5) * 0.4 : (hash8(n + 5) > 127 ? 0.58 : -0.58))
      const far = back ? 600 : 640
      j.x = me.x + Math.sin(b) * far
      j.y = me.y - Math.cos(b) * far
      j.z = Math.max(groundAt(j.x, j.y) + 40, me.z)
      j.yaw = me.yaw
      j.vx = Math.sin(j.yaw) * p.speed
      j.vy = -Math.cos(j.yaw) * p.speed
    }
    j.yawRate = 0
    j.roll = 0
    j.pitch = 0
    j.glass = true
    f.state = 0
    f.hp = FOE_HP
    f.t = 0
    f.vz = 0
  }
  function syncFoes() {
    const want = drill === 'calm' ? 0 : drill ? 1 : clamp(Math.round(p.enemies), 0, FOE_MAX)
    while (foes.length < want) {
      const j = makeJet(0, 0, 0, 0)
      j.foe = true
      foes.push({ j, state: 0, hp: FOE_HP, t: 0, wob: foes.length * 2.4 + 0.7, vz: 0, atk: false, atkT: 7 + foes.length * 4, burst: 0, due: 0, cool: 1 })
      placeFoe(foes.length - 1, true)
    }
    if (foes.length > want) foes.length = want
    if (lockOn >= foes.length) { lockOn = -1; lockT = 0 }
    for (const m of missiles) if (m.target >= foes.length) m.target = -1
  }
  const lead0 = () => jets[0]
  /** the enemy's missiles in the air: after the player, until one is thrown off or arrives */
  function stepInbound(dt) {
    const sc = jetSize()
    const lead = jets[0]
    threatT = 99
    for (const m of inbound) {
      if (!m.on) continue
      m.t += dt
      const mine = Math.hypot(lead.vx, lead.vy, riseNow)
      // (it is always gaining on him, thrusters or no; but not so fast that it cannot be seen coming)
      m.s = Math.min(Math.max(p.speed * 1.2, mine) + 170, m.s + 260 * dt)
      const gx = lead.x - m.x
      const gy = lead.y - m.y
      const gz = lead.z - m.z
      const far = Math.hypot(gx, gy, gz) || 1
      if (!m.lost && ej !== EJ_FLY) m.lost = true
      if (!m.lost) {
        const cosA = clamp((m.fx * gx + m.fy * gy + m.fz * gz) / far, -1, 1)
        const off = Math.acos(cosA)
        const k = off < 1e-4 ? 1 : Math.min(1, (2.8 * dt) / off)
        m.fx += (gx / far - m.fx) * k
        m.fy += (gy / far - m.fy) * k
        m.fz += (gz / far - m.fz) * k
        const fl = Math.hypot(m.fx, m.fy, m.fz) || 1
        m.fx /= fl
        m.fy /= fl
        m.fz /= fl
        // how long until it is here, at the rate it is closing
        const closing = Math.max(50, m.s - (lead.vx * gx + lead.vy * gy + riseNow * gz) / far)
        const tti = far / closing
        if (tti < threatT) {
          threatT = tti
          threatFrom = wrapAngle(Math.atan2(-gx, gy) - lead.yaw)
        }
        if (far < 7 * sc + closing * dt) {
          // it is here. A roll begun in the last half second throws it off (so does a loop just begun):
          // it goes by, blind, and blows up behind. Otherwise it tells.
          const rolling = lead.stunt >= 0 && lead.stunt <= PARRY
          const looping = (lead.loop >= 0 && lead.loop < 0.3) || (flipping && Math.abs(climbCmd) < 1.9)
          if (rolling || looping) {
            m.lost = true
            m.lostT = 0
            evades++
            sound('evade')
            // it goes by alongside, a wing's breadth off, on whichever side it was nearer …
            const pl = Math.hypot(m.fx, m.fy) || 1
            const px = -m.fy / pl
            const py = m.fx / pl
            const sideOf = (m.x - lead.x) * px + (m.y - lead.y) * py >= 0 ? 1 : -1
            m.x = lead.x - m.fx * 17 * sc + px * sideOf * 12 * sc
            m.y = lead.y - m.fy * 17 * sc + py * sideOf * 12 * sc
            m.z = lead.z + 2.5 * sc
            m.fz *= 0.3
            // … and for a moment time all but stops, to watch it go; a missile fired now is a counter-attack
            const len = clamp(p.slowMo, 0, 3)
            if (len > 0.05) {
              slowT = len
              sound('slowmo')
            }
            counterT = len + COUNTER_OPEN
            counterFoe = m.from
          } else {
            m.on = false
            blastAt(lead.x, lead.y, lead.z, 1.1)
            did.struck++
            // (in training its warhead is a dummy: a bang and a jolt, and no more)
            if (drill) sound('hit')
            else hitPlayer(FOE_MISSILE_HIT)
            continue
          }
        }
      } else {
        m.lostT += dt
        if (m.lostT > 0.7) {
          m.on = false
          blastAt(m.x, m.y, m.z, 0.9)
          continue
        }
      }
      m.puff -= dt
      if (m.puff <= 0) {
        m.puff = 0.018
        addSmoke(m.x - m.fx * 3 * sc, m.y - m.fy * 3 * sc, m.z - m.fz * 3 * sc, (1.1 + (hash8(smokeHead * 7) / 255) * 0.8) * sc, 0, 0, 0.6, 1 + (hash8(smokeHead * 5) / 255) * 0.5, 1)
      }
      m.x += m.fx * m.s * dt
      m.y += m.fy * m.s * dt
      m.z += m.fz * m.s * dt
      const ground = groundAt(m.x, m.y)
      if (m.z <= ground + 1 || m.t > 9) {
        m.on = false
        blastAt(m.x, m.y, Math.max(m.z, ground + 1))
      }
    }
  }
  /** one of the enemy's rounds strikes the player's jet: enough of them and it is lost */
  function hitPlayer(damage = 1) {
    if (ej !== EJ_FLY || truce > 0 || (damage === 1 && hullT < 0.14)) return // (two rounds of one burst do not land at once)
    const lead = jets[0]
    hull -= damage
    hullT = 0
    shake = Math.max(shake, 0.4)
    flash = Math.max(flash, 0.12)
    sound('hit')
    for (let k = 0; k < 4; k++) addDebris(lead.x, lead.y, lead.z, lead.vx * 0.6 + (hash8(k * 31 + smokeHead) - 128) * 0.4, lead.vy * 0.6 + (hash8(k * 17 + 3) - 128) * 0.4, 18 + hash8(k * 7 + 1) * 0.2, 4)
    if (hull <= 0) lostJet()
  }
  /** the player's jet is lost: it goes off, the pilot is thrown clear, and the tally starts again */
  function lostJet() {
    const lead = jets[0]
    blastAt(lead.x, lead.y, lead.z, 1.4, 'kill')
    kills = 0
    hull = HULL
    slowT = 0
    counterT = 0
    volley = 0
    startEject()
    burning = true
  }
  /** an enemy is hit: by a cannon round (1), or by a missile, which is the end of it */
  function hitFoe(i, damage, credit = true) {
    const f = foes[i]
    if (f.state !== 0) return
    const j = f.j
    f.hp -= damage
    for (let k = 0; k < 3; k++) addDebris(j.x, j.y, j.z, j.vx * 0.5 + (hash8(k * 31 + i) - 128) * 0.5, j.vy * 0.5 + (hash8(k * 17 + 3) - 128) * 0.5, 20 + hash8(k * 7 + 1) * 0.2, 4)
    if (f.hp > 0) return
    // shot down: it goes off, and what is left of it falls burning out of the sky
    f.state = 1
    f.t = 0
    f.vz = 12
    j.glass = false
    if (credit) { kills++; did.downed++ }
    blastAt(j.x, j.y, j.z, 1.3, 'kill')
    for (let k = 0; k < 6; k++) addDebris(j.x, j.y, j.z, j.vx * 0.4 + (hash8(k * 53 + 9) - 128) * 0.6, j.vy * 0.4 + (hash8(k * 29 + 5) - 128) * 0.6, 30 + hash8(k * 13) * 0.3, k & 1)
    if (lockOn === i) { lockOn = -1; lockT = 0 }
    for (const m of missiles) if (m.target === i) m.target = -1
  }
  /** how squarely an enemy is in the lead jet's sights (1 dead ahead … −1 behind), or −2 if it cannot be locked on to at all */
  function inSights(i, range) {
    const f = foes[i]
    if (f.state !== 0) return -2
    const lead = jets[0]
    const dx = f.j.x - lead.x
    const dy = f.j.y - lead.y
    const dz = (f.j.z - lead.z) * 0.6 // (height counts for less: from overhead there is no judging it)
    const d = Math.hypot(dx, dy, dz)
    if (d > range || d < 1) return -2
    const fz = mount.fz * 0.6
    return (dx * mount.fx + dy * mount.fy + dz * fz) / (d * Math.hypot(mount.fx, mount.fy, fz))
  }
  function stepFoes(dt) {
    const sc = jetSize()
    const me = pilotAt()
    for (let i = 0; i < foes.length; i++) {
      const f = foes[i]
      const j = f.j
      if (f.state === 2) {
        f.t -= dt
        if (f.t <= 0) placeFoe(i, false)
        continue
      }
      if (f.state === 1) {
        // falling: nose down, turning over and over, pouring smoke, until it meets the ground
        f.vz -= 90 * dt
        j.vx *= Math.exp(-dt * 0.35)
        j.vy *= Math.exp(-dt * 0.35)
        j.x += j.vx * dt
        j.y += j.vy * dt
        j.z += f.vz * dt
        j.pitch += (-1.05 - j.pitch) * (1 - Math.exp(-dt * 1.5))
        j.roll += 3.4 * dt
        f.t -= dt
        if (f.t <= 0) {
          f.t = 0.028
          addSmoke(j.x, j.y, j.z, 2 * sc + 1, 0, 0, 0.8, 1.5, 2)
          if (smokeHead & 1) addDebris(j.x, j.y, j.z, j.vx * 0.3, j.vy * 0.3, f.vz + 14, 4)
        }
        const ground = groundAt(j.x, j.y)
        if (j.z <= ground + 1.5) {
          blastAt(j.x, j.y, ground + 1, 1.6, matMap[(((j.y | 0) & NM) << NSHIFT) | ((j.x | 0) & NM)] < 4 ? 'splash' : 'explosion')
          f.state = 2
          f.t = drill ? 1.2 : 3 + (hash8(i * 19 + ((time * 10) | 0)) / 255) * 2.5
        }
        continue
      }
      // flying: it wanders, comes back when it has strayed far from the player, keeps from sitting
      // on top of him, and jinks when it is locked on to or a missile is after it. Every so often
      // (two at a time at most) one turns on the player: it comes round behind him, closes, and
      // fires in bursts at where he will be. A turn or a roll throws its aim off.
      const lead = jets[0]
      const fight = (drill ? drill === 'attack' : p.foeFire && introT > 6) && p.weapons && ej === EJ_FLY && truce <= 0 && !lead.away
      const dx = me.x - j.x
      const dy = me.y - j.y
      const dist = Math.hypot(dx, dy)
      // (one that is after the player does not give up while it is still on its way to him)
      if (!f.atk || dist < 460) f.atkT -= dt
      if (!fight) f.atk = false
      else if (drill) f.atk = true
      else if (f.atkT <= 0) {
        const others = foes.filter((o) => o !== f && o.atk && o.state === 0).length
        f.atk = !f.atk && others < 2
        f.atkT = (f.atk ? 11 : 4) + (hash8(i * 31 + ((time * 10) | 0)) / 255) * 5
      }
      const toMe = wrapAngle(Math.atan2(dx, -dy) - j.yaw)
      let want = 0.5 * Math.sin(time * 0.23 + f.wob) + 0.3 * Math.sin(time * 0.61 + f.wob * 2.1)
      let sp = p.speed * 0.82
      let aimed = false
      let offAim = 9
      // where the player will be by the time a round fired now gets there
      const tgo = dist / FOE_SHOT
      const ax = lead.x + lead.vx * tgo - j.x
      const ay = lead.y + lead.vy * tgo - j.y
      const az = lead.z + riseNow * tgo - j.z
      if (f.atk) {
        const toAim = wrapAngle(Math.atan2(ax, -ay) - j.yaw)
        offAim = Math.abs(toAim)
        if (dist < 80) want = toMe > 0 ? -1.1 : 1.1 // (too close: it breaks off, and comes round again)
        else want = clamp(toAim * 1.8, -1.1, 1.1)
        // (it hurries to catch up, then settles in behind at a little over the player's own speed)
        const mine = Math.hypot(lead.vx, lead.vy)
        sp = dist > 480 ? Math.max(p.speed * 1.5, mine * 1.9) : dist > 170 ? Math.max(p.speed, mine * 1.12) : mine * 0.92
        // (in training it hangs back at missile range, and keeps its guns to itself)
        if (drill) sp = dist > 480 ? Math.max(p.speed * 1.5, mine * 1.9) : dist > 380 ? mine * 1.05 : mine * 0.8
        aimed = !drill && dist < FOE_REACH && dist > 110 && Math.abs(toAim) < 0.14 && Math.abs(az) < 20 + dist * 0.3
      } else if (drill === 'target') {
        // a target to practise on. In front of the player it flies steadily on at his speed, coming
        // round to his heading only gently: it is for him to line up on. Lost (he has turned away
        // from it, or passed it, or left it behind) it comes round to in front of him again.
        const fx = Math.sin(me.yaw)
        const fy = -Math.cos(me.yaw)
        const ahead = -(dx * fx + dy * fy)
        const off = dx * fy - dy * fx // how far to his right it is
        const side = Math.abs(off)
        const mine = Math.max(p.speed * 0.7, Math.hypot(lead.vx, lead.vy))
        if (ahead > 130 && ahead < 640 && side < ahead * 1.1) {
          // (… and drifts in towards the line of his nose)
          want = clamp(wrapAngle(me.yaw - clamp(off / 420, -0.35, 0.35) - j.yaw) * 0.7, -0.45, 0.45) + 0.12 * Math.sin(time * 0.5 + f.wob)
          sp = mine * clamp(1 + (300 - ahead) / 420, 0.75, 1.25)
        } else {
          const lookTo = Math.max(ahead, 300) + 240
          want = clamp(wrapAngle(Math.atan2(me.x + fx * lookTo - j.x, -(me.y + fy * lookTo - j.y)) - j.yaw) * 1.8, -1.3, 1.3)
          sp = mine * (ahead > 640 ? 0.6 : ahead < 200 ? 2.2 : 1.4)
        }
      } else if (dist > 700) {
        // (strayed: it comes back, and quickly if the player is leaving it behind)
        want = clamp(toMe * 1.3, -0.9, 0.9)
        sp = Math.max(sp, Math.hypot(lead.vx, lead.vy) * 1.5)
      } else if (dist < 130 && Math.abs(toMe) < 2.4) want = toMe > 0 ? -0.9 : 0.9
      const hunted = (lockOn === i && lockT >= LOCK_TIME) || missiles.some((m) => m.on && m.target === i)
      if (hunted && drill !== 'target') want += 0.75 * Math.sign(Math.sin(time * 1.9 + f.wob))
      j.yawRate += (want - j.yawRate) * (1 - Math.exp(-dt * 2.2))
      j.yaw += j.yawRate * dt
      j.roll += (clamp(j.yawRate / 0.9, -1.2, 1.2) * 0.9 - j.roll) * (1 - Math.exp(-dt * 4))
      const now = Math.hypot(j.vx, j.vy) || sp
      const v = now + (sp - now) * (1 - Math.exp(-dt * 1.2))
      j.vx = Math.sin(j.yaw) * v
      j.vy = -Math.cos(j.yaw) * v
      j.x += j.vx * dt
      j.y += j.vy * dt
      // it flies at about the player's height (at just his, when it is after him), over whatever ground is ahead of it
      const level = f.atk || drill ? lead.z : me.z + 26 * Math.sin(time * 0.31 + f.wob)
      const goal = Math.max(groundAt(j.x + j.vx * 0.8, j.y + j.vy * 0.8) + 30, groundAt(j.x, j.y) + 22, level)
      const dz = clamp((goal - j.z) * (1 - Math.exp(-dt * 1.2)), -(f.atk ? 70 : 34) * dt, (f.atk ? 80 : 46) * dt)
      j.z += dz
      j.pitch += (clamp(dz / Math.max(dt, 1e-4) / v, -0.5, 0.5) - j.pitch) * (1 - Math.exp(-dt * 3))
      // now and then, from further back, a missile: it comes after the player, who can throw it
      // off only by rolling just as it arrives
      if (f.atk && fight && foeMissileWait <= 0 && dist > 250 && dist < 640 && offAim < 0.3 && !inbound.some((m) => m.on)) {
        const m = inbound[0]
        const fwd = Math.hypot(j.vx, j.vy) || 1
        m.on = true
        m.from = i
        m.lost = false
        m.t = 0
        m.lostT = 0
        m.puff = 0
        m.x = j.x + (j.vx / fwd) * 8 * sc
        m.y = j.y + (j.vy / fwd) * 8 * sc
        m.z = j.z - 3 * sc
        m.fx = j.vx / fwd
        m.fy = j.vy / fwd
        m.fz = 0
        m.s = fwd
        foeMissileWait = drill ? 5 : 11 + (hash8(i * 23 + ((time * 10) | 0)) / 255) * 8
        sound('foeMissile')
      }
      // its gun: a burst when the player is in its sights, then a pause
      f.cool -= dt
      if (aimed && f.cool <= 0 && f.burst <= 0) { f.burst = 0.6; f.due = 0 }
      if (f.burst > 0) {
        f.burst -= dt
        if (f.burst <= 0) f.cool = 0.9 + (hash8(i * 17 + ((time * 10) | 0)) / 255) * 0.9
        f.due -= dt
        const al = Math.hypot(ax, ay, az) || 1
        while (f.due <= 0) {
          f.due += 1 / 9
          const o = shotHead * SHOT_F
          const n = shotHead * 11 + ((time * 60) | 0)
          const fwd = Math.hypot(j.vx, j.vy) || 1
          shots[o] = j.x + (j.vx / fwd) * 14 * sc
          shots[o + 1] = j.y + (j.vy / fwd) * 14 * sc
          shots[o + 2] = j.z
          // (it does not shoot quite straight)
          shots[o + 3] = (ax / al) * FOE_SHOT + (hash8(n * 13) - 128) * 0.16
          shots[o + 4] = (ay / al) * FOE_SHOT + (hash8(n * 29) - 128) * 0.16
          shots[o + 5] = (az / al) * FOE_SHOT + (hash8(n * 43) - 128) * 0.11
          shots[o + 6] = time
          shots[o + 7] = 1
          shotHead = (shotHead + 1) % SHOT_N
          foeGun = Math.max(foeGun, 1 / (1 + (dist / 300) ** 2))
        }
      }
    }
    foeGun *= Math.exp(-dt * 9)
    // two jets in the same air at once: that is the end of both
    {
      const wide = 12 * sc
      const tall = 6.5 * sc
      const lead = jets[0]
      for (let a = 0; a < foes.length; a++) {
        const fa = foes[a]
        if (fa.state !== 0) continue
        for (let b = a + 1; b < foes.length; b++) {
          const fb2 = foes[b]
          if (fb2.state !== 0 || Math.abs(fa.j.z - fb2.j.z) > tall || Math.hypot(fa.j.x - fb2.j.x, fa.j.y - fb2.j.y) > wide) continue
          hitFoe(a, 99, false)
          hitFoe(b, 99, false)
          break
        }
        if (fa.state !== 0) continue
        // the player's too (but not in the moment he is given after getting a new one)
        if (ej === EJ_FLY && truce <= 0 && introT > 3 && !lead.away && Math.abs(fa.j.z - lead.z) < tall && Math.hypot(fa.j.x - lead.x, fa.j.y - lead.y) < wide) {
          hitFoe(a, 99, false)
          lostJet()
          break
        }
      }
    }
    if (foeMissileWait > 0 && ej === EJ_FLY && truce <= 0) foeMissileWait -= dt
    stepInbound(dt)
    // the enemy holds its fire while the pilot has no jet, and for a little after he has one again
    if (ej !== EJ_FLY) truce = 5
    else if (truce > 0) truce -= dt
    // the player's jet: left alone for a while it is patched up; badly hit, it trails smoke
    hullT += dt
    if (hullT > 6 && hull < HULL) hull = Math.min(HULL, hull + dt / 3)
    if (ej === EJ_FLY && hull <= HULL / 2) {
      hurtDue -= dt
      if (hurtDue <= 0) {
        hurtDue = hull <= 1.5 ? 0.03 : 0.07
        addSmoke(lead0().x, lead0().y, lead0().z, 1.4 * sc + 0.6, 0, 0, hull <= 1.5 ? 0.7 : 0.45, 1.1, 2)
      }
    }
    // the sights: the enemy nearest dead ahead is locked on to once it has been held there a moment,
    // and stays locked for as long as it is kept roughly in front
    if (!armed()) { lockOn = -1; lockT = 0 } else {
      mountAt(0, 0, 0)
      if (lockOn >= 0 && lockT >= LOCK_TIME) {
        if (inSights(lockOn, LOCK_RANGE * 1.25) < Math.cos(0.9)) { lockOn = -1; lockT = 0 }
      } else {
        let best = -1
        let bestC = Math.cos(0.4)
        for (let i = 0; i < foes.length; i++) {
          const c = inSights(i, LOCK_RANGE)
          if (c > bestC) { bestC = c; best = i }
        }
        if (best !== lockOn) { lockOn = best; lockT = 0 } else if (best >= 0) lockT += dt
      }
    }
  }
  function stepWeapons(dt) {
    const sc = jetSize()
    if (missileWait > 0) missileWait -= dt
    if (muzzleL > 0) muzzleL = Math.max(0, muzzleL - dt * 14)
    if (muzzleR > 0) muzzleR = Math.max(0, muzzleR - dt * 14)
    // reloading: the seconds go by, and then it is full again
    if (gunLoad > 0) {
      gunLoad -= dt
      if (gunLoad <= 0) { gunLoad = 0; roundsLeft = roundsMax(); sound('reload') }
    }
    if (missileLoad > 0) {
      missileLoad -= dt
      if (missileLoad <= 0) { missileLoad = 0; missilesLeft = missilesMax(); sound('reload') }
    }
    // the cannon: rounds at a steady rate for as long as the trigger is held and there are any left
    if (shooting()) {
      const j = jets[0]
      gunDue -= dt
      while (gunDue <= 0 && gunLoad <= 0) {
        gunDue += 1 / SHOT_RATE
        // a gun under each wing, firing in turn
        mountAt(gunSide * GUN_A, GUN_B, GUN_H)
        const o = shotHead * SHOT_F
        const n = shotHead * 7 + ((time * 60) | 0)
        // (they go where the nose points, with the jet's own speed behind them, toed in a little so
        // that the two streams meet far ahead, and scatter a hair)
        const toe = (-gunSide * GUN_A * sc * SHOT_SPEED) / GUN_MEET
        shots[o] = mount.x
        shots[o + 1] = mount.y
        shots[o + 2] = mount.z
        shots[o + 3] = mount.fx * SHOT_SPEED + mount.rx * toe + j.vx + (hash8(n * 13) - 128) * 0.05
        shots[o + 4] = mount.fy * SHOT_SPEED + mount.ry * toe + j.vy + (hash8(n * 29) - 128) * 0.05
        shots[o + 5] = mount.fz * SHOT_SPEED + mount.rz * toe + riseNow + (hash8(n * 43) - 128) * 0.05
        shots[o + 6] = time
        shots[o + 7] = 0
        shotHead = (shotHead + 1) % SHOT_N
        did.rounds++
        // (the last round gone: it runs dry, and is a while reloading)
        if (roundsMax() > 0 && --roundsLeft <= 0) {
          roundsLeft = 0
          gunLoad = reloadTime()
          if (gunLoad <= 0) roundsLeft = roundsMax()
          else sound('empty')
        }
        // … and its spent case is thrown out of the gun: out to the side and down, left behind by the jet
        const c = caseHead * CASE_F
        const out = gunSide * (22 + (hash8(n * 17) / 255) * 30)
        cases[c] = mount.x - mount.fx * 2 * sc
        cases[c + 1] = mount.y - mount.fy * 2 * sc
        cases[c + 2] = mount.z - 0.5 * sc
        cases[c + 3] = j.vx * 0.86 + mount.rx * out
        cases[c + 4] = j.vy * 0.86 + mount.ry * out
        cases[c + 5] = riseNow * 0.8 + 10 - (hash8(n * 31) / 255) * 26 // (flicked out, some of them upwards, before they fall)
        cases[c + 6] = time
        caseHead = (caseHead + 1) % CASE_N
        if (gunSide > 0) muzzleR = 1
        else muzzleL = 1
        gunSide = -gunSide
      }
    } else gunDue = 0
    for (let i = 0; i < SHOT_N; i++) {
      const o = i * SHOT_F
      const age = time - shots[o + 6]
      if (age < 0 || age > SHOT_LIFE) continue
      shots[o] += shots[o + 3] * dt
      shots[o + 1] += shots[o + 4] * dt
      shots[o + 2] += shots[o + 5] * dt
      // the enemy's: the player's jet in its way is hit, unless it is rolling, which throws them off
      if (shots[o + 7] === 1) {
        const lead = jets[0]
        const reach = 7 * sc + 2
        if (ej === EJ_FLY && !lead.away && Math.abs(shots[o] - lead.x) < reach && Math.abs(shots[o + 1] - lead.y) < reach && Math.abs(shots[o + 2] - lead.z) < reach * 0.8) {
          if (lead.stunt < 0) {
            shots[o + 6] = -1e9
            hitPlayer()
            continue
          }
        }
      }
      // the player's: an enemy in its way is hit
      let struck = false
      for (let n = 0; n < foes.length && !struck && shots[o + 7] === 0; n++) {
        const f = foes[n]
        if (f.state !== 0) continue
        const reach = 9 * sc + 2
        if (Math.abs(shots[o] - f.j.x) < reach && Math.abs(shots[o + 1] - f.j.y) < reach && Math.abs(shots[o + 2] - f.j.z) < reach * 0.8) {
          hitFoe(n, 1)
          struck = true
        }
      }
      if (struck) { shots[o + 6] = -1e9; continue }
      const at = (((shots[o + 1] | 0) & NM) << NSHIFT) | ((shots[o] | 0) & NM)
      if (shots[o + 2] <= heightMap[at]) {
        // it strikes: a spurt of water, or of dust
        addSmoke(shots[o], shots[o + 1], heightMap[at] + 1, (1.2 + (hash8(i * 7) / 255)) * sc, 0, 0, matMap[at] < 4 ? 0.7 : 0.5, 0.45, matMap[at] < 4 ? 1 : 0)
        shots[o + 6] = -1e9
      }
    }
    for (let i = 0; i < CASE_N; i++) {
      const o = i * CASE_F
      const age = time - cases[o + 6]
      if (age < 0 || age > CASE_LIFE) continue
      // falling: the air slows it, and the ground or the sea ends it (with a little splash, on the sea)
      cases[o + 5] -= 120 * dt
      cases[o + 3] *= Math.exp(-dt * 0.9)
      cases[o + 4] *= Math.exp(-dt * 0.9)
      cases[o] += cases[o + 3] * dt
      cases[o + 1] += cases[o + 4] * dt
      cases[o + 2] += cases[o + 5] * dt
      const at = (((cases[o + 1] | 0) & NM) << NSHIFT) | ((cases[o] | 0) & NM)
      if (cases[o + 2] <= heightMap[at]) {
        if (matMap[at] < 4) addSmoke(cases[o], cases[o + 1], heightMap[at] + 1, 0.8 * sc + 0.4, 0, 0, 0.6, 0.35, 1)
        cases[o + 6] = -1e9
      }
    }
    for (const m of missiles) {
      if (!m.on) continue
      m.t += dt
      const burn = m.t - (m.sure ? 0.04 : MISSILE_DROP)
      if (burn < 0) m.drop -= 110 * dt // let go: it falls away from the wing, still flying with the jet
      else {
        if (!m.lit) {
          // its motor lights: a flash and a burst of smoke, and it begins to pull away
          m.lit = true
          sound('missile')
          for (let k = 0; k < 4; k++) addSmoke(m.x - m.fx * 3 * sc, m.y - m.fy * 3 * sc, m.z - m.fz * 3 * sc, (2 + k * 0.7) * sc, (hash8(k * 13 + smokeHead) - 128) * 0.1, (hash8(k * 29 + smokeHead) - 128) * 0.1, 0.7, 1 + k * 0.2, 1)
        }
        // the thrust builds over a moment, then it is gathering speed all the time the motor burns;
        // after that it coasts, and the air slows it a little
        // (one of a counter-attack is quicker off the rail, faster, and burns until it is there)
        const up = clamp(burn / (m.sure ? MISSILE_RAMP * 0.4 : MISSILE_RAMP), 0, 1)
        const top = p.speed + MISSILE_TOP + (m.sure ? 140 : 0)
        if (burn < MISSILE_BURN || m.sure) m.s = Math.min(top, m.s + MISSILE_PUSH * (m.sure ? 1.7 : 1) * up * up * (3 - 2 * up) * dt)
        else m.s *= Math.exp(-dt * 0.25)
        m.drop *= Math.exp(-dt * 4) // (and it stops dropping as it gets going)
        // one that has a target turns after it: at where it will be, by the time the missile is there
        const f = m.target >= 0 ? foes[m.target] : null
        if (f && f.state === 0) {
          const gx = f.j.x - m.x
          const gy = f.j.y - m.y
          const gz = f.j.z - m.z
          const far = Math.hypot(gx, gy, gz)
          const tgo = Math.min(1.2, far / Math.max(60, m.s))
          const ax = gx + f.j.vx * tgo
          const ay = gy + f.j.vy * tgo
          const al = Math.hypot(ax, ay, gz) || 1
          const cosA = clamp((m.fx * ax + m.fy * ay + m.fz * gz) / al, -1, 1)
          const off = Math.acos(cosA)
          // (a counter-attack's holds its fan for a moment, then comes round as hard as it has to)
          const turn = m.sure ? 1.2 + 11 * clamp((burn - 0.16) / 0.45, 0, 1) : MISSILE_TURN * up
          const k = off < 1e-4 ? 1 : Math.min(1, (turn * dt) / off)
          m.fx += (ax / al - m.fx) * k
          m.fy += (ay / al - m.fy) * k
          m.fz += (gz / al - m.fz) * k
          const fl = Math.hypot(m.fx, m.fy, m.fz) || 1
          m.fx /= fl
          m.fy /= fl
          m.fz /= fl
          if (far < 9 * sc + m.s * dt) {
            m.on = false
            // (the missiles of a counter-attack all tell, one after another: the last is the end of him)
            if (m.sure && missiles.some((o) => o !== m && o.on && o.sure && o.target === m.target)) {
              blastAt(f.j.x, f.j.y, f.j.z, 0.8)
              hitFoe(m.target, 0)
            } else hitFoe(m.target, 99)
            continue
          }
        } else if (m.target >= 0) m.target = -1
        m.puff -= dt
        if (m.puff <= 0 && (burn < MISSILE_BURN || m.sure)) {
          m.puff = 0.016
          addSmoke(m.x - m.fx * 3 * sc, m.y - m.fy * 3 * sc, m.z - m.fz * 3 * sc, (1.1 + (hash8(smokeHead * 7) / 255) * 0.8) * sc, 0, 0, 0.6, 1.1 + (hash8(smokeHead * 5) / 255) * 0.5, 1)
        }
      }
      m.x += m.fx * m.s * dt
      m.y += m.fy * m.s * dt
      m.z += (m.fz * m.s + m.drop) * dt
      const ground = groundAt(m.x, m.y)
      if (m.z <= ground + 1 || m.t > (m.target >= 0 ? (m.sure ? 8 : 5) : 3.4)) {
        m.on = false
        blastAt(m.x, m.y, Math.max(m.z, ground + 1))
      }
    }
    for (const b of blasts) {
      if (!b.on) continue
      b.t += dt
      // (smoke hangs where one went off over land)
      if (!b.wet && b.t < 0.9 && ((b.t * 30) | 0) % 3 === 0) addSmoke(b.x + (hash8(smokeHead * 13) - 128) * 0.04, b.y + (hash8(smokeHead * 29) - 128) * 0.04, b.z + 2, 2.4 * jetSize() + 1.5, 0, 0, 0.6, 1.6, 2)
      if (b.t > 1.5) b.on = false
    }
  }
  /** how hard a jet is tearing at the water under it: 0 unless it is low over the sea */
  function wakeOf(j) {
    if (j.away) return 0
    const at = (((j.y | 0) & NM) << NSHIFT) | ((j.x | 0) & NM)
    if (matMap[at] >= 4) return 0
    const low = (WAKE_REACH - (j.z - heightMap[at])) / (WAKE_REACH - 7)
    return clamp(low, 0, 1) * clamp(Math.hypot(j.vx, j.vy) / 50, 0, 1) * clamp(p.wake, 0, 2)
  }
  function stepWake(dt) {
    const sc = jetSize()
    let lead = 0
    let moved = 0
    for (let n = 0; n < jets.length; n++) {
      const j = jets[n]
      const s = wakeOf(j)
      if (n === 0) { lead = s; moved = Math.hypot(j.vx, j.vy) * dt }
      if (s < 0.03) continue
      const sp = Math.hypot(j.vx, j.vy) || 1
      const fx = j.vx / sp
      const fy = j.vy / sp
      // spray, thrown up and out behind it
      sprayDue -= dt * (40 + 70 * s)
      while (sprayDue <= 0) {
        sprayDue += 1
        const k = smokeHead
        const side = k & 1 ? 1 : -1
        const out = (20 + (hash8(k * 13 + 3) / 255) * 90) * side
        const back = (4 + (hash8(k * 29 + 7) / 255) * 12) * sc
        addSmoke(
          j.x - fx * back - fy * out * 0.03, j.y - fy * back + fx * out * 0.03, heightMap[((((j.y - fy * back) | 0) & NM) << NSHIFT) | (((j.x - fx * back) | 0) & NM)] + 1 + (hash8(k * 3 + 11) / 255) * 3 * sc,
          (1.4 + (hash8(k * 7 + 1) / 255) * 2) * sc * (0.7 + 0.5 * s), -fy * out - fx * sp * 0.25, fx * out - fy * sp * 0.25,
          0.62 * s, 0.5 + (hash8(k * 5 + 9) / 255) * 0.6, 1,
        )
      }
    }
    // the lead jet's foam: a mark every few px it flies (the others only throw spray)
    if (lead >= 0.03) {
      wakeDue -= moved
      if (wakeDue <= 0) {
        wakeDue = 2.4
        const j = jets[0]
        const sp = Math.hypot(j.vx, j.vy) || 1
        const o = wakeHead * WAKE_F
        wake[o] = j.x - (j.vx / sp) * 6 * sc
        wake[o + 1] = j.y - (j.vy / sp) * 6 * sc
        wake[o + 2] = time
        wake[o + 3] = lead
        wake[o + 4] = -j.vy / sp
        wake[o + 5] = j.vx / sp
        wakeHead = (wakeHead + 1) % WAKE_N
      }
    }
    spray += (lead - spray) * (1 - Math.exp(-dt * 6))
    if (spray < 0.002) spray = 0
  }
  /** the pilot leaves the jet */
  function startEject() {
    const old = jets[0]
    rearm() // (the jet that comes for the pilot is a new one, fully armed)
    ej = EJ_ROCKET
    ejT = 0
    ejAt = 0
    ejHead = old.yaw
    sound('eject')
    seatOf(old)
    pilot.x = seat.x
    pilot.y = seat.y
    pilot.z = seat.z
    pilot.vx = old.vx * 0.5
    pilot.vy = old.vy * 0.5
    pilot.vz = 118
    pilot.swing = 0
    pilot.swingV = 0
    chute.on = false
    chute.free = false
    // the canopy goes first, tumbling away behind
    addDebris(seat.x, seat.y, seat.z + 2, old.vx * 0.3, old.vy * 0.3, 76, 2)
    old.glass = false
    old.lid = 0
    wreck = old
    wreckVz = Math.min(climbV, -34)
    burning = false
    // a new jet is already on its way; it takes its place in the scene once the parachute is open
    const fresh = makeJet(old.x + N * 2, old.y, old.z, old.yaw)
    fresh.away = true
    fresh.lid = 1
    jets[0] = fresh
    boost = 0
    kick = 0
    handed = 0
    flipping = false
    climbCmd = 0
    climbNow = 0
    diveHold = 0
    syncGhost()
  }
  function openChute() {
    ej = EJ_CHUTE
    ejAt = ejT
    chute.on = true
    chute.free = false
    chute.open = 0
    chute.t = 0
    pilot.swingV = 2.6
    meetT = ejT + MEET
    sound('chute')
    // the seat falls away
    addDebris(pilot.x, pilot.y, pilot.z - 2, pilot.vx * 0.8, pilot.vy * 0.8, pilot.vz - 24, 3)
  }
  /** how far above the pilot the hem of his open parachute is, px in the world */
  const hemAbove = () => ((PILOT_RISER[2] - PILOT_PIVOT[2]) * PILOT_SIZE + LINES * CHUTE) * jetSize()
  function cutChute() {
    ej = EJ_DROP
    ejAt = ejT
    seatOf(jets[0])
    dropZ = pilot.z - seat.z
    chute.free = true
    chute.t = 0
    chute.x = pilot.x
    chute.y = pilot.y
    chute.z = pilot.z + hemAbove()
    chute.vx = pilot.vx
    chute.vy = pilot.vy
    chute.vz = 4
  }
  /** how fast the new jet is flying as he lands in it, px per second: it never stops for him */
  const catchSpeed = () => Math.max(DRIFT + 12, p.speed * 0.5)
  /**
   * How far behind him the new jet's seat is, tau seconds before he lands in it. It comes in
   * fast and eases off the throttle all the way, so that it is at its slowest (and neither
   * slowing nor gathering speed) as it passes under him.
   */
  function gapBehind(tau) {
    const ease = (Math.max(p.speed * 1.15, catchSpeed() + 20) - catchSpeed()) / (MEET * MEET)
    return (catchSpeed() - DRIFT) * tau + (ease * tau * tau * tau) / 3
  }
  /** the jet he left meets the ground */
  function explode(x, y, ground, vx, vy) {
    boom.on = true
    boom.wet = matMap[((((y | 0) & NM) << NSHIFT) | ((x | 0) & NM))] < 4
    sound(boom.wet ? 'splash' : 'explosion')
    boom.t = 0
    boom.x = x
    boom.y = y
    boom.z = ground
    boom.puff = 0
    shake = 1
    flash = 1
    wreck = null
    for (let i = 0; i < 14; i++) {
      const a = (hash8(i * 37 + 11) / 255) * Math.PI * 2
      const out = 16 + (hash8(i * 53 + 5) / 255) * 60
      addDebris(x, y, ground + 2, Math.sin(a) * out + vx * 0.3, -Math.cos(a) * out + vy * 0.3, 46 + (hash8(i * 71 + 3) / 255) * 110, i % 3 === 0 ? 1 : 0)
    }
    // and a shower of sparks, thrown higher and farther, that burn out in the air
    const sparks = Math.round(30 * clamp(p.flash, 0, 1))
    for (let i = 0; i < sparks; i++) {
      const a = (hash8(i * 59 + 17) / 255) * Math.PI * 2
      const out = 20 + (hash8(i * 31 + 9) / 255) * 110
      addDebris(x, y, ground + 3, Math.sin(a) * out + vx * 0.4, -Math.cos(a) * out + vy * 0.4, 70 + (hash8(i * 43 + 21) / 255) * 150, 4)
    }
  }

  /** everything left in the air by a crash, whatever the pilot is doing */
  function stepWreckage(dt) {
    if (shake > 0) {
      shake *= Math.exp(-dt * 4.5)
      if (shake < 0.02) shake = 0
    }
    if (flash > 0) {
      flash *= Math.exp(-dt * 9)
      if (flash < 0.01) flash = 0
    }
    if (wreck) {
      // pilotless, it noses over and keeps going
      wreckVz -= 70 * dt
      wreck.x += wreck.vx * dt
      wreck.y += wreck.vy * dt
      wreck.z += wreckVz * dt
      wreck.pitch += (-0.95 - wreck.pitch) * (1 - Math.exp(-dt * 2.6))
      wreck.roll += (burning ? 3 : 1.3) * dt
      if (burning && ((time * 40) | 0) % 2 === 0) {
        addSmoke(wreck.x, wreck.y, wreck.z, 2 * jetSize() + 1, 0, 0, 0.8, 1.4, 2)
        if (smokeHead % 3 === 0) addDebris(wreck.x, wreck.y, wreck.z, wreck.vx * 0.3, wreck.vy * 0.3, wreckVz + 16, 4)
      }
      const ground = groundAt(wreck.x, wreck.y)
      if (wreck.z <= ground + 1.5) explode(wreck.x, wreck.y, ground, wreck.vx, wreck.vy)
    }
    if (boom.on) {
      boom.t += dt
      // black smoke pours from the wreck for a while (steam, where it went into the sea)
      boom.puff -= dt
      if (boom.t < 5 && boom.puff <= 0) {
        boom.puff = 0.045 + boom.t * 0.022
        const n = smokeHead
        addSmoke(
          boom.x + (hash8(n * 13 + 1) - 128) * 0.05, boom.y + (hash8(n * 29 + 7) - 128) * 0.05, boom.z + 2,
          3 + (hash8(n * 7) / 255) * 3, (hash8(n * 17 + 3) - 128) * 0.03, (hash8(n * 19 + 9) - 128) * 0.03,
          boom.wet ? 0.5 : 0.82, 2.2 + (hash8(n * 5) / 255) * 1.4, boom.wet ? 1 : 2,
        )
      }
      if (boom.t > 7) boom.on = false
    }
    for (let i = 0; i < DEBRIS_N; i++) {
      const o = i * DEBRIS_F
      if (debris[o + 6] < 0) continue
      debris[o + 5] -= 150 * dt
      debris[o] += debris[o + 3] * dt
      debris[o + 1] += debris[o + 4] * dt
      debris[o + 2] += debris[o + 5] * dt
      const age = time - debris[o + 6]
      // a burning piece leaves a thread of smoke
      if (debris[o + 7] === 1 && ((age * 30) | 0) % 2 === 0) addSmoke(debris[o], debris[o + 1], debris[o + 2], 1.1, 0, 0, 0.5, 0.5, 2)
      // (a spark burns out in a second or so, each in its own time)
      const life = debris[o + 7] === 4 ? 0.7 + (hash8(i * 67 + 5) / 255) * 0.9 : 4
      const down = age > 0.15 && debris[o + 2] <= groundAt(debris[o], debris[o + 1])
      // (a piece that falls in the sea makes its own small splash)
      if (down && debris[o + 7] !== 4 && matMap[(((debris[o + 1] | 0) & NM) << NSHIFT) | ((debris[o] | 0) & NM)] < 4) {
        addSmoke(debris[o], debris[o + 1], debris[o + 2] + 1, 1.6 * jetSize() + 0.8, 0, 0, 0.75, 0.55, 1)
        addSmoke(debris[o], debris[o + 1], debris[o + 2] + 4, 1.1 * jetSize() + 0.5, 0, 0, 0.6, 0.4, 1)
      }
      if (age > life || down) debris[o + 6] = -1
    }
    if (chute.on && chute.free) {
      // let go, the parachute lifts a little, tips, and drifts off down the wind, slowly folding
      chute.t += dt
      const fx = Math.sin(ejHead)
      const fy = -Math.cos(ejHead)
      const k = 1 - Math.exp(-dt * 0.9)
      chute.vx += (-fx * 8 + -fy * 15 - chute.vx) * k
      chute.vy += (-fy * 8 + fx * 15 - chute.vy) * k
      chute.vz += (10 - chute.t * 4.5 - chute.vz) * (1 - Math.exp(-dt * 1.6))
      chute.x += chute.vx * dt
      chute.y += chute.vy * dt
      chute.z += chute.vz * dt
      if (chute.t > 5.2) chute.on = false
    }
  }

  /** the pilot out of the jet: up on the seat's rocket, down under the parachute, into the new jet */
  function stepEject(dt) {
    ejT += dt
    const sc = jetSize()
    const fx = Math.sin(ejHead)
    const fy = -Math.cos(ejHead)
    const nj = jets[0]
    if (ej === EJ_ROCKET) {
      // the seat's rocket: a hard shove for a quarter of a second, then he coasts to the top
      const burning = ejT < 0.26
      pilot.vz += (burning ? 70 : -215) * dt
      const k = 1 - Math.exp(-dt * 1.5)
      pilot.vx += (fx * DRIFT - pilot.vx) * k
      pilot.vy += (fy * DRIFT - pilot.vy) * k
      pilot.x += pilot.vx * dt
      pilot.y += pilot.vy * dt
      pilot.z += pilot.vz * dt
      if (ejT < 0.46) {
        const n = smokeHead
        addSmoke(pilot.x, pilot.y, pilot.z - 4 * sc, (1.5 + (hash8(n * 7 + 1) / 255) * 1.3) * sc, (hash8(n * 11) - 128) * 0.04, (hash8(n * 23) - 128) * 0.04, 0.78, 0.8 + (hash8(n * 3) / 255) * 0.6, 1)
      }
      if (!burning && pilot.vz < 30) openChute()
    } else {
      // Under the parachute he comes down slowly, swinging, carried along a little; the new jet
      // closes from behind and below, easing off, and passes under him without stopping. He lets
      // go a moment before it is there and falls into its open cockpit as it goes by.
      const tau = meetT - ejT // seconds until he lands (negative once he has)
      if (tau <= 1.7 && tau + dt > 1.7) sound('flyby') // (the roar of the jet coming in swells as it arrives)
      if (tau <= 2.3 && tau + dt > 2.3) sound('radioIn') // (its pilot, on the radio)
      const hanging = ej === EJ_CHUTE
      const k = 1 - Math.exp(-dt * 2)
      if (tau > 0) {
        pilot.vx += (fx * DRIFT - pilot.vx) * k
        pilot.vy += (fy * DRIFT - pilot.vy) * k
        pilot.x += pilot.vx * dt
        pilot.y += pilot.vy * dt
      }
      if (hanging) {
        const ahead = groundAt(pilot.x + fx * 30, pilot.y + fy * 30)
        const sink = pilot.z > ahead + 44 * sc + 16 ? -SINK : 8 // (never down into a hillside)
        pilot.vz += (sink - pilot.vz) * (1 - Math.exp(-dt * 3.5))
        pilot.z += pilot.vz * dt
        hangZ = pilot.z
        chute.open = Math.min(1, chute.open + dt / 0.55)
        pilot.swingV += (-pilot.swing * 16 - pilot.swingV * 1.1) * dt
        pilot.swing += pilot.swingV * dt
      } else {
        hangZ += pilot.vz * dt // (the jet keeps to the line it was flying when he let go)
        pilot.swing *= Math.exp(-dt * 9)
      }
      const first = nj.away
      const ox = nj.x
      const oy = nj.y
      const oz = nj.z
      nj.away = false
      nj.yaw = ejHead
      nj.yawRate = 0
      nj.roll = 0
      if (tau > 0) {
        // the new jet, on its way in: a little nose up, levelling as it arrives
        const lift = clamp(tau / 1.6, 0, 1)
        nj.pitch = 0.13 * lift * lift * (3 - 2 * lift)
        seatOf(nj)
        const sx = seat.x - nj.x
        const sy = seat.y - nj.y
        const sz = seat.z - nj.z
        const behind = gapBehind(tau)
        const below = (10 + 30 * Math.pow(clamp(tau / MEET, 0, 1), 1.5)) * sc
        nj.x = pilot.x - fx * behind - sx
        nj.y = pilot.y - fy * behind - sy
        nj.z = hangZ - below - sz
        if (first) {
          nj.trailLen = 0
          nj.lastTrailX = nj.x
          nj.lastTrailY = nj.y
          nj.vx = fx * (DRIFT + (gapBehind(tau + 0.01) - behind) / 0.01)
          nj.vy = fy * (DRIFT + (gapBehind(tau + 0.01) - behind) / 0.01)
          riseV = pilot.vz
        } else if (dt > 0) {
          nj.vx = (nj.x - ox) / dt
          nj.vy = (nj.y - oy) / dt
          riseV = (nj.z - oz) / dt
        }
        ejSpeed = Math.hypot(nj.vx, nj.vy)
        if (hanging && tau <= FALL) cutChute()
        if (ej === EJ_DROP) {
          // falling, faster and faster, onto the seat as it comes under him
          seatOf(nj)
          const u = clamp(1 - tau / FALL, 0, 1)
          pilot.z = seat.z + dropZ * (1 - u * u)
        }
      } else {
        // he is in: the jet flies on with him, opening up again as gently as it eased off, and
        // levels out; the canopy comes down over him
        if (ej === EJ_DROP) {
          ej = EJ_SEAL
          ejAt = ejT
          sound('seat')
        }
        const since = ejT - ejAt
        if (since >= 0.4 && since - dt < 0.4) sound('radioOut')
        const open = clamp(since / 0.5, 0, 1)
        ejSpeed += (p.speed - ejSpeed) * (1 - Math.exp(-dt * 1.5 * open * open * (3 - 2 * open)))
        nj.vx = fx * ejSpeed
        nj.vy = fy * ejSpeed
        nj.x += nj.vx * dt
        nj.y += nj.vy * dt
        riseV *= Math.exp(-dt * 5)
        nj.z += riseV * dt
        nj.pitch += (0 - nj.pitch) * (1 - Math.exp(-dt * 6))
        seatOf(nj)
        pilot.x = seat.x
        pilot.y = seat.y
        pilot.z = seat.z
        pilot.vx = nj.vx
        pilot.vy = nj.vy
        const u = clamp((since - 0.12) / 0.6, 0, 1)
        if (u > 0 && nj.lid === 1) sound('canopy')
        nj.lid = u > 0 ? Math.min(0.999, 1 - u * u * (3 - 2 * u)) : 1
        if (u >= 1) {
          // sealed in: the jet is his to fly again, and the thrusters push it away
          nj.lid = 0
          ej = EJ_FLY
          speedEase = ejSpeed / Math.max(1, p.speed)
          kick = 1
          climbV = 0
          climbTilt = 0
          floorS = 0
          safeT = 1.4
          sound('kick')
        }
      }
      // the camera goes over to the jet as it arrives
      const h = clamp(1 - tau / HANDOVER, 0, 1)
      handed = h * h * (3 - 2 * h)
    }
    syncGhost()
  }

  // ── crash and ejection: how it is drawn. Each piece is placed in the world and drawn facing
  // the camera, at the size of the jet's own pixels, behind the same hills and clouds as a jet.

  /** a filled box */
  function box(x0, y0, x1, y1, col, V) {
    if (x0 < 0) x0 = 0
    if (y0 < 0) y0 = 0
    if (x1 > W) x1 = W
    if (y1 > H) y1 = H
    for (let y = y0; y < y1; y++) {
      let o = y * W + x0
      for (let x = x0; x < x1; x++, o++) if (zbuf[o] >= V - 1) fb[o] = col
    }
  }
  /** a disc; k is its strength out of 256, and ragged breaks its edge up into pixels */
  function ball(cx, cy, r, col, V, k, ragged) {
    if (r < 0.5 || k <= 0) return
    const x0 = Math.max(0, Math.floor(cx - r))
    const x1 = Math.min(W - 1, Math.ceil(cx + r))
    const y0 = Math.max(0, Math.floor(cy - r))
    const y1 = Math.min(H - 1, Math.ceil(cy + r))
    const inv = 1 / (r * r)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) * inv
        if (d2 > 1) continue
        const at = y * W + x
        if (zbuf[at] < V - 1) continue
        if (ragged && d2 > 0.6 && BAYER[((y & 3) << 2) | (x & 3)] < (d2 - 0.6) * 40) continue
        fb[at] = k >= 256 ? col : blend(fb[at], col, k)
      }
    }
  }
  /** a line one pixel wide */
  function thread(xa, ya, xb, yb, col, V, k) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(xb - xa), Math.abs(yb - ya))))
    for (let i = 0; i <= n; i++) {
      const x = Math.round(xa + ((xb - xa) * i) / n)
      const y = Math.round(ya + ((yb - ya) * i) / n)
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const at = y * W + x
      if (zbuf[at] >= V - 1) fb[at] = k >= 256 ? col : blend(fb[at], col, k)
    }
  }
  // The pilot and his seat are voxel models, turned the way they face and inked by the painter.
  const pose = new Float64Array(9)
  const lightIn = [0, 0, 1]
  const inkPals = [jetPalDim, jetPal, jetPalLit]
  /**
   * Stands a model at the point last projected: g is the size of one of its voxels (world px),
   * yaw the way it faces, pitch how far it is tipped back, lean a turn in the picture's own plane.
   * Answers the size of a voxel on screen.
   */
  function stand(g, yaw, pitch, lean) {
    const sn = Math.sin(yaw)
    const cs = Math.cos(yaw)
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    const k = Math.max(0.32 / prM, g) // (never so small that he is lost)
    const cl = Math.cos(lean)
    const sl = Math.sin(lean)
    const lx = -sunX
    const ly = -sunY
    const lz = 1.1
    // its axes in the world: to its right, the way it faces, up through its head
    for (let n = 0; n < 3; n++) {
      const ex = n === 0 ? cs : n === 1 ? sn * cp : -sn * sp
      const ey = n === 0 ? sn : n === 1 ? -cs * cp : cs * sp
      const ez = n === 0 ? 0 : n === 1 ? sp : cp
      const eV = -(ex * vSin + ey * vCos)
      const x = prM * k * (ex * vCos - ey * vSin)
      const y = -prM * k * (ez + vTan * eV)
      pose[n * 3] = x * cl - y * sl
      pose[n * 3 + 1] = x * sl + y * cl
      pose[n * 3 + 2] = k * eV
      lightIn[n] = ex * lx + ey * ly + ez * lz
    }
    return prM * k
  }

  /**
   * The parachute's canopy: (cx, cy) is the middle of its hem, u the size of a jet pixel,
   * open how far it has filled (0 a streamer … 1 a dome), tilt how far it leans, k its strength.
   */
  function canopy(cx, cy, u, open, tilt, k, V) {
    const o = 1 - (1 - open) * (1 - open)
    const pop = open < 1 ? Math.sin(open * Math.PI) * 0.1 : 0 // it bulges as it snaps open
    const rw = 12.5 * (0.2 + 0.8 * o) * (1 + pop) * u
    const hh = 9.5 * (1.55 - 0.55 * o) * u
    const c = Math.cos(tilt)
    const s = Math.sin(tilt)
    const reach = Math.max(rw, hh) + 2 * u
    const x0 = Math.max(0, Math.floor(cx - reach))
    const x1 = Math.min(W - 1, Math.ceil(cx + reach))
    const y0 = Math.max(0, Math.floor(cy - reach))
    const y1 = Math.min(H - 1, Math.ceil(cy + reach))
    const hem = 1.3 * u
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx
        const dy = y - cy
        const lx = c * dx + s * dy
        const ly = -s * dx + c * dy // up is negative
        if (ly < -hh || ly > hem) continue
        const w = ly < 0 ? rw * Math.sqrt(1 - (ly / hh) * (ly / hh)) : rw
        const ax = Math.abs(lx)
        if (ax > w) continue
        // eight gores across the half that shows, narrowing towards the sides as on a dome
        const g = (Math.asin(clamp(lx / (w + 0.001), -1, 1)) / Math.PI + 0.5) * 8
        const gore = Math.min(7, Math.floor(g))
        const within = g - gore
        if (ly > Math.sin(within * Math.PI) * hem - 0.3 * u) continue // the scalloped hem
        const at = y * W + x
        if (zbuf[at] < V - 1) continue
        const low = ly > -hh * 0.3 // its skirt, in its own shade
        const far = g > 5.6
        let col
        if (ax > w - 1 || ly < -hh + 1) col = jetPal[17 + 1]
        else if (within < 0.09 && gore > 0) col = gore % 2 === 0 ? jetPal[17 + 2] : SILK[2]
        else if (gore % 2 === 0) col = low || far ? jetPal[17 + 2] : ly < -hh * 0.72 ? jetPal[17 + 4] : jetPal[17 + 3]
        else col = low || far ? SILK[1] : SILK[0]
        fb[at] = k >= 256 ? col : blend(fb[at], col, k)
      }
    }
  }

  /** the explosion and the wreckage in the air */
  function drawWreckage() {
    const sc = jetSize()
    if (boom.on && project(boom.x, boom.y, boom.z)) {
      const m = prM
      const px = prX
      const py = prY
      const V = prV - 4 // (a touch nearer, so the slope it hit does not hide it)
      const t = boom.t
      // a ring racing out over the ground or the water
      if (t < 1.4) {
        const rx = 74 * (1 - Math.exp(-t * 2.4)) * m
        const ry = rx * clamp(Math.abs(vTan), 0.12, 1)
        const n = Math.max(24, Math.round(rx * 2.4))
        const k = Math.round(256 * (1 - t / 1.4))
        const col = boom.wet ? SPRAY[0] : DUST
        for (let i = 0; i < n; i++) {
          if (hash8(i * 7 + ((t * 20) | 0)) < 70) continue
          const a = (i / n) * Math.PI * 2
          const x = Math.round(px + Math.cos(a) * rx)
          const y = Math.round(py - Math.sin(a) * ry)
          if (x < 0 || y < 0 || x >= W - 1 || y >= H) continue
          const at = y * W + x
          if (zbuf[at] < V - 6) continue
          fb[at] = blend(fb[at], col, k)
          fb[at + 1] = blend(fb[at + 1], col, k)
        }
      }
      // the sea thrown up
      if (boom.wet && t < 1.2) {
        for (let i = 0; i < 9; i++) {
          const up = Math.sin(Math.PI * Math.min(1, t / (0.8 + (hash8(i * 19 + 3) / 255) * 0.4))) * (16 + (hash8(i * 43 + 1) / 255) * 26)
          const ox = (hash8(i * 13 + 9) / 255 - 0.5) * 30
          ball(px + ox * m, py - up * m, (2.2 + (hash8(i * 5 + 2) / 255) * 2.6) * m, SPRAY[i & 1], V, 256, true)
          ball(px + ox * m, py - up * 0.5 * m, 2.4 * m, SPRAY[1], V, 200, true)
        }
      }
      // the first flash
      if (t < 0.09) ball(px, py - 5 * m, (8 + t * 90) * m, FIRE[0], V, 256, true)
      // balls of fire that swell, rise, and turn to soot
      const size = boom.wet ? 0.7 : 1
      for (let i = 0; i < 10; i++) {
        const a = (t - (hash8(i * 31 + 7) / 255) * 0.24) / (0.75 + (hash8(i * 17 + 3) / 255) * 0.55)
        if (a <= 0 || a >= 1) continue
        const ox = (hash8(i * 13 + 1) / 255 - 0.5) * 24
        const up = (hash8(i * 29 + 5) / 255) * 9 + a * 26
        const r = (5 + (hash8(i * 41 + 9) / 255) * 7) * (0.35 + 0.65 * (1 - (1 - a) * (1 - a) * (1 - a))) * size * m
        const k = a < 0.62 ? 256 : Math.round(256 * (1 - (a - 0.62) / 0.38))
        ball(px + ox * m, py - up * m, r, a < 0.12 ? FIRE[1] : a < 0.34 ? FIRE[2] : a < 0.62 ? FIRE[3] : FIRE[4], V, k, true)
        if (a < 0.42) ball(px + ox * m, py - up * m, r * 0.56, a < 0.2 ? FIRE[0] : FIRE[1], V, 256, true)
      }
    }
    for (let i = 0; i < DEBRIS_N; i++) {
      const o = i * DEBRIS_F
      if (debris[o + 6] < 0 || !project(debris[o], debris[o + 1], debris[o + 2])) continue
      const kind = debris[o + 7]
      const u = Math.max(1, prM * sc)
      const turn = ((time - debris[o + 6]) * 9 + i) | 0 // it tumbles: wide, then tall
      const x = Math.round(prX)
      const y = Math.round(prY)
      if (kind === 2) {
        // the canopy: a curved piece of glass with a glint on it
        const w = Math.round((turn & 1 ? 2 : 4) * u)
        const h = Math.round((turn & 1 ? 4 : 2) * u)
        box(x - (w >> 1), y - (h >> 1), x - (w >> 1) + w, y - (h >> 1) + h, jetPal[33 + 3], prV)
        box(x - (w >> 1), y - (h >> 1), x - (w >> 1) + Math.max(1, Math.round(u)), y - (h >> 1) + Math.max(1, Math.round(u)), jetPal[33 + 5], prV)
      } else if (kind === 3) {
        // the seat, tumbling end over end as it falls
        const g = sc * PILOT_SIZE
        const gs = stand(g, ejHead + (time - debris[o + 6]) * 1.3, 0.5 + (time - debris[o + 6]) * 5.5, 0)
        painter.begin(prX, prY, seatModel.reach * gs)
        painter.add(seatModel, pose, prX, prY, 0, lightIn)
        painter.end(fb, zbuf, W, H, prV, inkPals, outlineCol, (1.6 * gs) / prM)
      } else if (kind === 4) {
        // a spark: white hot, yellowing, then orange as it dies; a pixel or two, with a short tail
        const age = (time - debris[o + 6]) / (0.7 + (hash8(i * 67 + 5) / 255) * 0.9)
        const col = FIRE[age < 0.3 ? 0 : age < 0.7 ? 1 : 2]
        const w = Math.max(1, Math.round(0.7 * u))
        box(x - (w >> 1), y - (w >> 1), x - (w >> 1) + w, y - (w >> 1) + w, col, prV)
        if (project(debris[o] - debris[o + 3] * 0.03, debris[o + 1] - debris[o + 4] * 0.03, debris[o + 2] - debris[o + 5] * 0.03)) thread(x, y, prX, prY, FIRE[2], prV, 200)
      } else {
        const w = Math.max(1, Math.round((1 + (i % 3) * 0.6) * u))
        box(x - (w >> 1), y - (w >> 1), x - (w >> 1) + w, y - (w >> 1) + w, kind === 1 ? FIRE[1 + (turn & 1)] : jetPal[1 + (i % 4)], prV)
      }
    }
  }

  /** the cannon's rounds, the missiles and their explosions */
  function drawWeapons() {
    const sc = jetSize()
    for (const b of blasts) {
      if (!b.on || !project(b.x, b.y, b.z)) continue
      const m = prM
      const px = prX
      const py = prY
      const V = prV - 3
      const t = b.t
      if (b.wet) {
        // a splash: a ring of foam racing out over the water, and the sea thrown up in columns that fall back
        if (t < 1.3) {
          const rx = 40 * b.size * (1 - Math.exp(-t * 2.6)) * m
          const ry = rx * clamp(Math.abs(vTan), 0.12, 1)
          const n = Math.max(20, Math.round(rx * 2.4))
          const k = Math.round(256 * (1 - t / 1.3))
          for (let i = 0; i < n; i++) {
            if (hash8(i * 7 + ((t * 20) | 0)) < 70) continue
            const a = (i / n) * Math.PI * 2
            const x = Math.round(px + Math.cos(a) * rx)
            const y = Math.round(py - Math.sin(a) * ry)
            if (x < 0 || y < 0 || x >= W - 1 || y >= H) continue
            const at = y * W + x
            if (zbuf[at] < V - 6) continue
            fb[at] = blend(fb[at], SPRAY[0], k)
            fb[at + 1] = blend(fb[at + 1], SPRAY[0], k)
          }
        }
        for (let i = 0; i < 9; i++) {
          const life = 0.7 + (hash8(i * 19 + 3) / 255) * 0.5
          if (t >= life) continue
          const up = Math.sin(Math.PI * (t / life)) * (10 + (hash8(i * 43 + 1) / 255) * 22) * b.size
          const ox = (hash8(i * 13 + 9) / 255 - 0.5) * 22 * b.size
          ball(px + ox * m, py - up * m, (1.8 + (hash8(i * 5 + 2) / 255) * 2.2) * m * b.size, SPRAY[i & 1], V, 256, true)
          ball(px + ox * m, py - up * 0.5 * m, 2 * m * b.size, SPRAY[1], V, 200, true)
        }
      }
      if (t < 0.07) ball(px, py, (5 + t * 70) * m * b.size, FIRE[0], V, 256, true)
      for (let i = 0; i < 6; i++) {
        const a = (t - (hash8(i * 31 + 7) / 255) * 0.12) / (0.5 + (hash8(i * 17 + 3) / 255) * 0.4)
        if (a <= 0 || a >= 1) continue
        const ox = (hash8(i * 13 + 1) / 255 - 0.5) * 13 * b.size
        const up = ((hash8(i * 29 + 5) / 255 - 0.3) * 8 + a * 10) * b.size
        const r = (3 + (hash8(i * 41 + 9) / 255) * 4.5) * (0.35 + 0.65 * (1 - (1 - a) * (1 - a) * (1 - a))) * m * b.size
        const k = a < 0.6 ? 256 : Math.round(256 * (1 - (a - 0.6) / 0.4))
        const col = b.wet && a > 0.3 ? SPRAY[i & 1] : a < 0.14 ? FIRE[1] : a < 0.36 ? FIRE[2] : a < 0.6 ? FIRE[3] : FIRE[4]
        ball(px + ox * m, py - up * m, r, col, V, k, true)
        if (a < 0.4 && !(b.wet && a > 0.3)) ball(px + ox * m, py - up * m, r * 0.55, a < 0.2 ? FIRE[0] : FIRE[1], V, 256, true)
      }
    }
    for (const m of missiles) {
      if (!m.on || !project(m.x - m.fx * 3.2 * sc, m.y - m.fy * 3.2 * sc, m.z - m.fz * 3.2 * sc)) continue
      const tx = prX
      const ty = prY
      const tm = prM
      if (!project(m.x + m.fx * 3.2 * sc, m.y + m.fy * 3.2 * sc, m.z + m.fz * 3.2 * sc)) continue
      // a pale body, a dark line under it so it reads over cloud, and (once it is alight) its motor's flame behind
      const w = Math.max(1, Math.round(prM * sc * 0.7))
      for (let k = 0; k < w; k++) {
        thread(tx + k, ty + 1, prX + k, prY + 1, outlineCol, prV, 256)
        thread(tx + k, ty, prX + k, prY, SILK[0], prV, 256)
      }
      const burn = m.t - (m.sure ? 0.04 : MISSILE_DROP)
      if (m.lit && (burn < MISSILE_BURN || m.sure)) {
        const big = burn < 0.12 ? 2.4 : 1 // (it flares as it lights)
        ball(tx, ty, (1.5 + 0.5 * Math.sin(time * 70)) * tm * sc * big, FIRE[1], prV, 256, true)
        ball(tx, ty, 0.8 * tm * sc * big, FIRE[0], prV, 256, false)
      }
    }
    for (const m of inbound) {
      if (!m.on) continue
      // the enemy's: a long streak of flame behind it, a red body, and the glare of its motor
      if (project(m.x - m.fx * 15 * sc, m.y - m.fy * 15 * sc, m.z - m.fz * 15 * sc)) {
        const fx0 = prX
        const fy0 = prY
        if (project(m.x - m.fx * 8 * sc, m.y - m.fy * 8 * sc, m.z - m.fz * 8 * sc)) {
          const fx1 = prX
          const fy1 = prY
          if (project(m.x - m.fx * 4 * sc, m.y - m.fy * 4 * sc, m.z - m.fz * 4 * sc)) {
            thread(fx0, fy0, fx1, fy1, FIRE[3], prV, 170)
            thread(fx1, fy1, prX, prY, FIRE[2], prV, 256)
            thread(fx1, fy1 + 1, prX, prY + 1, FIRE[2], prV, 200)
          }
        }
      }
      if (!project(m.x - m.fx * 4 * sc, m.y - m.fy * 4 * sc, m.z - m.fz * 4 * sc)) continue
      const tx = prX
      const ty = prY
      const tm = prM
      if (!project(m.x + m.fx * 4 * sc, m.y + m.fy * 4 * sc, m.z + m.fz * 4 * sc)) continue
      const w = Math.max(2, Math.round(prM * sc * 0.9))
      for (let k = 0; k < w; k++) {
        thread(tx + k, ty + 1, prX + k, prY + 1, outlineCol, prV, 256)
        thread(tx + k, ty, prX + k, prY, HUD_FOE, prV, 256)
      }
      ball(tx, ty, (1.5 + 0.5 * Math.sin(time * 70)) * tm * sc, FIRE[1], prV, 256, true)
      ball(tx, ty, 0.8 * tm * sc, FIRE[0], prV, 256, false)
    }
    for (let i = 0; i < SHOT_N; i++) {
      const o = i * SHOT_F
      const age = time - shots[o + 6]
      if (age < 0 || age > SHOT_LIFE) continue
      // a tracer: a short bright streak along the way it is going
      const tail = Math.min(age, 0.04)
      if (!project(shots[o] - shots[o + 3] * tail, shots[o + 1] - shots[o + 4] * tail, shots[o + 2] - shots[o + 5] * tail)) continue
      const tx = prX
      const ty = prY
      if (!project(shots[o], shots[o + 1], shots[o + 2])) continue
      const k = age > SHOT_LIFE - 0.2 ? Math.round(256 * ((SHOT_LIFE - age) / 0.2)) : 256
      const theirs = shots[o + 7] === 1
      thread(tx, ty, prX, prY, theirs ? FOE_TRACER[1] : FIRE[1], prV, k)
      if (prM * sc > 1.6 || theirs) thread(tx + 1, ty, prX + 1, prY, theirs ? FOE_TRACER[1] : FIRE[1], prV, k)
      const hx = Math.round(prX)
      const hy = Math.round(prY)
      if (hx >= 0 && hy >= 0 && hx < W && hy < H && zbuf[hy * W + hx] >= prV - 1) fb[hy * W + hx] = theirs ? FOE_TRACER[0] : FIRE[0]
    }
    // the spent cases, tumbling: seen end on and side on by turns, catching the light now and then
    for (let i = 0; i < CASE_N; i++) {
      const o = i * CASE_F
      const age = time - cases[o + 6]
      if (age < 0 || age > CASE_LIFE || !project(cases[o], cases[o + 1], cases[o + 2])) continue
      const u = prM * sc
      const turn = ((age * 22 + i * 1.7) | 0) & 3
      const long = Math.max(2, Math.round(u * 1.2))
      const thin = Math.max(1, Math.round(u * 0.55))
      const w = turn & 1 ? thin : long
      const h = turn & 1 ? long : thin
      const x = Math.round(prX) - (w >> 1)
      const y = Math.round(prY) - (h >> 1)
      if (age > CASE_LIFE - 0.25 && ((time * 30) | 0) % 2 === 0) continue // (it flickers out of sight)
      box(x, y + 1, x + w, y + h + 1, outlineCol, prV) // (a dark edge under it, so it shows against anything)
      box(x, y, x + w, y + h, BRASS[turn === 0 ? 0 : turn === 3 ? 2 : 1], prV)
    }
    // the flash at each gun's muzzle, under the wing (not from the seat: the wings are behind the pilot)
    if (armed() && vK < 0.5) {
      for (let side = -1; side <= 1; side += 2) {
        const hot = side < 0 ? muzzleL : muzzleR
        if (hot <= 0.3) continue
        mountAt(side * GUN_A, GUN_B + 2.5, GUN_H)
        if (project(mount.x, mount.y, mount.z)) ball(prX, prY, (0.8 + hot * 0.9) * prM * sc, FIRE[hot > 0.7 ? 0 : 1], prV - 1, 256, true)
      }
    }
  }

  /** the sights: a mark over each enemy, brackets closing on the one being locked on to, a box on the one that is */
  function drawSights(framed) {
    if (!p.weapons || foes.length === 0) return
    const sc = jetSize()
    const far = -1e9 // (the marks are on the glass, not in the world: nothing hides them)
    for (let i = 0; i < foes.length; i++) {
      const f = foes[i]
      if (f.state !== 0) continue
      const seen = project(f.j.x, f.j.y, f.j.z)
      const x = Math.round(prX)
      const y = Math.round(prY)
      const on = seen && x > 6 && y > 6 && x < W - 6 && y < H - 6
      if (!on) {
        // out of the frame: a mark at its edge, the way to turn to find it
        if (!framed) continue
        const dx = f.j.x - cam.x
        const dy = f.j.y - cam.y
        let vx = seen ? prX - (W >> 1) : dx * vCos - dy * vSin
        let vy = seen ? prY - (H >> 1) : dx * vSin + dy * vCos
        const k = Math.min((W / 2 - 7) / Math.max(1, Math.abs(vx)), (H / 2 - 7) / Math.max(1, Math.abs(vy)))
        vx = Math.round((W >> 1) + vx * k)
        vy = Math.round((H >> 1) + vy * k)
        box(vx - 3, vy - 3, vx + 4, vy + 4, outlineCol, far)
        box(vx - 2, vy - 2, vx + 3, vy + 3, i === lockOn ? HUD_SEEK : f.atk && ((time * 6) | 0) % 2 === 0 ? HUD_LOCK : HUD_FOE, far)
        continue
      }
      const size = Math.max(7, Math.round(JET_L * 0.42 * sc * prM))
      if (i === lockOn && armed()) {
        const locked = lockT >= LOCK_TIME
        const u = clamp(lockT / LOCK_TIME, 0, 1)
        // closing in while it is being locked on to; shut tight, and red, once it is
        const h = Math.round(size * (locked ? 1 : 2 - u))
        const c = Math.max(3, Math.round(h * 0.45))
        const col = locked ? HUD_LOCK : HUD_SEEK
        if (locked || ((time * 14) | 0) % 2 === 0) {
          for (let sx = -1; sx <= 1; sx += 2) {
            for (let sy = -1; sy <= 1; sy += 2) {
              thread(x + sx * h, y + sy * h, x + sx * (h - c), y + sy * h, col, far, 256)
              thread(x + sx * h, y + sy * h, x + sx * h, y + sy * (h - c), col, far, 256)
            }
          }
        }
        if (locked) {
          // and a diamond inside it, that pulses
          const d = Math.round(h * (0.55 + 0.1 * Math.sin(time * 14)))
          thread(x - d, y, x, y - d, col, far, 256)
          thread(x, y - d, x + d, y, col, far, 256)
          thread(x + d, y, x, y + d, col, far, 256)
          thread(x, y + d, x - d, y, col, far, 256)
        }
      } else {
        // any other: a small mark over it
        const top = y - size - 2
        thread(x - 3, top - 3, x, top, HUD_FOE, far, 256)
        thread(x + 3, top - 3, x, top, HUD_FOE, far, 256)
        if (f.atk && ((time * 6) | 0) % 2 === 0) {
          // … two, flashing, over one that is after the player
          thread(x - 3, top - 7, x, top - 4, HUD_LOCK, far, 256)
          thread(x + 3, top - 7, x, top - 4, HUD_LOCK, far, 256)
        }
      }
    }
  }

  /**
   * A missile is coming: two rings round the jet (round the middle of the glass, from the seat).
   * The outer one closes on the inner as the missile closes on the jet, with a mark on it on the
   * side the missile is coming from; when they meet, it is here. It turns from yellow to a red
   * flash for the moment in which a roll will throw the missile off.
   */
  function drawThreat() {
    if (threatT > 90 || ej !== EJ_FLY) return
    let cx = W >> 1
    let cy = Math.round(H * 0.34)
    if (vK < 0.5) {
      const lead = jets[0]
      if (!project(lead.x, lead.y, lead.z)) return
      cx = Math.round(prX)
      cy = Math.round(prY)
    }
    const far = -1e9
    const now = threatT <= PARRY * 0.85
    const inner = Math.max(9, Math.round(Math.min(W, H) * 0.045))
    const outer = inner + Math.round(clamp(threatT - PARRY * 0.4, 0, 2.6) * inner * 1.9)
    const flashOn = ((time * 16) | 0) % 2 === 0
    const col = now ? (flashOn ? HUD_LOCK : FOE_TRACER[0]) : HUD_SEEK
    const ring = (r, c, gaps) => {
      const n = Math.max(16, Math.round(r * 1.1))
      for (let i = 0; i < n; i++) {
        if (gaps && (i & 3) === 3) continue
        const a0 = (i / n) * Math.PI * 2
        const a1 = ((i + 1) / n) * Math.PI * 2
        thread(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, c, far, 256)
      }
    }
    ring(inner, now ? col : HUD_FOE, false)
    if (now) ring(inner + 1, col, false)
    ring(outer, col, true)
    // where it is coming from: a wedge on the outer ring (dead ahead is the top of it)
    const a = threatFrom - Math.PI / 2
    const wx = cx + Math.cos(a) * (outer + 4)
    const wy = cy + Math.sin(a) * (outer + 4)
    for (let k = -2; k <= 2; k++) thread(wx + Math.cos(a + Math.PI / 2) * k * 1.6, wy + Math.sin(a + Math.PI / 2) * k * 1.6, cx + Math.cos(a) * (outer + 1), cy + Math.sin(a) * (outer + 1), col, far, 256)
  }

  /** the pilot while he is out of the jet (or sitting in it under an open canopy), and his parachute */
  function drawPilot() {
    const sc = jetSize()
    // a parachute that has been cut loose, drifting off
    if (chute.on && chute.free && project(chute.x, chute.y, chute.z)) {
      const u = Math.max(1, prM * sc * CHUTE)
      const t = chute.t
      const tilt = Math.sin(t * 1.9) * 0.28 + Math.min(0.5, t * 0.22)
      const k = t < 2.6 ? 256 : Math.round(256 * clamp(1 - (t - 2.6) / 2.4, 0, 1))
      const open = 1 - 0.42 * Math.min(1, t / 2.6)
      // its lines trail beneath it, swinging
      const sway = tilt + Math.sin(t * 2.6) * 0.45
      const ex = prX + Math.sin(sway) * 10 * u
      const ey = prY + Math.cos(sway) * 10 * u
      const rw = 12.5 * (0.2 + 0.8 * (1 - (1 - open) * (1 - open))) * u
      for (let i = 0; i < 5; i++) {
        const lx = rw * Math.sin((i / 4 - 0.5) * Math.PI * 0.92)
        thread(prX + Math.cos(tilt) * lx, prY + Math.sin(tilt) * lx, ex, ey, SILK[1], prV, k >> 1)
      }
      canopy(prX, prY, u, open, tilt, k, prV)
    }
    if (ej === EJ_FLY) return // he is in the jet, under its glass
    if (vK > 0.2) return // the camera is still at his own eyes (the cockpit view): he is not in front of it
    if (!project(pilot.x, pilot.y, pilot.z)) return
    // (he is the same size against the jet all the way through: it is the camera that comes closer)
    const g = sc * PILOT_SIZE
    const px = prX
    const py = prY
    const V = prV - 2
    if (ej === EJ_ROCKET) {
      const gs = stand(g, ejHead, 0.1, 0)
      // the seat's rocket, burning under it for a moment
      if (ejT < 0.3) {
        const fx = px + (PILOT_SEAT_BASE[1] - PILOT_PIVOT[1]) * -pose[3] + (PILOT_SEAT_BASE[2] - PILOT_PIVOT[2]) * pose[6]
        const fy = py + (PILOT_SEAT_BASE[1] - PILOT_PIVOT[1]) * -pose[4] + (PILOT_SEAT_BASE[2] - PILOT_PIVOT[2]) * pose[7]
        const u = Math.max(1, gs * 1.7)
        const len = (7 + 5 * Math.sin(time * 61)) * (1 - ejT / 0.36)
        for (let i = 0; i < len; i++) {
          const w = Math.max(1, Math.round((2.4 - (i / len) * 2) * u))
          const col = i < len * 0.3 ? FIRE[0] : i < len * 0.62 ? FIRE[1] : FIRE[2]
          box(Math.round(fx) - (w >> 1), Math.round(fy + i * u), Math.round(fx) - (w >> 1) + w, Math.round(fy + (i + 1) * u) + 1, col, V)
        }
      }
      painter.begin(px, py, pilotSeated.reach * gs)
      painter.add(seatModel, pose, px, py, 0, lightIn)
      painter.add(pilotSeated, pose, px, py, 0, lightIn)
      painter.end(fb, zbuf, W, H, V, inkPals, outlineCol, (1.6 * gs) / prM)
      return
    }
    if (ej === EJ_CHUTE) {
      const u = Math.max(1, prM * sc * CHUTE)
      const sw = pilot.swing
      const body = px - Math.sin(sw) * 2.4 * u // he swings one way, the canopy leans the other
      const tilt = sw * 0.3
      const fill = chute.open
      const up = (PILOT_RISER[2] - PILOT_PIVOT[2]) * prM * g
      const cx = px + Math.sin(sw) * 1.6 * u
      const cy = py - up - LINES * (0.55 + 0.45 * fill) * u
      // he hangs in line with the canopy
      const gs = stand(g, ejHead, 0, Math.atan2(cx - body, py - cy))
      const rw = 12.5 * (0.2 + 0.8 * (1 - (1 - fill) * (1 - fill))) * u
      // he holds a riser in each fist: the lines go to whichever is on their side
      const ax = PILOT_RISER[0]
      const ab = PILOT_PIVOT[1] - PILOT_RISER[1]
      const ah = PILOT_RISER[2] - PILOT_PIVOT[2]
      const side = pose[0] >= 0 ? 1 : -1
      for (let i = 0; i < 6; i++) {
        const lx = rw * Math.sin((i / 5 - 0.5) * Math.PI * 0.92)
        const a = (i < 3 ? -ax : ax) * side
        thread(cx + Math.cos(tilt) * lx, cy + Math.sin(tilt) * lx, body + a * pose[0] + ab * pose[3] + ah * pose[6], py + a * pose[1] + ab * pose[4] + ah * pose[7], SILK[1], V, 190)
      }
      canopy(cx, cy, u, fill, tilt, 256, V)
      painter.begin(body, py, pilotHanging.reach * gs)
      painter.add(pilotHanging, pose, body, py, 0, lightIn)
      painter.end(fb, zbuf, W, H, V, inkPals, outlineCol, (1.6 * gs) / prM)
      return
    }
    // (seen from in front, where the glass is behind him, he is simply gone once it is nearly shut)
    if (!aboardDone && !(ej === EJ_SEAL && jets[0].lid < 0.3)) pilotAboard(null)
  }
  /**
   * The pilot falling into the seat, or sitting in it: whatever of him is below the cockpit's
   * sill is inside. Drawn from the jet's own drawing when its open canopy stands between him and
   * the camera (so that the glass goes over him), and after the jets otherwise.
   */
  let aboardDone = false
  function pilotAboard(mask) {
    if (!project(pilot.x, pilot.y, pilot.z)) return
    aboardDone = true
    const sc = jetSize()
    const g = sc * PILOT_SIZE
    const px = prX
    const py = prY
    const V = prV - 2
    seatOf(jets[0])
    const over = Math.hypot(pilot.x - seat.x, pilot.y - seat.y) < 5 * sc
    const high = (pilot.z - seat.z) / g // how far he has still to fall, in his own voxels
    // (as the canopy comes down he settles: only his helmet is left above the sill)
    const tuck = ej === EJ_SEAL ? 4.5 * (1 - jets[0].lid) : 0
    const floor = ej === EJ_SEAL || over ? PILOT_SILL + 0.5 - PILOT_PIVOT[2] - high + tuck : -1e9
    const gs = stand(g, jets[0].yaw, jets[0].pitch, 0)
    // (he lets go of the risers and tucks up as he reaches it)
    const model = ej === EJ_SEAL || high < 7 ? pilotSeated : pilotHanging
    painter.begin(px, py, model.reach * gs)
    painter.add(model, pose, px, py, 0, lightIn, floor)
    painter.end(fb, zbuf, W, H, V, inkPals, outlineCol, (1.6 * gs) / prM, mask)
  }

  // ── simulation
  function step(dtRaw) {
    // the clock, and the time things happen in: the same, but for the moment after a missile is thrown off
    const real = clamp(dtRaw, 0, 0.05)
    if (slowT > 0) slowT -= real
    const slowGoal = slowT > 0.32 ? 1 : 0 // (it eases back to speed over the last third of a second)
    slowAmt += (slowGoal - slowAmt) * (1 - Math.exp(-real * (slowGoal ? 30 : 8)))
    if (slowAmt < 0.003 && slowT <= 0) slowAmt = 0
    const dt = real * (1 - (1 - SLOW_RATE) * slowAmt)
    if (counterT > 0) counterT -= real
    if (volley > 0) {
      volleyDue -= real
      if (volleyDue <= 0) {
        launchMissile(volleyAt, VOLLEY - volley)
        volley--
        volleyDue = VOLLEY_GAP
      }
    }
    time += dt
    introT += dt
    pointerIdle += dt
    if (holding) holdT += dt
    if (worldDirty > 0) {
      worldDirty -= dt
      if (worldDirty <= 0) {
        buildWorld()
        if (reseat) {
          const dx = spawnX - jets[0].x
          const dy = spawnY - jets[0].y
          for (const j of jets) { j.x += dx; j.y += dy; j.trailLen = 0; j.lastTrailX = j.x; j.lastTrailY = j.y }
          for (const f of foes) { f.j.x += dx; f.j.y += dy }
          follow.x += dx
          follow.y += dy
          reseat = false
        }
      }
    }
    if (!cockpit && W > 0) {
      cockpitDue -= dt
      if (cockpitDue <= 0) cockpitArt()
    }
    const introDone = introT > 1.9
    burn += ((introDone ? 1 : 0) - burn) * (1 - Math.exp(-dt * 5))

    // holding down opens the thrusters: longer flames, more speed
    const pushing = introDone && ((holding && holdT >= HOLD) || boostKey)
    // (flying off with the pilot, the thrusters swell and die away again by themselves)
    if (kick > 0) kick = Math.max(0, kick - dt / 1.8)
    const surge = 0.6 * Math.sin(Math.PI * kick) ** 2
    const boostGoal = Math.max(pushing ? 1 : introDone ? padThrust : 0, surge)
    boost += (boostGoal - boost) * (1 - Math.exp(-dt * (boostGoal > boost ? 5 : 2.4)))
    if (boost < 0.0005 && boostGoal === 0) boost = 0
    speedEase += (1 - speedEase) * (1 - Math.exp(-dt * 1.5))
    if (safeT > 0) safeT -= dt
    // (a dive lends it a little speed; a steep climb costs it some, unless the thrusters are open)
    const slope = ej === EJ_FLY ? Math.sin(climbNow) : 0
    // (and a hard turn right round costs it a good deal: the thrusters are spent on the turning)
    const bleed = flipping ? 0.42 : 0
    energy += (1 - 0.2 * slope * (slope > 0 ? 1 - boost : 1) - bleed - energy) * (1 - Math.exp(-dt * (flipping ? 2.6 : 1.1)))
    const speed = p.speed * (1 + (clamp(p.boost, 1, 4) - 1) * boost) * speedEase * energy
    speedNow = speed
    spreadNow += (p.spread - spreadNow) * (1 - Math.exp(-dt * 11))

    const lead = jets[0]
    const maxRate = Math.max(0.1, p.agility)
    // how low and how high it may fly: it skims whatever ground lies ahead, with a little
    // room to spare, so it can get close but never hit anything; the ceiling is a setting
    const clearance = clamp(p.clearance, 2, 60)
    const floorNow = groundAhead(lead, speed) + clearance
    if (floorS === 0) floorS = floorNow
    floorS += (floorNow - floorS) * (1 - Math.exp(-dt * (floorNow > floorS ? 9 : 3)))
    const altLo = floorS
    const altHi = Math.max(altLo, p.altitude, clamp(p.ceiling, 20, 6000))
    const climbMax = speed // (it can climb all but straight up)
    const chase = vC + vK > 0.5 // flying from behind or from the seat

    warn = false
    riseNow = 0
    if (ej !== EJ_FLY) stepEject(dt)
    else {
    // where to turn and, from behind, how high to fly
    const crashOn = p.crash && safeT <= 0
    let commit = false // true while a dive is being pushed past the safe height: it will crash
    let ask = 0 // the climb angle the stick is asking for, rad
    let want = 0
    let flown = false // true while the player is choosing the height
    const stick = p.invertY ? -1 : 1 // like a flight stick, down climbs and up dives
    const steering = p.followPointer && pointerOn && pointerIdle < 5
    if (!introDone) {
      want = 0
    } else if (keyMode) {
      want = keyTurn * maxRate
      ask = keyClimb * stick * (keyClimb * stick > 0 ? STEEP : DIVE)
      flown = true
      // held hard down against the safe height for a moment, the dive is meant: let it through
      // (not with the thrusters open: that is the way into a loop forward, not into the ground)
      if (crashOn && boost <= 0.3 && keyClimb * stick < -0.8 && lead.z <= altLo + 3) diveHold += dt
      else diveHold = 0
      commit = diveHold > 0.4
    } else if (steering && (chase || project(lead.x, lead.y, lead.z))) {
      const vx = pointerX - prX
      const vy = pointerY - prY
      if (chase) {
        // from behind: point left or right of the jet to turn, above or below it to climb or dive
        const t = clamp((pointerX - vCx) / (W * 0.26), -1, 1)
        if (Math.abs(t) > 0.06) want = t * maxRate
        const raw = pointerY < vSteerY ? (vSteerY - pointerY) / Math.max(1, vSteerY) : -(pointerY - vSteerY) / Math.max(1, H - vSteerY)
        const up = stick * Math.sign(raw) * Math.max(0, Math.abs(raw) - 0.08) / 0.92
        // (the last of the way down is past the safe height: pointing there is a dive into the ground)
        if (crashOn && up < -0.84 && boost <= 0.3) {
          commit = true
          ask = -0.9
        } else {
          // the farther from the middle, the steeper: gentle near it, all but straight up at the top
          const a = up >= 0 ? Math.min(1, up / 0.86) : up / (crashOn ? 0.84 : 1) // (the top of the frame is the stick hard back)
          ask = Math.sign(a) * Math.pow(Math.abs(a), 1.25) * (a > 0 ? STEEP : DIVE)
        }
        flown = true
      } else {
        flown = true // overhead: keep the height it was flown to
        if (vx * vx + vy * vy > 18 * 18) {
        const fx = vx * vCos + vy * vSin
        const fy = -vx * vSin + vy * vCos
          const err = wrapAngle(Math.atan2(fx, -fy) - lead.yaw)
          want = clamp(err * 2.6, -maxRate, maxRate)
        }
      }
    } else {
      want = maxRate * (0.62 * Math.sin(time * 0.31 + 1.3) + 0.38 * Math.sin(time * 0.73 + 0.4) + 0.22 * Math.sin(time * 0.17))
      want = clamp(want, -maxRate, maxRate)
      if (p.stunts && !drill) {
        autoStunt -= dt
        if (autoStunt <= 0) {
          // (a roll, or now and then a loop)
          startRoll(false)
          autoStunt = 9 + (hash8((time * 10) | 0) / 255) * 7
        }
      }
    }
    lead.yawRate += (want - lead.yawRate) * (1 - Math.exp(-dt * 2.6))
    lead.yaw += lead.yawRate * dt
    const bankMax = (p.bank * Math.PI) / 180
    const rollTarget = clamp(lead.yawRate / maxRate, -1, 1) * bankMax
    lead.roll += (rollTarget - lead.roll) * (1 - Math.exp(-dt * 5))
    // in a loop it goes where its nose points, all the way round; otherwise it climbs at the angle
    // asked for, and what it puts into climbing it does not have for covering ground
    // The nose goes where the stick sends it, at one steady rate, and the jet goes where its nose
    // points: that is all there is to climbing, diving and looping. Back, it comes up to all but
    // straight up and holds there; forward, down into a dive and holds there. With the thrusters
    // open it does not stop at either: it carries on round at the same rate, over the top or
    // under, for as long as the stick is held. Let go before it is past the vertical and it eases
    // back; after, and it finishes the loop itself.
    const trick = lead.loop >= 0 && lead.loopDelay <= 0
    const turnRate = ((Math.PI * 2) / LOOP_T) * (1 + 0.15 * boost)
    const pushRate = turnRate * 0.85 // (a pilot can pull a little harder than he can push)
    const hardBack = ask >= STEEP * 0.97 && !commit
    const hardFwd = ask <= -DIVE * 0.97 && !commit
    // (the thrusters, opened by the pilot: not the push the jet gives itself as it flies off after a rescue)
    const thrusting = boost > 0.3 && (pushing || padThrust > 0.3)
    // (left to itself, it makes its own way back to its cruising height)
    if (!flown) ask = clamp((p.altitude - lead.z) * 0.012, -0.3, 0.35)
    if (trick) {
      flipping = false
      climbCmd = 0 // (a loop flown for him ends level, wherever it began)
    } else if (flipping) {
      const held = flipDir > 0 ? hardBack : hardFwd
      const on = held || Math.abs(climbCmd) > Math.PI / 2
      climbCmd += flipDir * (on ? 1 : -1) * (flipDir > 0 ? turnRate : pushRate) * dt
      if (Math.abs(climbCmd) >= Math.PI * 2) {
        // right round: a whole turn is no turn
        if (flipDir > 0) did.back++
        else did.fwd++
        climbCmd -= flipDir * Math.PI * 2
        lead.pitch -= flipDir * Math.PI * 2
        if (!held || !thrusting) flipping = false
      } else if (!on && Math.abs(climbCmd) <= (flipDir > 0 ? STEEP : DIVE)) flipping = false
    } else if (thrusting && hardBack) {
      climbCmd += turnRate * dt
      if (climbCmd >= STEEP) { flipping = true; flipDir = 1 }
    } else if (thrusting && hardFwd) {
      climbCmd -= pushRate * dt
      if (climbCmd <= -DIVE) { flipping = true; flipDir = -1 }
    } else {
      // (it settles gently on the angle asked for; a dive that is meant goes steeper than the stick alone will)
      climbCmd += clamp(((commit ? -0.9 : ask) - climbCmd) * (1 - Math.exp(-dt * 8)), -pushRate * dt, turnRate * dt)
    }
    hands = flown
    const inLoop = trick || flipping
    const round = trick ? loopOf(lead) : climbCmd
    const zWas = lead.z
    // up or down by as much as its nose points up or down …
    let dz = speed * Math.sin(round) * dt
    if (!inLoop && !commit) {
      // … flattening out as it comes to the ground, or to its ceiling
      if (dz < 0) dz *= clamp((lead.z - altLo) / 14, 0, 1)
      else dz *= clamp((altHi - lead.z) / 14, 0, 1)
    }
    // … and along by the rest
    const along = inLoop ? Math.cos(round) : Math.sqrt(Math.max(0.03, 1 - clamp(dz / Math.max(speed * dt, 1e-6), -1, 1) ** 2))
    lead.vx = Math.sin(lead.yaw) * speed * along
    lead.vy = -Math.cos(lead.yaw) * speed * along
    lead.x += lead.vx * dt
    lead.y += lead.vy * dt
    const hard = groundAt(lead.x, lead.y) + clearance * 0.7
    lead.z += dz + (inLoop ? 0 : Math.cos(time * 0.9) * 1.35 * dt) // (level, it is never quite still)
    let struck = false
    if (inLoop) {
      // a loop is flown as it is: without the air for it under the jet, it ends in the ground.
      // (The pilot is thrown clear a moment before, as from any crash.)
      const ground = Math.max(groundAt(lead.x, lead.y), groundAt(lead.x + lead.vx * 0.12, lead.y + lead.vy * 0.12))
      if (crashOn) struck = dz < 0 && lead.z - ground < Math.max(3.4, (-dz / Math.max(dt, 1e-4)) * 0.1)
      else if (lead.z < hard) lead.z = hard // (with crashes turned off, the ground only stops it)
      commit = false
    } else if (!commit) {
      // the ground rising under it lifts it; and, last resort, it is never closer to what is right
      // underneath than most of the clearance
      if (lead.z < altLo) lead.z += Math.min(climbMax * dt, (altLo - lead.z) * (1 - Math.exp(-dt * 4)))
      if (lead.z < hard) lead.z += (hard - lead.z) * (1 - Math.exp(-dt * 22))
    }
    dz = lead.z - zWas
    riseNow = dz / Math.max(dt, 1e-4)
    // the warning: a dive that is meant, or a loop that is about to meet the ground
    warn = commit || diveHold > 0.05 || (inLoop && crashOn && riseNow < -6 && (lead.z - hard) / -riseNow < 1.1)
    climbV += (riseNow - climbV) * (1 - Math.exp(-dt * 6))
    // nose up in a climb, down in a dive (the gentle cruise bob does not count)
    const climbing = Math.sign(climbV) * Math.max(0, Math.abs(climbV) - 3)
    climbTilt = clamp((climbing / Math.max(20, speed)) * 1.25, -0.5, 0.5)
    const rising = Math.sign(riseNow) * Math.max(0, Math.abs(riseNow) - 2)
    climbNow = inLoop ? 0 : Math.asin(clamp(rising / Math.max(20, speed), -0.995, 0.995))
    if (inLoop) lead.pitch += (round - lead.pitch) * (1 - Math.exp(-dt * 14))
    else {
      // (coming out of a loop its nose is already where it should be: a whole turn is no turn)
      if (lead.pitch > Math.PI) lead.pitch -= Math.PI * 2
      else if (lead.pitch < -Math.PI) lead.pitch += Math.PI * 2
      const pitchTarget = Math.abs(lead.yawRate / maxRate) * 0.1 + climbNow
      lead.pitch += (pitchTarget - lead.pitch) * (1 - Math.exp(-dt * 14))
    }
    // the pilot's head: it leans into a turn, sinks in a climb and under thrust, lifts in a
    // dive, and is never quite still. On a soft spring, so it overshoots a little and settles.
    const hxGoal = clamp(lead.yawRate / maxRate, -1, 1) * 6.4 + Math.sin(time * 0.53) * 0.3
    const hyGoal = clamp(climbTilt / 0.5, -1, 1) * 3.4 + boost * 1.6 + Math.sin(time * 0.71 + 1) * 0.25
    headVX += ((hxGoal - headX) * 64 - headVX * 11) * dt
    headVY += ((hyGoal - headY) * 64 - headVY * 11) * dt
    headX = clamp(headX + headVX * dt, -8, 8)
    headY = clamp(headY + headVY * dt, -5, 5)
    // a dive that was meant: a moment before the jet meets the ground, the pilot is thrown clear
    if (commit) {
      const under = Math.max(
        groundAt(lead.x, lead.y),
        groundAt(lead.x + lead.vx * 0.2, lead.y + lead.vy * 0.2),
        groundAt(lead.x + lead.vx * 0.4, lead.y + lead.vy * 0.4),
      )
      const gap = lead.z - under
      if (gap < 3.4 || gap < Math.max(8, -climbV) * 0.4) startEject()
    } else if (struck) startEject()
    }
    stepWreckage(dt)
    stepFoes(dt)
    stepClouds(dt)
    stepWeapons(dt)
    stepWake(dt)
    // (it watches until the canopy is shut, then glides back to where it flies from)
    const watching = ej === EJ_ROCKET ? ejT > 0.12 : ej !== EJ_FLY
    cine += ((watching ? 1 : 0) - cine) * (1 - Math.exp(-dt * (watching ? 2.4 : 1.3)))
    if (cine < 0.001 && !watching) cine = 0
    const back = ej === EJ_ROCKET || (ej === EJ_CHUTE && ejT - ejAt < 0.5)
    wide += ((back ? 1 : 0) - wide) * (1 - Math.exp(-dt * (back ? 6 : 1.5)))
    if (wide < 0.001 && !back) wide = 0
    // once the crash is over it comes in close on him, and stays there until he is back in a jet
    const close = (ej === EJ_CHUTE && !back) || ej === EJ_DROP || ej === EJ_SEAL
    near += ((close ? 1 : 0) - near) * (1 - Math.exp(-dt * (close ? 1.7 : 1.3)))
    if (near < 0.001 && !close) near = 0
    const mid = ej === EJ_CHUTE || ej === EJ_DROP || ej === EJ_SEAL
    centred += ((mid ? 1 : 0) - centred) * (1 - Math.exp(-dt * (mid ? 1.8 : 1.1)))
    if (centred < 0.001 && !mid) centred = 0
    const canopyUp = ej === EJ_CHUTE ? chute.open * (1 - handed) : 0
    rig += (canopyUp - rig) * (1 - Math.exp(-dt * 2.2))
    if (ej === EJ_FLY) handed = 0

    // wingmen hold formation
    for (let i = 1; i < jets.length; i++) {
      const j = jets[i]
      const side = i === 1 ? -1 : 1
      const lead = pilotAt() // (they keep station on the pilot while he has no jet)
      const tx = lead.x + Math.cos(lead.yaw) * side * formX() - Math.sin(lead.yaw) * formY()
      const ty = lead.y + Math.sin(lead.yaw) * side * formX() + Math.cos(lead.yaw) * formY()
      const k = 1 - Math.exp(-dt * 3.2)
      const ox = j.x
      const oy = j.y
      j.x += lead.vx * dt + (tx - (j.x + lead.vx * dt)) * k
      j.y += lead.vy * dt + (ty - (j.y + lead.vy * dt)) * k
      j.vx = (j.x - ox) / Math.max(dt, 1e-4)
      j.vy = (j.y - oy) / Math.max(dt, 1e-4)
      j.yaw += wrapAngle(lead.yaw - j.yaw) * (1 - Math.exp(-dt * 4))
      j.roll += (lead.roll - j.roll) * (1 - Math.exp(-dt * 3.2))
      j.pitch = j.loop >= 0 ? loopOf(j) : wrapAngle(lead.pitch)
      j.z += (lead.z + Math.sin(time * 1.1 + i * 2) * 1.2 - j.z) * (1 - Math.exp(-dt * 3))
      j.z = Math.max(j.z, groundAt(j.x, j.y) + clearance * 0.7)
    }

    for (const j of jets) {
      if (j.away) continue
      const gNow = clamp(Math.abs(lead.yawRate) / maxRate + (j.stunt >= 0 || j.loop >= 0 ? 0.7 : 0) + boost * 0.9 + Math.abs(climbTilt), 0, 1)
      j.g += (gNow - j.g) * (1 - Math.exp(-dt * 2.5))
      if (j.stunt >= 0) {
        if (j.stuntDelay > 0) j.stuntDelay -= dt
        else {
          j.stunt += dt / 0.85
          if (j.stunt >= 1) j.stunt = -1
        }
      }
      if (j.loop >= 0) {
        if (j.loopDelay > 0) j.loopDelay -= dt
        else {
          j.loop += dt / LOOP_T
          if (j.loop >= 1) {
            j.loop = -1
            if (j === jets[0]) { if (j.loopDir > 0) did.back++; else did.fwd++ }
          }
        }
      }
      // wingtip trails
      const ddx = j.x - j.lastTrailX
      const ddy = j.y - j.lastTrailY
      if (ddx * ddx + ddy * ddy > 6.25) {
        j.lastTrailX = j.x
        j.lastTrailY = j.y
        const ax = axes(j)
        for (let w = 0; w < 2; w++) {
          const sc = jetSize()
          const a = (w === 0 ? -WINGTIP_A : WINGTIP_A) * sc
          const b = (PIV_K - WINGTIP_K) * sc
          const hy = (WINGTIP_Y - PIV_Y) * sc
          const o = j.trailHead * 4
          j.trail[w][o] = j.x + a * ax.rx + b * ax.fx + hy * ax.ux
          j.trail[w][o + 1] = j.y + a * ax.ry + b * ax.fy + hy * ax.uy
          j.trail[w][o + 2] = j.z + a * ax.rz + b * ax.fz + hy * ax.uz
          j.trail[w][o + 3] = time
        }
        j.trailHead = (j.trailHead + 1) % TRAIL_N
        if (j.trailLen < TRAIL_N) j.trailLen++
      }
    }

    // a little dark smoke off the end of each flame, left hanging in the air behind the jet
    smokeClock += dt
    const every = 0.034 - 0.012 * boost
    if (smokeClock >= every && burn > 0.6 && p.afterburner > 0.05 && spreadNow < 2) {
      smokeClock = 0
      const len = flameLength()
      const sc = jetSize()
      for (let i = 0; i < jets.length; i++) {
        const j = jets[i]
        if (j.away) continue
        const ax = axes(j)
        const side = (smokeHead + i) & 1 ? 1 : -1
        const t = len * 0.78
        const a = (side * ENGINE_A + flameBend() * ((t * t) / Math.max(1, len))) * sc
        const b = (PIV_K - NOZZLE_K - t) * sc
        const hy = (ENGINE_Y - PIV_Y) * sc
        const o = smokeHead * SMOKE_F
        smoke[o] = j.x + a * ax.rx + b * ax.fx + hy * ax.ux
        smoke[o + 1] = j.y + a * ax.ry + b * ax.fy + hy * ax.uy
        smoke[o + 2] = j.z + a * ax.rz + b * ax.fz + hy * ax.uz
        smoke[o + 3] = time
        smoke[o + 4] = (1.3 + (hash8(smokeHead * 31 + 7) / 255) * 1.2) * sc
        smoke[o + 5] = -lead.vx * 0.3 + (hash8(smokeHead * 17 + 3) - 128) * 0.05
        smoke[o + 6] = -lead.vy * 0.3 + (hash8(smokeHead * 13 + 5) - 128) * 0.05
        smoke[o + 7] = (0.46 + 0.36 * boost) * clamp(p.afterburner * 1.4, 0, 1)
        smoke[o + 8] = 0.75 + 0.5 * boost + (hash8(smokeHead * 5) / 255) * 0.3
        smoke[o + 9] = 0
        smokeHead = (smokeHead + 1) % SMOKE_N
      }
    }

    // the view weights glide to their goals (three soft stages each)
    // (while the pilot is out of the jet, the camera goes behind to watch, whatever view it was in)
    const out = ej !== EJ_FLY
    const goC = out || viewTarget === 1 ? 1 : 0
    const goK = !out && viewTarget === 2 ? 1 : 0
    const ease = 1 - Math.exp((-dt * 7.6) / (clamp(p.transition, 0.2, 8) * (ej !== EJ_FLY ? 0.6 : 1)))
    let settled = true
    for (let i = 0; i < 3; i++) {
      wChase[i] += ((i === 0 ? goC : wChase[i - 1]) - wChase[i]) * ease
      wCock[i] += ((i === 0 ? goK : wCock[i - 1]) - wCock[i]) * ease
      if (Math.abs(wChase[i] - goC) > 0.0004 || Math.abs(wCock[i] - goK) > 0.0004) settled = false
    }
    if (settled) {
      wChase.fill(goC)
      wCock.fill(goK)
    }
    vC = wChase[2]
    vK = wCock[2]

    // camera: ahead of the leader, turning part of the way with it
    const cl = focus()
    const look = (22 + 16 * boost) * (1 - vC - vK)
    const tx = cl.x + Math.sin(cl.yaw) * look
    const ty = cl.y - Math.cos(cl.yaw) * look
    const kc = 1 - Math.exp(-dt * (3.5 + (ej !== EJ_FLY ? 4.5 * handed : 0))) // (it keeps up closely as it goes over to the new jet)
    follow.x += cl.vx * dt + (tx - (follow.x + cl.vx * dt)) * kc
    follow.y += cl.vy * dt + (ty - (follow.y + cl.vy * dt)) * kc
    cam.yaw += (-cl.yaw * clamp(p.cameraFollow, 0, 1) - cam.yaw) * (1 - Math.exp(-dt * 1.6))
    // (while the seat's rocket burns it hangs back, so the pilot climbs the picture above the crash)
    // (it goes most of the way with the jet as it climbs or dives, and all but all of it when that
    // is steep, or the jet would leave the frame)
    if (ej === EJ_FLY) follow.alt += riseNow * dt * (0.6 + 0.37 * clamp((Math.abs(riseNow) / Math.max(20, speedNow)) * 1.5, 0, 1))
    follow.alt += (cl.z - follow.alt) * (1 - Math.exp(-dt * (3 + 5 * cine) * (1 - 0.8 * wide)))
    // the chase camera keeps clear of the hills behind the jet, and stays out of the cloud
    // layer: under it while the jet is low, over it otherwise
    let fix = 0
    camFloor = 0
    if (vC > 0.3 && vQ > 1e-4) {
      const back = 1 / vQ
      const gx = cam.x + vSin * back
      const gy = cam.y + vCos * back
      let top = 0
      for (let iy = -1; iy <= 1; iy++) for (let ix = -1; ix <= 1; ix++) top = Math.max(top, groundAt(gx + ix * 9, gy + iy * 9))
      camFloor = top + 5
      const nominal = follow.alt + vLean * back
      let want = Math.max(nominal, camFloor)
      if (want > CLOUD_ALT - 3 && want < ZTOP + 3) want = cl.z < CLOUD_ALT - 8 ? Math.max(camFloor, CLOUD_ALT - 3) : ZTOP + 3
      fix = want - nominal
    }
    camFix += (fix - camFix) * (1 - Math.exp(-dt * 7))
    // the chase camera sits behind the jet and swings round a beat late in turns
    chaseYaw += (-cl.yaw + 0.95 * cine - chaseYaw) * (1 - Math.exp(-dt * 3.4)) // (it swings round to one side to watch a pick-up)
    const raw = chaseYaw - cam.yaw
    if (vC === 0 && vK === 0) yawDiff = wrapAngle(raw)
    else yawDiff += wrapAngle(raw - yawDiff)
    updateView()
  }

  // the jet's own axes in the world (x right, y down the map, z up)
  function axes(j) {
    const cs = Math.cos(j.yaw)
    const sn = Math.sin(j.yaw)
    const roll = rollOf(j)
    const cr = Math.cos(roll)
    const sr = Math.sin(roll)
    // right wing dips for a positive roll
    const rx = cs * cr
    const ry = sn * cr
    const rz = -sr
    const u2x = cs * sr
    const u2y = sn * sr
    const u2z = cr
    const cp = Math.cos(j.pitch)
    const sp = Math.sin(j.pitch)
    const fx = sn * cp + u2x * sp
    const fy = -cs * cp + u2y * sp
    const fz = u2z * sp
    const ux = u2x * cp - sn * sp
    const uy = u2y * cp + cs * sp
    const uz = u2z * cp
    return { rx, ry, rz, fx, fy, fz, ux, uy, uz, cr }
  }

  // ── drawing
  //
  // One camera covers both views. A world point lands on screen at
  //   scale = S / (1 + q·depth)     x = Cx + scale·across     y = Cy − scale·(height + slope·depth)
  // With q = 0 this is the flat sprite-stack view: every layer is drawn one pixel above the last.
  // Raising q brings the camera in behind the jet: far things shrink and a horizon appears.
  // Switching views only slides q, the slope, the scale and the heading, so there is no cut.
  const sjx = new Float64Array(3)
  const sjy = new Float64Array(3)
  const srx = new Float64Array(3)
  const sry = new Float64Array(3)
  const sfx = new Float64Array(3)
  const sfy = new Float64Array(3)
  const sic = new Float64Array(3)
  const rowNow = new Int32Array(64) // screen row of every height at this depth step
  const rowPrev = new Int32Array(64) // … and at the step before
  const offX = new Float32Array(512)
  const offY = new Float32Array(512)
  const sliceOrder = new Int32Array(JET_H)
  const sliceKey = new Float64Array(JET_H)
  let prX = 0
  let prY = 0
  let prM = 0
  let prV = 0

  /** world point → screen (prX, prY) and its scale (prM); false when it is behind the camera */
  function project(x, y, z) {
    const dx = x - cam.x
    const dy = y - cam.y
    const depth = -(dx * vSin + dy * vCos)
    const den = 1 + vQ * depth
    if (den < 0.12) return false
    prV = depth
    prM = vS / den
    prX = vCx + prM * (dx * vCos - dy * vSin)
    prY = vCy - prM * (z - cam.alt + vTan * depth)
    return true
  }

  // The islands and clouds, drawn from the nearest ground to the farthest. Every ground pixel
  // is a column of stacked layers: its top is drawn where the column ends and its wall where it
  // starts, and a pixel that is already taken stays taken (nearer things win).
  function drawWorld() {
    const _fb = fb
    const _zb = zbuf
    if (rowLo === 0 && rowHi === H && colLo === 0 && colHi === W) {
      _fb.fill(0)
      _zb.fill(1e9)
    } else {
      for (let y = rowLo; y < rowHi; y++) {
        _fb.fill(0, y * W + colLo, y * W + colHi)
        _zb.fill(1e9, y * W + colLo, y * W + colHi)
      }
    }
    colY.fill(rowHi)
    const c = vCos
    const s = vSin
    const q = vQ
    const S = vS
    const tn = vTan
    const Cx = vCx
    const Cy = vCy
    const A = cam.alt
    const bx = cam.x - Math.floor(cam.x / N) * N + N * 2
    const by = cam.y - Math.floor(cam.y / N) * N + N * 2
    const rankMax = Math.round(clamp(p.clouds, 0, 1) * 16)
    const cloudsOn = rankMax > 0
    const cdx = (time * 7) % NC
    const cdy = (time * 3) % NC
    const csx = sunX * CLOUD_ALT - cdx + NC
    const csy = sunY * CLOUD_ALT - cdy + NC
    const tW1 = ((time * 6) | 0) & 1023
    const tW2 = ((time * 4) | 0) & 1023
    const tF = (time * 36) | 0
    const sx = sunX
    const sy = sunY
    const isc = 1 / jetSize()
    const reach = JET_L * 0.75 * jetSize() + 3
    let nShadow = 0
    if (p.shadow && introT > 0.3) {
      const casting = wreck ? [wreck, ...jets] : jets
      for (let i = 0; i < casting.length && nShadow < 3; i++) {
        const jet = casting[i]
        if (jet.away) continue
        const j = nShadow
        const ax = axes(jet)
        sjx[j] = bx + (jet.x - cam.x) + sx * jet.z
        sjy[j] = by + (jet.y - cam.y) + sy * jet.z
        const cs = Math.cos(jet.yaw)
        const sn = Math.sin(jet.yaw)
        srx[j] = cs
        sry[j] = sn
        sfx[j] = sn
        sfy[j] = -cs
        sic[j] = 1 / (Math.max(0.3, Math.abs(ax.cr)) * jetSize())
        nShadow++
      }
    }
    const _h = heightMap
    const _m = matMap
    const _cn = cloudN
    const _nz = nz
    const _cy = colY
    const hzR = hazeCol & 255
    const hzG = (hazeCol >> 8) & 255
    const hzB = (hazeCol >> 16) & 255
    const mixHaze = (col, keep, fog) =>
      ((255 << 24) |
        (((((col >> 16) & 255) * keep + hzB * fog) >> 8) << 16) |
        (((((col >> 8) & 255) * keep + hzG * fog) >> 8) << 8) |
        (((col & 255) * keep + hzR * fog) >> 8)) >>> 0

    // start where the tallest thing sits on the bottom row; stop when the sea leaves the top
    // of the frame, or at the view distance once there is a horizon
    // (a camera down among the hills and clouds starts right in front of itself instead)
    const below = rowHi - Cy
    const nearest = q > 0 ? -0.85 / q : -1e9
    const camHigh = q > 0 ? A + tn / q : 1e9
    const dn = S * tn + q * below
    let v = camHigh > ZTOP + 1 && dn > 1e-6 ? Math.max(nearest, (S * (A - ZTOP) - below) / dn - 2) : nearest
    // from higher up it sees further, and the haze starts further out
    const viewDist = VIEW_DIST + 3 * A
    const fogStart = FOG_START + 2 * A
    const above = Cy - rowLo + 2
    let vEnd = viewDist
    if (S * tn > q * above) vEnd = Math.min(viewDist, (S * A + above) / (S * tn - q * above))
    let den = 1 + q * v
    let m = S / den
    let R = Cy - m * (tn * v - A) + EPS
    for (let z = 0; z <= ZTOP; z++) rowNow[z] = Math.floor(R - m * z)
    const rowsK = S * (tn + q * A)
    for (let guard = 0; v < vEnd && guard < 4000; guard++) {
      // one step deeper: about one screen row of sea, never coarser than a few pixels across
      let dv = (den * den) / rowsK
      const cap = (2.5 * den) / S
      if (dv > cap) dv = cap
      if (dv < 0.5) dv = 0.5
      v += dv
      den = 1 + q * v
      m = S / den
      R = Cy - m * (tn * v - A) + EPS
      for (let z = 0; z <= ZTOP; z++) {
        rowPrev[z] = rowNow[z]
        rowNow[z] = Math.floor(R - m * z)
      }
      const inv = den / S
      const ax = c * inv
      const ay = -s * inv
      let wx = bx - Cx * ax - v * s
      let wy = by - Cx * ay - v * c
      // distance haze: colours step towards the horizon colour, a few shades at a time
      let fog = 0
      if (q > 0 && v > fogStart) {
        const f = (v - fogStart) / (viewDist - fogStart)
        fog = Math.min(256, ((Math.sqrt(f) * FOG_STEPS + 0.5) | 0) * (256 / FOG_STEPS)) | 0
      }
      const keep = 256 - fog
      const fine = inv < 1.8
      wx += ax * colLo
      wy += ay * colLo
      for (let px = colLo; px < colHi; px++, wx += ax, wy += ay) {
        // clouds: a stack of up to CK layers floating at CLOUD_ALT
        if (cloudsOn) {
          const cv = _cn[((((wy - cdy + NC) | 0) & NCM) << NCSHIFT) | (((wx - cdx + NC) | 0) & NCM)]
          if (cv !== 0 && cv >> 4 < rankMax) {
            const tk = cv & 15
            const zt = CLOUD_ALT + tk - 1
            let y0 = rowNow[zt]
            let y1 = rowPrev[zt]
            if (y0 < rowLo) y0 = rowLo
            if (y1 > rowHi) y1 = rowHi
            if (y0 < y1) {
              let col = cloudTop[tk - 1]
              if (fog > 0) col = mixHaze(col, keep, fog)
              for (let y = y0, o = y0 * W + px; y < y1; y++, o += W) {
                // the thinnest rim is a checker, so the cloud edge is soft
                if (_fb[o] !== 0 || (tk === 1 && ((px + y) & 1) === 0)) continue
                _fb[o] = col
                _zb[o] = v
              }
            }
            // its underside, when the camera is below the clouds
            let u0 = rowPrev[CLOUD_ALT]
            let u1 = rowNow[CLOUD_ALT]
            if (u0 < u1) {
              if (u0 < rowLo) u0 = rowLo
              if (u1 > rowHi) u1 = rowHi
              const col = fog > 0 ? mixHaze(cloudUnder, keep, fog) : cloudUnder
              for (let y = u0, o = u0 * W + px; y < u1; y++, o += W) {
                if (_fb[o] !== 0 || (tk === 1 && ((px + y) & 1) === 0)) continue
                _fb[o] = col
                _zb[o] = v
              }
            }
            for (let k = tk - 2; k >= 0; k--) {
              let ya = rowPrev[CLOUD_ALT + k + 1]
              let yb = rowPrev[CLOUD_ALT + k]
              if (ya < rowLo) ya = rowLo
              if (yb > rowHi) yb = rowHi
              if (ya >= yb) continue
              let col = cloudSide[k]
              if (fog > 0) col = mixHaze(col, keep, fog)
              for (let y = ya, o = ya * W + px; y < yb; y++, o += W) {
                if (_fb[o] === 0) { _fb[o] = col; _zb[o] = v }
              }
            }
          }
        }
        // terrain
        const gx = wx | 0
        const gy = wy | 0
        const idx = ((gy & NM) << NSHIFT) | (gx & NM)
        const h = _h[idx]
        let cY = _cy[px]
        const yT = rowNow[h]
        let yR = rowPrev[h]
        if (yT >= cY && yR >= cY) continue
        const mat = _m[idx]
        // shadows: clouds, then the jets
        let shade = 0
        if (cloudsOn) {
          const sv = _cn[((((gy + csy) | 0) & NCM) << NCSHIFT) | (((gx + csx) | 0) & NCM)]
          if ((sv & 15) > 1 && sv >> 4 < rankMax) shade = 1
        }
        if (shade === 0 && nShadow > 0) {
          for (let j = 0; j < nShadow; j++) {
            const dx = gx - sjx[j] + sx * h
            const dy = gy - sjy[j] + sy * h
            if (dx > -reach && dx < reach && dy > -reach && dy < reach) {
              const a = (dx * srx[j] + dy * sry[j]) * sic[j]
              const b = (dx * sfx[j] + dy * sfy[j]) * isc
              const i = Math.floor(a + JET_W / 2)
              const k = Math.floor(PIV_K - b + 0.5)
              if (i >= 0 && i < JET_W && k >= 0 && k < JET_L && shadowMask[k * JET_W + i] === 1) { shade = 1; break }
            }
          }
        }
        let top
        let side
        if (mat < 4) {
          top = shade ? topShade[mat] : topLit[mat]
          if (mat === 3) {
            if (((_nz[((gy & 255) << 8) | (gx & 255)] + tF) & 255) < 120) top = shade ? topShade[2] : foamCol
          } else if (shade === 0 && fine) {
            const n1 = _nz[((gy & 255) << 8) | (((gx + tW1) >> 2) & 255)]
            if (n1 > 243) {
              const n2 = _nz[(((gy + 91) & 255) << 8) | (((gx + 1024 - tW2) >> 2) & 255)]
              if (n2 > 128) top = n1 > 252 ? sparkB : sparkA
            }
          }
          side = top
        } else {
          top = shade ? topShade[mat] : topLit[mat]
          side = shade ? sideShade[mat] : sideLit[mat]
        }
        if (fog > 0) {
          top = mixHaze(top, keep, fog)
          side = mixHaze(side, keep, fog)
        }
        // the wall of this column, where it starts …
        if (yR < cY) {
          if (yR < rowLo) yR = rowLo
          for (let y = yR, o = yR * W + px; y < cY; y++, o += W) {
            if (_fb[o] === 0) { _fb[o] = side; _zb[o] = v }
          }
          cY = yR
        }
        // … and its top, up to where it ends (unless the camera is below it)
        if (yT < cY) {
          const y0 = yT < rowLo ? rowLo : yT
          for (let y = y0, o = y0 * W + px; y < cY; y++, o += W) {
            if (_fb[o] === 0) { _fb[o] = top; _zb[o] = v }
          }
          cY = yT
        }
        _cy[px] = cY
      }
    }
  }

  // whatever the ground left empty: sky above the horizon, haze below it
  function drawSky() {
    if (vC === 0 && vK === 0) return
    const _fb = fb
    const q = vQ
    const horizon = q > 1e-7 ? vCy - (vS * vTan) / q : -1e9
    const hz = horizon > H ? H : Math.floor(horizon)
    const focal = q > 1e-7 ? vS / q : 1e9
    const tod = p.timeOfDay
    // sun or moon, low over the horizon, opposite the shadows
    if (hz > 0 && tod !== 'day') {
      const sl = Math.sqrt(sunX * sunX + sunY * sunY) || 1
      const dx = -sunX / sl
      const dy = -sunY / sl
      const du = dx * vCos - dy * vSin
      const dv = -(dx * vSin + dy * vCos)
      if (dv > 0.2) {
        const rad = tod === 'sunset' ? W * 0.05 : W * 0.022
        const cxs = vCx + (focal * du) / dv
        const cys = horizon - (focal * (tod === 'sunset' ? 0.12 : 0.3)) / dv
        const reach = rad * 1.9
        const xa = Math.max(0, Math.floor(cxs - reach))
        const xb = Math.min(W - 1, Math.ceil(cxs + reach))
        const ya = Math.max(0, Math.floor(cys - reach))
        const yb = Math.min(hz - 1, Math.ceil(cys + reach))
        for (let y = ya; y <= yb; y++) {
          for (let x = xa; x <= xb; x++) {
            const o = y * W + x
            if (_fb[o] !== 0) continue
            const d = Math.sqrt((x - cxs) * (x - cxs) + (y - cys) * (y - cys)) / rad
            if (d < 1) _fb[o] = sunCol
            else if (d < 1.9 && (1.9 - d) * 14 > BAYER[((y & 3) << 2) | (x & 3)]) _fb[o] = sunGlow
          }
        }
      }
    }
    const span = frameH * 0.75
    const starOff = ((vYaw * focal) | 0) & 4095
    const stars = tod === 'night'
    for (let y = rowLo; y < rowHi; y++) {
      let o = y * W
      o += colLo
      if (y < hz) {
        const t = ((hz - y) / span) * (NSKY - 1)
        for (let x = colLo; x < colHi; x++, o++) {
          if (_fb[o] !== 0) continue
          let b = t | 0
          const edge = (t - b - 0.7) * 3.4
          if (edge > 0 && edge * 16 > BAYER[((y & 3) << 2) | (x & 3)]) b++
          if (b >= NSKY) b = NSKY - 1
          _fb[o] = stars && b > 1 && hash8(((x + starOff) & 4095) * 73 + y * 9973) < 2 ? sunCol : skyPal[b]
        }
      } else {
        for (let x = colLo; x < colHi; x++, o++) if (_fb[o] === 0) _fb[o] = hazeCol
      }
    }
  }

  function drawTrails() {
    if (!p.trails) return
    const LIFE = 2.6
    const _fb = fb
    const _zb = zbuf
    for (const j of wreck ? [...jets, wreck] : jets) {
      if (j === jets[0] && jetFade < 0.5) continue
      const g = j.g
      for (let w = 0; w < 2; w++) {
        const tr = j.trail[w]
        let prevX = 0
        let prevY = 0
        let has = false
        for (let n = 0; n < j.trailLen; n++) {
          const o = ((j.trailHead - 1 - n + TRAIL_N * 2) % TRAIL_N) * 4
          const age = (time - tr[o + 3]) / (LIFE * (0.3 + 0.7 * g))
          if (age >= 1) break
          if (!project(tr[o], tr[o + 1], tr[o + 2])) { has = false; continue }
          const sxp = prX
          const syp = prY
          if (has) {
            // short line from the previous point, thicker when it is close to the camera
            const span = Math.max(Math.abs(sxp - prevX), Math.abs(syp - prevY))
            if (span < 600) {
              const steps = Math.max(1, Math.ceil(span))
              const alpha = age < 0.5 ? 1 : (1 - age) * 2
              const col = age < 0.25 ? trailPal[0] : age < 0.6 ? trailPal[1] : trailPal[2]
              const thick = prM > 2.4 ? 2 : 1
              for (let k = 0; k < steps; k++) {
                const x0 = Math.round(prevX + ((sxp - prevX) * k) / steps)
                const y0 = Math.round(prevY + ((syp - prevY) * k) / steps)
                for (let yy = y0; yy < y0 + thick; yy++) {
                  for (let xx = x0; xx < x0 + thick; xx++) {
                    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
                    if (_zb[yy * W + xx] < prV - 1) continue // behind a hill or a cloud
                    if (alpha * 16 > BAYER[((yy & 3) << 2) | (xx & 3)]) _fb[yy * W + xx] = col
                  }
                }
              }
            }
          }
          prevX = sxp
          prevY = syp
          has = true
        }
      }
    }
  }

  // dark exhaust smoke: soft round puffs that swell, pale and thin out as they hang in the air
  /** the foam of a wake, lying on the water: a V that opens and fades behind the jet that made it */
  function drawWake() {
    const sc = jetSize()
    // (seen from behind, what lies flat on the sea is squashed; from overhead it is not)
    const flat = vQ > 1e-6 ? clamp(vTan / Math.sqrt(1 + vTan * vTan), 0.22, 1) : 1
    for (let i = 0; i < WAKE_N; i++) {
      const o = i * WAKE_F
      const age = time - wake[o + 2]
      if (age < 0 || age >= WAKE_LIFE) continue
      const u = age / WAKE_LIFE
      const s = wake[o + 3]
      const wide = (3 + 27 * Math.pow(u, 0.7)) * sc * (0.7 + 0.3 * s)
      for (let side = -1; side <= 1; side++) {
        if (side === 0 && u > 0.45) continue // (the churned strip down its middle settles first)
        const x = wake[o] + wake[o + 4] * wide * side
        const y = wake[o + 1] + wake[o + 5] * wide * side
        const at = (((y | 0) & NM) << NSHIFT) | ((x | 0) & NM)
        if (matMap[at] >= 4 || !project(x, y, heightMap[at] + 0.6)) continue
        const rx = Math.max(1, (side === 0 ? 2.6 - 2 * u : 1.7 + 3.4 * u) * sc * prM * (0.7 + 0.5 * s))
        const ry = Math.max(0.7, rx * flat)
        const k = Math.min(1, s * 1.25) * (side === 0 ? 0.75 * (1 - u / 0.45) : Math.pow(1 - u, 1.3)) * (u < 0.03 ? u / 0.03 : 1)
        const strength = Math.round(235 * k)
        if (strength < 8) continue
        const x0 = Math.max(0, Math.floor(prX - rx))
        const x1 = Math.min(W - 1, Math.ceil(prX + rx))
        const y0 = Math.max(0, Math.floor(prY - ry))
        const y1 = Math.min(H - 1, Math.ceil(prY + ry))
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            const d2 = ((xx - prX) / rx) ** 2 + ((yy - prY) / ry) ** 2
            if (d2 > 1) continue
            const to = yy * W + xx
            if (zbuf[to] < prV - 2) continue
            // broken up at its edge, and more and more as it fades: foam, not paint
            if (BAYER[((yy & 3) << 2) | (xx & 3)] < d2 * 7 + u * 12 - 5) continue
            fb[to] = blend(fb[to], foamCol, strength)
          }
        }
      }
    }
  }
  function drawSmoke() {
    const _fb = fb
    const _zb = zbuf
    const night = p.timeOfDay === 'night' ? 0.55 : 1
    for (let i = 0; i < SMOKE_N; i++) {
      const o = i * SMOKE_F
      const life = smoke[o + 8]
      const kind = smoke[o + 9] // 0 exhaust, 1 white (a rocket's trail, steam), 2 the black smoke of a wreck
      if (life <= 0) continue
      const age = time - smoke[o + 3]
      if (age < 0 || age >= life) continue
      const u = age / life
      // the exhaust shoves it backwards at first; then it just hangs and rises a little
      const push = (1 - Math.exp(-age * 5)) / 5
      if (!project(smoke[o] + smoke[o + 5] * push, smoke[o + 1] + smoke[o + 6] * push, smoke[o + 2] + age * (kind === 2 ? 15 : kind === 1 ? 5 : 2.5))) continue
      const rad = Math.max(0.8, smoke[o + 4] * (1 + 2.4 * u) * prM)
      if (rad > 60) continue
      const alpha = smoke[o + 7] * (1 - u) * (1 - u) * (u < 0.08 ? u / 0.08 : 1) * night
      const shade = kind === 1 ? 238 - 44 * u : kind === 2 ? 16 + 58 * u : 26 + 70 * u
      const cr = shade
      const cg = shade + 1
      const cb = shade + 7
      const x0 = Math.max(0, Math.floor(prX - rad))
      const x1 = Math.min(W - 1, Math.ceil(prX + rad))
      const y0 = Math.max(0, Math.floor(prY - rad))
      const y1 = Math.min(H - 1, Math.ceil(prY + rad))
      const inv = 1 / (rad * rad)
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d2 = ((x - prX) * (x - prX) + (y - prY) * (y - prY)) * inv
          if (d2 > 1) continue
          const at = y * W + x
          if (_zb[at] < prV - 1) continue
          const k = (alpha * (1 - d2 * 0.7) * 256) | 0
          const bg = _fb[at]
          const r = ((bg & 255) * (256 - k) + cr * k) >> 8
          const g = (((bg >> 8) & 255) * (256 - k) + cg * k) >> 8
          const b = (((bg >> 16) & 255) * (256 - k) + cb * k) >> 8
          _fb[at] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
        }
      }
    }
  }

  function drawJet(j, index) {
    if (j.away) return
    const lidUp = !j.glass || j.lid > 0 // the canopy is off or open: its glass is not in its usual place
    const c = vCos
    const s = vSin
    const q = vQ
    const S = vS
    const tn = vTan
    const ax = axes(j)
    const sc = jetSize()
    // the jet's own axes in view space, per voxel: across the screen (U), into it (V), up (W)
    const rU = (ax.rx * c - ax.ry * s) * sc
    const rV = -(ax.rx * s + ax.ry * c) * sc
    const rW = ax.rz * sc
    const fU = (ax.fx * c - ax.fy * s) * sc
    const fV = -(ax.fx * s + ax.fy * c) * sc
    const fW = ax.fz * sc
    const uU = (ax.ux * c - ax.uy * s) * sc
    const uV = -(ax.ux * s + ax.uy * c) * sc
    const uW = ax.uz * sc
    const dx = j.x - cam.x
    const dy = j.y - cam.y
    const cU = dx * c - dy * s
    const cV = -(dx * s + dy * c)
    const cW = j.z - cam.alt
    // going into the cockpit, the camera moves into the leader, which fades away
    const fade = index <= 0 ? jetFade : 1
    if (fade < 0.004) return
    const fading = fade < 1
    const _bg = backdrop
    const den0 = 1 + q * cV
    if (den0 < 0.2) return
    const m0 = S / den0
    const cx = vCx + m0 * cU
    const cy = vCy - m0 * (cW + tn * cV)
    const far = JET_L * sc * m0 + 40
    if (cx < -far || cy < -far - H || cx > W + far || cy > H + far) return
    // screen steps for one voxel along the wing and along the fuselage, at the jet's centre
    const prx = m0 * rU
    const pry = -m0 * (rW + tn * rV)
    const pfx = m0 * fU
    const pfy = -m0 * (fW + tn * fV)
    const _fb = fb
    const _mk = jetMask
    const _zb = zbuf
    // light: which way each half of the jet faces the sun
    const lx = -sunX
    const ly = -sunY
    const lz = 1.1
    const ll = Math.sqrt(lx * lx + ly * ly + lz * lz)
    const night = p.timeOfDay === 'night'
    const litAt = night ? 0.74 : 0.9
    const dimAt = night ? 0.4 : 0.66
    const lit = (side) => {
      const nx = ax.ux + side * 0.4 * ax.rx
      const ny = ax.uy + side * 0.4 * ax.ry
      const nz2 = ax.uz + side * 0.4 * ax.rz
      const b = (nx * lx + ny * ly + nz2 * lz) / (ll * Math.sqrt(nx * nx + ny * ny + nz2 * nz2))
      if (j.foe) return b > litAt ? foePalLit : b < dimAt ? foePalDim : foePal
      return b > litAt ? jetPalLit : b < dimAt ? jetPalDim : jetPal
    }
    const palL = lit(-1)
    const palR = lit(1)
    let x0 = W
    let y0 = H
    let x1 = -1
    let y1 = -1
    // several samples per voxel, more the larger it is drawn, so a turned slice has no pin-holes
    const big = (sc * S) / Math.max(0.2, den0 - q * JET_L * 0.6 * sc)
    const ns = clamp(Math.ceil(big * 2 - 0.24), 2, 8)
    // … and each voxel is as thick as it is wide: where the slices would come apart on screen (the
    // jet seen from its side, climbing or diving steeply), the gap between one and the next is filled
    const pux = m0 * uU
    const puy = -m0 * (uW + tn * uV)
    const nu = clamp(Math.ceil(Math.hypot(pux, puy) * 1.15), 1, 8)
    let nOff = 0
    for (let i = 0; i < ns; i++) {
      for (let k = 0; k < ns; k++) {
        const oi = (i + 0.5) / ns - 0.5
        const ok = (k + 0.5) / ns - 0.5
        for (let e = 0; e < nu; e++) {
          const ou = (e + 0.5) / nu - 0.5
          offX[nOff] = oi * prx + ok * pfx + ou * pux
          offY[nOff] = oi * pry + ok * pfy + ou * puy
          nOff++
        }
      }
    }
    // slices are drawn from the one farthest from eye level to the nearest, so nearer ones cover
    let eye
    if (q < 1e-6) eye = tn * uW - uV >= 0 ? 1e9 : -1e9
    else eye = (-cU * uU + (-1 / q - cV) * uV + (tn / q - cW) * uW) / (sc * sc)
    for (let y = 0; y < JET_H; y++) {
      sliceOrder[y] = y
      sliceKey[y] = Math.abs((y - PIV_Y) * spreadNow - eye)
    }
    for (let i = 1; i < JET_H; i++) {
      const y = sliceOrder[i]
      const key = sliceKey[y]
      let k = i - 1
      while (k >= 0 && sliceKey[sliceOrder[k]] < key) { sliceOrder[k + 1] = sliceOrder[k]; k-- }
      sliceOrder[k + 1] = y
    }
    const it = j.foe ? 99 : introT - index * 0.25
    const flameOn = burn > 0.02 && p.afterburner > 0.01 && spreadNow < 2.6
    const flick = 0.82 + 0.18 * Math.sin(time * 47 + index * 2) * Math.sin(time * 31)
    const flameLen = (flameLength() * flick) / (j.foe ? 1 + 1.6 * boost : 1) // (the player's thrusters are his own)
    const flameWide = 1.15 * (1 + 0.22 * boost)
    const behind = vC + vK > 0.5 // seen from behind, the flames sit in front of the whole tail
    const bend = flameBend()
    const arch = climbTilt * 0.35
    const smooth = p.flameStyle === 'realistic' && !j.foe // (the smooth flames are kept for the player's own flight)
    const dropOf = (y) => {
      // the intro: slices fall in from the top one after another and land on the stack
      if (it >= 2) return 0
      const tt = (it - (y - firstSlice) * 0.07) / 0.36
      if (tt <= 0) return NaN
      return tt < 1 ? -(1 - tt * tt) * ((H >> 1) + 44) : 0
    }
    // afterburner, sliced the same way so it stacks with the jet
    const flames = (y, bU, bV, bW, drop) => {
      const dyv = (y + 0.5 - ENGINE_Y) / (ENGINE_R * 1.25)
      if (dyv <= -1 || dyv >= 1 || flameLen <= 0.5) return
      const prof = Math.sqrt(1 - dyv * dyv)
      for (let e = -1; e <= 1; e += 2) {
        for (let t = 0; t < flameLen; t += 0.5) {
          const u = t / flameLen
          const rad = ENGINE_R * flameWide * Math.pow(1 - u, 0.75) * prof * (0.9 + 0.2 * Math.sin(t * 1.9 - time * 40 + e))
          if (rad < 0.2) continue
          const b = PIV_K - NOZZLE_K - t
          // the plume trails round the inside of a turn, and along the arc of a climb or dive
          const curl = (t * t) / flameLen
          const swing = bend * curl
          const lift = arch * curl
          for (let a = -rad; a <= rad; a += 0.5) {
            const aa = e * ENGINE_A + a + swing
            const V = bV + aa * rV + b * fV + lift * uV
            const den = 1 + q * V
            if (den < 0.2) continue
            const m = S / den
            const heat = u * 0.9 + (Math.abs(a) / (rad + 0.01)) * 0.55 + Math.abs(dyv) * 0.3 - 0.16 * boost
            const col = flamePal[heat < 0.28 ? 0 : heat < 0.5 ? 1 : heat < 0.75 ? 2 : heat < 1.0 ? 3 : heat < 1.25 ? 4 : 5]
            const fx = Math.round(vCx + m * (bU + aa * rU + b * fU + lift * uU))
            const fy = Math.round(vCy - m * (bW + aa * rW + b * fW + lift * uW + tn * V) + drop)
            const size = Math.max(1, Math.ceil(m * sc * 0.55))
            const deep = Math.max(size, Math.ceil(Math.abs(puy) * (m / m0) * 1.1)) // (as tall as the gap to the next slice of it)
            for (let yy = fy - ((deep - size) >> 1); yy < fy + size + ((deep - size + 1) >> 1); yy++) {
              for (let xx = fx; xx < fx + size; xx++) {
                if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
                const at = yy * W + xx
                if (_zb[at] < V - 1) continue
                if (fading && _mk[at] === 0) _bg[at] = _fb[at]
                _fb[at] = col
                _mk[at] = 2 // flame: never outlined
              }
            }
            if (fx < x0) x0 = fx
            if (fx + size > x1) x1 = fx + size
            if (fy < y0) y0 = fy
            if (fy + size > y1) y1 = fy + size
          }
        }
      }
    }
    // a smooth flame is only measured here: where its nozzle, a point straight behind it and its
    // tip (which swings out in a turn) fall in the frame, and how much of it the world hides
    const smoothFlames = () => {
      // (the fire flickers by itself, so its length is held much steadier than the pixel flames')
      const L = flameLength() * (0.94 + 0.3 * (flick - 0.82)) * FLAME_GROW
      const wide = ENGINE_R * (1 + 0.12 * boost) * 1.5
      const show = fade * (1 - cockpitIn())
      if (L <= 0.6 || show < 0.01) return
      const hgt = (ENGINE_Y - 0.5 - PIV_Y) * spreadNow
      const bU = cU + hgt * uU
      const bV = cV + hgt * uV
      const bW = cW + hgt * uW
      for (let e = -1; e <= 1; e += 2) {
        if (flameOut.count >= FLAME_MAX) return
        const o = flameOut.count * FLAME_F
        let inView = true
        let mA = 0
        let mC = 0
        for (let n = 0; n < 3; n++) {
          const curl = n === 2 ? L : 0
          const aa = e * ENGINE_A + bend * curl
          const b = PIV_K - NOZZLE_K - n * 0.5 * L
          const lift = arch * curl
          const V = bV + aa * rV + b * fV + lift * uV
          const den = 1 + q * V
          if (den < 0.2) { inView = false; break }
          const m = S / den
          flameData[o + n * 2] = vCx + m * (bU + aa * rU + b * fU + lift * uU)
          flameData[o + n * 2 + 1] = vCy - m * (bW + aa * rW + b * fW + lift * uW + tn * V)
          flameV[n] = V
          if (n === 0) mA = m
          else if (n === 2) mC = m
        }
        if (!inView) continue
        const rad = wide * sc * mA
        const slot = ((index < 0 ? 2 : index) * 2 + (e > 0 ? 1 : 0)) % FLAME_MAX
        for (let n = 0; n < 3; n++) {
          const mid = n === 1
          const px = mid ? 0.25 * flameData[o] + 0.5 * flameData[o + 2] + 0.25 * flameData[o + 4] : flameData[o + n * 2]
          const py = mid ? 0.25 * flameData[o + 1] + 0.5 * flameData[o + 3] + 0.25 * flameData[o + 5] : flameData[o + n * 2 + 1]
          const V = mid ? 0.25 * flameV[0] + 0.5 * flameV[1] + 0.25 * flameV[2] : flameV[n]
          let open = 0
          for (let k = 0; k < 5; k++) {
            const xx = Math.round(px + (k === 1 ? -rad : k === 2 ? rad : 0))
            const yy = Math.round(py + (k === 3 ? -rad : k === 4 ? rad : 0))
            if (xx < 0 || yy < 0 || xx >= W || yy >= H || _zb[yy * W + xx] >= V - 1) open++
          }
          // eased, so a flame slips behind a cloud rather than blinking out
          const at = slot * 3 + n
          flameSeen[at] += (open / 5 - flameSeen[at]) * 0.3
          flameData[o + 10 + n] = flameSeen[at]
        }
        flameData[o + 6] = rad
        flameData[o + 7] = mC / mA
        flameData[o + 8] = boost
        flameData[o + 9] = show
        flameData[o + 13] = slot
        flameData[o + 14] = clamp(p.afterburner, 0, 1)
        flameData[o + 15] = L / wide
        flameOut.count++
      }
    }
    for (let n = 0; n < JET_H; n++) {
      const y = sliceOrder[n]
      const cnt = sliceC[y].length
      if (cnt === 0) continue
      const drop = dropOf(y)
      if (drop !== drop) continue
      const hgt = (y - PIV_Y) * spreadNow
      const bU = cU + hgt * uU
      const bV = cV + hgt * uV
      const bW = cW + hgt * uW
      const A = sliceA[y]
      const B = sliceB[y]
      const C = sliceC[y]
      for (let v = 0; v < cnt; v++) {
        const a = A[v]
        const b = B[v]
        if (lidUp && (C[v] - 1) >> 4 === 2) continue
        const V = bV + a * rV + b * fV
        const den = 1 + q * V
        if (den < 0.2) continue
        const m = S / den
        const col = a < 0 ? palL[C[v]] : palR[C[v]]
        const px = vCx + m * (bU + a * rU + b * fU)
        const py = vCy - m * (bW + a * rW + b * fW + tn * V) + drop
        const k = m / m0
        let x = 0
        let yy = 0
        for (let o = 0; o < nOff; o++) {
          x = Math.round(px + offX[o] * k)
          yy = Math.round(py + offY[o] * k)
          if (x < 0 || yy < 0 || x >= W || yy >= H) continue
          const at = yy * W + x
          if (_zb[at] < V - 1) continue // a hill or a cloud is in front
          if (fading && _mk[at] === 0) _bg[at] = _fb[at]
          _fb[at] = col
          _mk[at] = 1
        }
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (yy < y0) y0 = yy
        if (yy > y1) y1 = yy
      }
      if (flameOn && !smooth && !behind) flames(y, bU, bV, bW, drop)
    }
    if (flameOn && smooth) smoothFlames()
    if (flameOn && !smooth && behind) {
      for (let y = 0; y < JET_H; y++) {
        const drop = dropOf(y)
        if (drop !== drop) continue
        const hgt = (y - PIV_Y) * spreadNow
        flames(y, cU + hgt * uU, cV + hgt * uV, cW + hgt * uW, drop)
      }
    }
    // the canopy standing open: its glass, swung up about its back edge
    if (j.glass && j.lid > 0) {
      const th = j.lid * 1.15
      const ct = Math.cos(th)
      const st = Math.sin(th)
      // the pilot, if he is in this jet (or falling into it) and its raised canopy is nearer the
      // camera than he is: he goes in first, and the glass over him
      const half = (lidB1 - lidB0) / 2
      const glaze = Math.round(150 + 106 * (1 - j.lid) * (1 - j.lid)) // (clear while it is up; as it shuts, the sky on it hides him)
      const lidV = cV + (lidY0 - PIV_Y + half * st) * uV + (lidB0 + half * ct) * fV
      const seatV = cV + (SEAT_H + 0.5) * uV + SEAT_B * fV
      if (j === jets[0] && !fading && (ej === EJ_DROP || ej === EJ_SEAL) && vK <= 0.2 && lidV < seatV) {
        pilotAboard(_mk)
        if (painter.right >= painter.left) {
          x0 = Math.min(x0, Math.max(0, painter.left))
          y0 = Math.min(y0, Math.max(0, painter.top))
          x1 = Math.max(x1, Math.min(W - 1, painter.right))
          y1 = Math.max(y1, Math.min(H - 1, painter.bottom))
        }
      }
      for (let y = lidY0; y < JET_H; y++) {
        const A = sliceA[y]
        const B = sliceB[y]
        const C = sliceC[y]
        for (let v = 0; v < C.length; v++) {
          if ((C[v] - 1) >> 4 !== 2) continue
          const db = B[v] - lidB0
          const dh = y - lidY0
          const a = A[v]
          const b = lidB0 + db * ct - dh * st
          const hgt = (lidY0 - PIV_Y + db * st + dh * ct) * spreadNow
          const V = cV + hgt * uV + a * rV + b * fV
          const den = 1 + q * V
          if (den < 0.2) continue
          const m = S / den
          const col = a < 0 ? palL[C[v]] : palR[C[v]]
          const frame = ((C[v] - 1) & 15) <= 1
          const px = vCx + m * (cU + hgt * uU + a * rU + b * fU)
          const py = vCy - m * (cW + hgt * uW + a * rW + b * fW + tn * V)
          const k = m / m0
          let x = 0
          let yy = 0
          for (let o = 0; o < nOff; o++) {
            x = Math.round(px + offX[o] * k)
            yy = Math.round(py + offY[o] * k)
            if (x < 0 || yy < 0 || x >= W || yy >= H) continue
            const at = yy * W + x
            if (_zb[at] < V - 1) continue
            if (fading && _mk[at] === 0) _bg[at] = _fb[at]
            // its frame is solid; the glass itself is seen through (once: a pixel is glazed one pane deep)
            if (frame) { _fb[at] = col; _mk[at] = 1 } else if (_mk[at] !== 5) { _fb[at] = blend(_fb[at], col, glaze); _mk[at] = 5 }
          }
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (yy < y0) y0 = yy
          if (yy > y1) y1 = yy
        }
      }
    }
    // a dark 1 px outline around the whole stack, so it reads over any ground
    x0 = Math.max(1, x0 - 4)
    y0 = Math.max(1, y0 - 4)
    x1 = Math.min(W - 2, x1 + 4)
    y1 = Math.min(H - 2, y1 + 4)
    for (let yy = y0; yy <= y1; yy++) {
      let o = yy * W + x0
      for (let x = x0; x <= x1; x++, o++) {
        if (fading) {
          // let what was behind show through
          if (_mk[o] !== 0) {
            const bg = _bg[o]
            const fg = _fb[o]
            const k = (fade * 256) | 0
            const r = ((bg & 255) * (256 - k) + (fg & 255) * k) >> 8
            const g = (((bg >> 8) & 255) * (256 - k) + ((fg >> 8) & 255) * k) >> 8
            const b = (((bg >> 16) & 255) * (256 - k) + ((fg >> 16) & 255) * k) >> 8
            _fb[o] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
          }
        } else if (_mk[o] === 0 && ((_mk[o - 1] | _mk[o + 1] | _mk[o - W] | _mk[o + W]) & 1) === 1 && _zb[o] >= cV - 2) {
          _fb[o] = outlineCol
        }
      }
    }
    for (let yy = y0 - 1; yy <= y1 + 1; yy++) _mk.fill(0, yy * W + x0 - 1, yy * W + x1 + 2)
  }

  // ── the cockpit view
  //
  // The world is drawn on a larger square sheet and then turned, so the horizon tilts as the
  // jet banks. On top of that come the head-up display, the canopy frame and the instruments.

  /** turn the square sheet by the camera's roll into the frame */
  function turnSheet() {
    const c = Math.cos(vRoll)
    const s = Math.sin(vRoll)
    const half = sheetSide >> 1
    const cx = W >> 1
    const _fb = fb
    const _sh = sheet
    const side = sheetSide
    for (let y = 0; y < H; y++) {
      const dy = y - turnY
      let sx = half - c * cx - s * dy + 0.5
      let sy = half - s * cx + c * dy + 0.5
      let o = y * W
      for (let x = 0; x < W; x++, o++, sx += c, sy += s) _fb[o] = _sh[(sy | 0) * side + (sx | 0)]
    }
  }

  // the cockpit's fixed metalwork is painted once per size and colour scheme
  function cockpitArt() {
    if (!cockpit || cockpit.W !== W || cockpit.H !== H) {
      const body = []
      const hot = []
      for (let t = 0; t < 9; t++) body.push(jetPal[1 + t])
      for (let t = 0; t < 6; t++) hot.push(jetPal[17 + t])
      cockpit = buildCockpit(W, H, { body, hot })
    }
    return cockpit
  }
  const radarLand = (right, ahead) => {
    const lead = pilotAt()
    const sn = Math.sin(lead.yaw)
    const cs = Math.cos(lead.yaw)
    const m = matMap[((((lead.y + right * sn - ahead * cs) | 0) & NM) << NSHIFT) | (((lead.x + right * cs + ahead * sn) | 0) & NM)]
    return m >= 12 ? 3 : m >= 4 ? 2 : m >= 2 ? 1 : 0
  }
  const blips = []
  function drawCockpitView() {
    const lead = pilotAt()
    // the panel and the hoop slide into place over the later part of the move
    const inPlace = cockpitIn()
    if (inPlace <= 0) return
    const h = clamp((vK - 0.72) / 0.28, 0, 1)
    const sn = Math.sin(lead.yaw)
    const cs = Math.cos(lead.yaw)
    blips.length = 0
    for (let i = 1; i < jets.length; i++) {
      const ex = jets[i].x - lead.x
      const ey = jets[i].y - lead.y
      blips.push(ex * cs + ey * sn, ex * sn - ey * cs)
    }
    for (const f of foes) {
      if (f.state !== 0) continue
      const ex = f.j.x - lead.x
      const ey = f.j.y - lead.y
      blips.push(ex * cs + ey * sn, ex * sn - ey * cs)
    }
    // where the sun is from the seat: to one side or the other, ahead or behind
    const tod = p.timeOfDay
    const sl = Math.sqrt(sunX * sunX + sunY * sunY) || 1
    const sunFront = (-sunX * sn + sunY * cs) / sl
    const sunSide = (-sunX * cs - sunY * sn) / sl
    drawCockpit(fb, cockpitArt(), {
      time,
      inPlace,
      hud: h * h * (3 - 2 * h),
      roll: vRoll,
      pitch: lead.pitch,
      heading: lead.yaw,
      speed: speedNow,
      speedMax: p.speed * clamp(p.boost, 1, 4) * 1.08,
      alt: lead.z,
      altMax: Math.max(p.altitude, clamp(p.ceiling, 20, 6000)),
      climb: clamp(climbTilt / 0.5, -1, 1),
      turn: clamp(lead.yawRate / Math.max(0.1, p.agility), -1, 1),
      boost,
      pivotY,
      horizonY: vCy,
      focal: vS / vQ,
      // the head sways with the flying, and shudders while the thrusters are open
      headX,
      headY: headY + (boost > 0.2 ? ((((time * 30) | 0) & 1) - 0.5) * 1.5 * boost : 0),
      // light pours over the pilot's shoulder with the sun behind; the hood shades the panel with it ahead
      sunSide,
      sunReach: 0.72 - 0.28 * sunFront,
      sunColor: tod === 'sunset' ? SUN_SUNSET : tod === 'night' ? SUN_NIGHT : SUN_DAY,
      sunPower: tod === 'sunset' ? 1.1 : tod === 'night' ? 0.45 : 1,
      land: radarLand,
      blips,
      jet: jetTop,
    })
  }

  function render() {
    if (W === 0) return bytes
    updateView()
    frameH = H
    flameOut.count = 0
    aboardDone = false
    // in the cockpit the view rolls with the jet, so the world goes onto the square sheet first
    const rolled = vK > 0 || vRoll !== 0
    const w0 = W
    const h0 = H
    const f0 = fb
    const c0 = colY
    const m0 = jetMask
    const z0 = zbuf
    const b0 = backdrop
    const y0 = vCy
    if (rolled) {
      W = sheetSide
      H = sheetSide
      fb = sheet
      colY = sheetColY
      jetMask = sheetMask
      zbuf = sheetZ
      backdrop = sheetBackdrop
      const half = sheetSide >> 1
      vCx = half
      turnY = clamp(Math.round(pivotY * vK + y0 * (1 - vK)), 0, h0)
      vCy = half + (y0 - turnY)
      // only the part of the sheet the turned frame can see is drawn
      const c = Math.abs(Math.cos(vRoll))
      const s = Math.abs(Math.sin(vRoll))
      colLo = Math.max(0, half - Math.ceil(c * (w0 / 2) + s * Math.max(turnY, h0 - turnY)) - 2)
      colHi = Math.min(sheetSide, half + Math.ceil(c * (w0 / 2) + s * Math.max(turnY, h0 - turnY)) + 2)
      // (the frame may be turned right over, so either end of it may be on either side of the pivot)
      const tall = Math.max(turnY, h0 - turnY)
      rowLo = Math.max(0, half - Math.ceil(c * tall + s * (w0 / 2)) - 2)
      rowHi = Math.min(sheetSide, half + Math.ceil(c * tall + s * (w0 / 2)) + 2)
    } else {
      colLo = 0
      colHi = W
      rowLo = 0
      rowHi = H
    }
    drawWorld()
    drawSky()
    drawTrails()
    drawWake()
    drawSmoke()
    // far jets first
    drawWreckage()
    if (wreck) drawJet(wreck, -1)
    const order = jets.map((j, i) => ({ j, i, d: (j.x - cam.x) * vSin + (j.y - cam.y) * vCos }))
    for (let i = 0; i < foes.length; i++) {
      const j = foes[i].j
      if (foes[i].state !== 2) order.push({ j, i: 3 + i, d: (j.x - cam.x) * vSin + (j.y - cam.y) * vCos })
    }
    order.sort((a, b) => a.d - b.d)
    for (const e of order) drawJet(e.j, e.i)
    drawWeapons()
    drawPilot()
    drawSights(!rolled)
    if (rolled) {
      W = w0
      H = h0
      fb = f0
      colY = c0
      jetMask = m0
      zbuf = z0
      backdrop = b0
      vCx = W >> 1
      vCy = y0
      turnSheet()
      // the smooth flames were placed on the sheet: turn them with it
      const half = sheetSide >> 1
      const rc = Math.cos(vRoll)
      const rs = Math.sin(vRoll)
      for (let i = 0; i < flameOut.count; i++) {
        for (let n = 0; n < 3; n++) {
          const o = i * FLAME_F + n * 2
          const dx = flameData[o] - half
          const dy = flameData[o + 1] - half
          flameData[o] = (W >> 1) + rc * dx + rs * dy
          flameData[o + 1] = turnY - rs * dx + rc * dy
        }
      }
      // from the seat, cloud streams past the glass while the jet is in one (the cockpit is drawn over it)
      if (mist > 0.01 && vK > 0.5) {
        const k = Math.round(215 * mist * (0.85 + 0.15 * Math.sin(time * 23)))
        for (let o = 0; o < W * H; o++) fb[o] = blend(fb[o], MIST, k)
      }
      drawCockpitView()
    }
    drawThreat()
    // the finish: an explosion's flash, glow, colour, darkened corners, grain
    look.bloom = p.bloom
    look.vivid = p.vivid + 0.35 * slowAmt
    look.vignette = p.vignette + 0.6 * slowAmt
    look.grain = p.grain
    look.flash = flash * clamp(p.flash, 0, 1)
    post.apply(fb, W, H, look)
    return bytes
  }

  return {
    setParams,
    resize,
    pointerMove,
    pointerLeave,
    press,
    release,
    replayIntro,
    toggleView,
    /** a roll, as a click gives (for a game controller's button) */
    roll() { if (introT > 1.9) startRoll() },
    /** where everyone is, for a map or a test: the lead jet, each enemy (state 0 is flying), and the lock */
    get radar() {
      const lead = jets[0]
      return {
        me: { x: lead.x, y: lead.y, z: lead.z, yaw: lead.yaw, pitch: lead.pitch },
        foes: foes.map((f) => ({ x: f.j.x, y: f.j.y, z: f.j.z, state: f.state, hp: f.hp, atk: f.atk })),
        lock: lockOn,
        locked: lockOn >= 0 && lockT >= LOCK_TIME,
        attackers: foes.filter((f) => f.atk && f.state === 0).length,
      }
    },
    /** enemies shot down so far (since the player was last shot down himself) */
    get kills() { return kills },
    /** how many more hits the player's jet will take, and how many it takes when whole */
    get hull() { return Math.ceil(hull) },
    hullMax: HULL,
    /** the enemy's missiles thrown off by a roll so far */
    get evades() { return evades },
    /** counter-attacks made so far, and whether one may be made right now */
    get counters() { return counters },
    get counterOpen() { return counterT > 0 && armed() },
    /** 0..1: how far into the slow motion of a missile thrown off things are */
    get slow() { return slowAmt },
    /** seconds until a missile arrives (99 when none is coming) */
    get threat() { return threatT },
    /** the cannon's trigger, held or let go */
    setFire(on) {
      if (on && !firing && gunLoad > 0 && armed()) sound('empty') // (the trigger pulled on an empty gun)
      firing = on
    },
    /**
     * What is left to fire: rounds and missiles, how many of each when full (0: no limit), and how
     * far through reloading each is (0 while it is not reloading, then up towards 1).
     */
    get ammo() {
      const t = reloadTime()
      ammoOut.rounds = roundsLeft
      ammoOut.roundsMax = roundsMax()
      ammoOut.gunLoad = gunLoad > 0 ? clamp(1 - gunLoad / Math.max(t, 1e-3), 0.001, 1) : 0
      ammoOut.missiles = missilesLeft
      ammoOut.missilesMax = missilesMax()
      ammoOut.missileLoad = missileLoad > 0 ? clamp(1 - missileLoad / Math.max(t, 1e-3), 0.001, 1) : 0
      return ammoOut
    },
    /** a missile */
    missile() { fireMissile() },
    /** a loop: over the top and round again */
    loop(dir = 1) { startLoop(dir) },
    /**
     * A training flight begins, changes or ends (''): see Drill. It begins and ends with a clear
     * sky: nothing of the enemy's is left in the air, and the jet is whole.
     */
    drill(mode) {
      if (mode === drill) return
      if (!drill || !mode) {
        foes.length = 0
        hull = HULL
        slowT = 0
        counterT = 0
        volley = 0
        lockOn = -1
        lockT = 0
        for (const m of missiles) m.target = -1
      }
      if (!mode || mode === 'calm') {
        for (const m of inbound) m.on = false
        threatT = 99
      }
      if (mode === 'attack') foeMissileWait = 2.5
      else if (!mode) foeMissileWait = 16
      drill = mode
      syncFoes()
      for (const f of foes) if (!mode) f.atkT = 9 + f.wob * 2
    },
    /** what the player has done so far (counts that only go up) and how things stand, for the tutorial */
    get did() {
      const lead = jets[0]
      did.evades = evades
      did.counters = counters
      did.yaw = lead.yaw
      did.z = lead.z
      did.height = lead.z - groundAt(lead.x, lead.y)
      did.boost = boost
      did.lock = lockOn < 0 || !armed() ? 0 : Math.min(1, lockT / LOCK_TIME)
      did.threat = threatT
      did.hands = hands
      did.out = ej !== EJ_FLY
      did.counterOpen = counterT > 0 && armed()
      did.foe = foes.some((f) => f.state === 0)
      did.gunDry = gunLoad > 0
      did.missilesDry = missileLoad > 0
      return did
    },
    setKeys,
    step,
    render,
    get width() { return W },
    get height() { return H },
    /** the smooth flames to lay over this frame (none while the flames are drawn in pixels) */
    get flames() { return flameOut },
    /** the view the camera is in, or heading for */
    get view() { return viewTarget === 2 ? 'cockpit' : viewTarget === 1 ? 'chase' : 'top' },
    /**
     * How things stand, for the sound: the thrusters (0..1), the jet's speed against its cruising
     * speed, how far into the cockpit the camera is, how near the jet is to it (1 = flying it),
     * how much open air is rushing past the pilot (he is out of the jet), and the dive warning.
     */
    get audio() {
      const lead = jets[0]
      const out = ej === EJ_ROCKET || ej === EJ_CHUTE || ej === EJ_DROP
      audio.boost = boost
      audio.speed = (ej === EJ_FLY ? speedNow : lead.away ? 0 : Math.hypot(lead.vx, lead.vy)) / Math.max(1, p.speed)
      audio.cockpit = vK
      const far = lead.away ? 1e9 : Math.hypot(lead.x - cam.x, lead.y - cam.y, lead.z - cam.alt)
      audio.jet = ej === EJ_FLY ? 1 : 1 / (1 + (far / (46 * jetSize())) ** 2)
      audio.air = out ? 1 : 0
      audio.alarm = warn ? 1 : 0
      audio.spray = spray
      audio.gun = Math.max(shooting() ? 1 : 0, foeGun * 0.6)
      audio.cloud = inCloud && ej === EJ_FLY ? 1 : 0
      // (a missile on its way: 0 none … towards 1 as it closes; 1 while a roll would throw it off)
      audio.slow = slowAmt
      audio.threat = threatT > 90 ? 0 : threatT <= PARRY * 0.85 ? 1 : clamp(1 - threatT / 3.5, 0.05, 0.95)
      audio.lock = lockOn < 0 || !armed() ? 0 : Math.max(0.02, Math.min(1, lockT / LOCK_TIME))
      return audio
    },
    /** the things that have happened since this was last asked, for the sound; asking empties the list */
    takeSounds() {
      const list = heard.slice()
      heard.length = 0
      return list
    },
  }
}

 
