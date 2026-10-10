# Desktop quality audit — 2026-10-10

Scope: the standalone Unreal game in Warden on Linux, Unreal 5.8.3 and RTX 4090 / Vulkan SM6. Requirements are in `openspec/specs/nord-unreal/spec.md`. Automated success covers the measured scenario; it does not establish exact photographic likeness or a finished commercial open-world game. [CityQuality.md](CityQuality.md) describes this correction and geographic limits.

**Overall acceptance remains open.** Official saved-asset player matrices pass eight bodies × six native poses at both sizes, with 96 fresh captures. Independent review accepts all eight face close-ups at both sizes and confirms intact, distinct sampled poses. Final packaged gameplay passes eleven checks. The final post-atlas package performance run fails the required p95 frame budget in five of six views, and documented Montréal art limits remain. The OpenSpec change remains active.

## Requirement coverage

| Requirement | Evidence | Result / practical limit |
| --- | --- | --- |
| Standalone Unreal project | Final editor/package builds; `Package.json`; launcher tests | Post-atlas-fix build/cook/stage, actual packaged startup/peer joining and final packaged gameplay pass. Measured performance fails its acceptance gate. Distribute all of ignored `Builds/Linux/`. |
| Desktop movement and driving | `Smoke*.json`, `CarCollision.json`, `PackagedGameplay.json` | Native walk, strafe, sprint, jump, E, steering, handbrake and camera handlers exercised. Physical keyboard delivery is not automated. Cars use arcade sweeps, not suspension physics. |
| Curbs and markings | `CarCollision.json` | Saved marking, colliding 2 cm strip, 18 cm curb in both directions and tall-wall blocking checked. |
| Shared objectives and lifecycle | `Smoke.json`, `SmokePackagedPeer.json`, `MissionProximity.json`, final `PackagedGameplay.json` | Smoke and eleven final packaged checks cover ordered objectives, late joining, driving, handbrake/release, abrupt client loss, timeout, released-car entry/exit and clean departure. Progress resets with the host. |
| Comic appearance and private F2 | `SmokeRender1280.json`, `SmokeRender1920.json`; [face review](FaceVisualReview.md) | Automated control/capture checks pass at both sizes; F2 is local and survives car entry. Independent review accepts all eight official saved-atlas face close-ups at both sizes. |
| Animation on twos | `PlayerQuality/PlayerQuality1280.json`, `PlayerQuality/PlayerQuality1920.json`; [visual review](FaceVisualReview.md) | Both official matrices pass eight bodies × six native poses, including cadence/root/landing checks. All 96 PNGs are fresh/complete. Sampled run/airborne/landing poses for 3/5/9 are intact and distinct at both sizes. Some court-rail occlusion remains in run/landing frames. |
| Comic HUD | Current rendered smoke suites; retained `PriorityHUD.json`, `SoundWords.json` | Seven HUD states and eight playable selections captured at both sizes. Earlier native package captures cover priority overlaps and HOP!/VROOM!/SKRRT!; these are visual bursts, not recorded audio. |
| Survey buildings and geographic scope | `CityBuildings.json`, `LaFontaine.json`, `EnvironmentRefresh.json` | 1,161 municipal shells retain survey massing/roofs. Estimated masonry and decorative entrances do not establish exact facades or usable interiors. Shared origin, spawn, collision and address checks retained. |
| Park district | `Park.json`, `ParkBuild.json`, `EnvironmentRender1280.json`, `EnvironmentRender1920.json`; [visual review](EnvironmentVisualReview.md) | Source/placement and fourteen capture-completion checks pass. Visual review confirms broader crowns and quieter water, with partial Montréal resemblance: opaque foliage, flat banks, simplified landmarks and repetitive façades remain. |
| Original residents and illustrated cars | Smoke/package checks; population/render views | Original 14 residents and dialogue remain. Four paint styles and shaped car art retained. |
| Textured interchangeable crew | `MeshySources.json`, `MeshyImport.json`, `MeshyAssets.json`, `Package.json`; official player matrices | Eight weighted bodies and 32 matching clips pass saved-asset checks and final packaged availability/cycling. Atlas hashes match sources. Saved-atlas native matrices and independent face review pass at both sizes. |
| Saved atlas correction | `MeshyFaceMipsApplied.json`; matching importer settings | Eight base-color textures saved as NoMipmaps/NeverStream/zero LOD bias, with 2048×2048 BC7 and source RGB preserved. Protected materials/meshes/animations and retained sources are unchanged. Both official rendered matrices pass. |
| Revised skull-shirt likeness | Current Resident9 face captures; retained reference/source records | Short tousled hair, beard, black graphic shirt and teal shorts retained. Generated facial anatomy, fingers and lettering remain approximate. |
| Populated mapped district | Final `Population.json`; final package views | Thirteen final-code checks pass for 32 added parked cars, 16 traffic cars and 96 added walkers. 15/16 move in the final eight-second window while one safely follows the starter; all 16 resume after obstruction clearance. Replication and native car claiming pass. Population checks explicitly skip rendered crowd quality and performance. |
| Repository hygiene | Focused diff and ignore rules | Source/provenance and accepted reports retained; builds, caches, raw profiling, atlas exports and recovery backups excluded. Browser arcade unchanged. |

## Implemented corrections and open checks

- Face investigation identifies reduced-mip bleeding across tiny disconnected atlas UV islands. Stencil/normal/UV-precision changes alone were insufficient. The saved correction passes texture/source preservation checks and changes only base-color mip/streaming settings, with matching importer settings. It preserves the lit material; official native matrices and all sixteen face close-ups pass at both sizes.
- All eight rigs now have distinct running and locally authored jump/landing clips selected by movement. Official saved-asset 1280/1920 native pose/cadence matrices pass; independent visual review confirms intact, distinct sampled run/airborne/landing poses for styles 3, 5 and 9 at both sizes.
- A sparse district now includes bounded traffic and walkers. Tests exposed later jams beyond the initial movement check; static route filtering and junction reservations address those cases.
- Old parked cars overlapped traffic or the verge. Runtime placement uses sufficiently wide asphalt with full footprint clearance. The starter shifts 145 cm into its forward lane so it no longer blocks oncoming traffic.
- Environment renders show irregular canopy, varied masonry and quieter unequal-direction pond waves. [Visual review](EnvironmentVisualReview.md) records the actual improvements and remaining resemblance/material limits separately from source and capture passes.

Previously corrected blocked-exit captions, interaction/HUD priority and stale remote throttle remain covered by the regression suite. Remote controls clear after 0.5 seconds without a valid update; normal degraded packets and complete interruption are tested separately.

## Multiplayer and performance interpretation

Baseline, simulated 100 ms outgoing lag / 2% loss, complete client packet interruption and a separate packaged peer exercise local networking. Native packaged processes additionally cover abrupt process loss, normal timeout and reconnect. These checks do not cover public hosting or router/NAT traversal.

The final packaged driving fixture resets the occupied starter to its verified clear start lane before each of two acceleration windows, using native teleport while handbraked. Occupancy, collision and all sixteen traffic cars remain enabled. Host/client position and rotation assertions are retained, with client yaw tolerance accounting for Unreal's native byte quantization. The report records both resets; the longer mapped-route circulation/recovery checks remain in `Population.json`.

The final post-atlas six-scene package performance run records `passed: false`. Only 1280×720 Sherbrooke meets the required p95 below 16.67 ms, at 14.56 ms. The 720p Pond/NorthPark values are 23.12/28.98 ms; all three 1920×1080 views fail at 28.47/29.59/29.03 ms. The full median/p95/FPS table is in [README.md](README.md). The benchmark uses static Epic-quality views at 100% screen percentage, uncapped and without VSync, with verified viewport dimensions and 2,398 warmed frame samples per scene. Other desktop GPU applications remained active; these measurements describe the shared session and do not isolate the cause of the failures. No isolated GPU benchmark or 60 FPS acceptance is claimed. Static views do not establish worst-case driving, multiplayer or other-hardware performance. Editor inspection's smaller texture/shadow-page budget is separate from the default Epic package settings. Performance acceptance remains open.

`PackagedSoak.json` retains an earlier 30-minute / 60-cycle lifecycle test. It predates this animation/population update and was not repeated. RSS is diagnostic, not proof of leak-free memory use. Earlier HUD/sound-word captures and contended performance reports are historical evidence, not measurements of this revision.

## Remaining scope

No Street View parity is claimed. Geographic estimates and specific court/terrain gaps are listed in [CityQuality.md](CityQuality.md). There are three public park objectives, no private-memory missions, mansion interior, combat, GTA source decompilation, matchmaking, browser build, persistent progress or public deployment. Direct-IP Linux host/join requires matching builds. Internet/NAT traversal, physical two-person controls, other hardware/OSes, phone/browser/audio and broader accessibility remain unverified.

OpenSpec CLI is unavailable; proposal/design/tasks/delta structure and WHEN/THEN scenarios are checked directly. CLI validation is not claimed.

Completed scenario evidence and remaining performance/art limits are staged in the active [change verification](../../../openspec/changes/nord-city-quality/verification.md). Do not archive or mark the whole correction complete while the required performance gate fails.
