# NORD local graphic-novel pilot — 2026-10-13

The isolated `codex/nord-graphic-novel` branch now has an opt-in, playable style-9 pilot: teal utility trousers/canvas high-tops, twenty weighted finger joints, two restrained squint shapes, standard engine locomotion/jump crossfades and a separate selective ink material. [CPU asset preview](../Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe/front.png) and [bent-knee fit](../Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe/bent-knee.png) show the actual derived model, **not Unreal gameplay or final graphic-novel rendering**. The original face/body anatomy remains the baseline; no mature replacement, full blink, jaw, speech or finished art is claimed.

`-NordGraphicNovelCandidate` selects `/Game/ParkComic/CrewGraphicNovel/Resident9` only for style 9, including its native graph and ink/stencil 254. Other styles and normal launches retain production assets. F2 remains private and starts off. The direct editor review command is the installed `UnrealEditor` with this worktree's `Quebec.uproject`, `/Game/Maps/LaFontaine`, `-game -NordGraphicNovelCandidate`; use it only in an available serialized GPU window. The launcher may prefer a stale cooked build, so it is not evidence of this uncooked pilot.

## Fresh evidence

| Check | Result and scope |
| --- | --- |
| Final editor/game builds | PASS, exit 0: PilotBuild5 and PilotGameBuild2 |
| Offline import/material authoring | PASS, Python commandlet exit 0 and all aggregate markers in PilotImport5; body, seven assigned materials, four own clips, ordinary Engine BlendSpace1D and candidate ink saved separately |
| Native animation suite | PASS, 4/4, exit 0: actual locomotion/airborne bone evaluation, source full-pose preservation, same-style reapply and native opt-in/default selection |
| Native hand/eye controls | PASS: all twenty controls present; actual representative finger rotation 4° idle → 10° sprint → relaxed; both actual mesh squints 0 → 0.35 → 0; no full closure claim |
| Native selection/private view | PASS: opt-in body/graph/material/stencil selected before fixture overrides; style 8/default remain production; F2 affects only its controller |
| Possessed native pilot fixture | PASS, 7 headless states in 29.15 s, exit 0; idle/front/three-quarter/walk/run/airborne/landing state/bone observations, zero screenshots |
| Continuous evaluated motion | PASS: Walk 411/411 and Run 432/432 observed pairs advance both real sample phase and foot pose, two wraps each and a one-frame observation gap throughout |
| Native jump/root behavior | PASS: 183.612 cm peak, 0.00001 cm actor horizontal drift, 81.35° airborne-vs-idle knee difference, stable mesh-relative transform and recovery to idle |
| Two-player legacy regression | PASS, 69 checks in 45.06 s, exit 0; default production route, C/E/F2, props, movement/car interactions and resident readbacks; this is not full candidate co-op acceptance |
| CPU capture/cadence/shader guards | PASS: routing/diagnostic checks, corrupt cadence rejection and 12 tree/gradient/pilot-mask tests; syntax and diff checks pass |
| Protected baseline | PASS: all 283 map/production-crew/source/config/production-ink identities unchanged |

Cadence observations use 0.25 world-time dilation. Their sampling rates are **not rendered or streamed FPS**. The headless fixture explicitly forces `AlwaysTickPoseAndRefreshBones` and disables update-rate optimization so NullRHI can observe actual evaluated bones. It does not establish runtime render settings or visual quality. The ordinary rendered fixture retains its existing visibility behavior.

## Source and unresolved art

The local rig preserves all 24 original body binds/rest vertices and adds twenty weighted child finger joints. Reviewed source flex moves 1,233 vertices by more than 1 mm, with a 4.36 cm maximum at the deliberately stronger 18° inspection pose. Its FBX/GLB round-trip and weight guards pass. The two eye-narrowing morphs are restrained squints; the rejected full-blink test remains retained because coarse painted-eye triangles distorted the brow.

The wardrobe preserves all 44 binds, retained body vertex positions, both morph deltas and normalized weights. Separate meshes preserve shape keys. Current CPU front/side/bent-knee views show improved coverage, a clean waistband and cuffs, but the round-trip topology report is **failed**: eight small source-derived thigh boundary edges and a small outer-ankle notch remain. No watertight or finished-art acceptance is recorded.

`wardrobe/body-bind-pose.fbx` consolidates 46 partial bind poses into one 90-node union. Every non-Pose FBX object/connection and fresh Blender-imported geometry, weights, morphs, materials and 44 binds match the frozen original exactly. Unreal still emits relative bind-pose warnings and successfully recreates the pose; actual rendered cloth/hand deformation must be inspected before acceptance. This copy reduces ambiguity but is not a claimed complete SDK-warning fix.

The connected fal account, Vaughn DiMarco, returned `balance_exhausted` during upload preparation. No reference was uploaded, no model job was submitted and no provider generation charge was incurred. The clean reference, exact prompts, generation provenance and provider status remain under `Data/GraphicNovel/Pilot/CurlyMetalhead/`. The verified Meshy schema supplies a body rig/basic clips, not a promised face/finger/jaw rig.

## Rejected attempts and remaining verification

All attempts remain under `Saved/Tests/GraphicNovel/`. Initial test compile errors and a non-exported BlendSpace subclass were corrected; saved assets now use ordinary Engine BlendSpace1D. Import1–3 exposed Python editor-property/factory API differences. Import4 saved its assets but exited 139 during Slate/ICU text-notification teardown; `coredumpctl` identifies `FICUTextBiDi`/`SNotificationExtendable` destruction on exit, with no OOM evidence. No extracted core was created. Switching offline authoring to the normal Python commandlet yields a clean final exit; exact root cause beyond that teardown path remains unproven.

The first native hand test compared a raw Hips track with an engine root-locked pose. The final test uses full engine extraction with the same required bones/context and the original tolerance; diagnostic full-source and graph transforms match exactly. The first NullRHI capture advanced graph phases while visibility optimization left bone transforms unchanged. Its failed report is retained under `PilotCapture/RejectedHeadless1`; forcing headless bone refresh fixes observation without weakening pose/cadence assertions. The native suite also now checks actual airborne knee bend, not weights/time alone.

Actual Unreal images at 1280×720/1920×1080, both render modes, unpaused start/stop/turn/jump video, line stability, ground/cloth/hand visual review and current package/performance/browser/phone/candidate-co-op acceptance remain pending. The shared GPU currently hosts the running browser demo; a short authorized maintenance window was requested. The [iteration skill](/home/von/.codex/skills/unreal-safe-iteration/SKILL.md) requires: “Serialize heavy rendering, profiling, packaged peer and streaming jobs when they share resources.” No service was stopped or changed in this phase. Higher resident update cost and remaining 12-Hz peer crowd root replication still need fresh profiling/smoothing review.

No production cast replacement, cooked package rollout, deployment or accepted graphics overhaul occurred. OpenSpec CLI remains unavailable; structure and scenarios were reviewed manually. `Saved/Tests/GraphicNovel/PilotStatus.json` retains final source/binary/candidate hashes, protected results and explicit `graphics_accepted=false`.
