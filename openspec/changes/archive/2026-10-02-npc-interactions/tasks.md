# Tasks

- [x] Police gun drops and pickups.
- [x] Door pivots and carjacking animation.
- [x] Generate, optimize and integrate NPC models.
- [x] Browser and asset checks, screenshots, spec validation and archive.


## Verification

Passed `qa/crimson/npc-interactions.mjs` on desktop and with `NPC_TOUCH=1` at 844x390: all four real models, every animation track finite, walk heights within their own bind-pose bounds, live walking/fighting/seated/falling poses, police and sheriff melee defeat, once-only falling guns, officer despawn, actual keyboard/touch pickup, ammunition, open-door pull/throw/seat/close, temporary driver cleanup, interrupted entry, police recovery and subsequent gun drop, and session cleanup. Passed `NPC_FALLBACK=1` with all four GLB requests blocked. No browser errors.

Passed `qa/crimson/theft.mjs` desktop and `THEFT_TOUCH=1`: every vehicle kind, front door pivots and motion, driving after entry, Gabe passenger preservation/takeover, traffic promotion, 11 parked cars, patrol consequences, portrait rotation and cleanup. Passed the existing cast suite, including all original source-proportion tests, shared clips, bones, pose drift, LOD and crew seating.

Inspected `/tmp/npc-desktop.png`, `/tmp/npc-touch.png`, `/tmp/carjack-pull-desktop.png`, `/tmp/carjack-ground-desktop.png` and phone equivalents. Each GLB has 24 Meshy bones, 8,305–8,335 triangles and an embedded 1024px texture; each is below 1.4 MB. Generation inputs and output URLs are recorded in `public/crimson/assets/npc-fal.json`.

The performance suite passes desktop and combat budgets but retains four existing world-budget failures: Q1 Uptown 240k/220k, Q1 bridge 221k/220k, Q0 Uptown 178k/150k, Q0 bridge 162k/150k triangles. An isolated checkout of baseline `cf3aa98` reproduces all four (bridge Q0 is 161k). Budgets were not changed. This suite measures render counts, not hardware FPS.

Syntax and `git diff --check` passed. OpenSpec CLI is unavailable; proposal/design/tasks and all three requirement/scenario sections were validated manually. Real phone hardware was not tested. No merge or deployment performed for this change.

Serve `public/`, then run with `NODE_PATH=./qa/browser/node_modules CRIMSON_CHROMIUM=/usr/bin/chromium CRIMSON_URL=http://localhost:8876/crimson/ node qa/crimson/npc-interactions.mjs`. Prefix `NPC_TOUCH=1` or `NPC_FALLBACK=1` for the additional paths.
