# Full Swing performance acceptance — rubric v1 evidence supplement

Performance is a release gate for Full Swing, not a cosmetic score that can be carried forward without evidence. This protocol applies to the existing **Responsiveness and input latency** and **Performance stability** dimensions of [rubric v1](RUBRIC.md); it does not change the shared dimensions, weights or historical score scale. The user's report of slow Chrome gameplay on this machine remains unresolved until measured and corrected.

## Required round evidence

Record the commit, browser/version, OS, GPU/renderer (hardware or software), viewport, device-pixel ratio, game settings, workload, sample duration and sample count. Use the same conditions before and after. Record competing GPU workload; do not silently stop unrelated applications or lower graphics quality to make a benchmark pass.

Measure after loading and shader warmup, with the tab visible, for at least 60 seconds each at rest, during traversal and in a busy combat scene. Separate loading, pause and background-tab periods. Repeat three times when comparing a change. Record:

- Average FPS from completed frame intervals divided by elapsed time; never average instantaneous FPS values.
- Median, p95 and p99 frame time in milliseconds; count and percentage of frames over 50 ms.
- Input delay with sample count and exact measurement method. The debug overlay reports event timestamp to next CPU render submission, including browser dispatch delay. It does **not** measure GPU completion, monitor scanout or physical input-to-photon latency.
- Errors, viewport/render resolution and scene draw calls/triangles for context. Draw-budget checks alone do not establish smooth gameplay.

Desktop engineering targets are at least 60 FPS, p95 frame time at most 20 ms, p99 at most 33.3 ms, fewer than 1% of frames over 50 ms, and input-to-submit p95 at most 50 ms across at least 30 intentional key/pointer presses. These are project targets, not measured claims. Refresh rate can limit FPS; report that explicitly rather than calling a slower display a game regression. Headset acceptance uses the device's actual refresh budget and requires separate hardware evidence.

A repeatable degradation greater than 10% in FPS or frame-time/input-delay percentiles under matched conditions blocks a candidate; absolute target failures must remain visible even if a candidate improves them. Revert a verified shipped regression. Do not merge a rendering/performance change as a performance improvement on the basis of SwiftShader functional checks. Missing hardware evidence is **unverified**, not pass. A narrow unrelated correctness fix can still ship with that limitation, but cannot close the slowdown report or earn performance points.

## Existing debug capture

Open `/vr/?debug` in the affected browser and play normally. The overlay adds average gameplay FPS, p95/p99 intervals, long frames and input-to-submit timing. `G.test.performance()` returns the report; `G.test.resetPerformance()` begins a new sample. Capture reports periodically for long runs: the rolling buffer retains the latest 600 frame intervals and 120 sampled input frames, not necessarily a full 60 seconds. Multiple presses within a frame retain the earliest timestamp. No data leaves the browser. Leaving active gameplay breaks frame continuity; reset before each comparable workload. The ordinary game does not collect these diagnostics.

`node qa/vr/frame-metrics.test.mjs` checks the arithmetic, stalls, bounds and inactive gaps. `NODE_PATH=qa/browser/node_modules node qa/vr/frame-metrics.e2e.mjs` verifies the integration under software rendering. Neither establishes hardware performance. Do not use the test's short sample or its injected key presses as a full traversal/combat benchmark.

## Current acceptance status

User's Chrome on this machine: **unverified; reported slow**. The current tool session exposes no Chrome connection, so it has not sampled that tab. Hardware responsiveness and performance-stability scores must be marked unverified in new Full Swing round reports until a comparable Chrome capture exists. Prior numeric scores are historical, not evidence that the report is fixed.
