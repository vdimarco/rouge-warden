# Design

## Constraints
- The cloud container has no Unreal Engine, no GPU and no dotnet. Every native, C# and frame-time claim stays open until the host builds and runs it.
- The host compiles with clang `-Wall -Werror -Wshadow`. No local, parameter or lambda parameter may reuse a member name, own or inherited.
- The canonical spec requires 60 FPS native and WebRTC ceilings and forbids lowering production visual settings without an approved tradeoff (`openspec/specs/nord-stream-responsiveness/spec.md`, `openspec/specs/nord-unreal/spec.md`).
- The desktop gate stays as it is: `Scripts/profile_package.py`, p95 below 16.67 ms at Epic and 100%.
- The world is mirrored, and a fix will flip Y (`openspec/changes/nord-gta-level-up/design.md`). Route data must survive that fix without hand edits.
- Capture and profile scripts must not overwrite historical `Preview/` and `Verification/` files (`CLAUDE_HANDOFF.md`). Gauntlet output goes to new timestamped folders.

## Decisions
1. **Two meanings, one loop.** "Gauntlet loop" means a `docs/gauntlet/` round loop scored with rubric v1. This change adds the third NORD loop, `docs/gauntlet/gta-mobile.md`. An Unreal Gauntlet run on the host measures each round.
2. **Keep the 60 caps and judge frames against 33.3 ms.** A 30 cap added about 30 ms of receiver buffering: 73 ms against 43 ms (`Verification/DrivingLatency.md`). At a 30 cap the phone ladder can only step down, because it needs 35 FPS to step up (`Browser/config.mjs`). FrameTime therefore has a 16.7 ms floor, and GPUTime shows the headroom.
3. **Split "30 FPS latency" in two.** The frame-rate floor is gated. Delay (round-trip time, jitter buffer, decode, processing, end to end) is reported in its own section and never gated, as `nord-stream-responsiveness` requires.
4. **One viewer is gated.** The gate is one phone viewer on NordHost, with NordFriend1 idle and asleep. Two viewers and the TURN relay are report-only rows. The co-op target stays with nord-stream-speed.
5. **The tuned settings are an opt-in profile.** Production stays unchanged until the user approves paired captures. A separate change flips the default.

## Route
The stops come from the five replica manifest cameras (`Data/Plateau/ReplicaGeometry/Streets/manifest.json`). They are the capture streets with curb-to-building coverage, plex skins and mapped trees, so they are expected to be the heaviest. Round 1 checks this by ranking per-leg p95.

| Stop | Eye position (cm) | Target (cm) |
| --- | --- | --- |
| S1 Sherbrooke | (36000, 6200, 170) | (41000, 8800, 300) |
| S2 Papineau | (24500, 44000, 170) | (27500, 49500, 300) |
| S3 Fabre | (-6000, 44000, 170) | (-2600, 48800, 300) |
| S4 RachelPark | (-15500, 30500, 170) | (-11000, 33500, 250) |
| S5 Mentana | (-30500, 21800, 170) | (-27000, 26500, 300) |

The order is S1 to S5, then back to S1. `QuebecPursuit::FRoadGraph::Route` finds the path between stops over `LaFontaineExtension::RadarRoadSegments`. Each stop's road point is the nearest point on an open segment. An offline estimate gives legs of 513, 481, 178, 485 and 1334 m, about 3.0 km in all. The route test reports the real length and requires 2.5 to 3.5 km. `WALK_ROUTE` and the campaign RaceRoute do not reach these streets.

`make_gauntlet_route.py` generates `QuebecGauntletRoute.h` from the manifest. A test fails when the two disagree, so the mirror fix needs one regeneration.

The subsystem seats the avatar in a car at S1 with `Interact` and disables pawn input, as `Scripts/test_race_drive.py` does. Each tick it feeds `MoveForward` and `MoveRight`. Steering uses `Lookahead`, `TurnAhead` and `CornerSpeed`, as the police road follower does (`QuebecPolice.cpp`). Speed is capped at 15 m/s. The stuck rule is the police one: reverse for 1.1 s after 1.2 s stuck. `SetAutopilot` is not used, because a possessed car ignores it, and the chase camera reacts to speed only for a possessed car. Car handling matches at 30 and 120 Hz, so laps repeat across frame rates.

Perf and stream runs keep ambient traffic and residents, and pass `-NordNoPolice -NordNoCampaign -NordNoSideJobs -NordNoCampaignSave`. Look runs also pass `-NordNoAmbient`. The sky is always pinned. Day is `-NordHour=15 -NordWeather=Clear -NordFreezeTime -NordFreezeWeather`. Night rain, the worst case with 24 lamps, 2,000 rain streaks and moon shadows, is `-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather`. A run without hour and weather exits with code 3, because QA runs do not spawn the sky otherwise (`QuebecSky.cpp`).

A perf run is one warm-up lap, which is discarded because it compiles shaders, plus N measured laps of about 3.5 minutes each. Each stop has two fixed views, `<stop>-eye` (the manifest pose at 85°) and `<stop>-chase` (the car stopped at the road point, facing the next leg, after 2.5 s for the camera and 120 frames for TSR). The HUD is off. Sizes come from `Browser/config.mjs` with the sampler viewports: rung 0 is 1412x652 and 652x1412, rung 1 is 1058x488 and 488x1058. The tuner works at 1412x652. Confirmation adds portrait. Rung 1 is used in the stream pass only.

## Measurement
**Native.** The subsystem starts the CSV profiler after the warm-up lap and stops it at the end, as the HORU template does after the map loads. It adds a CSV event at each leg start. The parser reads FrameTime, GameThreadTime, RenderThreadTime, RHIThreadTime and GPUTime (with `-csvGpuStats`) by name and records any missing column. The runner samples VRAM and GPU use per process each second with `nvidia-smi`, and each game process's CPU use from `/proc` (VP8 encodes on the CPU). The subsystem logs a `NORD_GAUNTLET summary` line from its own frame-delta counter. A p95 mismatch over 1 ms against the CSV flags the run.

**Native gate**, per run and per leg after the warm-up lap: FrameTime p95 at most 33.3 ms; p99 at most 50 ms; at most 1% of frames over 50 ms; at most one hitch (over 66.7 ms) per 30 s and none over 250 ms; peak VRAM at most 6,000 MiB per process, so two slots fit the 12,000 MiB guard; a clean `render_log_guard.py`; and every profile CVar read back as requested.

**Stream.** `Browser/stream-sample.mjs` is extended, not replaced. It keeps mobile Chromium, touch and DPR 1. It adds each `requestVideoFrameCallback` callback (p50, p95 and p99 decoded intervals, the share over 33.3 and 50 ms, the longest gap), candidate-pair round-trip time, inbound jitter, processing delay, jitter buffer target, the frontend `latencyCalculated` event, encoder QP and every size change. A QA-only `?pin=` keeps the rung fixed. The run starts the lap 95 s after the first BeginPlay, so NordFriend1 is asleep (60 s warm-up plus 30 s grace).

**Stream gate**, solo, direct, both rungs, landscape and portrait: mean decoded FPS at least 29; zero freezes; at most 1% of intervals over 50 ms; longest gap at most 500 ms; jitter buffer at most 120 ms per frame on average; `NORD_STREAM_FPS` at least 29 in every 5 s window, and decoded FPS within 3 of native. These follow the nord-stream-speed rules.

**Report-only rows.** Two viewers, with one sampler per slot. Forced relay. Delay, labelled "host-PC headless Chromium with --disable-gpu, not a phone, not off-LAN".

**Contention.** The runner reuses `browser_streaming.preflight()` and records other GPU processes before and after. Any foreign GPU process labels the run "contended", and a contended run is never ranked.

**Output.** Each run writes `Saved/Gauntlet/<UTC>-<label>/` (git-ignored): `run.json`, `native/*.csv`, `native/legs.json`, `native/route.json`, `look/`, `stream/`, `verdict.json` and `review.html`. A gate's status is pass, fail, unverified or contended. After a round, only `Verification/Gauntlet/<YYYYMMDD>-<label>.json` (no PNGs) and approved stills in `Preview/Gauntlet/<YYYYMMDD>/` are committed.

## Visual check
The ceiling reference is all `sg.*` at 3, screen percentage 100, VSM on, Lumen GI and reflections at Epic, and TSR, as in the desktop release look. It is rendered twice. Run-to-run SSIM must be at least 0.98 on every image, or the round is invalid. The metric is luma SSIM with an 11x11 Gaussian window, sigma 1.5, K1 0.01 and K2 0.03, written in numpy. NVIDIA FLIP mean error is report-only when `flip-evaluator` is installed on the host, at a recorded 40 pixels per degree. The provisional floors, calibrated in round 1, are SSIM at least 0.85 on every image and a mean at least that of the current production profile. If the user rejects a candidate that passed, the floor rises above that candidate's lowest image, and the change is recorded. At each stop during the stream run, the subsystem holds 4 s, the runner writes a trigger line, and the sampler saves the decoded frame and a full-page shot. Their SSIM against the native still is report-only, because traffic is live.

## Tuning
The knob ladders live in `Data/Gauntlet/loop.json`. The baseline is today's `QUALITY`.

| Knob | Steps | Baseline |
| --- | --- | --- |
| Shadows | `sg.ShadowQuality` 1 + VSM 0, 2 + VSM 0, 2 + VSM 1, 3 + VSM 1 | 1 + VSM 0 |
| `sg.GlobalIlluminationQuality` | 1, 2, 3 | 1 |
| `sg.ReflectionQuality` | 1, 2, 3 | 1 |
| `r.ScreenPercentage` (TSR) | 60, 67, 75, 85, 100 | 75 |
| `sg.ViewDistanceQuality`, `sg.FoliageQuality`, `sg.EffectsQuality`, `sg.PostProcessQuality`, `sg.ShadingQuality`, `sg.AntiAliasingQuality`, `sg.TextureQuality` | 2, 3 | 2 |

`r.Nanite.MaxPixelsPerEdge` joins only if Nanite meshes show on the route. `-NordStreamBudget` joins when nord-stream-speed lands it. `t.MaxFPS 60`, TSR and VP8 are fixed. Stream ladder changes in `config.mjs` are recommendations for the user, never automatic.

A candidate is feasible when the night-rain landscape lap has FrameTime p95 at most 30.0 ms and GPUTime p95 at most 28.0 ms (a 10% margin; the gate stays 33.3 ms), and the hitch, VRAM and readback gates pass. Look is the mean SSIM over 20 images (10 views, two skies, landscape). Look values within max(0.005, 2 × (1 − mean repeatability SSIM)) tie, and a tie goes to the lower GPU p95. Millisecond differences below max(0.5 ms, 2 × |p95a − p95b|) of the two baseline runs tie.

The search is a greedy climb. Measure the baseline twice and the ceiling look twice; if the baseline is not feasible, search downward first. Measure each single step up from the baseline once. Rank steps by Look gain divided by max(ms cost, 0.25) and drop steps with no visible gain. Combine steps in that order while the predicted GPU p95 stays at most 28 ms, measure, and drop the last step if infeasible. Then try each remaining step alone on top of the winner. Stop when nothing feasible and visibly better is left, after 24 measured candidates, or at the window end (`--until HH:MM`). Confirm the winner and the baseline with 3 measured laps each, both skies, landscape and portrait, then the stream runs. If the winner fails, confirm the next feasible candidate. A candidate takes about 10 minutes, so 24 take about 4 hours, plus about 1.5 hours to confirm. It runs overnight in an agreed GPU window with the live demo stopped.

## Phone profile
`Config/DefaultDeviceProfiles.ini` gets `+DeviceProfileNameAndTypes=NordPhoneStream,Linux` and a `[NordPhoneStream DeviceProfile]` section with `DeviceType=Linux`, `BaseProfileName=Linux` and `+CVars=` lines, `sg.*` first. The first version equals `QUALITY`, so switching changes nothing. `browser_streaming.py` gains `NORD_STREAM_QUALITY=current|phone|file:<path>`. `current` is the default and unchanged. `phone` passes `-DeviceProfile=NordPhoneStream`. `file:` takes a candidate ExecCmds file under `Saved/Gauntlet`. If the host shows that `-DeviceProfile=` does not apply in the Browser package, the launcher expands the same section into `-ExecCmds`, which is today's proven path. The CVar readback on every run catches a saved `GameUserSettings.ini` that overrides the profile. The ini syntax and the command-line override are written from memory and are unverified until the host reads them back.

## Pieces
- C++ (`Source/Quebec/`): `QuebecGauntletModel.h` (engine-free route assembly, driver step, run state machine Wait, WarmLap, Measure, Hold, Done or Fail, frame-stat accumulator, expected-CVar parser); `QuebecGauntletRoute.h` (generated); `QuebecGauntlet.h/.cpp` (`UQuebecGauntletSubsystem`, created only with `-NordGauntlet`; flags `-NordGauntletMode=perf|look|stream`, `-NordGauntletRun=`, `-NordGauntletLaps=`, `-NordGauntletExpect=`, `-NordGauntletDelay=`; exit codes 0 done, 2 stuck over 10 s, 3 sky missing, 4 CVar mismatch, 5 timeout; it never judges budgets); `QuebecGauntletController.h/.cpp` (`UQuebecGauntletController : UGauntletTestController`, starts the subsystem in `OnPostMapChange` and calls `EndTest`, built only with `QUEBEC_WITH_GAUNTLET`).
- Project: `Quebec.Build.cs` adds the Gauntlet module in non-Shipping builds and defines `QUEBEC_WITH_GAUNTLET=1`. `Quebec.uproject` enables the Gauntlet plugin. `QuebecSky.cpp` adds `NordGauntlet` to its QA flags.
- Offline: stub `CsvProfiler.h` and a Gauntlet stub with `GauntletTestController.h`, written from memory and marked unverified, plus a selftest case.
- C# (host): `Build/Scripts/NordGauntlet.Automation.csproj` and `Build/Scripts/NordMobileLoop.cs` (`NordMobileLoop : UnrealTestNode<UnrealTestConfiguration>`; params `mode`, `size`, `sky`, `laps`, `run`, `execcmds`; client role on `/Game/Maps/LaFontaine` with `-RenderOffscreen -ForceRes -unattended -nosound -csvGpuStats`; `MaxDuration` 900 s; it runs the Browser package).
- Python (`Scripts/`): `gauntlet_loop.py` (`self-check`, `route`, `native` with `--direct`, `stream`, `reference`, `tune`, `report`, `write-profile`), `gauntlet_metrics.py`, `gauntlet_tune.py`, `make_gauntlet_route.py`, and plain-assert tests with fakes, including `test_gauntlet_model.py` with `gauntlet_model_test.cpp` and a shared frame-time fixture.
- Browser: `stream-sample.mjs` options `--frames`, `--pin`, `--trigger`, `--out`, `--latency`; `config.mjs` `pinnedLevel`; `player.js` skips adaptation when pinned; `build.mjs` defines `NORD_QA_PIN`, false by default; tests for the new fields and the four frame sizes.
- Launcher and docs: `browser_streaming.py` gains `NORD_STREAM_QUALITY` and `NORD_STREAM_GAUNTLET=<run dir>` (gauntlet flags on NordHost only, refused without hour and weather in `NORD_SKY_ARGS`), both recorded in `lifecycle.json` and covered by `self-check`. `Verification/QAPlan.md` names the 60 cap and points to these gates. `docs/gauntlet/gta-mobile.md` holds the loop protocol.

## Sources
AGENTS.md asks for the source of each technique. These are the sources adapted, and what was taken from each.
- Epic, "Gauntlet Automation Framework Overview", "Running Gauntlet Tests" and "Gauntlet Controller" (dev.epicgames.com): the C# test node, `RunUnreal` with `-test=Node(params)`, the controller lifecycle and `EndTest`. Every public example is Win64, so Linux is a host check.
- HORU, "Gauntlet Automated Testing and Performance Metrics in UE4" (horugame.com): start the CSV capture from `OnPostMapChange` after the map loads, wait for `EndCapture`, then call `EndTest`.
- Epic, AutomatedPerfTesting plugin API (`UAutomatedPerfTestControllerBase` and the Sequence test) and its forum threads: the idea of a fixed flythrough per map with CSV and screenshots. It is adapted as a driven route. The plugin itself is not used, because it is experimental and needs BuildGraph and Level Sequence assets.
- Intel, "Unreal Engine Optimization Guide: Profiling Fundamentals": the CSV profiler flags and the 33.33 ms budget for 30 FPS.
- Epic, "Scalability Reference" and the Device Profiles documentation: the `sg.*` groups and the profile section format.
- Epic, "Lumen Performance Guide", "Virtual Shadow Maps" and "Temporal Super Resolution": the cost of each knob step, the TSR 50% floor, and why the TSR flicker cap must match the frame cap (it stays at 60 here).
- W3C, "Identifiers for WebRTC's Statistics API": the freeze definition, jitter buffer per frame and round-trip time.
- Epic, PixelStreamingInfrastructure UE5.8 frontend (`LatencyCalculator`, the installed library in `Browser/node_modules`): the `latencyCalculated` delay fields.
- Wang, Bovik, Sheikh and Simoncelli, "Image Quality Assessment: From Error Visibility to Structural Similarity" (IEEE TIP, 2004): SSIM and its constants. Andersson et al., "FLIP: A Difference Evaluator for Alternating Images" (NVIDIA, 2020): the optional report-only map.
- "LUT-Opt: Real-Time Rendering Parameter Optimization" (arXiv 2604.25178): pick the best SSIM against a maximum-quality render within a time budget, with additive costs.
- NVIDIA's Optimal Playable Settings, as described by TechRadar: scripted runs through the heaviest areas against a target frame rate.
- In-repo: `docs/gauntlet/fullswing-performance.md` (evidence format, "unverified, not pass"), the police road follower in `QuebecPolice.cpp`, `Scripts/profile_package.py` (CSV parse, warm-up discard, percentile), `Browser/stream-sample.mjs` and `Scripts/test_race_drive.py` (input disabled before driving).

## Host checks to settle first
- Do RunUnreal and the Gauntlet plugin work on Linux? If not, use `gauntlet_loop.py native --direct`.
- Does `-DeviceProfile=` take effect in the Development Browser package, and does `GameUserSettings.ini` override it?
- Do the CSV columns include GPUTime with `-csvGpuStats`?
- Does C++ driving of a possessed, rendered car hold with pawn input disabled, or does real input write zero axes each frame?
- Is the measured loop near 3.0 km, and which leg is heaviest?
