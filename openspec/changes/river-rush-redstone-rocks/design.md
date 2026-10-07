# Investigation and scope

The engine currently resolves hazards against the selected target lane, although the rendered raft follows an analytic spring. At 30/60/120 Hz a swipe 5 ms before a neighboring rock crosses causes a hit while the raft is approximately 3.745 m away. This is a concrete candidate for the rock complaint; renderer investigation continues separately.

Bank waterfalls are rendered as tall transparent cards intersecting decorative cliffs. Verify whether those cards cause the reported white strips before selecting the visual correction. Decorative rock footprints must remain outside the playable channel on the intensified curved course.

Use an explicit simulation contact rule and the same exact crossing sample already used by pickups if the collision mismatch is corrected. Preserve dodge-only rocks, launch-frame jumps, independent ducks, protection, fair generated routes, and immediate controls. Visual validation covers phone, desktop, and short landscape, including both affected maps. Browser plugin is unavailable; use the existing Playwright workflow.

## Confirmed visual cause

The white strips are detached 3.8×19 m transparent waterfall cards partially occluded by independently rotated cliff and temple silhouettes. The correction retains solid cliff instances and removes waterfall/mist cards only in Redstone and Moonlit; Canopy waterfalls remain.

A separate exact mesh scan of Redstone gorge walls and ledges covered all 251 reduced course seeds across 5,400 m at 6 m intervals, then refined 48 broadphase candidates over 1,200 frames. No triangles intersected the near-raft navigable envelope (x ±5.4 m, z ±2 m, y −0.5..5.4 m), so no canyon terrain refactor is justified. Detailed geometry proof is saved outside the repository at `/tmp/river-rock-investigation.json`.

## Contact implementation

Use a forgiving 0.68-lane (2.584 m) lateral hazard core sampled from the analytic steering trajectory at each obstacle distance. Measured rock half-widths are 1.00–1.37 m; the raft half-width is 1.575 m, so this threshold matches their smallest combined footprint. Adjacent full-width jump/duck barriers overlap continuously, while each row pays only one trick reward.

Sample jump/duck action and Rush/grace at contact rather than frame end. Freeze fatal runs at that same crossing time, distance and raft pose so the death frame agrees with the contact; keep normal active-run motion unchanged.
