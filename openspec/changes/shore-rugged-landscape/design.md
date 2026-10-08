# Design

## Direction
Use the reference's irregular sandy river banks, clustered gray rock and leafy forest as spatial cues within Shore's established muted greens, warm earth and golden-hour lighting. The scene should read as a landscape with valleys and ridges, rather than a lawn decorated with props. Preserve combat visibility and the existing interface.

## Geometry
Keep the fixed mirrored lane graph shared by simulation, 2D painting, 3D masks and maps. Seeded extrema have unequal spacing and strength, joined by a quintic curve with continuous slope and curvature. Calm base exits and bridge approaches remain intact. The established 6% length budget still holds. The placement solver now validates its final candidate, uses a checked fallback on exhaustion, and rejects an impossible layout rather than returning unsafe geometry.

Build a 193 by 193 sampled terrain mesh over the arena and its forest skirt: 37,249 vertices and 73,728 triangles. Coherent broad noise, smaller folds and rocky ridges replace vertex jitter. Structure pads and bridge approaches remain level; the bed lies below water. Landforms use a fixed map seed; bank carving follows the match's live seeded river. Mirrored union carving and reflected triangle diagonals keep CPU and mesh heights fair for both teams.

Ground units, instances, effects and camera targets through the same triangle-interpolated surface sampler. Compose material bump with the terrain normal. Pointer rays traverse only the grid cells they cross and test each cell's two actual triangles, then compare water and bridge deck intersections. This retains the first contact even when a grazing ray enters and leaves a ridge between fixed-distance samples. Bridge-aware actors stand on deck height 12; effect marks use water height 3 only inside the live water mask, retaining lowered dry hollows. Cache relief data and static geometry at construction; actor height sampling is constant time.

Ground warnings share one dynamic batched mesh. Each warning copies the terrain grid's triangle pattern over its bounds and samples the signed height texture. Its interior therefore conforms to the same planes, whereas an independently tessellated quad can cut beneath a ridge. Masked horizontal water layers and clipped rotated bridge layers meet their separate surfaces. Discard submerged terrain warnings explicitly because transparent water does not write depth. Preserve the existing circle/capsule APIs and per-warning diagnostics. Buffers grow only when needed, are reused between frames, and reject whole extra warnings at a 262,144-vertex cap (about 22 MiB maximum; initial allocation about 704 KiB). The cached water-overlap table uses about 4 MiB per live mask. Actual GPU cost remains pending visual QA.

## Measured shape

| Lane | Previous displacement | New displacement | New full length | Added length over original spline | Bend direction changes |
| --- | --- | --- | --- | --- | --- |
| West | 159 | 340 | 12,144 | 5.45% | 8 |
| Middle | 148 | 222 | 9,789 | 3.17% | 4 |
| East | 164 | 349 | 12,105 | 5.71% | 7 |

All units are world units. Exact segment clearances are at least 275 from cover and 625 from camps/gates. Side lane lengths differ by 0.32%; the middle lane is 80.6% of the longer side. Off-lane land height spans about 465 units. Relief builds measured roughly 150–280 ms in the local Node runtime, once per scene seed; this is not a GPU frame-rate measurement.

## Verification
Measure relief range, surface continuity and mirrored samples. Check structures, bridge approaches and animated units against mesh heights. Compare broader bends with the baseline and enforce safe route invariants. Run relevant simulation checks and inspect 3D plus the 2D map on desktop and phone viewport sizes when browser access permits. Record missing assets or unavailable browser/CLI checks without claiming they passed.

## Desktop HUD follow-up

Use the same `(hover: hover) and (pointer: fine)` query in CSS and match startup. Desktop players receive no movement pad, movement coach or floating spellbook/point pill at any viewport size. The book opens through K or a Spellbook action in the pause menu. Matches begin directly; the existing plus badges train skills without a modal. Clear stale full-icon upgrade mode when starting a match. Coarse-pointer/touch players retain their movement and point controls and the initial book. Input capability determines this behavior, so a wide touch screen still receives touch controls.
