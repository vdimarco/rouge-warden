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

Across seeds 1, 49 and 91822, each realm places 1,292 to 1,373 scattered mature canopy props before instancing and entrance clearing; route cores remain clear. Rock geometry fits both realm footprints, has bounded triangle counts, and passes triangle contact tests through its open entrances to the recessed rear. Roof support tests include the same ground displacement used by the rock shader.

Surface tests check 42 projected ground targets with camera clearance plus independent first contacts against the actual mesh. Ground warnings match the terrain within 0.000171 world units. The full 3D module dependency graph imports; standard, basic and shadow-depth rock materials compose their ground displacement shaders.

## Browser verification

[The landscape 3D workflow passed](https://github.com/vdimarco/rouge-warden/actions/runs/37872805006) on code commit `427fe8252a867552b040dcb4fa5cd5f305fe3aef`. Chromium with SwiftShader rendered 1440×900 desktop and 390×844 portrait views, checked both realms, ground and shadow shaders, assets, ground targeting, movement and spellbook access. No page, shader or asset errors occurred. Ground selection errors at the staged player positions stayed below 0.000005 world units.

All [six screenshots](https://github.com/vdimarco/rouge-warden/actions/runs/37872805006/artifacts/11590898388) were visually reviewed. Broad hill faces and climbing roads are visible, cave entrances remain open in the forest, natural rock has mineral grain, and the hero remains readable. The captured matches retain 1,394 to 1,443 tree instances per realm plus 248 boundary trees after entrance clearing. Solid cover and roof trees retain their representation.

The landscape server and existing shared-creature browser server now serve the model decoder's `.mjs` files as JavaScript. The broader shared-creature workflow can therefore exercise the required 3D startup rather than fail at its disabled Play button; its current status is reported by GitHub checks.

## Limits

The cloud browser in this session lacks WebGL2; GPU rendering ran in GitHub Actions. No physical phone or hardware GPU performance measurements were taken. Cave interiors are scenery; existing obstacle collision defines their approach boundary.

OpenSpec CLI is unavailable. The Markdown structure and scenarios were checked directly, the completed change was archived, and the canonical landscape spec was reviewed.
