# Design

## The idea in the user's words
"Environments inspired by dead cells but give it a 3d supermarket 64 vibe with rolling hills", then "make it look gritty and dark". We read "supermarket 64" as Super Mario 64.

- **From Dead Cells (mood only):** a run through a chain of different places, ruined stone, torch light, and color that is saturated but never welcoming. Warm light falls on the hero, and cold shadow falls on the place.
- **From N64-era platformers (form only):** chunky round forms, rolling hills, a low resolution, flat shading in a few steps, fog that hides the far edge, and a summit goal that you can see from the start.
- **From the user's second note:** dusk and night only, dark ground and sky, and fire as the brightest color.

All five places, the lamplighter and the names are original.

## Sources
- **Dead Cells color:** Gwenaël Massé, "Art Design Deep Dive: Giving back colors to cryptic worlds in Dead Cells", Game Developer. We read it through the repost at https://www.jikguard.com/news/art-design-deep-dive-giving-back-colors-to-cryptic-worlds-in-dead-cells, because gamedeveloper.com was not reachable from this session. We take three rules from it:
  - the palette is saturated but not welcoming;
  - outdoor places use analogous hues;
  - warm light falls on the hero and cold shadow on the place.
- **Dead Cells 3D-to-pixel pipeline:** Thomas Vasseur, "Art Design Deep Dive: Using a 3D pipeline for 2D animation in Dead Cells". We read it through the repost at https://www.jikguard.com/news/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-dead-cells. Its lesson is to model in 3D and judge the result at the final pixel size. Ink Studio works the same way: solids are baked into pixel-art splats.
- **N64 look:** Rodrigo Copetti, "Nintendo 64 Architecture" (https://www.copetti.org/writings/consoles/nintendo-64) covers the low output resolution, Gouraud shading, and fog done as a blend. Ink Studio has no textures, so we do not copy the 3-point texture filter. Its splats carry flat palette ramps, which give the same smooth, few-step look.
- **Level shape:** the first course of Super Mario 64, as described at https://goombastomp.com/super-mario-64-level-bob-omb-battlefield/, has terraced plateaus, a spiral path, and a summit goal that can be seen across the map. We use only that structure: each place has its beacon on a summit that you can see from the start, and a path that climbs to it. No layout is copied.
- **Hills:** Inigo Quilez, "fBm" (https://iquilezles.org/articles/fbm) and "Domain warping" (https://iquilezles.org/articles/warp). The height is a sum of compact smooth bumps `h·(1−r²/R²)³`, plus 2–3 octaves of fBm with gain 0.5, plus one warp of the input point. We keep the bump height under 0.35 of its radius, so slopes stay walkable.
- **Fog:** Inigo Quilez, "Fog" (https://iquilezles.org/articles/fog/). The fog color is the horizon color. Ink Studio's renderer applies the fog as a smoothstep over view depth. We set the depth range for each frame, so the fog stays at the same distance as the camera moves in and out.
- **Far terrain:** geometry clipmaps (Losasso and Hoppe, SIGGRAPH 2004). The terrain is three square rings, and the splat spacing doubles in each ring away from the play area.
- **Pixel outlines:** David Holland, "3D Pixel Art Rendering" (https://davidholland.netlify.app/articles/3d-pixel-art-rendering). Outlines go at depth breaks. Ink Studio's `outline: { c, edge }` does this in its own resolve pass.
- **Splat pixel art:** Ink Studio itself (https://github.com/siliconjungle/shapeshift-labs-ink-studio, commit 6a8c622, MIT). We use its sculptor, bake, palette resolve, codec and WebGL renderer as they are. No other splat-stylization method fit: the papers we found are about style transfer, not pixel art.

## Bake offline, draw in the page
- `games/gloam-downs/` installs Ink Studio from GitHub, pinned to commit 6a8c622.
- `bake.mjs` builds each place with the full toolkit (about 2.7 MB of source) and writes three files:
  - `worlds/<id>.bin.gz`: the splat rows, as `SplatCodec` bytes, gzipped;
  - `worlds/<id>.walk.bin.gz`: the walk map;
  - `worlds/<id>.json`: the settings and the gameplay points.
- The page loads only the renderer:
  - `pixel-look.js`, `splat-codec.js` and seven `webgl/*.mjs` files, about 48 KB gzipped, copied into `public/lab/gloam-downs/ink/` with Ink Studio's license;
  - the page decompresses with `DecompressionStream`.
- Baking in the page would need the 770 KB toolkit and about one second of CPU time for each place, so we do not do it.

## A place
`biomes/<id>.mjs` exports `{ id, name, sub, palette, light, sky, fog, build(ctx) }`. The shared helpers in `lib/common.mjs` give:
- **Palette slots:** the colors for the lamplighter, the wisps, the fire and the beacon are the same in every palette. Only the place's own colors change.
- **Hills:** bumps, fBm and a warp, cached on a grid with `K.tab2`.
- **Terrain:** a near tile at spacing 0.2, then rings at 0.4 and 0.8. Each tile is bounded, so it keeps its own material.
- **Paths:** a polyline distance gives the dirt color and a slight dip in the ground.
- **Props:** rocks, trees, torches, braziers, stone blocks and fences.
- **Points:** the start point, five wisps, and the beacon on the summit.

## The walk map
- After the scenery is baked, `S.sdf` still holds the whole distance field. On a grid of 0.25 units, the bake marches down from above and stores the top surface. Where a gap of at least 1.8 units opens under that surface, it also stores the gap's underside and the floor below. Players can then walk under arches and tree crowns.
- At run time the lamplighter is a disc of radius 0.3 that stands on the floor under its centre. Each grid corner gives its top, or the floor under its gap when the top is out of reach, and the four are blended after that choice, so an arch's edge reads as flat floor from below and as a clean edge from above.
- Nothing inside the disc may rise more than a climb above the base: 0.5 plus the slope over the radius, 0.83 in all. The base is the floor where the feet last stood on a slope, a floor no steeper than a climb per radius. On a steeper face the base stays where the face began. So a ledge over 0.83 stops a walk from any heading and at any frame rate, and the jump (1.40) is the way up. In the air the disc may not overlap anything above the feet.
- The reach search uses the same disc and base, at each grid point and halfway to it. It jumps onto the next grid point only, so a jump across a gap does not count.
- The camera marches from the lamplighter to the eye and stops short of the first thing in the way, on the top surface or under a gap. When that is too close to frame the figure, the view tilts up until the eye is clear.
- The map is two `Int16` layers, in centimeters, gzipped.

## The lamplighter
- The figure is sculpted in each world after the scenery bake, high above the map, so the place's shadows do not fall on it. It is baked with that place's light.
- `K.bones.tag` puts its splats on seven GPU bones: body, head, two legs, two arms with the lantern, and the shadow disc. The page writes 12 numbers for each bone every frame, and no splat rows are uploaded.
- The controller, camera and pose live in `play.js` with no DOM, so Node can test them.

## Wisps and the beacon
- **Wisps:** emissive splats that bob in the shader.
- **Beacon flames:** emissive splats that start with zero density.
- **Changes:** to put out a wisp or light the beacon, the page sets the density of those rows, and the renderer uploads only the changed 512-splat rows.

## Speed
- The renderer sorts all splats on the CPU when the view changes. That costs about 3 ms for 100k splats and 7.5 ms for 300k. Each place is kept under 260k splats.
- The art size is about 64,000 pixels (320×200), scaled up by a whole number. If the median frame time is over 40 ms, the page steps the art size down.

## Not done
- Sound, enemies and combat.
- Runtime point lights: the renderer has no path for them, so all light is baked.
- A check on a real phone or a real graphics card. This session has only software WebGL.
