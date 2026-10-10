# Current verification — 2026-10-10

Checked in Warden on Linux, Unreal 5.8.3, Intel Core i9-14900K / RTX 4090 / Vulkan SM6. [CityQuality.md](CityQuality.md) describes this correction; [QualityAudit.md](QualityAudit.md) maps requirements to evidence and limits.

**Overall quality acceptance remains open.** Official saved-atlas player matrices pass eight bodies × six poses at each size, with 96 fresh captures. Independent review accepts all eight face close-ups at both sizes and confirms intact, distinct sampled poses. Final packaged gameplay passes eleven checks. The final post-atlas package performance run fails the required p95 budget in five of six views; documented Montréal art limits remain. Keep the OpenSpec change active.

| Check | Result / report |
| --- | --- |
| Editor and Linux Development package | Final post-atlas-fix build/cook/stage, actual package startup/peer joining and final packaged gameplay pass. Performance measurements are complete and fail the acceptance gate. Generated package excluded from Git. |
| Two-player gameplay | 66 checks pass, including native movement, eight crew choices, private F2, car controls, missions, residents and reconnect. `Smoke.json`. |
| Degraded networking | 66 checks pass with 100 ms outgoing lag / 2% loss on both peers; 68 pass with complete client packet interruption and recovery. `SmokeLag.json`, `SmokeDropout.json`. |
| Packaged late peer joining PIE | 68 checks pass with completed mission state and distinct host/client crew styles. `SmokePackagedPeer.json`. |
| Population | Final repeat passes 13 checks: 32 added parked cars, 16 traffic cars, 96 walkers, minute-long circulation, obstruction recovery, replication, yielding and native E claims. 15/16 move in the final eight-second window; the other safely follows the starter. All 16 resume after clearing the obstruction; all 40 nonstarter parked cars fit mapped asphalt. `Population.json`. |
| Vehicle collision | 13 checks pass: saved marking, colliding 2 cm strip, 18 cm curb forward/reverse and tall-wall blocking. `CarCollision.json`. |
| Saved map and park | Five geographic/collision checks plus retained 4,586 trees, 14 original residents, 73 original meshes and landmark roof collision. `LaFontaine.json`, `Park.json`, `ParkBuild.json`. |
| Crew source / saved assets | Asset/source checks pass for eight weighted bodies, retained atlas pixels, matching skeletons and 32 clips. These do not establish face readability or complete pose quality. `MeshySources.json`, `MeshyJumpSources.json`, `MeshyAssets.json`, `MeshyImport.json`. |
| Saved face-atlas correction | Eight base-color atlases saved as NoMipmaps/NeverStream/zero LOD bias. All report 2048×2048 BC7, unchanged TextureSource RGB and protected materials/meshes/animations/sources. Both official native matrices and independent face review pass. `MeshyFaceMipsApplied.json`. |
| Environment refresh | 24 crown batches, 81 facade edges/37 estimated entries, quiet pond material and 19 preserved gameplay actor transforms. Source/placement assertions pass. `EnvironmentRefresh.json`. |
| Native automation | Four tests pass with zero warnings/errors: shutdown cleanup, mission proximity, blocked traffic approach and closed traffic graph. `AutomationQuebec.json`, `HeadlessSuite.json`, `MissionProximity.json`. |
| Player rendered QA | Both official saved-asset matrices pass eight bodies × six native poses, 48 captures each: [1280](PlayerQuality/PlayerQuality1280.json), [1920](PlayerQuality/PlayerQuality1920.json). All 96 PNGs are fresh/complete. Independent [review](FaceVisualReview.md) accepts all sixteen face close-ups and confirms intact, distinct sampled poses; some run/landing views have foreground rail occlusion. |
| Environment capture completion | Both reports pass with seven fresh fixed views each. Dimensions and PNG completion are checked. `EnvironmentRender1280.json`, `EnvironmentRender1920.json`. |
| Environment visual assessment | [EnvironmentVisualReview.md](EnvironmentVisualReview.md) inspected fourteen fresh environment frames and seven package frames. Wider irregular crowns and quiet water are visible; opaque foliage, flat banks, generic architecture and blank basement stretches remain. No exact Montréal/Street View parity is accepted. |
| HUD / regression renders | Both rendered smoke suites pass 66 automated checks, with eight playable views and seven HUD states per size. This does not accept every character's face. `SmokeRender1280.json`, `SmokeRender1920.json`. Earlier priority-overlap/sound-word captures remain historical evidence. |
| Actual cooked content and peers | Final post-atlas-fix package passes: separate rendered host/headless client, eight native character cycles, eight bodies, all 32 clips and 1,161 city models, seven 1600×900 captures. `Package.json`. |
| Native packaged gameplay | Final `PackagedGameplay.json` passes eleven checks in separate Linux processes: objectives, late join, native driving/camera/handbrake/release, abrupt loss, timeout, released-car entry/exit and clean departure. The two acceleration windows reset the occupied, handbraked starter to its verified clear lane; collision and all traffic remain enabled. |
| Repository checks | Launcher/geographic/crew/environment/road-width source tests, Python syntax and whitespace checks. OpenSpec structure/scenarios checked manually; CLI unavailable. |

## Current performance

The final post-atlas six-scene [Performance.json](Performance.json) records **`passed: false`**. The requirement is p95 below 16.67 ms at both supported sizes. Only 1280×720 Sherbrooke passes; the other five views fail. The performance gate remains open.

| View | Resolution | Median (ms) | p95 (ms) | Average FPS | p95 gate |
| --- | --- | ---: | ---: | ---: | --- |
| Sherbrooke | 1280×720 | 10.91 | 14.56 | 92.1 | Pass |
| Pond | 1280×720 | 16.13 | 23.12 | 62.3 | Fail |
| NorthPark | 1280×720 | 16.50 | 28.98 | 58.5 | Fail |
| Sherbrooke | 1920×1080 | 20.23 | 28.47 | 48.4 | Fail |
| Pond | 1920×1080 | 22.21 | 29.59 | 45.4 | Fail |
| NorthPark | 1920×1080 | 22.29 | 29.03 | 45.5 | Fail |

Measured on the hardware above at default Epic quality, 100% screen percentage, comic on, VSync off and uncapped. Each scene uses 2,398 frames after discarding the first 600 and last two of 3,000 CSV frames. Other desktop GPU applications remained active. The results describe the observed shared session; isolated performance, cause attribution and 60 FPS acceptance are not claimed. These static reference views do not establish worst-case driving, multiplayer or other-hardware performance.

## Limits and retained evidence

The 30-minute / 60-cycle `PackagedSoak.json` predates this population/animation update and was not repeated. Earlier HUD/sound-word captures and contended performance reports are historical evidence. RSS sampling does not establish leak-free memory use.

Editor inspection uses a 1 GiB texture pool and 2,048 virtual shadow pages to fit beside ordinary desktop services; the package performance run uses the default Epic settings separately. No competing owned editor/game runs during profiling. Other desktop applications remain active on the shared GPU; isolated GPU performance is not claimed.

External internet/NAT traversal, physical two-person input, other hardware/OSes, phone/browser/audio and broader accessibility remain unverified. The map retains municipal shells and source tree locations, with estimated facades/landmarks and flat terrain/equal pond levels. Generated facial likeness, fingers and lettering remain approximate. There are three public objectives, no private-memory missions or mansion interior. No Street View parity is claimed.
