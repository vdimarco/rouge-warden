// The cockpit, built for depth. It is painted once (per size and colour scheme) as four layers
// at different distances from the pilot's eyes:
//
//   canopy hoop  ·  instrument panel  ·  consoles and side walls  ·  the frame behind your head
//
// Each frame the layers are laid over the view, shifted by different amounts as the pilot's
// head sways with the flying (near things move most), with sunlight falling across them from
// wherever the sun is. The live parts — screens, dials, lamps, lever, stick, and the head-up
// display on its own pane of glass — are drawn on top.
//
// Colours are 0xAABBGGRR. Sizes are in "design pixels": one at a frame 300 px tall.













































































const rgb = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const CRT = [rgb(3, 20, 13), rgb(5, 34, 22), rgb(10, 66, 40), rgb(22, 150, 78), rgb(70, 226, 126), rgb(186, 255, 210)]
const BRASS = [rgb(120, 86, 26), rgb(206, 158, 54), rgb(255, 222, 120)]
const LAMP = [rgb(110, 84, 26), rgb(255, 206, 84), rgb(255, 244, 190)]
const SKY = rgb(70, 140, 224)
const SKY2 = rgb(110, 176, 240)
const EARTH = rgb(150, 92, 40)
const EARTH2 = rgb(120, 70, 30)
const WHITE = rgb(255, 255, 255)
const BLACK = rgb(0, 0, 0)
const GLINT = rgb(232, 246, 255)
const HUD = rgb(120, 255, 164)
const GLASS = rgb(170, 226, 255)

// how much each layer shifts as the head moves: the nearer it is, the more
const NEAR = { canopy: 0.3, glass: 0.5, panel: 0.72, deck: 1, lever: 1.12, stick: 1.32, rear: 1.65 }

function hash(n) {
  let h = Math.imul(n ^ (n >>> 13), 0x5bd1e995)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  return (h >>> 24) & 255
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

function mix(bg, fg, k) {
  const r = ((bg & 255) * (256 - k) + (fg & 255) * k) >> 8
  const g = (((bg >> 8) & 255) * (256 - k) + ((fg >> 8) & 255) * k) >> 8
  const b = (((bg >> 16) & 255) * (256 - k) + ((fg >> 16) & 255) * k) >> 8
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

// 3 × 5 pixel digits and letters; each row is three bits, left pixel first
const GLYPHS = {
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 7, 1, 7], '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 2, 2], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
}

/** a small drawing surface over a pixel buffer; (ox, oy) moves everything drawn on it */
class Sheet {
  buf
  W
  H
  ox = 0
  oy = 0
  constructor(buf, W, H) {
    this.buf = buf
    this.W = W
    this.H = H
  }
  put(x, y, col) {
    x += this.ox
    y += this.oy
    if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.buf[y * this.W + x] = col
  }
  /** blend a colour over what is there (k of 256) */
  tint(x, y, col, k) {
    x += this.ox
    y += this.oy
    if (x >= 0 && y >= 0 && x < this.W && y < this.H) {
      const o = y * this.W + x
      this.buf[o] = mix(this.buf[o], col, k)
    }
  }
  get(x, y) {
    x += this.ox
    y += this.oy
    return x >= 0 && y >= 0 && x < this.W && y < this.H ? this.buf[y * this.W + x] : 0
  }
  /** filled box; right and bottom edges are not included */
  box(x0, y0, x1, y1, col) {
    x0 += this.ox
    x1 += this.ox
    y0 += this.oy
    y1 += this.oy
    if (x0 < 0) x0 = 0
    if (y0 < 0) y0 = 0
    if (x1 > this.W) x1 = this.W
    if (y1 > this.H) y1 = this.H
    if (x0 >= x1) return
    for (let y = y0; y < y1; y++) this.buf.fill(col, y * this.W + x0, y * this.W + x1)
  }
  line(xa, ya, xb, yb, col) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(xb - xa), Math.abs(yb - ya))))
    for (let i = 0; i <= n; i++) this.put(Math.round(xa + ((xb - xa) * i) / n), Math.round(ya + ((yb - ya) * i) / n), col)
  }
  disc(cx, cy, r, col) {
    const ri = Math.ceil(r)
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) if (dx * dx + dy * dy <= r * r) this.put(cx + dx, cy + dy, col)
  }
  text(x, y, str, col) {
    for (let i = 0; i < str.length; i++) {
      const g = GLYPHS[str[i]]
      if (!g) continue
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r] & (4 >> c)) this.put(x + i * 4 + c, y + r, col)
    }
  }
  /** a raised plate: lit along the top and left, dark along the bottom and right */
  plate(x0, y0, x1, y1, face, lit, dark) {
    this.box(x0, y0, x1, y1, face)
    this.box(x0, y0, x1, y0 + 1, lit)
    this.box(x0, y0, x0 + 1, y1, lit)
    this.box(x0, y1 - 1, x1, y1, dark)
    this.box(x1 - 1, y0, x1, y1, dark)
  }
  /** a well sunk into the surface: shadowed along the top and left, lit along the bottom and right */
  well(x0, y0, x1, y1, face, lit, dark) {
    this.box(x0, y0, x1, y1, face)
    this.box(x0, y0, x1, y0 + 2, dark)
    this.box(x0, y0, x0 + 2, y1, dark)
    this.box(x0 + 1, y1 - 1, x1, y1, lit)
    this.box(x1 - 1, y0 + 1, x1, y1, lit)
  }
  /** a screw head */
  bolt(x, y, lit, dark) {
    this.put(x, y, lit)
    this.put(x + 1, y, dark)
    this.put(x, y + 1, dark)
    this.put(x + 1, y + 1, dark)
  }
}

/** paints the fixed parts of the cockpit for a frame of W × H */
export function buildCockpit(W, H, pal) {
  const s = H / 300
  const cx = W >> 1
  const pad = Math.ceil(14 * s) + 3
  const aw = W + pad * 2
  const ah = H + pad * 2
  const R = (v) => Math.round(v * s)
  const X = (u) => cx + Math.round(u * s)
  const B = pal.body
  const A = pal.hot
  const layer = () => {
    const buf = new Uint32Array(aw * ah)
    const sh = new Sheet(buf, aw, ah)
    sh.ox = pad
    sh.oy = pad
    return sh
  }
  const rv = layer()
  const cv = layer()
  const pv = layer()
  const kv = layer()
  const P = 2.5
  const inside = (dx, dy, ax, ay) => Math.pow(Math.abs(dx) / ax, P) + Math.pow(Math.abs(dy) / ay, P)

  // ── the frame behind your head: the nearest thing, a dark edge in the top corners
  let rearBottom = 0
  {
    const oy = 252 * s
    const rx = 280 * s
    const ry = 276 * s
    for (let y = -pad; y < H; y++) {
      const dy = oy - y
      if (dy <= 0) break
      for (let x = -pad; x < W + pad; x++) {
        const v = inside(x - cx, dy, rx, ry)
        if (v <= 1) continue
        const f = (Math.pow(v, 1 / P) - 1) * rx // px beyond the opening
        const n = hash(x * 71 + y * 409)
        rv.put(x, y, f < 1.2 ? B[5] : f < 2.4 + s ? B[3] : f < 2.4 + 6 * s ? (n < 20 ? B[1] : B[2]) : n > 248 ? B[2] : B[1])
        if (y > rearBottom) rearBottom = y
      }
    }
    // padding studs along its edge
    for (let i = 0; i < 40; i++) {
      const ang = (i / 40) * Math.PI
      const m = 1 + (9 * s) / rx
      const bx = Math.round(cx + Math.sign(Math.cos(ang)) * Math.pow(Math.abs(Math.cos(ang)), 2 / P) * rx * m)
      const by = Math.round(oy - Math.pow(Math.abs(Math.sin(ang)), 2 / P) * ry * m)
      if (rv.get(bx, by) !== 0) rv.bolt(bx, by, B[5], B[0])
    }
  }

  // ── canopy hoop: a thick bar bent round the glass, in riveted sections, some painted
  {
    const oy = 236 * s
    const rx = 226 * s
    const ry = 228 * s
    const bar = Math.max(6, 13 * s)
    const SECTIONS = 15
    const PAINTED = [1, 4, 7, 10, 13]
    for (let y = -pad; y < H + pad; y++) {
      const dy = oy - y
      if (dy <= 0) break
      for (let x = -pad; x < W + pad; x++) {
        const dx = x - cx
        const vi = inside(dx, dy, rx, ry)
        if (vi <= 1) continue
        const vo = inside(dx, dy, rx + bar, ry + bar)
        if (vo > 1) continue
        // how far across the bar (0 at the glass, 1 at the outside)
        const f = clamp((Math.pow(vi, 1 / P) - 1) / ((rx + bar) / rx - 1), 0, 1)
        const part = (Math.atan2(dy / ry, dx / rx) / Math.PI) * SECTIONS
        const sec = Math.floor(part)
        const along = part - sec
        const n = hash(x * 131 + y * 977)
        const seam = along < 0.035 || along > 0.965
        // a round bar: bright where it turns to the light, dark underneath
        let col
        if (seam) col = B[0]
        else if (f < 0.08) col = B[2]
        else if (f < 0.2) col = B[6]
        else if (f < 0.34) col = B[5]
        else if (f < 0.66) col = n < 14 ? B[3] : B[4]
        else if (f < 0.86) col = B[2]
        else col = B[0]
        // paint, chipped at the edges and seams
        if (!seam && PAINTED.indexOf(sec) >= 0 && f > 0.14 && f < 0.86) {
          const edge = Math.min(along, 1 - along) * 9 + Math.min(f - 0.14, 0.86 - f) * 5
          if (n > 70 - edge * 150) col = f < 0.3 ? A[5] : f < 0.42 ? A[4] : f < 0.68 ? A[3] : A[2]
        } else if (!seam && f > 0.24 && f < 0.8 && n > 249) {
          col = A[2] // a fleck of old paint
        }
        cv.put(x, y, col)
      }
    }
    // screws either side of every seam
    for (let i = 1; i < SECTIONS; i++) {
      for (const off of [-0.09, 0.09]) {
        const ang = ((i + off) / SECTIONS) * Math.PI
        const m = 1 + bar / (2 * rx)
        const bx = Math.round(cx + Math.sign(Math.cos(ang)) * Math.pow(Math.abs(Math.cos(ang)), 2 / P) * rx * m)
        const by = Math.round(oy - Math.pow(Math.abs(Math.sin(ang)), 2 / P) * ry * m)
        if (cv.get(bx, by) !== 0) cv.bolt(bx - 1, by - 1, B[7], B[0])
      }
    }
    // lamp housing at the top of the hoop
    {
      const ty = Math.round(oy - ry - bar)
      const w = R(26)
      for (let y = -pad; y < R(21); y++) {
        const inset = Math.max(0, Math.round(y * 0.45))
        cv.box(cx - w + inset, ty + y, cx + w - inset, ty + y + 1, y < 2 ? B[5] : y > R(21) - 3 ? B[1] : B[3])
        cv.put(cx - w + inset, ty + y, B[0])
        cv.put(cx + w - inset - 1, ty + y, B[0])
      }
      cv.box(cx - R(14), ty + R(7), cx + R(14), ty + R(13), B[0])
      cv.box(cx - R(12), ty + R(8), cx + R(12), ty + R(12), A[4])
      cv.box(cx - R(12), ty + R(8), cx + R(12), ty + R(9), A[5])
      cv.bolt(cx - R(21), ty + R(5), B[7], B[0])
      cv.bolt(cx + R(19), ty + R(5), B[7], B[0])
    }
    // latches on either side
    for (const side of [-1, 1]) {
      const ly = Math.round(118 * s)
      const hw = rx * Math.pow(1 - Math.pow((oy - ly) / ry, P), 1 / P)
      const lx = Math.round(cx + side * (hw + bar * 0.35))
      cv.box(lx - R(5), ly - R(9), lx + R(5), ly + R(9), B[0])
      cv.box(lx - R(4), ly - R(8), lx + R(4), ly + R(8), A[3])
      cv.box(lx - R(4), ly - R(8), lx + R(4), ly - R(6), A[5])
      cv.box(lx - R(4), ly + R(5), lx + R(4), ly + R(8), A[2])
      cv.bolt(lx - 1, ly - 1, B[7], B[0])
    }
    // glints on the glass: diagonal streaks inside the hoop and out towards the corners
    for (const side of [-1, 1]) {
      for (const [u0, v0, u1, v1, wide] of [[-152, 66, -124, 38, 3], [-141, 72, -127, 58, 2], [-190, 40, -170, 20, 3], [-197, 54, -184, 41, 2], [-178, 44, -172, 38, 1]]) {
        const n = Math.max(1, Math.round(Math.abs(u1 - u0) * s))
        for (let i = 0; i <= n; i++) {
          for (let k = 0; k < Math.max(1, Math.round(wide * s)); k++) {
            const x = Math.round(cx + side * (u0 + ((u1 - u0) * i) / n) * s) + k * side
            const y = Math.round((v0 + ((v1 - v0) * i) / n) * s) + k
            if (cv.get(x, y) !== 0) continue
            // solid at its core, broken at the edges and the ends
            const ends = Math.min(i, n - i) < 2
            if (k === 0 && !ends ? true : ((x + y) & 1) === 0) cv.put(x, y, GLINT)
          }
        }
      }
    }
  }

  // ── instrument panel: a hooded shelf (the glare shield) over an upright face
  const topOf = (u) => {
    const a = Math.abs(u)
    if (a <= 58) return 168
    if (a <= 74) return 168 + ((a - 58) / 16) * 11
    if (a <= 92) return 179
    if (a <= 104) return 179 - ((a - 92) / 12) * 9
    if (a <= 206) return 170 + (a - 104) * 0.02
    return 172 + ((a - 206) / 16) * 10
  }
  const G = Math.max(5, R(11)) // depth of the shelf, as seen from the seat
  let panelTop = H
  for (let x = -pad; x < W + pad; x++) {
    const u = (x - cx) / s
    if (Math.abs(u) > 232) continue
    const top = Math.round(topOf(u) * s)
    if (top < panelTop) panelTop = top
    for (let y = top; y < H + pad; y++) {
      const d = y - top
      const n = hash(x * 53 + y * 311)
      let col
      if (d < G) {
        // the top of the shelf, running away towards the glass: its far edge catches the sky
        const near = d / G
        const ray = Math.abs(u) / (15 + near * 9)
        const groove = ray - Math.floor(ray) < 0.07
        col = d === 0 ? B[6] : d === 1 ? B[4] : groove ? B[0] : near < 0.45 ? (n > 236 ? B[3] : B[2]) : B[1]
        // worn paint out at its far edge
        if (d > 0 && d < G * 0.5 && hash((x >> 3) * 7 + 5) > 208 && n > 120) col = d < 3 ? A[3] : A[2]
      } else if (d < G + 2) {
        col = d === G ? B[5] : B[3] // the rolled lip of the hood
      } else if (d < G + 4) {
        col = B[0] // its underside
      } else {
        // the upright face, in the hood's shadow at the top and darker again towards the floor
        const below = d - G - 4
        const shade = below < R(4) ? 0 : below < R(8) ? (((x + y) & 1) === 0 ? 0 : 1) : 1
        const v = y / s
        col = shade === 0 ? B[0] : v > 262 ? B[0] : v > 250 ? (((x + y) & 1) === 0 ? B[0] : B[1]) : v > 222 ? B[1] : ((x + y) & 3) === 0 ? B[1] : B[2]
        if (shade === 1 && n > 251) col = B[3]
      }
      pv.put(x, y, col)
    }
  }
  // grilles let into the shelf
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const gx = X(side * (150 + i * 5))
      pv.box(gx, R(173), gx + Math.max(1, R(2)), R(179), B[0])
    }
  }

  // lamp strip and vents on the hood of the centre console
  const lamps = []
  pv.well(X(-34), R(183), X(34), R(191), B[0], B[4], B[0])
  for (let i = 0; i < 5; i++) {
    const r = { x: X(-30 + i * 12.4), y: R(185), w: Math.max(4, R(10)), h: Math.max(3, R(5)) }
    lamps.push(r)
    pv.box(r.x, r.y, r.x + r.w, r.y + r.h, A[1])
  }
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) pv.box(X(side * (41 + i * 4)), R(184), X(side * (41 + i * 4)) + 1, R(190), B[0])

  // the two screens, sunk into thick bezels with keys along the bottom
  const panelKeys = []
  const screen = (u0) => {
    const x0 = X(u0)
    const x1 = X(u0 + 100)
    const y0 = R(193)
    const y1 = R(261)
    // the bezel stands proud of the face and throws a shadow down and to the right
    pv.box(x0 + 2, y0 + 2, x1 + 3, y1 + 3, B[0])
    pv.plate(x0, y0, x1, y1, B[3], B[6], B[1])
    pv.box(x0 + 1, y0 + 1, x1 - 1, y0 + 2, B[5])
    pv.box(x0 + 2, y0 + 2, x1 - 2, y1 - 2, B[3])
    const m = Math.max(4, R(7))
    const r = { x: x0 + m, y: y0 + m - 1, w: x1 - x0 - m * 2, h: y1 - y0 - m * 2 - R(3) }
    pv.well(r.x - 3, r.y - 3, r.x + r.w + 3, r.y + r.h + 3, B[1], B[5], B[0])
    pv.box(r.x - 1, r.y - 1, r.x + r.w + 1, r.y + r.h + 1, B[0])
    pv.box(r.x, r.y, r.x + r.w, r.y + r.h, CRT[0])
    for (const [bx, by] of [[x0 + 3, y0 + 3], [x1 - 5, y0 + 3], [x0 + 3, y1 - 5], [x1 - 5, y1 - 5]]) pv.bolt(bx, by, B[7], B[0])
    for (let i = 0; i < 6; i++) {
      const k = { x: r.x + R(4) + i * Math.round(r.w / 6.4), y: y1 - R(7), w: Math.max(3, R(7)), h: Math.max(2, R(3)) }
      pv.box(k.x, k.y + 1, k.x + k.w + 1, k.y + k.h + 1, B[0])
      pv.box(k.x, k.y, k.x + k.w, k.y + k.h, B[5])
      pv.box(k.x, k.y, k.x + k.w, k.y + 1, B[7])
      if (i === 1 || i === 4) panelKeys.push(k)
    }
    return r
  }
  const radar = screen(-206)
  const status = screen(106)

  // centre plate: the attitude ball with four small dials round it, each sunk in its own well
  pv.box(X(-100) + 2, R(193) + 2, X(100) + 3, R(262) + 3, B[0])
  pv.plate(X(-100), R(193), X(100), R(262), B[2], B[5], B[0])
  for (const [bu, bv] of [[-97, 196], [94, 196], [-97, 257], [94, 257]]) pv.bolt(X(bu), R(bv), B[7], B[0])
  const ball = { x: cx, y: R(228), r: R(25) }
  {
    const ro = ball.r + Math.max(4, R(8))
    for (let dy = -ro - 3; dy <= ro + 3; dy++) {
      for (let dx = -ro - 3; dx <= ro + 3; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > ro + 3) continue
        let col
        if (d > ro + 1) {
          // shadow thrown by the raised ring
          if (dx + dy < ro * 0.4) continue
          col = B[0]
        } else if (d > ro) col = B[0]
        else if (d > ball.r + 2) {
          // the ring: a turned bevel, bright where it faces the light
          const lightSide = (-dx - dy) / (d * 1.4142 + 0.001)
          col = lightSide > 0.55 ? B[7] : lightSide > 0.1 ? B[5] : lightSide > -0.45 ? B[4] : B[2]
        } else col = B[0]
        pv.put(ball.x + dx, ball.y + dy, col)
      }
    }
    const rb = ball.r + Math.max(3, R(5))
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bx = Math.round(ball.x + sx * rb * 0.7071)
      const by = Math.round(ball.y + sy * rb * 0.7071)
      pv.put(bx, by, BRASS[2])
      pv.put(bx + 1, by, BRASS[1])
      pv.put(bx, by + 1, BRASS[1])
      pv.put(bx + 1, by + 1, BRASS[0])
    }
    // pointer at the top, knob at the bottom
    const ph = Math.max(3, R(5))
    for (let i = 0; i < ph; i++) pv.box(ball.x - i, ball.y - ro + ph - i, ball.x + i + 1, ball.y - ro + ph - i + 1, i === 0 ? BRASS[2] : BRASS[1])
    pv.box(ball.x - R(6), ball.y + ro - R(2), ball.x + R(6) + 2, ball.y + ro + R(4), B[0])
    pv.box(ball.x - R(6), ball.y + ro - R(3), ball.x + R(6) + 1, ball.y + ro + R(3), BRASS[1])
    pv.box(ball.x - R(6), ball.y + ro - R(3), ball.x + R(6) + 1, ball.y + ro - R(2), BRASS[2])
    pv.box(ball.x - R(6), ball.y + ro + R(2), ball.x + R(6) + 1, ball.y + ro + R(3), BRASS[0])
    for (let i = -R(5); i <= R(5); i += 2) pv.put(ball.x + i, ball.y + ro, BRASS[0])
  }
  const dials = []
  for (const [du, dvv] of [[-72, 211], [-72, 246], [72, 211], [72, 246]]) {
    const d = { x: X(du), y: R(dvv), r: Math.max(6, R(12)) }
    dials.push(d)
    for (let dy = -d.r - 3; dy <= d.r + 4; dy++) {
      for (let dx = -d.r - 3; dx <= d.r + 4; dx++) {
        const dd = Math.sqrt(dx * dx + dy * dy)
        if (dd > d.r + 3.5) continue
        let col
        if (dd > d.r + 2) {
          if (dx + dy < d.r * 0.5) continue
          col = B[0] // shadow of the rim
        } else if (dd > d.r) col = -dx - dy > d.r * 0.4 ? B[7] : -dx - dy > -d.r * 0.5 ? B[5] : B[2]
        else if (dd > d.r - 1.5) col = B[0]
        // the face sits deep: the rim shades its upper left
        else col = dd > d.r - 4 && -dx - dy > d.r * 0.3 ? B[0] : B[1]
        pv.put(d.x + dx, d.y + dy, col)
      }
    }
    for (let i = 0; i < 10; i++) {
      const an = (-225 + i * 30) * (Math.PI / 180)
      pv.put(Math.round(d.x + Math.cos(an) * (d.r - 3)), Math.round(d.y + Math.sin(an) * (d.r - 3)), i > 7 ? A[4] : B[7])
    }
  }
  // push-buttons between the dials: raised, each with its own shadow
  for (const side of [-1, 1]) {
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const k = { x: X(side * 72) - R(8) + i * R(9), y: R(224) + j * R(6), w: Math.max(4, R(7)), h: Math.max(3, R(5)) }
        const lit = (i + j) % 2 === 0
        pv.box(k.x - 1, k.y - 1, k.x + k.w + 2, k.y + k.h + 2, B[0])
        pv.box(k.x, k.y, k.x + k.w, k.y + k.h, lit ? A[3] : B[4])
        pv.box(k.x, k.y, k.x + k.w, k.y + 1, lit ? A[5] : B[6])
        if (lit && j === 0) panelKeys.push(k)
      }
    }
  }
  // wear on the panel: paint rubbed off along plate edges in patches, and a few scratches
  const weather = (sh, y0, salt) => {
    const buf = sh.buf
    const isPlate = (c) => c === B[2] || c === B[3] || c === B[1]
    const isEdge = (c) => c === B[0] || c === B[4] || c === B[5] || c === B[6]
    const worn = []
    for (let y = y0 + pad; y < ah - 1; y++) {
      for (let x = 1; x < aw - 1; x++) {
        const o = y * aw + x
        if (!isPlate(buf[o])) continue
        if (hash((x >> 3) * 31 + (y >> 2) * 17 + salt) < 234) continue
        if (!(isEdge(buf[o - 1]) || isEdge(buf[o + 1]) || isEdge(buf[o - aw]) || isEdge(buf[o + aw]))) continue
        if (hash(x * 7 + y * 13) > 96) worn.push(o)
      }
    }
    for (const o of worn) buf[o] = hash(o) > 170 ? A[3] : hash(o) > 70 ? A[2] : A[1]
    for (let i = 0; i < Math.round(16 * s * (W / H)); i++) {
      const sx = Math.round((hash(i * 97 + salt) / 255) * (aw - 8)) + 2
      const sy = y0 + pad + Math.round((hash(i * 57 + salt * 3) / 255) * (ah - y0 - pad - 6))
      const len = 2 + (hash(i * 11 + salt) & 3)
      for (let k = 0; k < len; k++) {
        const o = (sy + k) * aw + sx + k
        if (sy + k < ah && sx + k < aw && isPlate(buf[o])) buf[o] = hash(i) > 128 ? B[4] : B[0]
      }
    }
  }
  weather(pv, panelTop + G + R(10), 3)

  // ── consoles and side walls: the layer nearest the seat. Its top is a shelf you look down on.
  const deckOf = (u) => {
    const a = Math.abs(u)
    if (a <= 212) return 263
    if (a <= 222) return 263 - ((a - 212) / 10) * 77
    return Math.max(110, 186 - (a - 222) * 0.42)
  }
  let deckTop = H
  for (let x = -pad; x < W + pad; x++) {
    const u = (x - cx) / s
    const a = Math.abs(u)
    const top = Math.round(deckOf(u) * s)
    if (a <= 212 && top < deckTop) deckTop = top
    for (let y = top; y < H + pad; y++) {
      const d = y - top
      const n = hash(x * 59 + y * 211)
      let col
      if (a > 212) {
        // side wall: panels running away towards the nose, under a padded rail
        const v = y / s
        const ray = ((v - 112) / Math.max(1, a)) * 7
        const rib = ray - Math.floor(ray) < 0.06
        if (d === 0) col = B[6]
        else if (d < R(3)) col = B[4]
        else if (d < R(5)) col = B[2]
        else if (d < R(7)) col = B[0]
        else if (a < 222) col = a < 215 ? B[5] : a < 218 ? B[3] : B[1] // the corner post
        else col = rib ? B[0] : Math.floor(ray) % 2 === 0 ? (n > 250 ? B[3] : B[2]) : B[1]
        if (v > 276 && !rib) col = ((x + y) & 1) === 0 ? col : B[0]
      } else {
        // the shelf: a bright front edge, then its top, dimmer the nearer the floor
        const v = y / s
        col = d === 0 ? B[6] : d === 1 ? B[4] : v > 290 ? (((x + y) & 1) === 0 ? B[1] : B[2]) : n > 250 ? B[4] : B[3]
      }
      kv.put(x, y, col)
    }
  }
  const deckKeys = []
  const KEYCOL = [A[3], A[3], B[4], LAMP[1], LAMP[1], B[4], B[4], A[3]]
  const key = (k, col) => {
    // a raised cap: shadow underneath and to the right
    kv.box(k.x, k.y + 1, k.x + k.w + 1, k.y + k.h + 2, B[0])
    kv.box(k.x - 1, k.y - 1, k.x + k.w + 1, k.y, B[1])
    kv.box(k.x, k.y, k.x + k.w, k.y + k.h, col)
    kv.box(k.x, k.y, k.x + k.w, k.y + 1, col === B[4] ? B[6] : col === LAMP[1] ? LAMP[2] : A[5])
    kv.box(k.x, k.y + k.h - 1, k.x + k.w, k.y + k.h, col === B[4] ? B[2] : col === LAMP[1] ? LAMP[0] : A[2])
  }
  // left: lit keys, then the throttle quadrant
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      const k = { x: X(-209 + i * 12), y: R(269 + j * 9), w: Math.max(5, R(10)), h: Math.max(3, R(6)) }
      const col = KEYCOL[(i + j * 3) % KEYCOL.length]
      key(k, col)
      if (col === LAMP[1] && i === 0) deckKeys.push(k)
    }
  }
  const throttle = { x: X(-150), y0: R(270), y1: R(290), w: R(34) }
  kv.well(X(-173), R(267), X(-109), H + pad, B[1], B[5], B[0])
  for (const ru of [-158, -141, -124]) {
    kv.box(X(ru), R(270), X(ru) + Math.max(2, R(3)), H + pad, B[0])
    for (let y = R(272); y < H + pad; y += Math.max(2, R(4))) kv.put(X(ru) + Math.max(2, R(3)) + 1, y, B[5])
  }
  // right: toggles, a knob and more keys
  for (let i = 0; i < 4; i++) {
    const tx = X(112 + i * 11)
    kv.box(tx - 1, R(281), tx + Math.max(4, R(6)) + 1, R(288), B[0])
    kv.box(tx, R(282), tx + Math.max(3, R(5)), R(286), B[5])
    const up = i % 2 === 0
    kv.box(tx + 2, up ? R(274) : R(285), tx + Math.max(2, R(3)) + 2, up ? R(284) : R(294), B[0])
    kv.box(tx + 1, up ? R(273) : R(284), tx + Math.max(2, R(3)), up ? R(283) : R(293), B[7])
    kv.box(tx + 1, up ? R(273) : R(290), tx + Math.max(2, R(3)), up ? R(275) : R(293), WHITE)
  }
  kv.disc(X(167), R(282), Math.max(4, R(8)), B[0])
  kv.disc(X(166), R(280), Math.max(4, R(8)), B[1])
  kv.disc(X(166), R(280), Math.max(3, R(7)), B[5])
  kv.disc(X(166), R(279), Math.max(2, R(5)), A[3])
  kv.disc(X(165), R(278), Math.max(1, R(2.5)), A[5])
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      const k = { x: X(180 + i * 12), y: R(269 + j * 9), w: Math.max(5, R(10)), h: Math.max(3, R(6)) }
      const col = KEYCOL[(i * 2 + j * 3 + 2) % KEYCOL.length]
      key(k, col)
      if (col === A[3] && j === 1) deckKeys.push(k)
    }
  }
  // the well the stick stands in
  const stick = { x: cx, y: R(253) }
  for (let dy = -R(10); dy <= R(10); dy++) {
    for (let dx = -R(32); dx <= R(32); dx++) {
      const d = (dx * dx) / (R(32) * R(32)) + (dy * dy) / (R(10) * R(10))
      if (d <= 1) kv.put(cx + dx, R(296) + dy, d > 0.8 ? (dy < 0 ? B[1] : B[5]) : d > 0.62 ? B[0] : B[1])
    }
  }
  // keys on the side walls
  for (const side of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const k = { x: X(side * 233) - (side < 0 ? R(8) : 0), y: R(212 + j * 15), w: Math.max(4, R(8)), h: Math.max(3, R(6)) }
      key(k, j === 1 ? A[3] : j === 2 ? LAMP[1] : B[4])
    }
  }
  weather(kv, deckTop + R(4), 11)

  return {
    W, H, s, cx, pad, aw, ah,
    rear: rv.buf, canopy: cv.buf, panel: pv.buf, deck: kv.buf,
    panelTop, deckTop, rearBottom,
    radar, status, ball, dials, lamps, panelKeys, deckKeys, throttle, stick, pal,
  }
}



/**
 * Lays a layer over the frame, shifted by (dx, dy + fy): fy is the part of a pixel left over
 * while the layer is sliding, so it glides instead of stepping. Where the sun reaches it, it
 * is lit: the light falls in a slanted band with broken edges, crossed by the hoop's shadow.
 */
function lay(fb, art, src, dx, dy, fy, top, bottom, light) {
  const { W, H, aw, ah, pad } = art
  const w1 = fy > 0.004 ? Math.round(fy * 256) : 0 // how much of the row above shows in each row
  const y0 = Math.max(0, top + dy)
  const y1 = Math.min(H, bottom + dy + (w1 > 0 ? 1 : 0))
  for (let ty = y0; ty < y1; ty++) {
    const sy = ty - dy + pad
    if (sy < 0 || sy > ah || (sy === ah && w1 === 0)) continue
    let i = sy * aw + pad - dx
    let o = ty * W
    if (!light && w1 === 0) {
      for (let x = 0; x < W; x++, o++, i++) {
        const c = src[i]
        if (c !== 0) fb[o] = c
      }
      continue
    }
    const here = sy < ah
    const above = w1 > 0 && sy > 0
    let xa = 0
    let xb = 0
    let sh0 = 0
    let sh1 = 0
    if (light) {
      const mid = light.x + (ty - light.y0) * light.slope
      xa = mid - light.half
      xb = mid + light.half
      sh0 = mid - light.half * 0.22
      sh1 = mid + light.half * 0.02
    }
    for (let x = 0; x < W; x++, o++, i++) {
      let c = here ? src[i] : 0
      let cover = 256
      if (w1 > 0) {
        const up = above ? src[i - aw] : 0
        if (up !== c) {
          if (up === 0) cover = 256 - w1
          else if (c === 0) { c = up; cover = w1 }
          else c = mix(c, up, w1)
        }
      }
      if (c === 0) continue
      if (light && x >= xa && x < xb && !(x >= sh0 && x < sh1)) {
        // ragged edges, so the light does not end in a ruled line
        const e = Math.min(x - xa, xb - x)
        if (e >= 4 || BAYER[((ty & 3) << 2) | (x & 3)] <= e * 4) c = mix(c, light.col, light.k)
      }
      fb[o] = cover === 256 ? c : mix(fb[o], c, cover)
    }
  }
}

/** the head-up display: a tilted pane of glass on the panel, and the green figures that float in it */
function drawHud(fb, art, live, gx, gy) {
  const { W, H, s, cx } = art
  const B = art.pal.body
  const k = Math.round(clamp(live.hud, 0, 1) * 256)
  if (k <= 0) return
  const R = (v) => Math.round(v * s)
  const py = live.pivotY
  // the pane: wider at the top, where it leans towards you
  const top = py - R(57) + gy
  const bot = R(170) + gy
  const halfTop = R(86)
  const halfBot = R(76)
  const edge = (y) => halfBot + ((halfTop - halfBot) * (bot - y)) / Math.max(1, bot - top)
  for (let y = Math.max(0, top); y < Math.min(H, bot); y++) {
    const h = Math.round(edge(y))
    const xa = Math.max(0, cx + gx - h)
    const xb = Math.min(W - 1, cx + gx + h)
    // a faint tint, and a soft sheen running down its left side
    for (let x = xa; x <= xb; x++) {
      const o = y * W + x
      const sheen = x - xa < R(10) + (y - top) * 0.12 && x - xa > R(4) + (y - top) * 0.12
      fb[o] = mix(fb[o], GLASS, ((sheen ? 30 : 10) * k) >> 8)
    }
    // its polished edges
    if (xa > 0) fb[y * W + xa] = mix(fb[y * W + xa], y - top < (bot - top) * 0.5 ? GLINT : B[6], (150 * k) >> 8)
    if (xb < W - 1) fb[y * W + xb] = mix(fb[y * W + xb], B[5], (120 * k) >> 8)
  }
  if (top >= 0 && top < H) for (let x = cx + gx - halfTop; x <= cx + gx + halfTop; x++) if (x >= 0 && x < W) fb[top * W + x] = mix(fb[top * W + x], GLINT, (130 * k) >> 8)
  // the two arms that hold it
  for (const side of [-1, 1]) {
    for (let y = bot - R(14); y < bot + 2; y++) {
      const x = cx + gx + side * (Math.round(edge(y)) + 1)
      for (let i = 0; i < Math.max(2, R(3)); i++) {
        const xx = x + side * i
        if (xx >= 0 && xx < W && y >= 0 && y < H) fb[y * W + xx] = mix(fb[y * W + xx], i === 0 ? B[6] : B[2], k)
      }
    }
  }

  // the figures are focused far away: they stay put against the world while the glass moves,
  // and can only be seen through it
  const put = (x, y) => {
    if (y < top + 2 || y >= bot - 2 || x < 0 || x >= W) return
    if (Math.abs(x - cx - gx) > edge(y) - 2) return
    const o = y * W + x
    fb[o] = k >= 256 ? HUD : mix(fb[o], HUD, k)
  }
  const line = (xa, ya, xb, yb) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(xb - xa), Math.abs(yb - ya))))
    for (let i = 0; i <= n; i++) put(Math.round(xa + ((xb - xa) * i) / n), Math.round(ya + ((yb - ya) * i) / n))
  }
  const text = (x, y, str) => {
    for (let i = 0; i < str.length; i++) {
      const g = GLYPHS[str[i]]
      if (!g) continue
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r] & (4 >> c)) put(x + i * 4 + c, y + r)
    }
  }
  // reticle: four corners and a cross
  const q = R(9)
  const l = Math.max(2, R(4))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    line(cx + sx * q, py + sy * q, cx + sx * (q - l), py + sy * q)
    line(cx + sx * q, py + sy * q, cx + sx * q, py + sy * (q - l))
  }
  line(cx - R(3), py, cx + R(3), py)
  line(cx, py - R(3), cx, py + R(3))
  // horizon and pitch bars: fixed to the world, so they tilt and slide with it
  const c = Math.cos(live.roll)
  const sn = Math.sin(live.roll)
  const hz = live.horizonY - py
  for (let deg = -20; deg <= 20; deg += 10) {
    const dy = hz - live.focal * Math.tan(((deg * Math.PI) / 180) * 0.8)
    const near = deg === 0 ? R(16) : R(8)
    const far = deg === 0 ? R(54) : R(20)
    for (let side = -1; side <= 1; side += 2) {
      const xa = side * near
      const xb = side * far
      line(cx + c * xa + sn * dy, py - sn * xa + c * dy, cx + c * xb + sn * dy, py - sn * xb + c * dy)
      if (deg !== 0) {
        const tk = dy + Math.sign(deg) * R(3)
        line(cx + c * xb + sn * dy, py - sn * xb + c * dy, cx + c * xb + sn * tk, py - sn * xb + c * tk)
      }
    }
  }
  // speed scale on the left, height scale on the right: the ticks run past a fixed pointer
  const half = R(30)
  const step = Math.max(3, R(5))
  for (let side = -1; side <= 1; side += 2) {
    const x = cx + side * R(62)
    line(x, py - half, x, py + half)
    const value = side < 0 ? live.speed * 0.6 : live.alt * 0.8
    const off = ((value % (step * 4)) + step * 4) % (step * 4)
    for (let y = -half - step * 4; y <= half; y += step) {
      const yy = Math.round(py + y + off)
      if (yy < py - half || yy > py + half) continue
      const long = Math.round((y + half + step * 4) / step) % 4 === 0
      line(x, yy, x - side * (long ? R(6) : R(3)), yy)
    }
    const px = x + side * R(4)
    line(px, py, px + side * R(4), py - R(3))
    line(px, py, px + side * R(4), py + R(3))
    line(px + side * R(4), py - R(3), px + side * R(4), py + R(3))
  }
  const spd = String(Math.round(live.speed * 4.2))
  text(cx - R(62) - spd.length * 2, py - half - 8, spd)
  const alt = String(Math.round(live.alt * 120))
  text(cx + R(62) - alt.length * 2, py - half - 8, alt)
  // three bars over the reticle: they fill as the thrusters open
  const bars = live.boost > 0.66 ? 3 : live.boost > 0.33 ? 2 : live.boost > 0.05 ? 1 : 0
  for (let i = 0; i < 3; i++) {
    const y = py - R(22) + i * R(4)
    const w = i === 1 ? R(6) : R(9)
    if (i >= 3 - bars) line(cx - w, y, cx + w, y)
    else { put(cx - w, y); put(cx + w, y) }
  }
  // heading scale along the bottom
  const by = py + R(40)
  const span = R(34)
  line(cx - span, by, cx + span, by)
  const hd = ((((live.heading * 180) / Math.PI) % 360) + 360) % 360
  const per = Math.max(2, R(4)) / 5 // px per degree: a tick every 5°
  for (let t = Math.floor((hd - 60) / 5) * 5; t <= hd + 60; t += 5) {
    const x = Math.round(cx + (t - hd) * per)
    if (Math.abs(x - cx) > span) continue
    line(x, by, x, by - (((t % 15) + 15) % 15 === 0 ? R(4) : R(2)))
  }
  line(cx, by + R(2), cx - R(3), by + R(6))
  line(cx, by + R(2), cx + R(3), by + R(6))
  line(cx - R(3), by + R(6), cx + R(3), by + R(6))
  text(cx - 5, by - R(4) - 8, String(Math.round(hd)).padStart(3, '0'))
}

/** lays the cockpit over the frame and draws its live parts */
export function drawCockpit(fb, art, live) {
  const { W, H, s, cx } = art
  const B = art.pal.body
  const A = art.pal.hot
  const R = (v) => Math.round(v * s)
  const a = clamp(live.inPlace, 0, 1)
  if (a <= 0) return
  const t = live.time

  // how far each layer is shifted: it slides in as the camera arrives, then sways with the head
  const hx = live.headX * s
  const hy = live.headY * s
  const away = 1 - a
  // (the slide keeps its fraction of a pixel, f, so the layers glide rather than step)
  const off = (near, slide) => {
    const whole = Math.floor(slide)
    return {
      x: -clamp(Math.round(hx * near), -art.pad, art.pad),
      y: -clamp(Math.round(hy * near), -art.pad, art.pad) + whole,
      f: slide - whole,
    }
  }
  const deckSlide = away * (H - art.deckTop + 8) * 1.5
  const oCanopy = off(NEAR.canopy, -away * H * 0.62)
  const oGlass = off(NEAR.glass, away * (H - art.panelTop + 8))
  const oPanel = off(NEAR.panel, away * (H - art.panelTop + 8))
  const oDeck = off(NEAR.deck, deckSlide)
  const oLever = off(NEAR.lever, deckSlide)
  const oStick = off(NEAR.stick, deckSlide)
  const oRear = off(NEAR.rear, -away * H * 0.9)

  // sunlight: a slanted band that crosses the cockpit as the jet turns to and from the sun
  let light = null
  if (live.sunPower > 0.02 && live.sunReach > 0.02) {
    // light from the right lands on the left, and leans the way it is travelling
    light = {
      x: cx - live.sunSide * R(176),
      slope: clamp(Math.tan(live.roll) * 0.9 - live.sunSide * 0.6, -2.4, 2.4),
      half: R(78),
      k: Math.round(58 * live.sunPower * live.sunReach),
      col: live.sunColor,
      y0: art.panelTop,
    }
  }

  // (the hoop is further from the light's path, so it catches less of it)
  const canopyLight = light ? { ...light, k: light.k >> 1 } : null
  lay(fb, art, art.canopy, oCanopy.x, oCanopy.y, oCanopy.f, -art.pad, H + art.pad, canopyLight)
  drawHud(fb, art, live, oGlass.x, oGlass.y)
  lay(fb, art, art.panel, oPanel.x, oPanel.y, oPanel.f, art.panelTop, H + art.pad, light)

  const v = new Sheet(fb, W, H)
  v.ox = oPanel.x
  v.oy = oPanel.y

  // lamp strip: two steady, one winking; all on when the thrusters are open
  for (let i = 0; i < art.lamps.length; i++) {
    const r = art.lamps[i]
    const on = live.boost > 0.25 || i < 2 || (i === 2 && ((t * 2) | 0) % 2 === 0) || (i === 4 && hash(((t * 3) | 0) * 7) > 200)
    if (!on) continue
    v.box(r.x, r.y, r.x + r.w, r.y + r.h, A[4])
    v.box(r.x, r.y, r.x + r.w, r.y + 1, A[5])
  }
  for (let i = 0; i < art.panelKeys.length; i++) {
    const r = art.panelKeys[i]
    if (hash(i * 53 + ((t * (0.7 + i * 0.23)) | 0)) > 150) continue
    v.box(r.x, r.y, r.x + r.w, r.y + r.h, B[3])
  }

  // a sheet of glass over a screen or dial: shaded under its rim, with a slanting reflection
  const glass = (x0, y0, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (y < 2 || x < 2) v.tint(x0 + x, y0 + y, BLACK, y < 1 || x < 1 ? 120 : 60)
        else {
          const d = x + y * 0.9 - w * 0.34
          if (d > 0 && d < w * 0.16) v.tint(x0 + x, y0 + y, WHITE, 22)
          else if (d > w * 0.24 && d < w * 0.28) v.tint(x0 + x, y0 + y, WHITE, 16)
        }
      }
    }
  }

  // radar: the ground round the jet, nose up, under range rings, with a sweep
  {
    const r = art.radar
    const mx = r.x + (r.w >> 1)
    const my = r.y + (r.h >> 1)
    const rad = Math.min(r.w, r.h) * 0.47
    const zoom = 9 / s
    const sweep = (t * 1.6) % (Math.PI * 2)
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const dx = x - (r.w >> 1)
        const dy = y - (r.h >> 1)
        const d = Math.sqrt(dx * dx + dy * dy)
        const m = live.land(dx * zoom, -dy * zoom)
        let tone = m >= 3 ? 4 : m === 2 ? 3 : m === 1 ? 1 : (y & 1) === 0 ? 0 : 1
        if (m < 2 && (dx === 0 || dy === 0)) tone = 2
        const ring = d / rad
        if (m < 3 && (Math.abs(ring - 1) < 0.5 / rad || Math.abs(ring - 0.66) < 0.5 / rad || Math.abs(ring - 0.33) < 0.5 / rad)) tone = Math.max(tone, m === 2 ? 4 : 2)
        if (d <= rad) {
          let da = sweep - Math.atan2(dx, -dy)
          da -= Math.PI * 2 * Math.floor(da / (Math.PI * 2))
          if (da < 0.12) tone = 5
          else if (da < 0.7 && tone < 5) tone++
        }
        v.put(r.x + x, r.y + y, CRT[tone])
      }
    }
    for (let i = 0; i + 1 < live.blips.length; i += 2) {
      const bx = mx + Math.round(live.blips[i] / zoom)
      const by = my - Math.round(live.blips[i + 1] / zoom)
      if (bx > r.x + 1 && bx < r.x + r.w - 2 && by > r.y + 1 && by < r.y + r.h - 2) v.box(bx, by, bx + 2, by + 2, CRT[5])
    }
    for (const [ox, oy] of [[0, -2], [0, -1], [-1, 0], [0, 0], [1, 0], [-2, 1], [2, 1]]) v.put(mx + ox, my + oy, CRT[5])
    for (let i = 0; i < 3; i++) v.box(r.x + 3, r.y + 3 + i * 3, r.x + 3 + (i === 1 ? 9 : 13), r.y + 5 + i * 3, CRT[3])
    for (let i = 0; i < 3; i++) v.box(r.x + r.w - 15, r.y + r.h - 11 + i * 3, r.x + r.w - 3, r.y + r.h - 9 + i * 3, CRT[i === 2 ? 4 : 3])
    v.box(r.x + r.w - 14, r.y + 3, r.x + r.w - 3, r.y + 5, CRT[2])
    glass(r.x, r.y, r.w, r.h)
  }

  // status screen: the jet from above, engine bars, speed and height
  {
    const r = art.status
    for (let y = 0; y < r.h; y++) v.box(r.x, r.y + y, r.x + r.w, r.y + y + 1, CRT[(y & 1) === 0 ? 0 : 1])
    const j = live.jet
    const fit = Math.min((r.h - 8) / j.h, (r.w * 0.5) / j.w)
    const jw = Math.round(j.w * fit)
    const jh = Math.round(j.h * fit)
    const jx = r.x + Math.round(r.w * 0.31) - (jw >> 1)
    const jy = r.y + ((r.h - jh) >> 1)
    const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= jw || yy >= jh ? 0 : j.cells[Math.min(j.h - 1, Math.floor(yy / fit)) * j.w + Math.min(j.w - 1, Math.floor(xx / fit))])
    for (let y = 0; y < jh; y++) {
      for (let x = 0; x < jw; x++) {
        const c = at(x, y)
        if (c === 0) continue
        const rim = at(x - 1, y) === 0 || at(x + 1, y) === 0 || at(x, y - 1) === 0 || at(x, y + 1) === 0
        v.put(jx + x, jy + y, c === 2 ? (rim ? A[2] : A[3]) : c === 3 ? CRT[5] : rim ? CRT[2] : CRT[3])
      }
    }
    if (hash((t * 12) | 0) > 60) {
      v.box(jx + (jw >> 1) - 3, jy + jh, jx + (jw >> 1) - 1, jy + jh + 1 + Math.round(live.boost * 3), A[5])
      v.box(jx + (jw >> 1) + 1, jy + jh, jx + (jw >> 1) + 3, jy + jh + 1 + Math.round(live.boost * 3), A[5])
    }
    const bh = r.h - 16
    for (let e = 0; e < 2; e++) {
      const bx = r.x + Math.round(r.w * 0.66) + e * Math.max(8, R(12))
      const by = r.y + 7
      const bw = Math.max(5, R(8))
      v.box(bx - 1, by - 1, bx + bw + 1, by + bh + 1, CRT[3])
      v.box(bx, by, bx + bw, by + bh, CRT[0])
      const level = clamp(0.5 + 0.45 * live.boost + (hash(((t * 9) | 0) + e * 31) - 128) / 2600, 0, 1)
      const filled = Math.round(bh * level)
      for (let y = 0; y < filled; y++) if (y % 3 !== 2) v.box(bx + 1, by + bh - 1 - y, bx + bw - 1, by + bh - y, y > bh * 0.8 ? A[4] : CRT[4])
      v.box(bx, r.y + 2, bx + bw, r.y + 4, CRT[3])
    }
    v.text(r.x + 3, r.y + r.h - 7, String(Math.round(live.speed * 4.2)).padStart(3, '0'), CRT[4])
    v.text(r.x + 3, r.y + 3, String(Math.round(live.alt * 120)).padStart(5, '0'), CRT[4])
    glass(r.x, r.y, r.w, r.h)
  }

  // attitude ball: a sphere of sky over ground with a pitch ladder, turning with the jet
  {
    const b = art.ball
    const cr = Math.cos(live.roll)
    const sr = Math.sin(live.roll)
    const per = b.r / 34 // px per degree
    const po = clamp(live.pitch * (180 / Math.PI) * per * 0.9, -b.r * 0.85, b.r * 0.85)
    const rung = Math.max(3, Math.round(5 * per * 2) / 2)
    for (let dy = -b.r; dy <= b.r; dy++) {
      for (let dx = -b.r; dx <= b.r; dx++) {
        const d2 = dx * dx + dy * dy
        if (d2 > b.r * b.r) continue
        const bx = cr * dx - sr * dy
        const by = sr * dx + cr * dy - po
        let col = by > 0 ? (by > b.r * 0.55 ? EARTH2 : EARTH) : by < -b.r * 0.55 ? SKY : SKY2
        if (Math.abs(by) < 0.6) col = WHITE
        else {
          const k = Math.round(by / rung)
          if (k !== 0 && Math.abs(by - k * rung) < 0.55 && Math.abs(bx) < (k % 2 === 0 ? b.r * 0.34 : b.r * 0.18)) col = WHITE
          else if (Math.abs(bx) < 0.6 && Math.abs(by) < b.r * 0.7) col = WHITE
        }
        // it is round: it falls away into shade at the rim, darkest lower right,
        // and the ring above it shades its upper left edge
        const rim = d2 / (b.r * b.r)
        const fall = rim > 0.9 ? 130 : rim > 0.74 ? 80 : rim > 0.55 ? 34 : 0
        const lowerRight = (dx + dy) / (b.r * 1.4142)
        col = mix(col, BLACK, clamp(fall + Math.round(lowerRight * 46), 0, 200))
        v.put(b.x + dx, b.y + dy, col)
      }
    }
    // a highlight on the glass over it
    for (let dy = -b.r; dy < 0; dy++) {
      for (let dx = -b.r; dx < 0; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / b.r
        if (d > 0.5 && d < 0.72 && dx < dy * 0.4 + b.r * 0.1 && dx > dy * 2.4) v.tint(b.x + dx, b.y + dy, WHITE, 54)
      }
    }
    // the fixed aircraft mark, standing clear of the ball
    v.box(b.x - Math.round(b.r * 0.62), b.y + 1, b.x - Math.round(b.r * 0.2), b.y + 2, BLACK)
    v.box(b.x + Math.round(b.r * 0.2) + 1, b.y + 1, b.x + Math.round(b.r * 0.62) + 1, b.y + 2, BLACK)
    v.box(b.x - Math.round(b.r * 0.62), b.y, b.x - Math.round(b.r * 0.2), b.y + 1, LAMP[1])
    v.box(b.x + Math.round(b.r * 0.2) + 1, b.y, b.x + Math.round(b.r * 0.62) + 1, b.y + 1, LAMP[1])
    v.box(b.x - 1, b.y - 1, b.x + 2, b.y + 2, LAMP[1])
    v.put(b.x, b.y, LAMP[2])
  }

  // four dials: speed, height, climb, turn — needles standing off the face, glass on top
  {
    const needles = [
      -225 + clamp(live.speed / Math.max(1, live.speedMax), 0, 1) * 270,
      -225 + clamp(live.alt / Math.max(1, live.altMax), 0, 1) * 270,
      -90 + clamp(live.climb, -1, 1) * 120,
      -90 + clamp(live.turn, -1, 1) * 120,
    ]
    for (let i = 0; i < art.dials.length; i++) {
      const d = art.dials[i]
      const an = (needles[i] * Math.PI) / 180
      v.line(d.x + 1, d.y + 1, d.x + 1 + Math.cos(an) * (d.r - 4), d.y + 1 + Math.sin(an) * (d.r - 4), BLACK)
      v.line(d.x, d.y, d.x + Math.cos(an) * (d.r - 3), d.y + Math.sin(an) * (d.r - 3), A[4])
      v.line(d.x, d.y, d.x - Math.cos(an) * 2, d.y - Math.sin(an) * 2, A[2])
      v.put(d.x, d.y, B[7])
      for (let k = 0; k < 4; k++) {
        const ga = (-150 + k * 12) * (Math.PI / 180)
        v.tint(Math.round(d.x + Math.cos(ga) * (d.r - 5)), Math.round(d.y + Math.sin(ga) * (d.r - 5)), WHITE, 110)
      }
    }
  }

  // ── the nearer layer: consoles and side walls, then the lever and the stick in front of them
  lay(fb, art, art.deck, oDeck.x, oDeck.y, oDeck.f, 0, H + art.pad, light)
  v.ox = oDeck.x
  v.oy = oDeck.y
  for (let i = 0; i < art.deckKeys.length; i++) {
    const r = art.deckKeys[i]
    if (hash(i * 91 + ((t * (0.9 + i * 0.31)) | 0)) > 150) continue
    v.box(r.x, r.y, r.x + r.w, r.y + r.h, B[3])
  }

  // throttle: the handle rides up its rails as the thrusters open
  {
    v.ox = oLever.x
    v.oy = oLever.y
    const th = art.throttle
    const hyy = Math.round(th.y1 - (th.y1 - th.y0) * clamp(0.18 + 0.82 * live.boost, 0, 1))
    const x0 = th.x - R(11)
    const x1 = th.x + th.w - R(6)
    v.box(th.x - R(7), hyy + R(5), th.x - R(4), H + 12, B[5])
    v.box(th.x - R(4), hyy + R(5), th.x - R(3), H + 12, B[1])
    v.box(th.x + R(10), hyy + R(5), th.x + R(13), H + 12, B[5])
    v.box(th.x + R(13), hyy + R(5), th.x + R(14), H + 12, B[1])
    // its shadow on the quadrant, then the grip: a rounded bar, bright on top
    v.box(x0 + R(3), hyy + R(9), x1 + R(3), hyy + R(12), BLACK)
    v.box(x0 - 1, hyy - 1, x1 + 1, hyy + R(9) + 1, B[0])
    v.box(x0, hyy, x1, hyy + R(9), A[3])
    v.box(x0, hyy, x1, hyy + Math.max(1, R(1.5)), A[4])
    v.box(x0 + 1, hyy + 1, x1 - 1, hyy + Math.max(2, R(3)), A[5])
    v.box(x0, hyy + R(6), x1, hyy + R(9), A[2])
    v.box(x0, hyy + R(8), x1, hyy + R(9), A[1])
    v.box(x1 - R(5), hyy + 1, x1 - R(4), hyy + R(8), A[2])
  }

  // stick: the nearest thing on the panel side, standing up in front of the instruments.
  // It leans with the turn and the climb, pivoting far below the frame.
  {
    v.ox = oStick.x
    v.oy = oStick.y
    const topY = art.stick.y - Math.round(clamp(live.climb, -1, 1) * R(3))
    const lean = clamp(live.turn, -1, 1) * R(9)
    const reach = H + R(40) - topY
    const headH = Math.max(7, R(14))
    const gripH = Math.max(8, R(17))
    const fold = Math.max(3, R(5))
    const bottom = H + art.pad
    // its shadow, thrown down and to the right on to the consoles
    for (let y = topY + R(4); y < bottom; y++) {
      const x = Math.round(art.stick.x + lean * (1 - (y - topY) / reach)) + R(5)
      const d = y - topY
      const hw = d < headH ? R(12) : d < headH + gripH ? R(8) : R(12) + Math.floor((d - headH - gripH) / fold) * R(3)
      for (let i = -hw; i <= hw; i++) if (((x + i + y) & 1) === 0) v.tint(x + i, y + R(3), BLACK, 150)
    }
    for (let y = topY; y < bottom; y++) {
      const d = y - topY
      const x = Math.round(art.stick.x + lean * (1 - d / reach))
      if (d < headH) {
        // the head: a rounded block, lit along its top
        const round = d < 2 ? 2 - d : d > headH - 2 ? 1 : 0
        const hw = R(12) - round
        for (let i = -hw; i <= hw; i++) {
          const f = i / hw
          v.put(x + i, y, d === 0 ? B[5] : d < Math.max(2, R(3)) ? B[6] : d > headH - Math.max(2, R(3)) ? B[1] : f < -0.8 ? B[5] : f > 0.78 ? B[1] : f > 0.3 ? B[2] : B[3])
        }
        v.put(x - hw - 1, y, B[0])
        v.put(x + hw + 1, y, B[0])
      } else if (d < headH + gripH) {
        // the grip: a column with finger grooves, bright down its left and dark down its right
        const hw = R(8)
        const groove = (d - headH) % Math.max(3, R(4)) === Math.max(2, R(3))
        for (let i = -hw; i <= hw; i++) {
          const f = i / hw
          let col = f < -0.8 ? B[2] : f < -0.45 ? B[5] : f < -0.05 ? B[4] : f < 0.45 ? B[3] : f < 0.8 ? B[1] : B[0]
          if (groove) col = f < -0.05 ? B[2] : B[0]
          v.put(x + i, y, col)
        }
        v.put(x - hw - 1, y, B[0])
        v.put(x + hw + 1, y, B[0])
        if (d === headH) for (let i = -hw; i <= hw; i++) v.put(x + i, y, B[0]) // under the head
      } else {
        // the rubber boot: folds that widen towards the floor
        const n = Math.floor((d - headH - gripH) / fold)
        const within = (d - headH - gripH) % fold
        const hw = R(12) + n * R(3) - (within === 0 ? 1 : 0)
        for (let i = -hw; i <= hw; i++) {
          const f = i / hw
          v.put(x + i, y, within === 0 ? (f < 0.2 ? B[4] : B[2]) : within === fold - 1 ? B[0] : f < -0.55 ? B[2] : f > 0.5 ? B[0] : B[1])
        }
        v.put(x - hw - 1, y, B[0])
        v.put(x + hw + 1, y, B[0])
      }
    }
    // outline over the head, then its buttons: one dark, one that lights with the thrusters
    const hx0 = Math.round(art.stick.x + lean)
    v.box(hx0 - R(12) + 2, topY - 1, hx0 + R(12) - 1, topY, B[0])
    v.disc(hx0 - R(6), topY + R(7) + 1, Math.max(2, R(4.2)), B[0])
    v.disc(hx0 - R(6), topY + R(7), Math.max(2, R(3.4)), B[2])
    v.disc(hx0 - R(6) - 1, topY + R(7) - 1, Math.max(1, R(1.4)), B[6])
    v.disc(hx0 + R(6), topY + R(7) + 1, Math.max(2, R(4.2)), B[0])
    v.disc(hx0 + R(6), topY + R(7), Math.max(2, R(3.4)), live.boost > 0.3 ? A[5] : A[3])
    v.put(hx0 + R(6) - 1, topY + R(7) - 1, live.boost > 0.3 ? WHITE : A[5])
  }

  // the frame behind your head, nearest of all
  lay(fb, art, art.rear, oRear.x, oRear.y, oRear.f, -art.pad, art.rearBottom + 1, null)
}
