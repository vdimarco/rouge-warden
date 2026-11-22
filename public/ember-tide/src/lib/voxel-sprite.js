// A small voxel model drawn as pixel art, from any side: the pilot and his seat.
//
// The jet is a stack of slices, and only ever seen from above or behind. The pilot tumbles out
// of it and is watched from wherever the camera happens to be, so he is drawn voxel by voxel
// with a depth of his own, and then inked the way a pixel artist would: a dark line round the
// whole figure, and a shadow line wherever one part of him passes in front of another.

 













/**
 * The visible shell of a grid of palette indices (index (z·L + k)·W + i; k runs from the front
 * of the model to its back), measured from a pivot given the same way.
 */
export function shellOf(grid, W, L, H, pivot) {
  const full = (i, k, z) => i >= 0 && k >= 0 && z >= 0 && i < W && k < L && z < H && grid[(z * L + k) * W + i] !== 0
  const xs = []
  const ys = []
  const zs = []
  const cs = []
  const ds = []
  let reach = 0
  for (let z = 0; z < H; z++) {
    for (let k = 0; k < L; k++) {
      for (let i = 0; i < W; i++) {
        const v = grid[(z * L + k) * W + i]
        if (!v) continue
        if (full(i - 1, k, z) && full(i + 1, k, z) && full(i, k - 1, z) && full(i, k + 1, z) && full(i, k, z - 1) && full(i, k, z + 1)) continue
        // it faces away from the solid around it
        let nx = 0
        let nk = 0
        let nz = 0
        for (let dz = -2; dz <= 2; dz++) {
          for (let dk = -2; dk <= 2; dk++) {
            for (let di = -2; di <= 2; di++) {
              if ((!di && !dk && !dz) || full(i + di, k + dk, z + dz)) continue
              const w = 1 / (di * di + dk * dk + dz * dz)
              nx += di * w
              nk += dk * w
              nz += dz * w
            }
          }
        }
        const l = Math.hypot(nx, nk, nz) || 1
        const sx = nx / l > 0.42 ? 1 : nx / l < -0.42 ? -1 : 0
        const sy = -nk / l > 0.42 ? 1 : -nk / l < -0.42 ? -1 : 0
        const sz = nz / l > 0.42 ? 1 : nz / l < -0.42 ? -1 : 0
        const px = i - (W - 1) / 2 - pivot[0]
        const py = pivot[1] - (k + 0.5)
        const pz = z + 0.5 - pivot[2]
        xs.push(px)
        ys.push(py)
        zs.push(pz)
        cs.push(v)
        ds.push(sx + 1 + 3 * (sy + 1) + 9 * (sz + 1))
        reach = Math.max(reach, Math.hypot(px, py, pz))
      }
    }
  }
  return { n: xs.length, x: new Float32Array(xs), y: new Float32Array(ys), z: new Float32Array(zs), c: new Uint8Array(cs), d: new Uint8Array(ds), reach: reach + 1 }
}

/** half way from one colour to another */
const between = (a, b) => ((((a ^ b) & 0xfefefefe) >>> 1) + (a & b)) >>> 0

/** how one model stands in the picture: its three axes, each as (right, down, away) per voxel, in pixels */
 



export function createVoxelPainter() {
  let side = 0
  let ink = new Uint16Array(0) // 0 empty, else palette index + 256·(shade + 1)
  let deep = new Float32Array(0)
  let cx = 0
  let cy = 0
  let x0 = 0
  let y0 = 0
  let x1 = 0
  let y1 = 0
  const offX = new Float32Array(125)
  const offY = new Float32Array(125)
  const offD = new Float32Array(125)
  const tone = new Int8Array(27)

  return {
    /** start a figure whose middle is at (x, y) and which reaches no farther than `reach` pixels from it */
    begin(x, y, reach) {
      const need = Math.min(1024, (Math.ceil(reach) + 3) * 2 + 1)
      if (need > side) {
        side = need
        ink = new Uint16Array(side * side)
        deep = new Float32Array(side * side)
      } else ink.fill(0)
      cx = Math.round(x) - (side >> 1)
      cy = Math.round(y) - (side >> 1)
      x0 = side
      y0 = side
      x1 = -1
      y1 = -1
    },
    /**
     * Add a model to the figure, its pivot at (px, py) in the picture and `pd` away.
     * `light` is where the light comes from in the model's own axes (across, forward, up);
     * voxels below `floor` (in voxels above the pivot) are left out.
     */
    add(m, pose, px, py, pd, light, floor = -1e9) {
      // surfaces turned to the light are a tone lighter, those turned away a tone darker
      const ll = Math.hypot(light[0], light[1], light[2]) || 1
      for (let i = 0; i < 27; i++) {
        const sx = (i % 3) - 1
        const sy = (((i / 3) | 0) % 3) - 1
        const sz = ((i / 9) | 0) - 1
        const l = Math.hypot(sx, sy, sz)
        const b = l ? (sx * light[0] + sy * light[1] + sz * light[2]) / (l * ll) : 0
        tone[i] = b > 0.62 ? 2 : b < -0.45 ? 0 : 1
      }
      // several samples per voxel, more the larger it is drawn, so a turned figure has no pin-holes
      const big = Math.max(Math.hypot(pose[0], pose[1]), Math.hypot(pose[3], pose[4]), Math.hypot(pose[6], pose[7]))
      const ns = Math.max(1, Math.min(5, Math.ceil(big * 1.7)))
      let no = 0
      for (let a = 0; a < ns; a++) {
        for (let b = 0; b < ns; b++) {
          for (let c = 0; c < ns; c++) {
            const oa = (a + 0.5) / ns - 0.5
            const ob = (b + 0.5) / ns - 0.5
            const oc = (c + 0.5) / ns - 0.5
            offX[no] = oa * pose[0] + ob * pose[3] + oc * pose[6]
            offY[no] = oa * pose[1] + ob * pose[4] + oc * pose[7]
            offD[no] = oa * pose[2] + ob * pose[5] + oc * pose[8]
            no++
          }
        }
      }
      const bx = px - cx
      const by = py - cy
      for (let v = 0; v < m.n; v++) {
        const c = m.z[v]
        if (c < floor) continue
        const a = m.x[v]
        const b = m.y[v]
        const sx = bx + a * pose[0] + b * pose[3] + c * pose[6]
        const sy = by + a * pose[1] + b * pose[4] + c * pose[7]
        const sd = pd + a * pose[2] + b * pose[5] + c * pose[8]
        const code = m.c[v] + (tone[m.d[v]] << 8)
        for (let o = 0; o < no; o++) {
          const x = Math.round(sx + offX[o])
          const y = Math.round(sy + offY[o])
          if (x < 1 || y < 1 || x >= side - 1 || y >= side - 1) continue
          const at = y * side + x
          const d = sd + offD[o]
          if (ink[at] !== 0 && deep[at] <= d) continue
          ink[at] = code
          deep[at] = d
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    },
    /** where the figure last drawn is in the picture: left, top, right, bottom (right < left if it was empty) */
    get left() { return cx + x0 - 1 },
    get top() { return cy + y0 - 1 },
    get right() { return x1 < 0 ? cx - 2 : cx + x1 + 1 },
    get bottom() { return cy + y1 + 1 },
    /**
     * Ink the figure and put it in the picture. `pals` are the palette a tone darker, as it is,
     * and a tone lighter; `gap` is how far one part must stand in front of another (in the same
     * units as the poses' depths) for a line to be drawn between them; `V` is how deep into the
     * view the figure is, and anything in the world's depth buffer nearer than that hides it.
     * Given a `mask` (a byte per pixel of the picture), every pixel it paints is marked 1 there.
     */
    end(fb, zbuf, W, H, V, pals, outline, gap, mask = null) {
      if (x1 < 0) return
      for (let y = y0 - 1; y <= y1 + 1; y++) {
        const fy = y + cy
        if (fy < 0 || fy >= H) continue
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          const fx = x + cx
          if (fx < 0 || fx >= W) continue
          const at = y * side + x
          const code = ink[at]
          let col
          if (code === 0) {
            if (x <= 0 || y <= 0 || x >= side - 1 || y >= side - 1) continue
            if ((ink[at - 1] | ink[at + 1] | ink[at - side] | ink[at + side]) === 0) continue
            col = outline
          } else {
            const d = deep[at] - gap
            // a part of him in front of this one: this pixel is in its shadow line
            const l = ink[at - 1] !== 0 && deep[at - 1] < d
            const r = ink[at + 1] !== 0 && deep[at + 1] < d
            const u = ink[at - side] !== 0 && deep[at - side] < d
            const dn = ink[at + side] !== 0 && deep[at + side] < d
            col = pals[code >> 8][code & 255]
            if (l || r || u || dn) col = between(col, outline)
          }
          const to = fy * W + fx
          if (zbuf && zbuf[to] < V - 1) continue
          fb[to] = col
          if (mask) mask[to] = 1
        }
      }
    },
  }
}
