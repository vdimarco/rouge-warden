# Design

Use the existing Three.js pixel-ratio path, bounding its ratio by sqrt(pixel budget / CSS viewport area). Apply the same calculation at initialization and resize; retain the existing XR resize guard. Bloom already reads the actual drawing-buffer dimensions. CSS layout and camera aspect remain viewport-sized.

Source: [Three.js responsive design](https://threejs.org/manual/pages/responsive.html), “HD-DPI: Limiting maximum drawing buffer size,” consulted22October2026. Adapt its maximum-area approach to the existing renderer rather than introducing an adaptive quality controller. Start by testing3840×2160 total pixels; the final budget requires measured evidence.

Acceptance: matched60-second idle, traversal and staged-combat samples, three repetitions, hardware renderer identified, p95/p99/long frames and at least30 input-to-submit samples. Headless and windowed runs are distinct conditions. Reject inactive samples. Preserve unrelated GPU workloads; disclose contention. Capture visual before/after evidence and inspect sharpness. The user's existing Chrome profile and physical input-to-display latency remain outside these synthetic tests.
