// The finish laid over each frame once the scene is drawn: the flash of an explosion, a glow
// round everything that burns or shines, richer colour, darkened corners and film grain.
// It works on the picture's own pixels (one Uint32 each, 0xAABBGGRR), so the glow is in the same
// big pixels as everything else. Every part can be turned down to nothing.

 









export function createPost() {
  let W = 0
  let H = 0
  let hw = 0
  let hh = 0
  let glow = new Float32Array(0) // half-size, three numbers a cell
  let tmp = new Float32Array(0)
  let corner = new Uint8Array(0) // 0 in the middle of the frame … 255 in its corners
  const hot = new Uint8Array(32768) // how strongly each colour shines, by its top five bits a channel
  const curve = new Uint8Array(256) // contrast
  let curveFor = -1
  let seed = 1

  function resize(w, h) {
    W = w
    H = h
    hw = (w + 1) >> 1
    hh = (h + 1) >> 1
    glow = new Float32Array(hw * hh * 3)
    tmp = new Float32Array(hw * hh * 3)
    corner = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5) / w - 0.5
        const dy = (y + 0.5) / h - 0.5
        const d = clamp01(((dx * dx + dy * dy) * 4 - 0.3) / 1.5)
        corner[y * w + x] = Math.round(255 * d * d * (3 - 2 * d))
      }
    }
  }

  /** one pass of a blur along the rows (or down the columns) of the half-size picture */
  function blur(from, to, r, down) {
    const n = down ? hh : hw
    const lines = down ? hw : hh
    const step = (down ? hw : 1) * 3
    const k = 1 / (r * 2 + 1)
    for (let l = 0; l < lines; l++) {
      const base = (down ? l : l * hw) * 3
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0
        for (let i = -r; i <= r; i++) sum += from[base + Math.min(n - 1, Math.max(0, i)) * step + ch]
        for (let i = 0; i < n; i++) {
          to[base + i * step + ch] = sum * k
          sum += from[base + Math.min(n - 1, i + r + 1) * step + ch] - from[base + Math.max(0, i - r) * step + ch]
        }
      }
    }
  }

  return {
    /** which colours shine, and how strongly (0..1): the scene's own flat colours for fire, the sun and so on */
    setHot(list) {
      hot.fill(0)
      for (const [c, w] of list) {
        const key = (((c & 255) >> 3) << 10) | ((((c >> 8) & 255) >> 3) << 5) | (((c >> 16) & 255) >> 3)
        hot[key] = Math.max(hot[key], Math.round(255 * clamp01(w)))
      }
    },
    apply(fb, w, h, look) {
      if (w !== W || h !== H) resize(w, h)
      const n = w * h
      // the flash of an explosion: everything is lit, warm and white, for a moment
      const flash = clamp01(look.flash)
      if (flash > 0.01) {
        const k = Math.round(150 * flash)
        for (let i = 0; i < n; i++) {
          const c = fb[i]
          const r = c & 255
          const g = (c >> 8) & 255
          const b = (c >> 16) & 255
          fb[i] = ((255 << 24) | ((b + (((214 - b) * k) >> 8)) << 16) | ((g + (((244 - g) * k) >> 8)) << 8) | (r + (((255 - r) * k) >> 8))) >>> 0
        }
      }
      // the glow: what shines is gathered at half size, blurred, and added back
      const bloom = clamp01(look.bloom)
      if (bloom > 0.01) {
        glow.fill(0)
        let any = false
        for (let y = 0; y < h; y++) {
          const row = (y >> 1) * hw
          let i = y * w
          for (let x = 0; x < w; x++, i++) {
            const c = fb[i]
            const s = hot[(((c & 255) >> 3) << 10) | ((((c >> 8) & 255) >> 3) << 5) | (((c >> 16) & 255) >> 3)]
            if (s === 0) continue
            const o = (row + (x >> 1)) * 3
            glow[o] += (c & 255) * s
            glow[o + 1] += ((c >> 8) & 255) * s
            glow[o + 2] += ((c >> 16) & 255) * s
            any = true
          }
        }
        if (any) {
          const r = Math.max(2, Math.round(hw / 70))
          blur(glow, tmp, r, false)
          blur(tmp, glow, r, true)
          blur(glow, tmp, r, false)
          blur(tmp, glow, r, true)
          // (a cell holds up to four pixels at full strength: 4 × 255 × 255)
          const gain = (bloom * 3.4) / (4 * 255)
          for (let y = 0; y < h; y++) {
            const row = (y >> 1) * hw
            let i = y * w
            for (let x = 0; x < w; x++, i++) {
              const o = (row + (x >> 1)) * 3
              const gr = glow[o] * gain
              const gg = glow[o + 1] * gain
              const gb = glow[o + 2] * gain
              if (gr + gg + gb < 3) continue
              const c = fb[i]
              const rr = (c & 255) + gr
              const g2 = ((c >> 8) & 255) + gg
              const bb = ((c >> 16) & 255) + gb
              fb[i] = ((255 << 24) | ((bb > 255 ? 255 : bb | 0) << 16) | ((g2 > 255 ? 255 : g2 | 0) << 8) | (rr > 255 ? 255 : rr | 0)) >>> 0
            }
          }
        }
      }
      // colour, corners and grain, in one go over the frame
      const vivid = clamp01(look.vivid)
      const vig = Math.round(clamp01(look.vignette) * 150)
      const grain = Math.round(clamp01(look.grain) * 28)
      if (vivid < 0.01 && vig === 0 && grain === 0) return
      const key = Math.round(vivid * 100)
      if (key !== curveFor) {
        curveFor = key
        const cn = 1 + 0.22 * vivid
        for (let v = 0; v < 256; v++) curve[v] = Math.min(255, Math.max(0, Math.round(128 + (v - 128) * cn + 4 * vivid)))
      }
      const sat = Math.round(256 * (1 + 0.38 * vivid))
      for (let i = 0; i < n; i++) {
        const c = fb[i]
        let r = c & 255
        let g = (c >> 8) & 255
        let b = (c >> 16) & 255
        if (key > 0) {
          const l = (r * 77 + g * 150 + b * 29) >> 8
          r = l + (((r - l) * sat) >> 8)
          g = l + (((g - l) * sat) >> 8)
          b = l + (((b - l) * sat) >> 8)
          r = curve[r < 0 ? 0 : r > 255 ? 255 : r]
          g = curve[g < 0 ? 0 : g > 255 ? 255 : g]
          b = curve[b < 0 ? 0 : b > 255 ? 255 : b]
        }
        if (vig > 0) {
          const k = 256 - ((corner[i] * vig) >> 8)
          r = (r * k) >> 8
          g = (g * k) >> 8
          b = (b * k) >> 8
        }
        if (grain > 0) {
          seed = (Math.imul(seed, 1664525) + 1013904223) | 0
          const d = (((seed >>> 16) & 255) * grain >> 8) - (grain >> 1)
          r += d
          g += d
          b += d
          r = r < 0 ? 0 : r > 255 ? 255 : r
          g = g < 0 ? 0 : g > 255 ? 255 : g
          b = b < 0 ? 0 : b > 255 ? 255 : b
        }
        fb[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
      }
    },
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
