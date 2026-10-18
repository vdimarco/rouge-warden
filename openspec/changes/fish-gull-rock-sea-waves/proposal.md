# Gull Rock sea waves and crest foam

## Why

The user asked to use the water from [Noniv/web-ocean](https://github.com/Noniv/web-ocean) in Reel It In. That renderer needs WebGPU, runs a live six-cascade FFT and looks photoreal, so it cannot replace the game's WebGL painted water. The user chose two of its ideas, at Gull Rock only:

1. Better wave shapes: a Tessendorf FFT wave tile, baked once and looped, so the phone does no FFT work per frame.
2. Crest foam that fades over time and drifts with the wind.

## What changes

- A new pure module, `public/fish/js/sea-waves.js`, bakes a small looping FFT wave tile with slopes and crest foam (fade and drift baked in).
- The water shader samples that tile when the place has `waves` in its look. Only Gull Rock has it. The other places draw exactly as before.
- The painted look stays the default and stays on top. Foam is drawn as brush dabs in Painted and as soft foam in Original.
- No new mesh, render pass, image file or network request.

## Out of scope

WebGPU, vertex displacement, the web-ocean sky, LEAN glitter and the other places.
