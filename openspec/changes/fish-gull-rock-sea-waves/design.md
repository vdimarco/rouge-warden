# Design

## Source

Adapted from [Noniv/web-ocean](https://github.com/Noniv/web-ocean) (MIT, Maksymilian Dendura), `js/wgsl/sim.js`:

- `jonswap()` and `donelanBanner()`: the fetch-limited JONSWAP spectrum with Donelan-Banner spreading.
- `FOAM_UPDATE`: foam injected where the surface Jacobian folds, `f = max(prev * exp(-dt * decay), inject)`, a semi-Lagrangian drift downwind, and a "fresh" channel for bright new crest foam.

The wave method is Tessendorf, "Simulating Ocean Water" (SIGGRAPH course notes, 2001), with the looping dispersion from section 3.4 (each frequency rounded to a multiple of 2π/T, so the waves repeat every T seconds).

## Why bake

web-ocean runs six 256² FFTs and a 1024² foam map every frame on WebGPU. Reel It In runs WebGL2 on phones. One 64² tile over 32 m, looped every 8 s, gives the shapes that the fishing camera can see. The bake runs once per session, in a module worker (`sea-waves-worker.js`), when the player first goes to Gull Rock. If a worker cannot start, it runs on the main thread after a timeout. It takes about 0.2 s on a desktop CPU, so on the main thread it would stall travel on a phone. The CPU data is kept; the GPU texture is freed when the player leaves. Until the bake is done the water shows the old swell, then `uSeaOn` fades the waves in over one second.

## Data

`bakeSeaWaves()` returns 64 frames of 64×64 RGBA8:

- R, G: wave slope along x and z, sharpened by the choppy horizontal displacement (`slope / (1 + dDx/dx)`), stored as `0.5 + s / 1.2`.
- B: foam amount, with fade and drift baked in.
- A: foam freshness (new crest foam).

Foam needs a steady loop. The bake runs the foam update over two loops, so the start state no longer matters (decay `exp(-0.8 · 8)`, 0.2%, per loop), and keeps the second one. A gather over every foam age was tried first, without step-by-step blur, but it cost 0.4 s. Drift is a bilinear, wrapped back-trace in the periodic tile.

The frames go into one `DataArrayTexture` with repeat wrap and mipmaps. The shader blends two frames, at two scales (1× and 2.7× turned 33°) so the tile does not repeat visibly. Low quality reads one scale. Wave detail fades by pixel footprint, as the existing ripples do, and the old sine swell carries the far sea.

## Look

Slopes add to the existing normal gradient `g`, so the reflection, the sun glitter and the painted texture distortion follow the waves. Foam is added to the existing `foam` term below the gameplay marks. Painted style steps the foam with a brush-noise threshold. Original keeps soft foam with streaks for old foam.

## Tuning (after renders)

The first render had foam over about 16% of the sea, in big flat patches that hid the aim dots. Final values: 1.8% of the tile breaks at once, foam fades at 0.8/s, and the bigger copy adds faint foam only (35%). Painted foam is cut at a brush-noise threshold into small dabs. The aim dots, rings and wakes draw after the foam and stay clear.
