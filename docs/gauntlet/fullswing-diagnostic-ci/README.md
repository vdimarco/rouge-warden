# Required CI excludes optional performance benchmarks

OpenSpec `full-swing-diagnostic-ci` preceded the workflow edit. The user explicitly requires no FPS-benefit or performance-benchmark merge gate. Baseline docs-only PR #791 at `15ed7935` has no runtime/test/workflow diff from production `fafc9085`. Its CI run `40811493341`, flat-missions job `123242612236`, passed frame instrumentation correctness checks and then timed out after 480 seconds inside the required software swing benchmark before reporting a driven sample. `ci791-failure.log` retains the relevant output. This establishes a blocking diagnostic run, not a shipped regression or a fixed slowdown.

Remove only that benchmark step from required CI. Keep the manual script, all six jobs, every other parsed workflow value, frame-metrics unit/browser checks, gameplay correctness gates and rendering quality unchanged. `workflow-check.log` records exact parsed-workflow comparison and the frame-metrics unit result. Existing frame/input browser assertions passed on the identical production code in the failed job; they are not claimed rerun locally. Concurrent #790 adds gauntlet tests in other steps; preserve them. #789 now includes street-prop runtime changes; preserve those too. No longer timeout, retry queue, bypass, empty commit or benchmark-as-approval substitute is used.

Fresh release checks, review, authenticated preview, rebases and production verification remain pending for this focused repair. OpenSpec CLI is unavailable; proposal/design/scenario/task structure is checked manually. Canonical performance-policy reconciliation and archive follow release.

## All twenty rubric limits

All dimensions are unscored; no inherited hardware points, total or delta. Actual affected Chrome120Hz, physical-device input, listening and full playthrough remain unverified.

| Dimension | Limit |
|---|---|
| Lighting | No runtime change or new assessment. |
| Color palette | No runtime change or new assessment. |
| Detail density | No runtime change or new assessment. |
| Texture/material | No runtime change or new assessment. |
| Composition/camera | No runtime change or new assessment. |
| Atmosphere | No runtime change or new assessment. |
| Character models | No runtime change or new assessment. |
| Animation smoothness | No runtime change or new assessment. |
| Particles/VFX | No runtime change or new assessment. |
| UI polish | No runtime change or new assessment. |
| Responsiveness/input latency | Required instrumentation correctness checks remain; no hardware timing or benefit claim. |
| Controls feel | No runtime change or new assessment. |
| Mission clarity | No runtime change or new assessment. |
| Pacing | No runtime change or new assessment. |
| Fun factor | No runtime change or new assessment. |
| Difficulty curve | No runtime change or new assessment. |
| Feedback | No runtime change or new assessment. |
| Sound design | No runtime change or new assessment. |
| Variety | No runtime change or new assessment. |
| Performance stability | Required instrumentation correctness checks remain; no hardware timing or benefit claim. |
