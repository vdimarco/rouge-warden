# Tasks
- [x] Repair bridge approaches, underside road paint and arch clearance.
- [x] Grade/color a hiking trail and add a meeting-site return mission.
- [x] Run terrain checks and inspect the bridge/trail in browser.
- [ ] Validate/archive with OpenSpec CLI when available.

Two seeded terrain tests pass: bridge endpoints at deck height, no road mask beneath the span, no formation colliders obstructing the trail, and sampled rise below 0.45m per meter. Desktop browser rendered the bridge and trail and completed the entire side mission using mission autopilot. Screenshot `/tmp/crimson-canyon-restored.png` inspected. This does not substitute for a full manual hike/drive or mobile terrain performance testing. Existing arsenal desktop/touch suite passes. Browser plugin not available; used existing Playwright harness. OpenSpec CLI unavailable.
