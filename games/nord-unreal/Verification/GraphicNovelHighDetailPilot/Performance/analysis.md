Both high-detail motion jobs pass native checks, finalize/hash-verify their CSVs, exit cleanly and restore the demo. The managed unit completed successfully with exit status 0, confirmed by root. This compares one warmed Epic 1920×1080 editor run per cell; discard two frames at each end.

| Mode/model | CSV Hz | Frame mean / p95 ms | Game mean ms | GPU mean / p95 ms | Motion callback mean / max ms |
|---|---:|---:|---:|---:|---:|
| Standard / Retained refined | 24.84 | 40.27 / 48.15 | 5.38 | 11.15 / 12.33 | 0.461 / 0.898 |
| Standard / High detail | 24.95 | 40.08 / 46.84 | 5.37 | 11.10 / 12.38 | 0.446 / 0.820 |
| Comic / Retained refined | 25.19 | 39.70 / 45.99 | 5.55 | 10.56 / 11.55 | 0.481 / 0.950 |
| Comic / High detail | 24.59 | 40.66 / 51.64 | 5.43 | 11.18 / 12.28 | 0.462 / 0.774 |

Standard is nearly unchanged in this observation. Comic records +0.62 ms GPU cost and +0.96 ms mean frame time, with a higher frame p95. These single sequential runs neither prove performance equivalence nor establish a reproducible regression. Both remain near 25 editor Hz; no packaged 60 FPS or rendered fluidity is accepted.

Recorded settings and effective readbacks match by mode: Epic groups 3, texture pool 1000 MiB, shadow pages 4096, MaxFPS 60, VSyncs 0 and local streaming/background throttle false. ScreenPercentage 0 is default policy. Corrected isolation counts also match: Standard has 110 residents/44 cars and 1100/1382 owned components; Comic has 110/45 actors and 1100/1413 components. Both warm/completion checks pass.

High-detail callbacks average 0.446/0.462 ms; sample cost is included. Game EventWait still averages 34.76/35.29 ms and Slate DrawPrePass 35.98/36.55 ms. The retained CPU trace identifies FlushRenderingCommands/render synchronization as the enclosing wait owner, while the triggering caller and pending render/RHI operation remain unresolved. This analysis adds no new callstack trace.

The source body rises from 31,026 to 103,544 triangles, but this is a stochastic body/texture/own-clip comparison, not a same-seed polygon ablation. Both rigs retain static faces and fingers (zero controls); the high-detail model uses raw UV0/full normals, while the retained body includes its UV1 collar colour repair. Native selection, own clips/material and zero live material overrides pass; art quality and adoption remain separate decisions.

Only the successful HighDetailMotion-20261014T084528Z motion evidence is used. The interrupted 083947Z first-motion attempt is excluded; its two passing 720p still jobs remain separate. Raw hashes, phase/callback counts, all per-mode metrics and comparison deltas are recorded in analysis.json. No continuous playback, cooked performance, candidate co-op or physical-control acceptance is claimed.
