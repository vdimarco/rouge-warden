# Current verification — 2026-10-10

Checked in Warden on Linux, Unreal 5.8.3, Intel Core i9-14900K / RTX 4090 / Vulkan SM6. [CityQuality.md](CityQuality.md) describes this correction; [QualityAudit.md](QualityAudit.md) maps requirements to evidence and limits.

**Overall quality acceptance remains open.** All eight current resting faces pass native review, including corrected style 8 revision 2. Both final matrices pass 56 views each; final native smoke passes 66 checks in 43.98 seconds and Linux build/cook/stage succeeds in 69.76 seconds. Final package play passes in 33.78 seconds; all eleven final packaged gameplay checks pass in 89.1 seconds. Last recorded performance fails five of six p95 budgets, and documented Montréal art limits remain. Keep the OpenSpec change active.

**Current resting-face review passes; packaged character integration passes.** [NaturalFaces.md](NaturalFaces.md) records all eight current designs, the rejected first style 8 and its accepted replacement. The complete predecessor and four native faces remain read-only under `Data/CharactersNeutral/Revisions/LimeJacket-v1`; `NeutralLimeImport.json` records the focused reimport/backup. The other seven retain 140 source files and 77 Unreal assets unchanged. [Pipeline commands](../Data/CharactersNeutral/README.md) preserve the expression criterion and all original sources. Body-only rigs provide no facial animation, blinking or lip sync.

| Check | Result / report |
| --- | --- |
| Editor and Linux Development package | Final revision-2 build/cook/stage/pak/archive succeeds in 69.76 seconds. Separate-process package play passes in 33.78 seconds; all eleven final gameplay checks pass in 89.1 seconds. Last performance measurement fails its gate. Generated package excluded from Git. |
| Two-player gameplay | Fresh final native smoke passes 66 checks in 43.98 seconds, including movement, eight crew choices, private F2, cars, objectives, residents and reconnect. `Smoke.json`. |
| Degraded networking | 66 checks pass with 100 ms outgoing lag / 2% loss on both peers; 68 pass with complete client packet interruption and recovery. `SmokeLag.json`, `SmokeDropout.json`. |
| Packaged late peer joining PIE | 68 checks pass with completed mission state and distinct host/client crew styles. `SmokePackagedPeer.json`. |
| Population | Final repeat passes 13 checks: 32 added parked cars, 16 traffic cars, 96 walkers, minute-long circulation, obstruction recovery, replication, yielding and native E claims. 15/16 move in the final eight-second window; the other safely follows the starter. All 16 resume after clearing the obstruction; all 40 nonstarter parked cars fit mapped asphalt. `Population.json`. |
| Vehicle collision | 13 checks pass: saved marking, colliding 2 cm strip, 18 cm curb forward/reverse and tall-wall blocking. `CarCollision.json`. |
| Saved map and park | Five geographic/collision checks plus retained 4,586 trees, 14 original residents, 73 original meshes and landmark roof collision. `LaFontaine.json`, `Park.json`, `ParkBuild.json`. |
| Replacement crew source / saved assets | Eight complete bodies and 32 own clips pass `CharactersNeutralSources.json`, `CharactersNeutralJumpSources.json` and fresh `MeshyAssets.json`. Saved checks include exact 25-node source hierarchies (24 body bones + Armature), local mesh/skeleton reference transforms, source bind distances and body/clip import MD5. `NeutralCrewImport.json` records the production backup; `NeutralOriginalSources.json` protects 166 original files. Source/saved checks are separate from native visual review. |
| Historical face-atlas correction | `MeshyFaceMipsApplied.json` records the preceding eight-atlas NoMipmaps/NeverStream/zero-bias correction and protected source/asset hashes. Replacement imports retain those texture settings and default lit shading; this report does not verify replacement faces. |
| Environment refresh | 24 crown batches, 81 facade edges/37 estimated entries, quiet pond material and 19 preserved gameplay actor transforms. Source/placement assertions pass. `EnvironmentRefresh.json`. |
| Native automation | Four tests pass with zero warnings/errors: shutdown cleanup, mission proximity, blocked traffic approach and closed traffic graph. `AutomationQuebec.json`, `HeadlessSuite.json`, `MissionProximity.json`. |
| Replacement player rendered QA | Both final current matrices pass eight bodies × seven states, 56 captures per size; all 112 PNGs pass dimensions/completion checks. Style 8 revision 2 passes calm-brow/eye/closed-mouth review. `PlayerQuality/PlayerQuality{1280,1920}.json`; [scoped visual evidence](NaturalFaces.md). |
| Relaxed-expression pilot | Separate style 9 native matrix passes seven states at both sizes; [review](NaturalFaces.md) accepts four unobstructed faces and samples ten body poses, with fourteen complete PNGs. Candidate assets were archived outside Content before cook; retained reports/captures remain. |
| Environment capture completion | Both reports pass with seven fresh fixed views each. Dimensions and PNG completion are checked. `EnvironmentRender1280.json`, `EnvironmentRender1920.json`. |
| Environment visual assessment | [EnvironmentVisualReview.md](EnvironmentVisualReview.md) inspected fourteen fresh environment frames and seven package frames. Wider irregular crowns and quiet water are visible; opaque foliage, flat banks, generic architecture and blank basement stretches remain. No exact Montréal/Street View parity is accepted. |
| HUD / regression renders | Both rendered smoke suites pass 66 automated checks, with eight playable views and seven HUD states per size. This does not accept every character's face. `SmokeRender1280.json`, `SmokeRender1920.json`. Earlier priority-overlap/sound-word captures remain historical evidence. |
| Actual cooked content and peers | Current style-8-revision-2 `Package.json` passes in 33.78 seconds: separate-process host/client loopback, eight native character cycles, eight bodies/32 clips, 1,161 city models and seven rendered 1600×900 captures. |
| Native packaged gameplay | Current `PackagedGameplay.json` passes eleven objective/late-join/driving/camera/handbrake/dropout/timeout/rejoin/exit checks in 89.1 seconds using separate Linux processes and native inputs. Two acceleration windows reset the occupied, handbraked starter to its verified clear lane with collision and ambient traffic enabled. |
| Repository checks | Launcher/geographic/crew/environment/road-width source tests, Python syntax and whitespace checks. OpenSpec structure/scenarios checked manually; CLI unavailable. |

## Last recorded performance — before expression regeneration

The last recorded post-atlas, pre-expression six-scene [Performance.json](Performance.json) records **`passed: false`**. The requirement is p95 below 16.67 ms at both supported sizes. Only 1280×720 Sherbrooke passes; the other five views fail. These results do not measure the regenerated crew; the performance gate remains open.

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

The 30-minute / 60-cycle `PackagedSoak.json` predates the population/animation update and expression regeneration and was not repeated. Earlier HUD/sound-word captures, mip-fix face review and preceding-crew package reports are historical evidence. Source/import checks remain separate from the passing native visual/runtime and final packaged regressions. RSS sampling does not establish leak-free memory use.

Final player inspection uses temporary capture-process limits: 720p has a 1024 MiB texture streaming pool / 2048 virtual-shadow pages, while 1080p has 512 MiB / 1024 pages to fit the shared GPU. Actual packaged Epic defaults remain unchanged. Capture success is not a performance or 60 FPS claim. No competing owned editor/game runs during profiling; other desktop applications remain active on the shared GPU.

External internet/NAT traversal, physical two-person input, other hardware/OSes, phone/browser/audio and broader accessibility remain unverified. The map retains municipal shells and source tree locations, with estimated facades/landmarks and flat terrain/equal pond levels. Generated facial likeness, fingers and lettering remain approximate. There are three public objectives, no private-memory missions or mansion interior. No Street View parity is claimed.
