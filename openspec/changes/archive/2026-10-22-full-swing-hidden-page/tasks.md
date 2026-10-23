# Tasks
- [x] Inspect input visibility, simulation guard and mobile/XR lifecycle paths.
- [x] Reproduce hidden-page movement with observable physics state.
- [x] Apply the smallest visibility correction and verify hide/resume behavior.
- [x] Capture labelled before/after evidence and honest rubric scores.
- [x] Complete review, CI and deployed preview; rebase, merge, verify production and archive the completed spec.

Validation: baseline6fail/8pass → corrected14pass across960×540 and390×844. Current authenticated preview passes14checks. All six CI jobs, automated review and deployment checks passed on0f8cf4a8; fresh rebase preceded exact-head merge4fdb704a. Production desktop.js HTTP200 and byte-for-byte match verified. OpenSpec CLI unavailable; structure/scenarios reviewed manually. Synthetic lifecycle evidence only; actual browser throttling, physical devices and affected Chrome-session performance remain unverified.
