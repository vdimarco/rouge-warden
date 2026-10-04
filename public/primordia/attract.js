// Attract screen for the Primordia arcade cabinet: a small live Lenia dish in demo mode.
// The arcade loads this module only when the cabinet is selected, and calls frame() each animation frame.

import { Game } from "./core.js";

const N = 128;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function mountAttract(canvas) {
  const game = new Game(N, N);
  game.reset("demo");
  const g = canvas.getContext("2d");
  const off = document.createElement("canvas");
  off.width = N; off.height = N;
  const og = off.getContext("2d");
  const img = og.createImageData(N, N);
  // a tiny copy for the glow: drawn small, then stretched with smoothing
  const glow = document.createElement("canvas");
  glow.width = 32; glow.height = 32;
  const gg = glow.getContext("2d");
  let last = 0;

  function paint() {
    const { A, B, N: agar } = game.world, d = img.data;
    for (let i = 0, j = 0; i < A.length; i++, j += 4) {
      const a = A[i], b = B[i], n = agar[i];
      // agar: deep teal when fresh, murky violet when eaten
      let r = mix(13, 4, n), gr = mix(5, 18, n), bl = mix(18, 26, n);
      const pa = smooth(0.04, 0.3, a), pb = smooth(0.04, 0.3, b);
      if (pa > 0) {
        const lo = smooth(0.08, 0.45, a), hi = smooth(0.55, 0.95, a);
        const cr = mix(mix(5, 20, lo), 191, hi), cg = mix(mix(64, 217, lo), 255, hi), cb = mix(mix(82, 217, lo), 235, hi);
        r = mix(r, cr, pa); gr = mix(gr, cg, pa); bl = mix(bl, cb, pa);
      }
      if (pb > 0) {
        const lo = smooth(0.08, 0.5, b), hi = smooth(0.6, 0.98, b);
        const cr = mix(mix(89, 255, lo), 255, hi), cg = mix(mix(5, 41, lo), 184, hi), cb = mix(mix(31, 115, lo), 140, hi);
        r = mix(r, cr, pb); gr = mix(gr, cg, pb); bl = mix(bl, cb, pb);
      }
      d[j] = r; d[j + 1] = gr; d[j + 2] = bl; d[j + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    // cover the cabinet screen, keeping the dish square
    const s = Math.max(canvas.width / N, canvas.height / N), w = N * s, h = N * s;
    const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.drawImage(off, x, y, w, h);
    gg.clearRect(0, 0, 32, 32);
    gg.drawImage(off, 0, 0, 32, 32);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.45;
    g.drawImage(glow, x, y, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  paint();
  return {
    frame(now) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      game.update(dt, {});
      game.events.length = 0;
      paint();
    },
    pause() { last = 0; },
  };
}
