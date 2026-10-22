# Round29 adaptive-resolution trial

**Release evidence is in progress. Do not treat this branch as accepted hardware performance.**

Flat gameplay now trials15% lower linear3D resolution after three seconds averaging over25ms with a majority of intervals over25ms. The next three-second window must improve by at least10%, otherwise it restores the prior resolution and stops trying until resize/reload. It stops reducing at half the initial ratio. Native DOM sizing, camera aspect, content, simulation and XR are preserved. Successful reductions remain until resize/reload to avoid periodic upward probes causing new hitches. Fine3D sampling can become softer.

Unit checks cover smooth frames, sustained slow frames, improvement, rollback/no-repeat, inactive continuity, isolated stalls, minimum and reset. The synthetic browser integration checks12 lifecycle/layout cases at960×540/390×844; controlled callback timestamps and a no-op bloom pass isolate feedback logic. They do not measure hardware or physical-device behavior. An initial fixture read resize state before the event arrived (10pass/2fail); waiting for updated camera aspect corrects the fixture, all12pass.

A preliminary30-second isolated Chrome156 headless NVIDIAOpenGL RTX4090 experiment deliberately rendered the full bloom pipeline four times per frame: baseline35.08FPS, candidate43.17FPS. Both p95 frame times33.4ms miss20ms. This exploratory candidate predates the majority-slow-frame guard; it is not release evidence. Formal matched comparisons use frozen current sources, three60-second idle/traversal/staged-combat workloads,35synthetic inputs per workload, with both normal pacing and explicitly artificial4× rendering pressure. Full raw data, visual comparisons and remaining failures will be recorded before merge.

Actual user-profile Chrome/high-refresh/input-to-photon acceptance remains unavailable. No slowdown-fixed claim, no current performance/stability score or overall rubric total. The prior render-budget round's misses and fine-detail tradeoff remain disclosed.

CI exposed a wall-clock-dependent pointer-lock fixture: its nominal140ms refusal check ran after9036ms on a busy runner, so the mock correctly granted the lock and the test failed. The initial refusal assertion now holds the mock/product performance clock in a scoped try/finally, then restores real time before checking automatic retry. No pointer-lock production behavior changed; fresh CI is required.
