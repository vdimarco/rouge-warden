# Design

## World and islands (`scene.js`)
`ISLANDS` gives each island a radius, a place on the sea (`at`, metres from Home Isle), grass colours and a seed. `build(id, { density, cell, far, state })` paints one island at the origin: the ground (a drum with soft hills, clipped at the sea), the dock and boat toward Home Isle, its fixed set pieces, its person, and its breakable things placed by a seeded search for free ground. `state.broken` leaves out things the save marks gone; `state.sprouts` places each thorn sprout from a seed of its own id, so it stays put. `far: true` paints only the big things, at low density and with no cast shadows, for the horizon.

The island you stand on is painted in full at the origin. The other four are painted once as far copies and moved to their offset from the current island. The sea and clouds stay round you. Sailing paints the next island behind a "Sailing…" card.

## Things
Each thing is `{ id, kind, label, parts, center, radius, solid, hits, again, loot, use, talk }`. `solid` is the footprint you walk round. `hits` is the number of hits to break it. `again` is `pop` (comes back at once), `dawn` (comes back at the next dawn) or `never`. `loot` is a shell, the rope or the stone. `use` is a verb (well, bloom, bell, sail). People are painted once with `figure(kind)` and placed on their spot.

## The story and chores (`main.js`)
Flags in the save drive the talk lines and the goal line: sawSleeper, bellAsked, thornsAsked, gardenerOk, clapper, bell, oilAsked, ropeAsked, oil, lit. The goal line always names the next step. The wall refuses to break until the gardener agrees. The chores line on the HUD lists what Home Isle needs today.

## Day and night
Light is baked into each stroke, so the time of day is a tint: Spark's `SplatMesh.recolor` multiplies each mesh's strokes. Parts with glowing strokes (lamps, windows, the flower, the keeper's lantern) are split into their own meshes in `split()` and keep their colour; the lighthouse lamp stays dark until it is lit, and the flower's glow follows its health. The tint is rounded to 1/48 steps, so a mesh is only rebuilt by Spark when its tint moves. A sky dome shader blends a horizon, a zenith and a low colour, and stars fade in at night. The lighthouse beam is an additive cone.

## Quality
- Density 560 strokes per m² on a desktop (was 420), 0.6 of that on touch screens, 0.33 for the browser check.
- Grass: short upright strokes scattered on open ground.
- Fill light: `bake()` adds a low, cool light from the far side of the sky, so shade sides read as shapes. This follows the key, fill and sky split in Inigo Quilez's "outdoors lighting" notes, already the source of the sun and sky terms.
- Outline: the pixel pass darkens a pixel that sits on the dark side of a strong luminance step to its neighbours. Adapted from the edge outlines in t3ssel8r's pixel-art 3D scene breakdowns, which use depth and normals; splats give no usable normal buffer, so the step is taken on luminance.
- Soft shadows under people and the goat: a disc of dark, flat strokes that Spark sorts with the rest. No source needed; it is the usual drop shadow.

## Controls
Tap the ground to walk there (the ray marches until it passes under `heightAt`). Tap a thing to walk to it and act. WASD or arrows walk relative to the view; E, Space or Enter acts; M opens the Map; Q and R turn the view; drag turns, wheel or pinch zooms. The Act button names what it will do ("Talk to Gardener", "Hit the crate"). The Look panel holds Pixel (P), Palette (C), Goop, Shapes (X) and New game.

## Save
`localStorage["splat-isle.save.v3"]`: the island, day and time, the inventory, the flags, what is broken on each island, which loot is taken, the sprouts, the flower and the goat's trust. `?fresh` ignores it.

## Checks
- `node qa/lab/splat-isle.test.mjs`: shapes, strokes, light, the five islands and what the story needs on each, sprouts, people, goat, sea.
- `node qa/lab/splat-isle.e2e.mjs`: paint, Look panel, tap to walk, tap to break, the whole story through the Map, night and dawn, save and load, phone layout.
- Pictures: `shots/` from the browser check and full-density captures.

## Not done
No sound. The game runs at about one frame a second in SwiftShader, so the browser check cannot judge smoothness; a real phone and a real graphics card were not available.
