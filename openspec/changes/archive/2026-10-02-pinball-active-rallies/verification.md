# Verification

## Baseline and intended outcome

The user reported that Full Tilt felt easy, predictable and mostly passive. Six seeded baseline runs (1, 8, 21, 42, 73, 101) using Pulse alone all completed the voyage in 48–95 seconds without a flipper press. Flipper-only play spent 70–90% of its time away from the dock, with an uninterrupted absence as long as 58 seconds.

The implementation gives each launch, moving flipper strike or reverse scoop a 4.5-second orbital window. A bounded return current then approaches one blade. A genuine upward motor contact powers the ball for four seconds; successive strikes on the same ball build an asteroid-score multiplier capped at three. Pulse now adds a 420-unit impulse, with a capped upgrade boost, and does not reset the return clock. Three to five seeded rocks move on safe paths, deflect ordinary balls and break once under power. Reentry is warned for at least 1.25 seconds and waits for ball clearance.

## Model and independent review

- Twenty unattended seeds returned to a descending dock approach in at most 7.16 seconds away. Frame displacement remained bounded, with no return teleport.
- The final comparison uses six seeds and real launch/Pulse/flipper inputs: active play won 6/6 voyages in 176–288 seconds including warp travel, averaging 8.1 powered strikes per active minute. The longest active absence from the dock was 9.3 seconds. Pulse-only play won 0/6 voyages.
- All nine simulation suites passed, including 2.1 million classic collision frames, two simulated hours of classic bot play and 3,356 camera checks. The adventure bot now uses active-play ticks and a six-minute budget; it still uses real physical controls. The field-expiry test compares same-time gravity without the well because the underlying rally force now evolves during the field's lifetime.
- Focused rally checks cover genuine versus held/empty flipper input, capped multiplier, reverse recovery, checkpoint cleanup, paused time, corrective Pulse, safe paths, ordinary deflection, one destruction reward, delayed reentry and inactive-sector isolation.
- Independent review compared 20,000 classic ticks with the original solver: ball/flipper state and existing event fields were identical. Three thousand valid Pulse vectors respected the impulse and speed bounds. Moving-rock bounce matched relative-velocity restitution.
- Independent path sampling covered 100 seeds over 120 seconds. All sampled moving-body gaps retained at least one ball diameter. Path generation uses original neighbor anchors, so iteration order cannot weaken its range bound.
- Return guidance originally said “Flip now” too early. Direct contact trials showed early presses had already reached the held position at impact. The cue now distinguishes “Incoming” from the lower strike window and refreshes each rendered frame.

## Render evidence

The Browser plugin was not available, so checks used the existing Playwright workflow and Chromium. New test response fixtures arrange initial physical situations only; production exports contain no test hooks. User input then drives the unchanged solver.

- Actual moving-asteroid forecasting shortened a crossing path from 24 samples to 9. Inactive and warning-only rocks stayed excluded from collision predictions.
- Hollow amber warnings are visually distinct from live mineral bodies. A powered ball retains its gold duration ring with reduced motion; extra streaks and fragments are suppressed.
- Repeated paused frames and reduced-motion frames were pixel-identical in the focused renderer fixture. No browser runtime errors occurred.
- Initial portrait screenshots showed a one-pixel overlap between the long rally readout and flipper controls. Raising the readout by 13 pixels leaves a visible 12-pixel gap. All 34 affected portrait checks passed on rerun.
- A total of 382 browser assertions and three layout scenarios passed: 139 new rally checks, 78 reverse, 74 field, 35 standard controls and 56 transit checks. Desktop 1280×800, portrait 390×844 and landscape 844×390 all reached the first gate naturally through public launch, Pulse and the visible flipper timing cues. No private state or fixed seed was used for this progression test.
- Screenshots were inspected for powered shots, smash feedback, reentry warnings and returning balls. Test fixtures separately verified both keyboard sides, real touch input, one-time power rewards, pause/map/field freezes, restart and reduced motion. No application errors were observed.

## Limits

Automated policies establish reachability and contrast active with passive play; they do not replace human playtesting of enjoyment. Tests use Chromium and emulated touch. Physical phone latency, sustained mobile frame rate, audio quality and native sensor prompts were not measured. The OpenSpec CLI is unavailable in this workspace; Markdown structure and requirement/scenario coverage are reviewed directly.
