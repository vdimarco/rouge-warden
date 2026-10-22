# Round 28 evidence — in progress

First serial matched pair only; remaining repetitions pending. Raw JSON records 60-second workloads, frame-time p95/p99, long frames, synthetic input timestamps and actual drawing-buffer dimensions. Input latency ends at CPU submission, not display presentation. Hardware: isolated installed Chrome155 headless OpenGL on RTX4090, shared GPU. Not the user’s Chrome profile.

Full and detail PNGs show unchanged composition/native DOM text and coarser 3D fine sampling. Baseline/candidate main.js SHA256 values are in matched-sources.json. Functional logs demonstrate three failing budget checks before the fix and nine passing checks afterward.
