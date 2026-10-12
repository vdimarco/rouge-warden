# Design

Import a focused area around 1334 Sherbrooke Est from the 2016 municipal CityGML survey (CC BY 4.0). Convert NAD83/MTM8 coordinates to the existing geographic frame, retain roof photo UVs and use estimated facade patterns, and flatten each building base to the existing flat ground. Remove only overlapping procedural buildings; preserve other map actors and all gameplay source. Survey age, wall extrapolation and flat terrain remain explicit limits. Back up assets before import. Verify source geometry/UVs, map collision and rendered views.

The finished pass covers 119 municipal models and removes 127 overlapping procedural footprints. Aerial wall textures smear at street level, so façades use estimated masonry and window spacing; photo shadows are lifted with a shared colour power correction. Geometry is batched into at most two sections per model. Import refreshes cooked collision after changing complexity. Detailed tree materials persist Nanite usage on both base materials and instances for game mode.

The façade art uses flat brick colour bands, dark window outlines, cream trim and blue glass. Every wall surface is estimated; only roof photo UVs are retained. F2 controls the global comic post-process independently of these illustrated materials. Review street, façade and overhead renders at 1280×720 and confirm foliage in a fresh game-mode run.

Rendered review exposed full-surface ink from mismatched viewport and scene-buffer UVs. The shared post-process samples colour and geometry at their respective default scene-texture UVs, including matching centre and neighbouring depth/normal samples.

Brick texture luminance selects restrained terracotta colour bands instead of quantizing RGB channels independently, which produced distracting neon speckles under the comic filter.
