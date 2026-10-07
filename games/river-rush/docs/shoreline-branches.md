# Shoreline branches

Duck obstacles now grow from shoreline trees, with grounded roots, tapered
bark limbs, leafy crowns and curved low tips. Outer lanes use the nearest bank;
centre-lane trees vary sides deterministically. Connecting wood stays above
standing height across safe lanes. Passed trees remain until the existing
16-metre entity retirement boundary.

Both renderers use the same shape. WebGL reuses the existing wood surface maps
and batches every visible tree into two instanced draws, capped at 32 trees,
768 wood segments and 384 foliage clusters. Foliage art and shaders prepare
before play; the change adds no network asset requests. Speed, duck duration,
collision lanes, rewards, character and controls are unchanged.

Checks: 45 game/geometry tests; actual jump then successful duck on phone,
desktop and short landscape WebGL, phone 2D, and reduced motion. Browser checks
verify shoreline grounding, collision registration, retained passed trees,
pause pixels, unchanged speed, no active shader/texture preparation, and input.
A separate phone check loses the WebGL context and resumes the same run in 2D.

```sh
npm test --prefix games/river-rush
node qa/river-rush/shoreline-branches.mjs
```

The browser check accepts `CASE=phone`, `ARCADE_URL` and `SHOTS`. Screenshots
were inspected for shoreline connection and readable low limbs. Chromium uses
emulated viewports and SwiftShader; physical phones and hardware GPU frame
rates are not measured. OpenSpec CLI is unavailable; proposal/design/tasks and
the added requirement's three scenarios were checked directly as Markdown.

Build hashes, local results and production verification are recorded in
`shoreline-branches-verification.json`.
