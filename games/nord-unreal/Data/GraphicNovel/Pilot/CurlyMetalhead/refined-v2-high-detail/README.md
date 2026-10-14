# High-detail central collar UV1 study

This derivative isolates **26 faces / 78 corners** on the small central upward garment ledge. The six CPU views show subtle darkening of that pale strip, with the actual neck wall unpainted. It is a partial colour correction: the surrounding chipped collar and irregular silhouette remain. `graphics_accepted=false`; no native import occurred.

The eight [raw-source cross sections](collar-sections.png) separate the upward ledge from the inward steep neck wall. The [selection front](CPU-selection-front.png) and [selection three-quarter](CPU-selection-three-quarter.png) show the exact conservative mask. Compare [original front](CPU-original-front.png) with [refined front](CPU-refined-front.png), and [original three-quarter](CPU-original-three-quarter.png) with [refined three-quarter](CPU-refined-three-quarter.png). These are Cycles CPU images at 768², 16 samples, four threads; they are not Unreal screenshots. Lighting is bright, and the improvement is small at this framing.

[collar-uv1.json](collar-uv1.json) records original and target coordinates for every selected corner. UV1 copies UV0 everywhere else. Targets sample a verified 64² neutral-dark patch from the existing atlas, with ten-pixel remap radius and at least 22 pixels of dark padding. No source bitmap changes. The method adapts the earlier semantic collar repair and [Epic's TextureCoordinate channel example](https://dev.epicgames.com/documentation/en-us/unreal-engine/coordinates-material-expressions-in-unreal-engine); future native material routing would use UV1 only for base colour/emission, retaining UV0 and full normal strength for the other maps.

[body.fbx](body.fbx) is a new binary derivative of the frozen generated-v2-high-detail FBX. [body.json](body.json) proves every original FBX element is unchanged except appended UV1/its layer reference and writer-normalized FileId/CreationTime metadata. Fresh Blender reimport matches all positions, triangles, corner normals, UV0, weights, 24 binds and object matrices. Original maps and own clips remain in the raw source folder. All 27 raw-source file hashes match before and after. Existing refined-v1 remains separate and unchanged.

Reproduce from games/nord-unreal with Blender 5.2.2:

```text
blender -t 4 --background --factory-startup --python-exit-code 1 --python Scripts/refine_high_detail_collar.py -- study
blender -t 4 --background --factory-startup --python-exit-code 1 --python Scripts/refine_high_detail_collar.py -- export --reviewed-mask-sha256 88d3180bc539bf86298710077f7d1f0de7cadd00553f0e5a403f83c00f51614b
python3 Scripts/test_refine_high_detail_collar.py
blender -t 4 --background --factory-startup --python-exit-code 1 --python Scripts/test_refine_high_detail_collar.py
```

The study/export refuse to replace their existing evidence or derivative, so reproduction needs a fresh output location after preserving this revision. Checks are read-only and can run against the retained output. [review.json](review.json) records geometry bounds, local image differences, checks and limitations. Two initial helper failures are retained under rejected/; they stopped before art outputs and were corrected before the successful study/export.

No Content, capture guard, importer, runtime, service or paid-provider changes are part of this study. A native derivative requires explicit integration and new source/material readbacks. This does not resolve shoulder deformation, static face/fingers, hair/ink quality, source topology or detached shadow fragments.
