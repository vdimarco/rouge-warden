# Production pacing follow-up

Three serial runs directly loaded production, with normal headless pacing in installed Chrome155, hardware NVIDIA RTX4090 OpenGL, CSS3840×1080, DPR2, drawing buffer5430×1527. Main.js SHA256 remains `e86d0f9f39a112168197f4dbcf80300a61140f81b822aa70e8909786ab0f5f76` (merged #622). Shared GPU workloads were preserved. Each run warms up10seconds, then samples60seconds each of idle, W+E traversal and a staged auto-healed brawl. Audio, pointer lock and fullscreen are disabled only in the harness.

| Run | Workload | FPS | p95 ms | p99 ms | >50ms count (%) | Input p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | idle | 60.00 | 16.7 | 16.8 | 0 (0.000%) | 15.5 |
| 1 | traversal | 60.00 | 16.8 | 16.8 | 0 (0.000%) | 16.2 |
| 1 | combat | 60.00 | 16.7 | 16.8 | 0 (0.000%) | 15.2 |
| 2 | idle | 60.00 | 16.7 | 16.8 | 0 (0.000%) | 17.8 |
| 2 | traversal | 59.69 | 16.8 | 16.8 | 1 (0.028%) | 17.4 |
| 2 | combat | 60.00 | 16.7 | 16.8 | 0 (0.000%) | 17.4 |
| 3 | idle | 60.00 | 16.8 | 16.8 | 0 (0.000%) | 15.8 |
| 3 | traversal | 59.74 | 16.8 | 16.8 | 0 (0.000%) | 17.5 |
| 3 | combat | 60.00 | 16.7 | 16.8 | 0 (0.000%) | 15.2 |

All samples have zero inactive frames and page errors, and35synthetic key presses per workload. FPS/frame percentiles use the external full60-second rAF sample; `inputTiming` contains the separate rolling600-frame diagnostic and input timestamps. Input timing ends at CPU submission and excludes GPU completion, display presentation and physical input.

Traversal runs2/3 are59.69/59.74FPS, slightly below the strict60FPS engineering target; retain these values. Headless pacing is near60Hz and cannot establish120Hz desktop presentation. The first matched candidate traversal failure in the original before/after table also remains evidence and is not superseded by these later passing samples. No score increase or actual-user slowdown closure is claimed.

An exploratory run with frame limiting and GPU vsync disabled reached133/131/121FPS but traversal input p95 rose to333ms. That delay did not reproduce in any of these three normally paced runs. Deliberately unpaced launch conditions are a confound, not evidence of a verified normal-browser regression. High throughput alone is insufficient for acceptance.

Actual user-profile Chrome remains inaccessible to the browser connector. A separate windowed trial was interrupted and rejected. These tests verify scoped production behavior; they do not validate the affected session, physical devices, audio listening or a full playthrough. No further identical GPU repeats are planned without a new concern.
