# Full Swing performance improvement plan

User direction: ship small, reviewable improvements continuously. FPS-benefit checks and long benchmark queues are no longer merge gates. Keep focused correctness tests, review, CI, deployed preview, rebase and production verification. Measure when it answers a specific question; do not delay every increment for another full comparison.

## Constraints
- Real building anchors only; reachable attachments above rooftops remain allowed. No artificial height ceiling.
- Keep the existing image, effects, native UI resolution and XR behavior. No blind quality cuts.
- Keep the affected Chrome slowdown open until that browser is actually verified. FPS/latency targets remain diagnostic; no inherited passing hardware scores.

## Incremental delivery
1. **Remove redundant fullscreen clears (#634).** Reuse the tested opaque fullscreen pass helper; restore caller renderer state in finally. Pixel equivalence, failure-state tests, CI/review/preview are already established on the runtime change. Ship after fresh current-head release checks; do not require a proven FPS gain.
2. **Bound dynamic GPU uploads.** Inspect the street/character instance buffers and upload only populated/changed ranges using the existing addUpdateRange pattern. Verify actual GPU-upload ranges and shrinking/growing instance counts; preserve visible actors and motion.
3. **Reduce repeated scene work.** Use the existing scene-cost data to target recurring material/instance work, reuse cached static data and preserve culling bounds. Pick one concrete hot path, make one change, and add a focused equivalence or behavior check.
4. **Keep responsiveness observable.** Retain FPS, p95/p99, long-frame and precisely scoped input-latency diagnostics. Record before/after observations when available; use an actual affected-Chrome capture when accessible. Do not repeat identical passing benchmark suites.

Each increment gets a small commit/PR, honest limitations, automated review and release checks, a rebase before merge, and production byte verification. Revert verified shipped regressions. Continue to the next implementation after release instead of repeating audits.

## Current evidence
The shipped render budget, bounded adaptive feedback and zero-contribution shaft guard are live. Fullscreen-clear measurements were mixed: this increment removes redundant render commands, with FPS benefit unverified. The new user-directed workflow supersedes the earlier rejection based solely on an unproven throughput gain.
