// First Breath: the two tiers (design.md 14.3, 14.1's table). The full tier draws 14.1 as written. The low tier draws
// the same sheets from the same draw list, so it still looks like paper cut, with: no grain, one flat shadow per
// sheet (one offset fill, no strokes), no motes, no dapple sheet, 2-disc paper glows, plain tails (no twist), half
// the cilia strips, flat shadows in the bakes. ?q=low pins it (and ?gl=0, its alias); render/perf.js switches to it
// when the rAF interval stays slow at the lowest phone step.
// Source: none fit, our own (14.2).

export const FULL = Object.freeze({
  name: "full",
  grain: 1,            // grain alpha on large sheets
  shadow: "cheap",     // moving sheets: one offset fill plus strokes
  shadowStrokes: 1,    // widening strokes on a cheap shadow
  bakeShadow: "soft",  // still sheets: the soft clipped-stroke shadow
  edge: true,          // the lit cut edge on moving sheets
  motes: 40,           // render motes drifting at the back (≤ 150)
  dapple: true,
  glowDiscs: 3,
  twist: true,         // tails and cords twist to show their back
  ciliaEvery: 1,
  grainMinPx: 12,      // no grain on moving shapes under about this many px across
});

export const LOW = Object.freeze({
  name: "low",
  grain: 0,
  shadow: "flat",
  shadowStrokes: 0,
  bakeShadow: "flat",
  edge: true,
  motes: 0,
  dapple: false,
  glowDiscs: 2,
  twist: false,
  ciliaEvery: 2,
  grainMinPx: Infinity,
});

export const tierOf = (low) => (low ? LOW : FULL);

// The glow discs of a tier: radius factors and alphas (14.1: r, 0.72 r, 0.45 r at 0.10, 0.12, 0.16).
export function glowDiscs(tier) {
  return tier.glowDiscs >= 3
    ? [[1, 0.1], [0.72, 0.12], [0.45, 0.16]]
    : [[1, 0.14], [0.55, 0.22]];
}
