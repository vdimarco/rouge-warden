# Branched boughs

Duck trees now support a thick woody limb with four substantial two-part forks
and smaller lateral twigs. Forks are distributed toward the visible river end,
fan into different course depths and hold leafy offshoots with enough open
space to show the wood. The supporting trunk is broader. The low bough descends
through the original contact and tapers past it without the old upward curl.

Both renderers use this shape. The 2D fallback draws a filled tapered silhouette.
Prepared bark/leaf art and the two shared WebGL batches are reused, with each
tree still bounded to 32 wood segments and 32 foliage clusters. Duck contact,
other lanes, speed, inputs and collision timing retain existing behavior.

Checks sample 129 points on every curved limb with its actual tapered radius,
covering 60 seed/course/lane combinations, and check connected leafy forks,
contact thickness and a descending terminal profile. The 48-test game suite
passes. Real timed ducks, pose clearance, pause pixels, preparation counters,
scene budgets and screenshots are checked on phone, short landscape, standard
materials, 2D and reduced motion with `qa/river-rush/tree-realism.mjs`.
Emulated Chromium viewports and SwiftShader exercise these cases; physical
phone/hardware frame rates are not measured. Existing build warnings remain.
OpenSpec CLI is absent; Markdown scenario structure is checked directly.

Exact build hashes, browser results and production verification are recorded
in `branched-boughs-verification.json`. Existing texture source and generation
provenance remains in `tree-realism-sources.json`; this change generates no art.
