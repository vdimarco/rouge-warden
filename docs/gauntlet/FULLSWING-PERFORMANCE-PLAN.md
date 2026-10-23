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

## Released increments

PR#634 released as `8608ff629f30ec911edab0ad6c12f77606b6fc9c` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

PR#635 released as `3797b07fdd943b430102de6b573ef8f20f6f2e38` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

PR#636 released as `9d82f8233450bc1a3c5f1e8ef841c78de731c768` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

Continue with small concrete scene-work changes; do not reinstate FPS-benefit checks or benchmark queues as merge prerequisites.


Increment37 released in #638 as2c9d2d8f after all6CI/review/current4checkpreview/freshrebase. Production streetview HTTP200 exactSHA6a1c7c3089d596471c0cca7fae51a27b30b6bd39bdffa021a49f879fe5c64282. Canonical invisible-street scenarios published and OpenSpec archived. No FPS gain or affectedChrome acceptance claimed; currenttotal withheld.


Increment38 shipped #640 as69c6ecff after all6CI/review/current9checkpreview/freshrebase. Productionactionview HTTP200 exactSHA8390a157dc9c3ccd40b16968f869791f8ea7713cd2d81fd114b12d885c276a38. Canonical populated-car/marker scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment39 shipped #642 asf84e61f3 after all6CI/review/current20deployedchecks/freshrebase; productionactionview HTTP200 exactbytes verified (fullhash in fullswing-r39-marker-dirty/production-verification.json). Canonical markerdirty scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment40 shipped #644 as8b5a4565 after freshall6CI/review/current25deployedchecks/rebase; productionactionview HTTP200 exactbytes verified (hash in fullswing-r40-selection-slots/production-verification.json). Canonical selection/no-camera scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.
