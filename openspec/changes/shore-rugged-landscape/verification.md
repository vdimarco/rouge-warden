# Verification

## Passing repository checks

Run each with `node qa/tidebreak/<name>.test.mjs` from the repository root:

- `roads`: deterministic mirrored paths, alternating irregular bends, bounded stretch and curvature, cover/camp/gate clearance, map boundaries, non-intersection, ward spacing and validated failure/fallback behavior.
- `terrain`: deterministic mirrored relief, 465.1-unit off-lane elevation range, level defensive pads, bank carving and bridge approaches across seeds 49, 7 and 101, continuous heights and agreement with mesh triangles (maximum error 0.000173 units).
- `surface`: 42 terrain projection round trips, a grazing-ridge first-contact regression, exact grid boundaries/corners, safe misses, rotated bridge footprints and water mask sampling.
- `terrain-effects`: 958 warning-triangle interiors, circle/capsule masks, water and rotated bridge layers, reusable buffers, bounded growth and fallback diagnostics. Uses the committed Three.js module and runs with plain Node.
- `river`, `scenery`, `towers`: shared seeded banks, one crossing per lane, scenery/collision clearance and the existing defensive progression.
- `pointers`, `targeting`, `tactical-combat`: existing control rules and all 16 heroes' targeting, combat and movement behavior.
- `sim`: six complete matches and deterministic replay passed after the route changes. Every match broke wards; matches finished in 570–967 simulated seconds.

JavaScript syntax checks and `git diff --check` passed. Markdown delta structure was checked for required artifacts, ADDED requirement headings, SHALL statements and WHEN/THEN scenarios. The OpenSpec CLI is unavailable, so its validator did not run. The new winding-road requirement is ADDED because it is absent from the canonical moba-combat spec; an earlier active winding-roads change records the previous implementation.

## Additional CPU integration checks

These temporary Node harnesses use the repository's original Three.js modules and actual renderer methods. They verify calculations and object transforms, not browser rendering.

| Check | Result |
| --- | --- |
| Exact terrain picker against Three Raycaster, 1,000 rays at four camera pitches | Zero misses; maximum error 5.66e-12 units |
| Camera projection/picking at 1440×900, 844×390 and 390×844 | 60 round trips, maximum planar error 0.000034 units; 972 rays matched the ground mesh |
| Real Terrain.build with native Canvas and the original procedural textures/masks | 36 water/deck projection checks passed; 14,152 effect-height queries respected ground/deck surfaces |
| Actual unit/scenery positioning methods | 24 hero roots and 4,088 scenery transforms grounded; maximum scenery Float32 error 0.000587 units |
| Relative-height effect APIs | Ribbon endpoints, spark emissions and point lights receive surface height once; leap/death offsets remain relative |
| Batched ground warnings | 958 terrain-triangle interiors conformed (maximum error 0.000147 units); circle/capsule masks, wet-only layers, rotated deck clipping, buffer reuse/growth and hard limits passed |
| Independent warnings on real Terrain.build | 7,896 triangle interior samples matched actual Float32 mesh planes within 0.000130 units; water overlays used the live mask and bridge layers stayed within all three rotated decks |

Commands for the local temporary harnesses:

```sh
node --experimental-loader /tmp/shore-local-import-loader.mjs /tmp/shore-renderer-math-check.mjs
node --experimental-loader /tmp/shore-local-import-loader.mjs /tmp/shore-grounding-check.mjs
node --experimental-loader /tmp/shore-local-import-loader.mjs /tmp/shore-surface-mesh-check.mjs
node --experimental-loader /tmp/shore-grounding-loader.mjs /tmp/shore-surface-ray-check.mjs
node --experimental-loader /tmp/shore-grounding-loader.mjs /tmp/shore-decal-check.mjs
node --experimental-loader /tmp/shore-grounding-loader.mjs /tmp/shore-effects-check.mjs
node --experimental-loader /tmp/shore-local-import-loader.mjs /tmp/shore-exact-decals-check.mjs
```

The temporary harnesses are not committed test dependencies. Hero/scenery grounding used placeholders or synthetic geometry where original GLBs were unavailable.

## Pending visual QA

The sandbox forbids network sockets. The local HTTP server could not bind, and Chromium also crashed with `setsockopt: Operation not permitted` and SIGTRAP, including the attempted no-server harness. The GitHub connector cannot download binary GLBs. No browser screenshots, WebGL shader compilation/execution, live mouse/WASD/touch controls, real-device checks or GPU frame-rate measurements ran.

With the full repository and browser access, run `render3d.e2e.mjs`, `hero-select-3d.e2e.mjs` and `combat-feel-3d.e2e.mjs`, then inspect both realms, hills/banks, steep-ground spell warnings, bridge crossings and the 2D fallback at desktop, landscape-phone and portrait-phone sizes. Check the existing renderer quality/frame-rate rule. Keep this change active until those visual tasks pass; it is not archived into canonical specs yet.
