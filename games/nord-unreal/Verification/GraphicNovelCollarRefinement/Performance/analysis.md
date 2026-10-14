All three latest native motion diagnostics passed, finalized their CSVs, and restored the demo. This is one warmed 1920×1080 Epic editor run per cell on the 4090, discarding two frames at each end. It does not accept packaged FPS or rendered fluidity.

| Cell | CSV Hz | Frame mean / p95 ms | Game mean / p95 ms | GPU mean / p95 ms | Motion callback mean / max ms |
|---|---:|---:|---:|---:|---:|
| Fixed Standard | 24.84 | 40.27 / 48.15 | 5.38 / 6.83 | 11.15 / 12.33 | 0.461 / 0.898 |
| Fixed Comic | 25.19 | 39.70 / 45.99 | 5.55 / 6.89 | 10.56 / 11.55 | 0.481 / 0.950 |
| Old Fixture Standard | 23.86 | 41.91 / 53.06 | 10.05 / 14.99 | 11.29 / 12.30 | 0.442 / 0.895 |

The matched Standard comparison removes 4.67 ms of observed Game work (46.4%): TickActors falls from 3.26 to 0.22 ms and Animation from 0.93 to 0.08 ms. Mean frame period improves only 1.64 ms (3.9%); GPU cost stays near 11.2 ms. This diagnoses combined background actor/component fixture overhead. The old fixture can restore resident visibility, so it is not a pure CPU ablation. Comic is a separate observation, with no claim that its effect is free.

Fixed Standard verifies 110 residents, 44 cars and 1100/1382 owned components isolated at warm-up and completion. Fixed Comic verifies 110 residents, 45 cars and 1100/1413 components. Old Fixture records requested counts of 110/44 actors; its runtime isolation remains unverified.

Python sampling is small: motion callbacks average 0.442–0.481 ms and peak below 0.950 ms; sample cost is already included. All runs retain Epic groups 3, MaxFPS 60, VSync/VSyncEditor 0 and effective streaming/throttle flags false. ScreenPercentage 0 remains the default policy.

Editor pacing remains unresolved: Slate DrawPrePass averages 33.11–36.15 ms and Game EventWait 31.88–34.94 ms. The next useful diagnostic is a bounded CPU timing/callstack trace around that wait with unchanged settings. No quality reduction or production optimization is validated by these runs.

Raw CSV/report/summary hashes, callback distributions, phase checks, fixture counts, source explanations and caveats are in analysis.json. Only the successful 075500Z motion evidence is promoted; earlier failed wrappers remain diagnostic evidence.
