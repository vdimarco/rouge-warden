# Bound character and sign uploads

Upload only populated attribute ranges after initial allocation. Reuse the existing BufferAttribute range API and skip uploads when the populated count is zero. No change to population, motion, meshes, physics, anchors or height rules.

Focused browser checks exercise real WebGL bufferSubData calls: character counts3→1→0→7→2 and sign counts3→1→0→96→3. All13checks pass, including identical nonblank reference/candidate images and no page errors. Three figures upload264bytes instead of21120bytes at240capacity (98.75%less); three signs upload156bytes instead of5200 at100capacity (97%less). Initial allocation still uploads capacity once. These are data-transfer measurements, not FPS or affected-Chrome acceptance.

Uses the incremental performance plan: no FPS-benefit gate or long benchmark queue. Current-head review, CI, deployed preview, rebase and production verification remain required. Score unchanged; current hardware responsiveness/stability and total remain unverified/withheld. No physical-device, listening or full-playthrough claim.
