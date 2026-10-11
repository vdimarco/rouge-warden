# ASCII scene collection

Six independent static games using original MIT-licensed bas3line/ascii scenes.

| Route | Scene | Main interaction | Round objective |
| --- | --- | --- | --- |
| `/lighthouse-keeper/` | Night coast | Sweep beam; select a lit boat, chart waypoints | Complete eight boat arrivals with fewer than three wrecks |
| `/echoes-under-ice/` | Aurora fjord | Swim, pulse sonar, recharge at surface | Recover six bells before oxygen or time runs out |
| `/last-train-home/` | Tokyo rain | Change street lanes; reveal reflections | Follow seven route clues before the last train |
| `/firefly-courier/` | Misty forest | Release light, recall swarm, walk remembered path | Wake five forest lanterns before the swarm fades |
| `/mirage-runner/` | Desert night | Counter wind; distinguish steady beacons from mirages | Catch six true beacons across twelve gates |
| `/orbital-gardener/` | Earthrise | Catch drifting seeds; descend and plant | Grow six gardens that bend the remaining seed orbits |

## Verification

Run `node --test qa/scene-games/*.test.mjs` for the 15 pure simulation checks. These cover complete outcomes, resource failure, pause, route markers, true/false beacons and gravity effects.

Serve `public/` at localhost:8765, then run `node qa/scene-games/collection.e2e.mjs`. It uses installed system Chromium because the browser plugin is unavailable. All six games are checked for local assets, startup errors, deliberate start, keyboard action, pause/resume, page hiding, switching, retry, pointer cancellation, reduced motion, and desktop/phone layouts. It also launches each game through the actual arcade picker/token flow.

Viewport targets: 1440×900, 390×844 and 844×390. Landscape phone scenes and controls fit together without scrolling. Portrait layouts preserve native 2:1 scene proportions. Physical devices and other browser engines were not tested. Optional coastal audio was wired and its controls checked; playback fidelity was not checked on physical speakers.

Original scene source frames and palette arrays matched vendored modules at 0, 1 and 20 seconds for all six scenes. Scene code retains MIT license attribution and has no runtime CDN dependency.

## Visual review

The reference is the existing Last Light art direction refined by the user's request for integrated dot sprites and horizon depth, together with the actual ascii.rest scene frames. Original halftone source art is intentional; raster-generated sprites would conflict with the requested style. The shared concept reference is `/workspace/last-light-concept.png` during development. New scenes inherit the refined visual system rather than copying that sunset composition.

| Comparison | Finding and correction |
| --- | --- |
| Scene fidelity | Exact source frames and palettes preserved; six native previews rendered from originals |
| Sprite integration | Gameplay centers align with the scene cell grid; no large line-character overlays |
| Depth | Water boats and desert landmarks grow from the horizon; city reflections follow the street vanishing point |
| Typography/chrome | Quiet monospace controls; removed added eyebrow labels; corrected Earthrise control palette |
| Mobile aspect | Removed stretched portrait canvases; source dot aspect stays square |
| Landscape balance | City/forest scene moved left and controls right so both fit 844×390 |
| Controls/access | Native button focus retained; movement clears on pause/cancellation; switcher pauses games |
| Copy | Titles/objectives follow the six accepted game ideas; action hints describe real controls |

Latest browser captures are temporary QA artifacts outside the repository. The release keeps source previews, credits, playable code, and reproducible verification scripts.

Verified on 2026-10-09: the full collection browser check passed all six routes, all three layouts, and all six cabinet token launches with no uncaught errors or HTTP asset failures. A focused follow-up independently checked all six games with storage reads and writes throwing SecurityError through startup, start, action, keyboard input, and pause; all passed.
