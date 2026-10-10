# Desktop quality audit — 2026-10-09

Scope: the existing standalone Unreal game in Warden, checked on Linux with Unreal 5.8.3 and RTX 4090 / Vulkan SM6. The canonical requirements are in `openspec/specs/nord-unreal/spec.md`. A passing automated check is evidence for its stated scenario, not a claim that the original open-world-game ambition is complete.

## Requirement coverage

| Canonical requirement | Evidence | Result / practical limit |
| --- | --- | --- |
| Standalone Unreal project | Fresh editor module and Linux Development package builds; `Package.json`; `Scripts/test_launcher.py` | Supported Linux build loads the saved LaFontaine map. Whole `Builds/Linux/` is the distributable; engine caches/builds stay outside Git. |
| Preserve verified play — desktop controls | `Smoke.json`, `MissionProximity.json`, `CarCollision.json`, `PackagedGameplay.json`; checked `Config/DefaultInput.ini` | Native forward walking, sprint strafing/jump, throttle, steering, handbrake and E handlers pass. Physical keyboard/mouse input is not automated. |
| Preserve verified play — curbs/markings | `CarCollision.json` | Actual saved road marking, colliding 2 cm strip, 18 cm curb forward/reverse pass; tall wall blocks. The car uses arcade box sweeps, not suspension physics. |
| Preserve verified play — shared progress | `Smoke.json`, `SmokePackagedPeer.json`, `PackagedGameplay.json` | Three objectives complete in order and replicate. Future/out-of-range interactions fail. A late join receives completed progress. Progress resets when the host restarts. |
| Honest geographic and visual scope | `LaFontaine.json`, `CityBuildings.json`; source READMEs | Correct shared geographic origin, orientation, model bounds and saved collision probes. Terrain, façades and landmark heights remain estimated. No Google imagery, Street View parity or interiors. |
| Comic-book look | `Smoke.json` private F2 checks; `Preview/Quality1280_*.png`, `Quality1920_*.png` | Ink, bands, halftone and offset colours render. F2 affects only the client and persists through car entry. Assets retain their illustrated textures in standard view. |
| Animation on twos | `Smoke.json` animation tick interval checks and moving poses | Comic player pose interval is 1/12 second; F2 restores full-rate player animation. Camera and movement update each frame. |
| Comic HUD | Seven captured states at both sizes, plus packaged interaction-priority views; `SmokeRender1280.json`, `SmokeRender1920.json`, `PriorityHUD.json`; six packaged burst views in `SoundWords.json`; native HUD action conditions | Mission, controls, minimap attribution, car prompt, speed, dialogue and blocked-exit caption are readable. Native jump, acceleration and handbrake handlers produce readable HOP!, VROOM! and SKRRT! bursts at both sizes; these are visual bursts, not recorded audio. |
| Repository hygiene | Focused staged diff, `.gitignore`, source/provenance retention | No credentials, package, caches or recovery files included; browser arcade unchanged. |
| Surveyed starting-block buildings | `CityBuildings.json`, `LaFontaine.json`, `Package.json`; city triangulation source test | 1,161 municipal models replace 1,299 generic footprints, with exterior collision and retained survey roof geometry/UVs. Illustrated façades are estimates. |
| Comic park district | `Park.json`, `ParkBuild.json`; park source test; existing park views plus current performance views | 4,586 tree trunks/crowns, ponds, paths, courts, theatre/chalet/cultural centre and furniture load. Source tree locations are retained; crown shapes/heights are stylized estimates. |
| Original park residents | `Smoke.json`, `SmokePackagedPeer.json`, `PackagedGameplay.json` | 14 residents, eleven styles, replicated walking placement, private E dialogue, completed missions preserved. Three original mascot designs retain simple mesh bodies. |
| Illustrated cars | `Smoke.json`, `CarCollision.json`; car reference views | Shaped hatchback art and animated wheel code retain tested controls/collision. Parked fleet uses varied colours. |
| Textured cottage crew | `MeshySources.json`, `MeshyAssets.json`, `MeshyImport.json`, `Package.json`; refreshed `MeshyResident3–10.png` | Eight complete textured skeletal bodies and sixteen clips load in editor and actual package. `CrewPreview.json` records ten refreshed package captures using a held native pose for inspection. Retained models are about 31k triangles and 24 bones each. |
| Revised skull-shirt likeness | `Preview/SkullShirtFace.png`; character provenance | Updated smiling face reference, short tousled hair, beard, black graphic shirt, teal shorts and bare feet retained. Generated likeness, lettering and fingers are approximations. |
| Verified desktop release quality | All reports above, `SmokeLag.json`, `SmokeDropout.json`, `PackagedGameplay.json`, `Performance.json` | Invalid interactions, lifecycle, packet interruption, supported layouts and hardware-specific frame timings exercised. |

## Defects corrected in this pass

- A blocked car exit previously wrote only to Unreal's console. It now displays a private on-screen caption, keeps occupancy and hidden-pawn collision safe, and clears the caption after successful entry/exit.
- The HUD could offer resident dialogue or objective completion while E would take the nearby car. Prompts now follow the same car → objective → resident priority as the server interaction.
- A remote driver that stopped sending packets left its last throttle active until the network connection timed out. A regression reproduced continued travel of 1,440 cm in 0.6 seconds after five seconds of complete packet loss. The server now clears remote controls after 0.5 seconds without a valid update and coasts to a stop. Normal delayed/lossy updates and reconnection remain checked separately.
- A projected world-objective diamond could draw over the mission caption. It is now suppressed inside that caption region; the minimap and distance hint remain available.
- Individual crew preview cameras cropped the feet. The full-body capture framing is corrected; no model replacement or paid regeneration was needed.

## Multiplayer and performance interpretation

The baseline suite uses two in-process PIE worlds. A second check adds an actual package as a third peer after all missions are complete. Separate packaged processes additionally exercise native E/throttle/handbrake handlers, a killed client process, the normal network timeout, abandoned-car reuse and repeated clean joins. The final suites pass 56 baseline checks, 56 degraded-network checks, 58 packet-interruption checks and 58 separate-package-peer checks. The final rendered suite passes all 56 checks at each size, including the HUD-priority overlap; two native packaged overlap views independently verify that case.

`PackagedSoak.json` records 1,800.5 seconds and 60 fresh join/enter/exit/leave cycles, with one host controller and walking pawn after every clean departure. It uses the final gameplay implementation before the last two walking handlers were exposed to reflection for testing and the final HUD-only marker exclusion. The rebuilt final package separately passes its eleven native gameplay checks. RSS samples are retained as diagnostics, not proof against leaks: paging and other workloads affect residency.

Simulated 100 ms outgoing lag and 2% loss run on both PIE peers; a separate case completely interrupts client packets. These cover local network behavior, not router/NAT traversal or a public server.

`Performance.json` records the scene, actual screenshot-verified viewport size, sample count, frame-time percentiles and GPU timing. The packaged renderer runs Epic settings, 100% screen percentage, uncapped and without VSync. Each scene discards initial warmup frames and captures its screenshot before measurement. Static views are a repeatable reference, not a worst-case driving or multiplayer benchmark. Raw CSVs and runtime test outputs are preserved locally under `Saved/Tests/PackageRuntimeEvidence/`; process logs remain in `Saved/Tests/`. Generated profiling/screenshots and test-peer caches were moved out of the distributable; its normal configuration is retained.

Measured on Intel Core i9-14900K, RTX 4090 (driver 610.57.04), Linux/Vulkan SM6. Each row contains 2,398 warmed frames; no sampled frame exceeded 33.33 ms. The final repeat ran after the competing game closed, with ordinary desktop apps and background services active. The earlier faster reference is retained in `PerformanceEarlier.json`; differences between runs are not a hardware guarantee.

| Scene | Viewport | Average FPS | Median frame | 95th percentile | 99th percentile |
| --- | --- | ---: | ---: | ---: | ---: |
| Sherbrooke | 1280×720 | 109.6 | 9.15 ms | 12.71 ms | 13.69 ms |
| Pond | 1280×720 | 101.9 | 9.61 ms | 13.89 ms | 15.41 ms |
| NorthPark | 1280×720 | 93.0 | 10.68 ms | 14.54 ms | 15.56 ms |
| Sherbrooke | 1920×1080 | 81.0 | 12.58 ms | 15.66 ms | 16.68 ms |
| Pond | 1920×1080 | 79.6 | 12.62 ms | 16.30 ms | 18.26 ms |
| NorthPark | 1920×1080 | 78.7 | 12.87 ms | 16.33 ms | 17.52 ms |

A repeat at 23:40 UTC shared the GPU with another running game and averaged 61 FPS in the 720p Sherbrooke scene (95th percentile 22.8 ms). It failed the reference budget; this result is retained separately in `PerformanceContended.json`. The other game started after the earlier six reference measurements and closed before the final six-scene repeat. A subsequent editor capture also failed a Vulkan device-memory allocation under the competing workload. The final ten character views were captured successfully in the lighter packaged game. Close other render workloads for editor captures and comparable performance measurements; simultaneous heavy GPU use is not a supported performance claim.

## Remaining product scope

The player is still the Unreal mannequin; supplied detailed characters are park residents. The session has three public park objectives, not missions authored from private chat memories. There is no mansion interior or Zillow-based spawn, combat, GTA source decompilation, matchmaking, browser build, persistent progress or public deployment. External internet play, other GPUs/OSes, physical two-person controls, phone/browser/audio and accessibility beyond the inspected desktop layouts remain unverified. The direct-IP Linux host/join path is available, with matching builds required.

OpenSpec CLI is unavailable in this environment. Proposal/design/tasks/delta structure and WHEN/THEN scenarios are checked directly; CLI validation is not claimed.
