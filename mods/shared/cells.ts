// A small pixel canvas for the animated panes, and the two ways to show it: a terminal Raster of
// half-block cells (two pixels a cell, top in the glyph's colour, bottom in the cell's background),
// and an SVG for the desktop, VS Code and mobile apps. mods/sync.mjs copies it into each mod's
// hooks/shared/.

/** A w by h grid of 0xRRGGBB colours, row-major from the top left. */
export type Pixels = { w: number; h: number; px: Uint32Array }

export const pixels = (w: number, h: number, color = 0): Pixels => ({ w, h, px: new Uint32Array(w * h).fill(color) })

export function plot(p: Pixels, x: number, y: number, color: number): void {
  const ix = Math.floor(x), iy = Math.floor(y)
  if (ix >= 0 && iy >= 0 && ix < p.w && iy < p.h) p.px[iy * p.w + ix] = color
}

export function fillRect(p: Pixels, x0: number, y0: number, x1: number, y1: number, color: number): void {
  const xa = Math.max(0, Math.floor(Math.min(x0, x1))), xb = Math.min(p.w - 1, Math.floor(Math.max(x0, x1)))
  const ya = Math.max(0, Math.floor(Math.min(y0, y1))), yb = Math.min(p.h - 1, Math.floor(Math.max(y0, y1)))
  for (let y = ya; y <= yb; y++) p.px.fill(color, y * p.w + xa, y * p.w + xb + 1)
}

export function disc(p: Pixels, cx: number, cy: number, r: number, color: number): void {
  const r2 = r * r
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) plot(p, x, y, color)
}

/** A line of the given half width (0: one pixel). */
export function line(p: Pixels, x0: number, y0: number, x1: number, y1: number, color: number, half = 0): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n
    if (half <= 0) plot(p, x, y, color)
    else disc(p, x, y, half, color)
  }
}

/** Mixes two 0xRRGGBB colours: t 0 is a, 1 is b. */
export function mix(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  const c = (s: number) => {
    const x = (a >> s) & 255, y = (b >> s) & 255
    return Math.round(x + (y - x) * k) << s
  }
  return c(16) | c(8) | c(0)
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const UPPER_HALF = 0x2580, SPACE = 0x20

/** The Raster `cells` for a canvas: w columns, ceil(h / 2) rows. */
export function rasterCells(p: Pixels): string {
  const cols = p.w, rows = Math.ceil(p.h / 2)
  const words = new Uint32Array(cols * rows * 3)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = p.px[2 * r * cols + c] ?? 0
      const bottom = 2 * r + 1 < p.h ? (p.px[(2 * r + 1) * cols + c] ?? 0) : top
      const i = (r * cols + c) * 3
      words[i] = top === bottom ? SPACE : UPPER_HALF
      words[i + 1] = top
      words[i + 2] = bottom
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}

export const rasterRows = (p: Pixels): number => Math.ceil(p.h / 2)

const hex = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`

/**
 * An SVG of the canvas, `scale` CSS pixels a canvas pixel: one path per colour, one run of a row per
 * subpath, so a frame of 64 by 64 stays far under the SVG limit. `quantize` (0 to 7) drops that many
 * low bits of each channel first, which makes runs longer.
 */
export function svgOf(p: Pixels, scale = 4, quantize = 0): string {
  const mask = (0xff << quantize) & 0xff, keep = (mask << 16) | (mask << 8) | mask
  const paths = new Map<number, string[]>()
  for (let y = 0; y < p.h; y++) {
    let x = 0
    while (x < p.w) {
      const color = (p.px[y * p.w + x] ?? 0) & keep
      let end = x + 1
      while (end < p.w && ((p.px[y * p.w + end] ?? 0) & keep) === color) end++
      let list = paths.get(color)
      if (list === undefined) paths.set(color, (list = []))
      list.push(`M${x} ${y}h${end - x}v1h${x - end}z`)
      x = end
    }
  }
  let body = ''
  for (const [color, runs] of paths) body += `<path fill="${hex(color)}" d="${runs.join('')}"/>`
  const w = p.w * scale, h = p.h * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${p.w} ${p.h}" shape-rendering="crispEdges">${body}</svg>`
}
