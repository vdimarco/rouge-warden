# Design

## Measurement

The perf check's main-pass triangles were broken down by object, by wrapping `renderer.renderBufferDirect` during one stepped frame, at the same viewpoints and headings. Seed 7, SwiftShader at 640×360, current main:

| View | Worst frame | Midgley tile, nearest level | Outhouses | Other notable items |
|---|---|---|---|---|
| Q1 Uptown (yaw 90°) | 240k | 53k | 4k (1) | grass 24k, cottonwood 19k, juniper 19k, kayak 17k, A-frame 13k, hero 12.5k |
| Q1 bridge (yaw 0°) | 233k | 53k | 12k (3) | grass 24k, cottonwood 23k, juniper 20k, kayak 17k |
| Q0 Uptown (yaw 90°) | 178k | 53k | 4k (1) | kayak 17k, A-frame 13k, hero 12.5k |
| Q0 bridge (yaw 0°) | 182k | 53k | 12k (3) | kayak 17k, juniper 13k, cottonwood 11k |

Uptown's viewpoint is 116 m from the edge of tile 3_1, inside the nearest-level distance on Q1 (200 m × 0.8) and Q0 (200 m × 0.6). Seen from Uptown, every outhouse is 537 to 1229 m away, all past Q0's 450 m view. Seen from the deck, all but the Midgley lot's (151 m) are 695 to 1324 m away.

## Decisions

- **A new `tileFine` field in `QUALITY`** (true on Q2, false on Q1 and Q0). `sedona.js` reads it beside `view` and `lodBias` and passes it through `terrain.update` → `request` → the worker → `buildTile(ctx, i, j, lod, fine)`. Only tile 3_1's nearest level depends on it. The built tile carries `fine` for that level (null otherwise), so the manager rebuilds only that mesh when the tier changes, adaptive drops included. The old mesh stays visible until the new one arrives, so the ground never has a hole.
- **Q2 keeps the 2.5 m level.** Its budget has room (450k), and the finer vertex colours keep the trail's painted edge smooth up close. Lower tiers get the same 5 m density as every other tile (14.2k instead of 53.2k triangles).
- **The outhouse cull also checks the view distance.** It uses the same rule as `sedona.js cull()` and the terrain tiles: radial distance minus the bounding radius, against the current day or night view distance. The 40 m shadow-caster rule stays. Fog ends at or before the view distance (C8), so nothing visible changes on any tier.
- **Rejected:**
  - Raising the budgets.
  - Thinning flora or grass, or shrinking the 3D-tree radius. Both are visible on every lower-tier screen and were not needed.
  - Frustum-culling flora instances per camera turn. It is a larger change to the refill and to tree shadows.
  - Hiding the kayak by distance. That is a visible pop at 136 m from the deck, and it was not needed once the two fixes landed.

## Checks

- A Node check against `gen.worker.js`: every vertex of the 2.5 m level lies on the 5 m level's triangles (max |dy| 3.8e-6 m). Nearest-level triangles drop from 53,231 to 14,191; levels 1 and 2 are unchanged.
- `qa/crimson/perf.mjs --q=1`, `--q=0` and `--q=2`, with results in `tasks.md`.
- Gameplay never reads the mesh. `S.world.height`, `surface` and the raycasts use the height field.
