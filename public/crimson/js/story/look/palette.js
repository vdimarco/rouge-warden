// js/story/look/palette.js : every world colour by name (sRGB hex). Packages build their materials from
// these, so nothing in Sedona turns into neon by accident: in the ink, the post pass keeps any pixel that
// looks neon yellow-green (render.js neonOf) and makes it glow. checkNeon() runs a JS copy of that test on
// every entry at three light levels.
//
// Rules (design 3.6):
// - neon means danger. Only the entries in NEON may score as neon: the gang's hi-vis stripe, flashlights,
//   gang marker lights, enemy tells and the danger glyph.
// - crimson means the crew and objectives. It is drawn with KEY.solid / KEY.glow (render.js).
// - greens stay bluish: green minus blue stays under 0.12, so a juniper can never read as neon.
// - E6: the tour jeeps are tangerine orange, never pink.

const g = (o) => Object.freeze(o);
export const PALETTE = g({
  // rock and ground
  rockRed: 0xb4553a, rockRedDark: 0x8a3a28, rockRust: 0x9c4a30, rockOrange: 0xc8703f, rockCream: 0xd9c2a0,
  rockBand: 0xc28a64, rockShadow: 0x6e4a44, rockGrey: 0x8a7f78, rockVarnish: 0x4a3430,
  dirtRed: 0xa8583c, dirtTan: 0xbf9470, sand: 0xd2b48c, gravel: 0x8f8478, mud: 0x5a4032, slickrock: 0xc47a52,
  // roads and town ground
  asphalt: 0x3a3838, asphaltWorn: 0x55504c, shoulder: 0x8a6a52, roadLine: 0xe8e4dc, roadCenter: 0xd8962a,
  concrete: 0xa6a29c, curb: 0xbab4aa, parkingLine: 0xdcd8d0, guardrail: 0x9a9ea2, bridgeSteel: 0x6a5e58, bridgeConcrete: 0xb8b0a4,
  // plants: every green keeps green - blue under 0.12
  juniper: 0x3d4a40, juniperLight: 0x566656, juniperDry: 0x5a5a4e, pinyon: 0x44503f, cottonwood: 0x5e6e58, cottonwoodLight: 0x76846e,
  sycamoreBark: 0xc8c0b0, trunk: 0x4a3a30, grassDry: 0xa08c70, grassGreen: 0x6a7666, sage: 0x7c8a80, agave: 0x5e7a78,
  cactus: 0x4e6650, pricklyPear: 0x5a6e5c, manzanita: 0x7a3a2a, flowerRed: 0xb8402e, flowerCream: 0xe0d8c0,
  // water
  creekDeep: 0x2e4a50, creekWater: 0x3a5a5e, creekShallow: 0x5e7a70, creekFoam: 0xd8dcd8, pool: 0x4a6a70,
  // buildings and signs (every sign is invented and painted on canvas)
  adobe: 0xc89a72, stucco: 0xd8c4a8, stuccoWhite: 0xe6ddd0, stuccoRust: 0xb0684a, roofTerracotta: 0xa04a32, roofTin: 0x8a8c90,
  roofDark: 0x4a4644, wood: 0x7a5a40, woodDark: 0x4a3628, woodPale: 0xb09070, glass: 0x2a3238, window: 0x5a6670, awning: 0x7a2e24,
  signCream: 0xece0c4, signRed: 0x9a2a22, signTeal: 0x2a6a6a, signOrange: 0xd87a2a, signBrown: 0x5a3a26, trim: 0x3a2e28,
  neonSignOff: 0x5a5a5a, fence: 0x8a7a68, barbedWire: 0x5a5a58, cairnStone: 0xa89888, tent: 0xd8ccb4,
  // vehicles (all code-built)
  vanWhite: 0xe8e6e2, vanGlass: 0x1c2226, vanTrim: 0x2a2a2c, jeepTangerine: 0xe8741e, jeepRoll: 0x2a2a2a,
  suvBlack: 0x23262b, fbiBlack: 0x1e222a, pickupRed: 0x7a2a22, pickupDust: 0x9a8a78, sedanBlue: 0x3a4a6a, sedanSilver: 0xa4a6aa,
  glassTop: 0x6a7a88, glassLow: 0x28323a, rim: 0x9ea2a8, indicator: 0xd8862a, // glass: sky above, road below
  sedanBrown: 0x6a4a36, rvCream: 0xe0d4bc, rvStripe: 0x8a4a2a, tire: 0x1c1c1c, chrome: 0xc8ccd0, tailLight: 0xb01010,
  headlight: 0xfff1d8, lightBarRed: 0xd01818, lightBarBlue: 0x1830d0, licensePlate: 0xe0dcd0,
  // people: skin, hair and clothes
  skin1: 0xf0c8a8, skin2: 0xd8a484, skin3: 0xb07a58, skin4: 0x8a5a3c, skin5: 0x5e3c28,
  hairBlack: 0x1a1614, hairBrown: 0x4a3222, hairBlonde: 0xc8a870, hairGrey: 0x9a9894, hairRed: 0x8a3a1e,
  denim: 0x3a4e6e, denimDark: 0x26324a, khaki: 0xb0a080, shirtWhite: 0xe8e4dc, shirtBlack: 0x222224, shirtBlue: 0x4a6a9a,
  shirtRed: 0x9a2e2a, shirtRust: 0xa85a36, shirtSand: 0xc8b490, shirtGrey: 0x7a7a7c, flannel: 0x7a2a26, vest: 0x5a4a3a,
  fbiNavy: 0x1c2638, vossSuit: 0xd8d0c0, vossHat: 0xe6dccb, bolo: 0x8a6a3a, gangJacket: 0x2a2a2c, gangCap: 0x3a3a3c,
  boots: 0x3a2a20, sneakerWhite: 0xe0dcd4, cowboyHat: 0x8a6a48, sunglasses: 0x121214, kasa: 0xc8b48a,
  // props
  kazoo: 0xe05a2a, flamingo: 0xe07a8a, pipePVC: 0xe8e6e0, footLocker: 0x5a5e5a, canteen: 0x6a5a3a, cooler: 0x3a6a8a,
  bat: 0x9a7a52, cue: 0xb89a6a, stool: 0x5a3a2a, phone: 0x18181a, camera: 0x2a2a2a, pumpRed: 0x9a2a22, pumpWhite: 0xe0dcd4,
  // sky and light
  sun: 0xffe2b8, moon: 0xe6ecf5, hemiSky: 0x9cc4ff, hemiGround: 0xa0522d, skyTop: 0x2f6cc0, skyHorizon: 0xb9cbe1,
  fogDay: 0xc6b2a0, fogDusk: 0x7c5e5e, fogNight: 0x0e1014, fogDawn: 0x8e8088, fogMemory: 0xcab49a, fogInterior: 0x14100c,
  lamp: 0xffc890, fire: 0xff8a3a, lanternWarm: 0xffb060,
});
// crimson: the crew and the objectives, drawn through the key so it stays crimson in the ink
export const CRIMSON = g({ crimson: 0xb3122e, crimsonDeep: 0x7a0c1e, crimsonGlow: 0xff2a44, kasaBand: 0xa8102a, pinstripe: 0xb3122e, ringBox: 0x9e0e26, marker: 0xc8142f });
// neon: danger only. These are meant to read as neon, so the check skips them.
export const NEON = g({ neon: 0xb8ff1a, hiVis: 0xc6ff1a, flashlight: 0xccff4a, gangLight: 0xb8ff1a, tell: 0xc6ff3a, danger: 0xb8ff1a });

/* ---------------- the neon test, as in render.js ---------------- */
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const hexRGB = (hex) => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
// neonOf on a display-space colour (render.js COMMON)
export function neonOf([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / (mx + 0.02);
  const hue = sst(0.82, 1.02, g / (r + 0.03)) * sst(0.12, 0.4, g - b);
  return Math.min(1, Math.max(0, hue * sst(0.35, 0.6, sat) * sst(0.18, 0.4, g)));
}
// the score of an sRGB colour lit at an exposure: to linear, times the light, back through disp()
export function neonScore(hex, exposure = 1) {
  const c = hexRGB(hex).map((v) => Math.pow(lin(v) * exposure, 1 / 2.2));
  return neonOf(c);
}
export const EXPOSURES = Object.freeze([0.5, 1, 1.6]);
export const NEON_LIMIT = 0.05;
// Every PALETTE and CRIMSON entry at exposures 0.5, 1 and 1.6. Returns the entries over 0.05, the worst
// first. In dev (?dev) it throws on any, so a bad colour stops the page early. Also flags greens with
// green minus blue of 0.12 or more (the bluish-green rule).
export function checkNeon({ entries = { ...PALETTE, ...CRIMSON }, dev = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev') } = {}) {
  const bad = [];
  for (const [name, hex] of Object.entries(entries)) {
    let worst = 0, at = 1;
    for (const e of EXPOSURES) { const s = neonScore(hex, e); if (s > worst) { worst = s; at = e; } }
    if (worst > NEON_LIMIT) bad.push({ name, hex: '#' + hex.toString(16).padStart(6, '0'), score: +worst.toFixed(3), exposure: at });
    const [r, gg, b] = hexRGB(hex);
    if (gg > r && gg > b && gg - b >= 0.12) bad.push({ name, hex: '#' + hex.toString(16).padStart(6, '0'), score: 0, rule: 'green minus blue is 0.12 or more' });
  }
  bad.sort((a, b) => b.score - a.score);
  if (dev && bad.length) throw new Error(`palette: ${bad.length} colours read as neon: ${bad.map((b) => `${b.name} ${b.hex} ${b.rule || b.score}`).join(', ')}`);
  return bad;
}
// a THREE.Color-ready number by name from any group (throws on a typo, so a bad name shows at once)
export function pal(name) {
  const v = PALETTE[name] ?? CRIMSON[name] ?? NEON[name];
  if (v == null) throw new Error(`palette: no colour '${name}'`);
  return v;
}
