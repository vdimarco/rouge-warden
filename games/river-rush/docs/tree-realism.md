# Tree realism

River Rush now uses fal-generated furrowed bark and photographic ficus leaves,
with a derived bark detail normal on the standard material path. Each tree has
an asymmetric layered crown, broad trunk, grounded roots and curved limbs that
narrow toward their tips. Matching decorative trees travel along both banks.
The existing duck tip remains registered to its original lane and distance.

Wood uses one shared curved-tube shader and foliage uses one shared instanced
batch: two draws, at most 32 trees with 32 wood segments and 32 leaf clusters
per tree. Decorative trees share this budget and follow hazards in allocation
priority. All shader variants and textures prepare before play. Optional tree
images have retries and an eight-second deadline; failures keep local bark
and generated leaf fallbacks, and late images never replace prepared art.
The 2D renderer uses the same limb curves and photographic art.

Provider details, prompts, request IDs, original URLs, packing instructions,
estimated generation cost and runtime hashes are in `tree-realism-sources.json`.
The normal is derived from albedo for fine surface detail, not measured PBR.

```sh
npm test --prefix games/river-rush
npm run build:arcade --prefix games/river-rush
node qa/river-rush/tree-realism.mjs
```

The browser check covers phone, desktop, short landscape, 2D, reduced motion,
blocked and stalled tree textures, and the standard normal-map material path.
It plays a real jump and duck, checks protection and accepted speed, compares
paused pixels, checks bounded trees and scene budgets, and measures zero new
texture uploads or shader compilation after preparation. Phone also loses the
WebGL context and resumes in 2D. `CASE`, `SHOTS` and `ARCADE_URL` select cases,
artifact location and deployment. Existing shoreline checks remain compatible.

Chromium uses emulated viewports and a software GPU. The standard-material case
exercises the detailed shader, not physical GPU performance. Physical phones
and hardware frame rates were not measured. Before/after approach and duck
screenshots were visually inspected. Build warnings about existing arcade
scripts and bundle size remain. OpenSpec CLI is unavailable; Markdown proposal,
design, task and scenario structure is validated directly. Exact hashes,
local results and production verification are in `tree-realism-verification.json`.
