# Round 28 hardware evidence

Three serial baseline/candidate pairs, each with 10 seconds warmup and 60 seconds per workload. Isolated installed Chrome155 headless, NVIDIA RTX4090 OpenGL, CSS3840×1080, DPR2. Baseline buffer7680×2160; candidate5430×1527. Shared GPU load was preserved; start/end snapshots appear in JSON except baseline1, whose mid-run utilization was observed at93%. Workloads: idle, W+E traversal, staged auto-healed brawl. Audio, fullscreen and pointer lock disabled only in the harness. Headless presentation is limited near60Hz and does not establish this120Hz monitor’s windowed performance.

Each row lists repetitions1/2/3. Every workload remained active, returned no page errors and collected35 synthetic Shift presses. Input p95 ends at CPU render submission, not physical display presentation. FPS and frame percentiles use the full60-second external rAF sample; inputTiming frame fields are a separate600-frame rolling buffer and must not replace the full sample.

| Variant/workload | FPS | p95 ms | p99 ms | >50ms count (%) | Input p95 ms | GPU median ms |
| --- | --- | --- | --- | --- | --- | --- |
| baseline idle | 41.57 / 57.77 / 59.39 | 33.40 / 16.80 / 16.80 | 33.40 / 33.40 / 33.20 | 0 (0.000%) / 3 (0.087%) / 0 (0.000%) | 25.1 / 17.8 / 16.0 | 13.16 / 9.42 / 8.83 |
| baseline traversal | 39.56 / 57.02 / 58.32 | 33.40 / 33.20 / 16.80 | 49.90 / 33.40 / 33.40 | 7 (0.295%) / 2 (0.058%) / 1 (0.029%) | 28.7 / 21.8 / 20.1 | 13.07 / 8.77 / 7.83 |
| baseline combat | 39.60 / 59.00 / 59.60 | 33.40 / 16.80 / 16.80 | 33.40 / 33.30 / 16.80 | 0 (0.000%) / 0 (0.000%) / 0 (0.000%) | 28.3 / 17.0 / 17.7 | 13.59 / 9.10 / 9.06 |
| candidate idle | 60.00 / 59.90 / 60.00 | 16.70 / 16.80 / 16.80 | 16.80 / 16.80 / 16.80 | 0 (0.000%) / 0 (0.000%) / 0 (0.000%) | 17.4 / 17.2 / 17.6 | 4.20 / 3.16 / 3.53 |
| candidate traversal | 56.17 / 59.30 / 60.00 | 33.30 / 16.80 / 16.70 | 33.40 / 33.30 / 16.80 | 2 (0.059%) / 0 (0.000%) / 0 (0.000%) | 19.9 / 17.4 / 16.6 | 5.20 / 4.15 / 3.60 |
| candidate combat | 60.00 / 60.00 / 60.00 | 16.80 / 16.70 / 16.70 | 16.80 / 16.80 / 16.80 | 0 (0.000%) / 0 (0.000%) / 0 (0.000%) | 17.4 / 18.0 / 14.9 | 4.19 / 4.33 / 4.26 |

Interpretation: median GPU render time decreases in all nine paired workloads. Warmed baseline FPS approaches60, so the first pair overstates a steady-state FPS gain. Candidate idle59.90 and traversal56.17/59.30 miss the strict60FPS target; traversal1 p9533.3 misses20ms and p9933.4 misses33.3ms. No repeatable >10% regression was found. All input p95 values stay below50ms and long frames below1%. This supports a bounded rendering workload, not closure of the actual user-Chrome report.

Visuals: full and detail PNGs preserve camera composition and native DOM text; fine3D texture sampling is visibly coarser. No aesthetics score increase. Screenshots were captured after warmup before measurements. Functional logs demonstrate3fail/6pass before and9pass after. XR guard is simulated, not headset-tested.

Source SHA256 manifest identifies exact baseline/candidate main.js. Raw local harness and originals: /home/von/Work/fullswing-performance-evidence-20261022. Production baseline is1b216ced; candidate runtime is unchanged from8a3399df. OpenSpec CLI unavailable; scenarios reviewed manually. Review passed on8a3399df; authenticated deployed preview passes all nine budget checks; final-head CI remains pending.
