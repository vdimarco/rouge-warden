# Design

Use deterministic tapered, textured limbs and leafy crowns, connected from
river-profile shoreline roots to each existing branch entity. Outer lanes use
their nearest bank; central obstacles vary banks deterministically. Carry the
connecting limb high above other lanes and descend only within the hazard lane.
Keep the low tip aligned to the entity's collision distance. No engine changes.

Share a compact shape between both renderers. WebGL batches wood and foliage in
two bounded instanced draws using existing bark maps; prepare those shaders on
the title screen. Retain passed trees briefly, then recycle with the existing
entity bounds. Static geometry respects pause and reduced motion. No new asset
requests or generated-model dependency.

Verify shoreline grounding, safe-lane clearance and bounded geometry with
focused geometry checks; inspect actual branch approach/duck at phone, desktop
and short landscape, plus 2D and reduced motion. Check unchanged timing,
successful duck, pause pixels and live deployed assets. Chromium viewport
emulation does not establish physical phone frame rate.
