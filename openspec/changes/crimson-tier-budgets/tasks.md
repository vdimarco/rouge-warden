# Tasks

- [x] Reproduce the Q1 and Q0 failures and break the main pass down by object at Uptown and the bridge deck.
- [x] Add `tileFine` to `QUALITY` and pass it from `sedona.js` through `terrain.update`, `request` and the worker to `buildTile`. Rebuild the Midgley tile's nearest level when it changes.
- [x] Check that the 5 m and 2.5 m nearest levels have the same surface (Node, `gen.worker.js`).
- [x] Stop drawing outhouses past the current view distance (`town.js`).
- [x] Run `qa/crimson/perf.mjs` on Q1, Q0 and Q2.
- [x] Check a runtime tier change near the bridge (Q2 → Q1 → Q0 → Q2).
- [ ] Validate and archive with the OpenSpec CLI (not installed here).

## Validation

All runs used system Chromium 152 (`CRIMSON_CHROMIUM=/usr/bin/chromium`) with SwiftShader at 640×360, Playwright 1.51.1 from the main checkout's `qa/browser/node_modules`, and `public/` served locally.

`qa/crimson/perf.mjs`, worst heading per view:

| View | Before | After | Budget |
|---|---|---|---|
| Q1 Uptown | 240k, 60 draws | 201k, 59 draws | 220k, 130 |
| Q1 bridge | 221k, 47 draws | 174k, 46 draws | 220k, 130 |
| Q0 Uptown | 178k, 56 draws | 135k, 55 draws | 150k, 100 |
| Q0 bridge | 162k, 43 draws | 110k, 42 draws | 150k, 100 |
| Q2 Uptown | passed | 318k, 67 draws | 450k, 200 |
| Q2 bridge | passed | 277k, 53 draws | 450k, 200 |

- After the change, every check passes on all three tiers: 17/17 each. That covers the 8 viewpoints, the fog limits, the fixed light set and the two fights. The first Q2 attempt timed out while the page loaded, before the story started, with the machine's load average at 34. A rerun passed.
- Node check (`buildTile` for tile 3_1, seed 51): every 2.5 m vertex lies on the 5 m level's triangles (max |dy| 3.8e-6 m). The nearest level drops from 53,231 to 14,191 triangles; levels 1 and 2 are unchanged (13,769 and 3,849).
- Runtime tier change, through `S.look.setQuality` and stepping frame by frame:
  - Q2 → Q1 → Q0 → Q2: each change rebuilds the nearest level within 4 frames, with no frame where the tile is missing.
  - `S.world.height` at the turnout, the deck, the trail and the wash is unchanged.
  - No page errors. Screenshots at Q2 and Q1 show the same ground shape, with no holes or seams.
- Regressions:
  - `node --test qa/crimson/canyon.test.mjs` passes.
  - `qa/crimson/look.mjs` passes, including the adaptive tier drops.
  - `qa/crimson/world.mjs` fails the same two checks as an untouched HEAD served on another port:
    - the `lot_midgley` road grade (21.7%, a Node-side height check), and
    - Q1 world draws at the West Sedona view (36 with the change, 37 on HEAD; limit 30).
  - One `world.mjs` run also flagged a long task while the machine's load average was 34. A rerun with the change passed that check (no long tasks).
  - With the change, `world.mjs`'s Q1 triangles drop at the bridge (195k → 156k), the canyon (194k → 182k) and the Y (169k → 161k).
- Not checked: a physical phone, frame rate on real phone hardware, and the shadow pass (perf.mjs counts only the main pass).
