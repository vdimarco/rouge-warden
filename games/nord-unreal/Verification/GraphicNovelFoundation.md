# NORD graphic-novel foundation — 2026-10-13

The user selected Spider-Verse-inspired illustrated comic-book visuals **with smooth motion** and rejected the current goofy cast. A new mature-human [style study](../Data/GraphicNovel/style-study.png), its exact prompt/provenance and reusable `higgsfield/styles/nord.json` are retained. This is concept art, not gameplay or visual acceptance of a replacement model. The original crew and mapped environment remain the source baseline.

Implementation is isolated at `/home/von/Work/rouge-warden-nord-graphic-novel`, branch `codex/nord-graphic-novel`, based on `ed452c1a`. The other checkout's concurrent car/collision work was not edited. The native source now evaluates player poses at full simulation cadence in both F2 states and removes the deliberate 12-Hz pose quantization / 24-Hz actor tick from park residents. Comic switching remains private. The rendered pilot also exposed same-style reapplication clearing its SingleNode animation instance; switching animation mode before mesh assignment fixes that shared path, with a native regression.

| Fresh check | Result |
| --- | --- |
| Editor build | PASS, final exit 0 |
| CPU cadence regression | PASS: smooth Walk/Run at multiple sampling rates/wraps; held poses, jumps in phase, frozen bones and inadequate sampling rejected |
| Native same-style reapply | PASS: real selected body and live instance survive reapply; pose assignment and successive grounded ticks work; exit 0 |
| Two-player native legacy smoke | PASS: 69 checks in 44.54 s, exit 0; C/E/F2, props, movement, car interactions and resident tick readbacks retained |
| Rendered possessed style 9 pilot | PASS: seven 1280×720 states, exit 0; actual idle/face/three-quarter/walk/run/airborne/landing fixture |
| Continuous locomotion | Every observed Walk pair (396/396) and Run pair (409/409) advanced phase and foot pose; one engine-frame gap throughout; two wraps each, no phase-rate error |
| Saved asset/source preservation | PASS: all 279 protected map/crew/source identities unchanged |
| Render log content | No dependency, shader, fatal or GPU-memory errors under existing guard; two PixelStreaming startup window errors are outside that guard and did not prevent completed capture |
| Visual inspection | All seven existing-model snapshots inspected; stronger source body/rig/material work is still required |
| Style loader/composition | PASS through actual loadStyle/applyStyle; no provider submission |
| Diff/syntax checks | PASS; OpenSpec CLI unavailable, structure checked manually |

Cadence observations use 0.25 world-time dilation to resolve pose holds. Their rates are **not** native/render/browser FPS. The pilot proves continuous samples of the current hero, not blended transitions, expressive acting, mature model quality or player-perceived fluidity. Existing face expressions are static, fingers have no controls, locomotion clips still switch abruptly, and NPC root movement still replicates at 12 Hz without CharacterMovement smoothing. Higher resident update cost requires fresh performance acceptance.

Remaining work: a mature rigged character pilot with facial/finger articulation, blended locomotion/turning and grounded feet; selective authored line/material and lighting treatment; reviewed replacement for toy mascots; then the eight-crew/ambient rollout, both supported sizes, actual motion videos, co-op/late join, package/performance and streamed/phone checks. No production asset replacement, package rebuild, browser rollout, paid model generation or deployment happened in this phase.

Raw evidence and rejected attempts are retained in `Saved/Tests/GraphicNovel/`, including Report.json, final smoke, AutomationVerified, Reports/PlayerQuality1280.json, Pilot1280, the contact sheet and protected hashes. Earlier failed fixtures/compile attempts are not counted as passing evidence. The first render failure identified the animation-instance bug; test-only initialization mistakes were corrected while retaining their intended assertions. All owned test processes exited. No service lifecycle was changed.
