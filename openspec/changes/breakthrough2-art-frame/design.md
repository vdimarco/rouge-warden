# Design

The painted layers are 16:9. The map strip is often wider than that, so stretching them fills the canvas and squashes the islands.

The draw uses one shared cover rectangle, the same construction as CSS `object-fit: cover` with `object-position` (CSS Images Module Level 3, https://drafts.csswg.org/css-images-3/#object-fit). The focal point is the midpoint of the island centers (x 0.50, y about 0.49), the same idea as a focal-point crop (MDN `object-position`, and the percentage focal point described at https://henry.codes/writing/pure-css-focal-points/). Canvas has no `object-fit`, so `artPlacement` computes that rectangle once. Every layer, and the procedural marks drawn over the art, use it. Device pixels come from the existing canvas fit, which already follows `devicePixelRatio` up to 2.

Sea level is a straight line from clear at 1.0° to full at 3.0°, with a small upward offset (48 CSS pixels across that span on a 390-wide map). Smog alpha is a straight line in emissions, clear at 42 and full at 87. Neither is stepped. The map view already eases between turns, and snaps when motion is off or reduced.

The end screen keeps the map visible at 85% opacity with a light blur, and puts the ending copy on an opaque paper panel (`#F3E9D6`, ink `#2B2A33`). The play UI under it is `inert`. There is no dark scrim.
