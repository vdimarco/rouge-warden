# Current verification — 2026-10-09

Checked in Warden on Linux, Unreal 5.8.3, Intel Core i9-14900K / RTX 4090 / Vulkan SM6. See [QualityAudit.md](QualityAudit.md) for every canonical requirement, evidence and remaining product scope.

| Check | Result / report |
| --- | --- |
| C++ editor module and Linux Development package | Fresh builds succeed; local package is about 2.2 GiB and excluded from Git. |
| Two-player gameplay | 56 checks pass, including native walking/strafe, sprint/jump, private F2, car interaction/steering/camera/handbrake, missions, residents, disconnect and reconnect. `Smoke.json`. |
| Simulated degraded network | 56 checks pass with 100 ms outgoing lag and 2% loss on both peers; 58 pass with complete client packet interruption and recovery. `SmokeLag.json`, `SmokeDropout.json`. |
| Separate package joining PIE | 58 checks pass; the late join receives mission progress and eight skeletal crew bodies. `SmokePackagedPeer.json`. |
| Native packaged gameplay | 11 checks pass in separate Linux processes, including abrupt process loss, normal connection timeout, abandoned-car reuse and reconnection. `PackagedGameplay.json`. |
| Endurance | 30 minutes / 60 fresh join, enter, exit and leave cycles pass, with only the host controller and walking pawn remaining after each departure. `PackagedSoak.json`. |
| Vehicle collision | All 13 checks pass: actual marking, colliding 2 cm strip, 18 cm curb forward/reverse, tall-wall blocking. `CarCollision.json`. |
| Objective proximity | All six native assertions pass. `MissionProximity.json`. |
| City and saved-map collision | 1,161 municipal models replace 1,299 footprints; imported bounds/material sections, shared geographic origin, spawn/car/address and roof probes pass. Park-wide composite 2316936 stays excluded. `CityBuildings.json`, `LaFontaine.json`. |
| Park source / saved assets | 4,586 trunk/crown instances, 14 residents and 73 original meshes; source inventory IDs, 14 routes on mapped paths, finite triangulation/UVs and landmark roof collision pass. `Park.json`, `ParkBuild.json`. |
| Crew source / saved assets | Eight weighted GLBs, normalized skin weights, UVs, hashes, eight saved skeletal bodies/skeletons/materials and 16 animation clips pass. `MeshySources.json`, `MeshyAssets.json`, `MeshyImport.json`. |
| Cooked package | Eight skeletal bodies, 16 clips, 66 retained fallback parts and exactly 1,161 surveyed buildings load; separate peers connect and seven rendered views complete. `Package.json`. |
| HUD / character inspection | Seven HUD states at both 1280×720 and 1920×1080 pass the final 56-check rendered suite, plus two native packaged priority-overlap views. Six package captures additionally verify HOP!, VROOM! and SKRRT! after native input. Ten refreshed 1600×900 crew views show full bodies and the revised face. `SmokeRender1280.json`, `SmokeRender1920.json`, `PriorityHUD.json`, `SoundWords.json`, `CrewPreview.json`; images in `Preview/`. |
| Performance reference | Six warmed Epic-quality static views, 2,398 frames each: 93–110 average FPS at 720p, 79–81 at 1080p; all p95 below 16.67 ms. `Performance.json`. |
| Repository checks | Launcher tests, source tests, Python syntax and whitespace checks pass. OpenSpec structure/scenarios checked manually; CLI unavailable. |

The endurance run used the same final gameplay implementation, before two additional walking handlers were exposed to reflection for automation and the final HUD-only marker exclusion. The final package was rebuilt and its 11 native gameplay checks and cooked-content checks rerun afterward. Endurance RSS samples are diagnostic only: paging and competing workloads prevent treating them as proof of leak-free memory use.

A later performance repeat with another game sharing the GPU missed the reference budget (`PerformanceContended.json`). A heavy editor capture subsequently ran out of Vulkan device memory under that workload; the lighter package completed the final crew and HUD captures. Close competing render workloads for comparable profiling and editor captures.

External internet/NAT traversal, physical two-person input, other hardware/OSes, phone/browser/audio and broader accessibility remain unverified. The player is still the Unreal mannequin; crew are NPCs. There are three public park objectives, no private-memory missions or mansion interior. Map/likeness detail remains approximate; no Street View parity is claimed. Read the audit before treating this as a completed open-world game.
