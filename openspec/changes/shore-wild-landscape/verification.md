# Verification

All 33 Shore Node regression suites pass, including six full simulation matches. Terrain and scenery retain mirrored geometry, existing collision routes, dry defense pads and exact river crossings. Syntax checks pass for the changed JavaScript; `git diff --check` passes.

## Measurements

| Feature | Previous | New |
| --- | --- | --- |
| Off-lane terrain range | 465.1 | 1,054.7 world units |
| Dry west lane range | 166.2 | 360.8 world units |
| Dry east lane range | 177.9 | 478.7 world units |
| Sampled near-flat ground | 33.7% | 27.0% |
| Major rock cover | Small boulder clusters | Eight bluffs with rock strata |
| Recessed cave interiors | None | Six per realm, at the same cover islands |

Across seeds 1, 49 and 91822, each realm places 1,292 to 1,373 scattered mature canopy props before instancing; route cores remain clear. Rock geometry fits both realm footprints, has bounded triangle counts, and passes triangle contact tests through its open entrances to the recessed rear. Roof support tests include the same ground displacement used by the rock shader.

Surface tests check 42 projected ground targets with camera clearance plus independent first contacts against the actual mesh. Ground warnings match the terrain within 0.000171 world units. The full 3D module dependency graph imports; standard, basic and shadow-depth rock materials compose their ground displacement shaders.

## Browser and CLI limits

This session's cloud browser lacks WebGL2. Local Chromium installation was unavailable in the preceding task, so actual rendering and physical phone checks have not run here. `landscape.e2e.mjs` and its GitHub workflow check desktop and portrait 3D rendering, both realms, asset/shader errors, camera targeting, movement and spellbook access. They also capture six screenshots for visual review. Their run status must be checked separately after publication.

OpenSpec CLI is unavailable; the Markdown change structure was checked directly. This change remains active until rendered and device checks are complete.
