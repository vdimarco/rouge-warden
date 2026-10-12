# Verification

Run on 2026-10-07 in the worktree, against a static server on port 8766 (this change) and a copy of the previous commit
on port 8767 (before).

## Spec structure
The OpenSpec CLI is not installed, so `openspec validate` did not run. The change follows the layout of the other
changes: proposal, design, tasks, one spec delta with ADDED requirements and WHEN/THEN scenarios.

## Node tests
`for f in qa/tidebreak/*.test.mjs; do node $f || echo FAIL $f; done`: all 28 files pass, including the new
`roads.test.mjs`. No existing test was changed.

`roads.test.mjs` output:
- west: spline 11517, road 11851 (×1.029), widest swing 159, turning per half 77° → 261°, 8 left-right changes;
- middle: spline 9488, road 9610 (×1.013), widest swing 148, turning 188° → 283°, 4 changes;
- east: spline 11452, road 11815 (×1.032), widest swing 164, turning 75° → 226°, 8 changes.

`sim.test.mjs` plays six full matches. Before: team 0 won 3, team 1 won 3, 640 to 895 s. After: team 0 won 3, team 1
won 3, 713 to 971 s. `bot-ab.mjs veteran veteran 24` (48 matches, sides swapped each seed) ran without timeouts; the
average match lasted 12.6 minutes.

## Browser checks (Chromium, `/opt/pw-browsers/chromium`)
- `ground.e2e.mjs`: pass. Water at every river sample, no holes, three seeds, both realms.
- `desktop.e2e.mjs`: 17 checks pass.
- `render3d.e2e.mjs`: 10 checks pass (SwiftShader).
- `combat-feel-3d.e2e.mjs`: 8 checks pass (SwiftShader).

## Performance (`?perf`, 2D view, headless Chromium without a GPU)

| Screen | Before: frame median · draw | After: frame median · draw |
| --- | --- | --- |
| 1440 × 900 | 16.7 to 33.2 ms · 6.4 to 6.8 ms | 16.7 to 16.8 ms · 6.1 to 6.9 ms |
| 844 × 390 | 16.7 ms · 4.0 to 4.9 ms | 16.7 ms · 3.9 to 4.5 ms |
| 390 × 844 | 16.7 ms · 3.1 to 3.5 ms | 16.7 ms · 3.4 to 3.8 ms |

The ranges cover three runs before and five runs after. The differences are within the noise of a software renderer. One ground canvas takes
about 540 ms to paint instead of about 430 ms (median of 12 paints per run, two runs each), once per realm when a match
starts.

## Screenshots
In `/tmp/claude-0/-home-user-rouge-warden/a6866cff-7c11-5769-a48c-7bb099d6030a/scratchpad/`, `before/` and `after/`:
- `ground-full.png` (whole painted ground, seed 49), `ground-lane.png` (west lane bend), `ground-base.png` (team 0 court
  exits), `ground-ward.png` (east middle ward);
- `1440x900-west-lane.png`, `1440x900-mid-lane.png`, `1440x900-map.png` (tactical map), and the same at `844x390` and
  `390x844` (2D view);
- `3d/1440x900-start.png`, `3d/1440x900-lane.png` and the same at `844x390` (3D view, SwiftShader).

## Not checked
- No real phone, no real GPU. Phone sizes were emulated in Chromium.
- The look was reviewed from screenshots only.
