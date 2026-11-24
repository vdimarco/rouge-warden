# Design

## The idea in the user's words
"generate more otherworldly environment with a digital Renaissance theme".

We read it as three new places, a second set beside the five. They keep the engine and the form of the five. They change the art direction:
- **Renaissance:** domes, loggias and arcades, the one-point perspective of an ideal city, coffered vaults, marble, gold leaf, sfumato skies, the polyhedra of Pacioli and Leonardo, and armillary spheres.
- **Digital:** floor grids that run to a vanishing point, wireframe solids, voxel breakup, floating fragments, impossible scale.
- **Mood:** still dusk or night, and still moody. The places may glow more than the five (gold, cyan and magenta light), but the dark rule of `--check` stays.

## Sources
This session could not open iquilezles.org, gamedeveloper.com or medium.com (the host does not resolve here). We read those pages through search extracts. The rest are from search extracts too.

### Renaissance form
- **Brunelleschi's dome, Florence.** National Geographic, "The Florence cathedral" (https://www.nationalgeographic.com/magazine/article/Il-Duomo); World History Encyclopedia, "Filippo Brunelleschi" (https://www.worldhistory.org/Filippo_Brunelleschi/); Wikipedia, "History of Italian Renaissance domes" (https://en.wikipedia.org/wiki/History_of_Italian_Renaissance_domes). We take: an octagonal dome of eight sails, two shells with a gap between them, white marble ribs at the corners, brick laid in a herringbone pattern, and a lantern on top. We also take the pointed profile of the sails. The Broken Cupola uses these forms. Its size, its break, its stair and its colours are our own.
- **Loggia and the cube bay.** Ospedale degli Innocenti: M. Sullivan, Bluffton University (https://homepages.bluffton.edu/~sullivanm/ospedale/ospedale.html), and Wikipedia (https://en.wikipedia.org/wiki/Ospedale_degli_Innocenti). We take one rule: the column height equals the column spacing and the depth of the arcade, so each bay is a cube. The arcades of The Vanishing Piazza use that rule.
- **The ideal city and one-point perspective.** The Walters Art Museum, "The Ideal City" (https://art.thewalters.org/object/37.677/), and Wikipedia, "The Ideal City (painting)" (https://en.wikipedia.org/wiki/The_Ideal_City_(painting)). We take: a paved square with buildings on both sides whose lines meet at one point, with a round building or a gate at that point. The Vanishing Piazza puts the summit temple on that point. We copy no panel: there is no Roman arch, no named building, and the temple is our own.
- **Forced perspective.** Borromini's perspective gallery in Palazzo Spada (from memory; no page fetched in this session). We take the idea of arcades that come closer together and get lower as they go back, so the square looks longer than it is. Our numbers are our own.
- **Coffers.** The Pantheon's dome: MIT, "Pantheon: the dome" (https://web.mit.edu/21h.405/www/Pantheon/Pantheon/Dome.html), and ArchDaily, "AD Classics: Roman Pantheon" (https://www.archdaily.com/802201/ad-classics-roman-pantheon-emperor-hadrian). We take rows of square coffers that get smaller as they go up the dome. The inner shell of The Broken Cupola has five rows.
- **Polyhedra.** Leonardo's plates for Luca Pacioli's "De divina proportione" (1509): George W. Hart, "Leonardo da Vinci's polyhedra" (https://georgehart.com/virtual-polyhedra/leonardo.html), and MAA Convergence, "Leonardo da Vinci's Geometric Sketches" (https://old.maa.org/press/periodicals/convergence/leonardo-da-vincis-geometric-sketches-introduction). We take the "solid edges" form (the vacua): a polyhedron drawn only by thick edges, so you see through it. That is our wireframe solid. We draw it in 3D with our own sizes and colours. We copy no plate.
- **Perspective studies.** Piero della Francesca, "De prospectiva pingendi": Wikipedia (https://en.wikipedia.org/wiki/De_prospectiva_pingendi). We take the mazzocchio, a ring drawn as faceted segments, as a form for a gold ring on the piazza temple. The form is common to many perspective studies.
- **Armillary sphere.** Museum of the History of Science, Oxford, "Armillary sphere" (https://www.mhs.ox.ac.uk/animateit/armillary-sphere/), and Britannica (https://www.britannica.com/print/article/35363). We take: a horizon ring, a meridian ring, the equator, the ecliptic band tilted 23.4°, the two tropics and a small globe in the centre. The Orrery Isles float one over the summit.
- **Sfumato.** Britannica, "sfumato" (https://www.britannica.com/art/sfumato), and Wikipedia (https://en.wikipedia.org/wiki/Sfumato). Leonardo built soft changes of tone from many thin glazes. Our sky does the same with the means we have: many close steps of the sky ramp, mixed by the dither, with no hard edge.
- **Gold leaf.** None fit as a single published source for the look in splats. Gold-ground panels have punched patterns in their halos. We use rings of small bright dots round the low sun for that. The method is our own.

### Digital form
- **The vaporwave grid.** The Collector, "How Vaporwave Turned Retro Tech and Mall Culture Into Fine Art" (https://www.thecollector.com/vaporwave-art-retro-tech-mall-culture/), and Spoon Graphics, "Digital art and Renaissance statues" (https://blog.spoongraphics.co.uk/articles/digital-art-and-renaissance-statues-an-unlikely-combination-that-actually-works). We take only the pairing of classical form with a lit floor grid that runs to the horizon. We do not use the striped sun, palms, statues or busts.
- **Grid lines that stay clean far away.** Ben Golus, "The Best Darn Grid Shader (Yet)" (https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8, read through a mirror at https://hn.jakechampion.name/reader/https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8); Inigo Quilez, "Filterable procedurals" (https://iquilezles.org/articles/filterableprocedurals) and "Checker filtering" (https://iquilezles.org/articles/checkerfiltering/); Open Design, "Neon grid shader" (https://open-design.ai/showcase/neon-grid-shader-design/). They draw grids in a shader and widen or fade the lines with distance against aliasing. We have no grid shader: the art is a few hundred pixels wide and the palette snap draws each splat as a pixel. So we take the lesson, not the code. A grid line is a row of small emissive splats on the ground. Its spacing grows and its tone falls a step with distance, so far lines do not shimmer into moire. A checker tile is a material that picks its ramp by the parity of floor(x / 2) + floor(z / 2), which needs no extra splats.
- **Signed distance solids.** Inigo Quilez, "Distance functions" (https://iquilezles.org/articles/distfunctions): the box frame (`sdBoxFrame`), the octahedron, the onion (a shell of a solid) and rounding. Ink Studio already has `S.box`, `S.ball`, `S.tube`, `S.lathe`, `S.torus`, `S.extrude`, `S.poly`, `S.regular('d4' | 'd6' | 'd8' | 'd12' | 'd20')`, `S.shell` (the onion), `S.join` and `S.vox`. We build every form from these. A wireframe solid is one `S.tube` for each edge, as a box frame is in Quilez's article.
- **Joins with steps and columns.** Mercury, "hg_sdf" (https://in4k.github.io/html_articles/hg_sdf.html; port https://github.com/makio64/hg_sdf). Ink Studio's `S.join` has the same `stairs`, `columns`, `groove` and `engrave` joins. We use `engrave` for the herringbone brick and `groove` for the coffer edges.
- **Repetition.** Inigo Quilez, "Domain repetition" (https://iquilezles.org/articles/sdfrepetition), and Ian Henry, "Periodic spaces" (https://ianthehenry.com/posts/periodic-spaces/). They repeat one solid by folding space. Ink Studio's bake needs one solid per object to sample it, so we repeat in a loop that places the same prop many times. We take the rule that each copy keeps a correct distance bound.
- **Voxel breakup and dissolve.** Godot Shaders, "Intersection dissolve" (https://godotshaders.com/shader/intersection-dissolve/), and gamedev.net shaderlab, "Sprite dissolve effect" (https://gamedev.net/shaderlab/14-sprite-dissolve-effect/). A dissolve compares a noise value with a threshold that moves with distance from a point, and it draws a lit rim where the threshold passes. Ours does it on a grid of 1 m blocks: a block whose noise is over the threshold is cut out of the solid, the blocks just past it lift and drift away (more with distance), and the rim gets emissive dots in the place's digital colour.
- **Fog and fBm hills.** As the five places: Inigo Quilez, "fBm", "Domain warping" and "Fog" (named in `openspec/changes/add-gloam-downs/design.md`).
- **Palette dither.** As the five: Ink Studio's resolve. Ordered dithering against a fixed palette (Wikipedia, "Ordered dithering", https://en.wikipedia.org/wiki/Ordered_dithering) is the general method.

## Decisions

### Three places, one set
The three places are one set, the Gilt Lattice. They share:
- the same **gold** ramp, so the gold leaf looks the same everywhere: `[0x3a2410, 0x74501e, 0xc08a34, 0xf0c862]`;
- **white marble** with cool veins in shadow;
- one **digital colour** each, that the other two do not use: cyan blue in the Piazza, magenta in the Cupola, amber in the Isles;
- a **sfumato sky**: four or five close steps of the sky ramp to a low glowing band, and a soft halo round the light source;
- a **set signature**: a place's own form breaks into 1 m blocks at its edge, and a wire form shows where the solid form is missing.

They differ from each other: dusk, night and deep night; a square on flat ground, a dome on a hill, islands over a grid; cyan, magenta and amber. They differ from the five: those are ruins of stone and wood with fire, and these are marble, gold and light.

### What stays from the five
The engine, the bake, the low resolution, the 48 colours, the dither, the outlines, the chunky forms, the rolling ground, the summit seen from the start, five wisps, one beacon and one spawn. The rules of `--check` stay as they are, with two more rules for the Lattice (see Checks).

### The bake: places with no zones
`lib/zones.mjs` is the run's zone table, and the run stays as it is. So a Lattice biome says `run: false` and `set: 'lattice'`:
- `bake.mjs` asks `zonesOf()` only for a place with no `run: false`. A Lattice place gets no `zones` in its JSON. `ctx.zone()` in a Lattice biome stops the bake with an error.
- `bake.mjs` exports `LATTICE = ['piazza', 'cupola', 'orrery']`. `node bake.mjs` with no ids still bakes the five, so their files do not change. `node bake.mjs lattice` bakes the three. `node bake.mjs piazza --check --preview --out <dir>` works as for the five.
- The JSON gains `set: 'lattice'` (and `set: 'downs'` is not written for the five, so their JSON does not change).
- `lib/check.mjs` keeps `PLACES` (the five) for the figure and pool checks. The Lattice places have no pool.

### The explorer: a second group in the Map
We chose the simplest rule that a player understands: **the Lattice is a second group in the Map, and its first place is open from the start.** The player sees the new places at once, as the user asked for them. Inside the Lattice the rule is the one the player knows: a lit beacon opens the next place.

We did not choose "open after the fifth beacon of the downs". It hides the new places behind the whole walk, and a player who does not know of them never finds them.

- **The Map.** Two groups in one panel, each with a heading: "The downs" (I to V) and "The Gilt Lattice" (I to III). A row shows the numeral, the name, the wisps (◆ n/5) and the beacon state, as now. A locked row says "Light the beacon before it".
- **The count line** under the title: "Wisps: 7 of 25 on the downs, 3 of 15 in the Lattice."
- **Layouts.** At 1280×720 the two groups stand side by side in a box up to 760 px wide. At 390×844 and 320×640 they stand one over the other. In a window under 700 px high, a row is 44 px high and the beacon line moves beside the wisps, so the eight rows and Close fit 320×640 with the box not scrolled. The focus order is the downs, then the Lattice, then Close.
- **The arrival card** of a Lattice place: "I · The Gilt Lattice" (II, III), the name and the subtitle.
- **A lit Lattice beacon.** The next Lattice place opens and loads, with "The way opens to <name>". The last one says "Every beacon of the Lattice burns" and the player stays. No end card shows for the Lattice. The downs' end card, time and best time count only the downs.
- **Walk again** on the downs' end card puts out the five beacons of the downs only. The Lattice keeps its beacons.
- **The walk time** counts only in the five places of the downs.
- **The HUD hint** in a Lattice place is the place's `hint`, then "The way is open. Use the map, or walk on." after its beacon, and "Every beacon of the Lattice burns. Use the map." after the third.

### The save
The fields of the save do not change, so old saves load and the Node test's "same fields as a fresh one" still holds.
- `save.js` keeps `ORDER` (the five), `fresh()` and `wispCount()` (the downs only). It adds `LATTICE` and two pure functions:
  - `latticeOpen(s, id)`: true for `piazza`, and for the others when the beacon of the place before is lit. So the Lattice needs no `reached` list, and `reached` keeps the downs only.
  - `latticeWisps(s)`: the wisps found in the three places.
- `clean()` also keeps `wisps` for the three ids (integers 0 to 4), `lit` for the three ids when `lit` holds `true` and the place is open by the chain, and `at` when it is an open Lattice place.
- `public/lab/gloam-downs/places.js` (new, no DOM) gives `LATTICE_NAMES`, `placeName(id)`, `nextOf(id)` and `mapGroups(save, current)`, the rows the Map shows. The Node test reads the same rows.

### `?place=`
`?place=<id>` loads that place when it is open: a downs place in `reached`, or a Lattice place that `latticeOpen` allows. Else the page loads `save.at`. So `?place=piazza` always works, and `?place=orrery` works after the Cupola's beacon. The switcher's `url` stays `/lab/gloam-downs/`.

### What does not change
`run.js`, `run-save.js`, `screens.js`, `music.js`, `sound.js`, `run-sound.js`, `play.js`, `fight.js`, `sparks.js`, `lib/zones.mjs`, the five biomes, the five places' baked files, the foe and boss files, the cabinet, the switcher entry and the Corridor.

## The places
Coordinates are metres. The play area is -34..34 on x and z. North is -z. The start faces north (yaw π). Heights are of the walk floor. Every number is a start point for the builder: the bake's `--check` decides.

The start camera looks down at pitch 0.3, and the top of its picture is at about eye level. Eye level is about 3.7 over the start. So in each place the summit's landmark rises to about that height or higher, and the beacon stands 2 to 4 over the start.

### 1. The Vanishing Piazza (`piazza`)
- **Name:** The Vanishing Piazza. **Sub:** "A marble square whose arcades run to one point of gold". **Hint:** "Walk to the round temple. Light the beacon." **Seed:** 61.
- **The picture from the start.** You stand on a terrace high at the south end of a long marble square at dusk. Two arcades run north on both sides and close in. At the far end, on a stepped podium, a round temple of columns stands with a dome of gold wire. A low gold sun with a punched halo sits behind it. The checkered floor turns into a lit cyan grid as it goes north, and its tiles lift into the air at the edges.
- **Layout.**
  - The start terrace (the belvedere): a flat at [0, 27], box [6, 3], y 7.0, with a balustrade along its north edge, broken in the middle for the stair. Spawn [0, 7.13, 27], yaw π.
  - The grand stair: from [0, 23.6] to [0, 18.4], width 5, rise 0.35 (15 steps), with `ctx.stair`.
  - The square: a flat at [0, 1], box [12, 17], y 0, blend 3. Checkered marble in 2 m tiles from z 18 to z 4. From z 4 to z -14 the tiles thin out to a lit grid over dark ground: a tile is kept where `n3(x / 2, z / 2) > t(z)`, and t rises from 0 to 1 over that span.
  - The arcades: two, west and east. Each runs from z 18 to z -14 and closes in from x ±12.5 to x ±7.5 (forced perspective). Nine bays a side. The bay is a cube: in the first bay the column is 5.0 high and the spacing and depth are 5.0. Each bay is 0.92 of the one before, so the last is about 3.4. The columns are lathes with entasis, on a plinth, with a cushion capital. Round arches (a box cut by a horizontal lathe), an entablature, and a flat roof. The arcade floor is the square's floor. The last two bays of each arcade are gold wire only: tubes along the edges of the arch, columns and roof, with no solid.
  - The east arcade's roof is a walk: a stair of blocks (rise 0.4, width 2.2) at its south end, from y 0 to the roof at y 5.2. The roof walk ends at the sixth bay with a low parapet.
  - The sunken grid: a square pit at [-6, -6], a flat box [3, 3] at y -1.2, blend 1.5, so its sides are ramps. Its floor is dark with a bright cyan grid of 0.5 m.
  - The podium: a bump at [0, -24] (R 14, H 8) under three terraces: [0, -19.5] box [10, 2.5] at y 2.5, [0, -22.5] box [7, 2.2] at y 5.0, [0, -25] r 5.2 at y 7.6. A central stair joins each terrace (rise 0.35, width 3.2). A round drum of three steps (rise 0.27) brings the temple floor to y 8.4.
  - The temple: twelve columns on a ring of radius 4.0, 4.2 high, a ring entablature (a torus and a lathe band), and a dome of gold wire: twelve meridian tubes and three parallel tori up to y 16.5, a small lantern ring on top. The faceted gold ring of a mazzocchio (24 short boxes on a torus line) circles the dome at its foot. The way between columns is 2.0, so the walk enters from every side. The centre has a round altar 1.2 high with the beacon on it.
  - The hills: east and west of the arcades the ground rolls (bumps at [±24, 6] R 12 H 3.5, [±22, -14] R 11 H 4.5; fBm amp 0.6, freq 1/11; warp amp 3). The land falls away north of the podium (a bump [0, -96] R 72 H -12, as in the Gaol) so the temple stands against the sky.
  - Far: six columns of impossible scale, 26 to 34 m high, at radius 60 to 80 in the fog (res 0.3), two of them broken.
- **The climb.** Down the stair from 7.0 to 0. North across the square, past the sunken grid. Up the three terraces (2.5, 5.0, 7.6) to the temple floor at 8.4. The beacon is at y 9.6.
- **Palette** (29 own colours, index 0 the darkest sky):
  ```js
  palette: [
    ['sky', [0x07061a]],
    ['skyband', [0x120c2a, 0x241640, 0x3e1f52, 0x6a2c5c, 0x9a4458]],
    ['fog', [0x2a1e3c]],
    ['ink', [0x05040c]],
    ['shade', [0x08060f]],
    ['marble', [0x1a1826, 0x2e2b3e, 0x4a4560, 0x6e6884, 0x8c86a0]],
    ['verde', [0x0b1614, 0x16261f, 0x24392c]],
    ['gold', [0x3a2410, 0x74501e, 0xc08a34, 0xf0c862]],
    ['grid', [0x0e2a44, 0x1c5a86, 0x3c9ad0]],
    ['turf', [0x0a0c12, 0x141a20, 0x1f2a2a]],
    ['sun', [0xc8763a, 0xf2c66a]]
  ]
  ```
  The light tiles are `marble`; the dark tiles are `verde`. The brightest grid colour has a luminance of 0.54, under the 0.55 of the bright rule, and a hue of about 202°, far from the wisps' mint.
- **Light:** `{ sun: [-0.7, 0.35, 0.45], amb: 0.13, sky: 0.18, sunK: 0.5, shK: 7 }`. The key light is the dusk afterglow from the west, over the left shoulder at the start. Lamps: gold bowls on the podium's four corners and two on the belvedere (`ctx.fire`, s 0.7), with `g` on marble so the light falls on it as a warm pool.
- **Fog:** `{ color: 'fog', far: 84, start: 0.5, max: 0.86 }`. **Dither:** 0.45. **Outline:** 0.42.
- **Sky (glow):** `B.sky` in five bands, darkest at the top. A low sun at azimuth just right of the temple, elevation about 1°, a gold disc of `sun` steps, and three rings of small `gold` dots round it (the punched halo). Thin flat cloud lines of `skyband[1]`. 40 stars, high only. Cyan motes over the grid.
- **Props to write** (in `lib/renaissance.mjs`, so the other two can use them):
  - `arcade(ctx, a, b, { n, first, shrink, mat, wire })`: bays from a to b, cube bays, the last `wire` bays as gold tubes.
  - `column(ctx, x, z, { h, r, mat, y })`: plinth, shaft with entasis (`S.lathe` with r(t) = r(1 - 0.12 t²)), capital.
  - `balustrade(ctx, a, b, { mat, h })`: vase balusters (`S.lathe` with a vase profile) every 0.35 m under a rail.
  - `wireSolid(ctx, kind, c, r, { mat, thick, yaw, tilt })`: one tube for each edge of a `cube`, `octahedron`, `icosahedron`, `dodecahedron` or `rhombicuboctahedron`, from vertex lists.
  - `voxelBreak(ctx, box, { cell, noise, threshold, lift, drift, mat, rim })`: the dissolve on a grid of blocks.
  - `gridLines(ctx, area, { step, colors, h, fade })`: emissive dabs along the lines, on the ground's height.
  - `haloSun(ctx, eye, az, el, { r, ring, dots })`: the low sun and its punched halo.
  - `mazzocchio(ctx, c, R, r, n, mat)`: a faceted gold ring.
- **Digital motifs:** the checker that turns into the grid; tiles that lift out of the floor at the square's east and west edges (cell 2 m, the ones over 1.0 high in `ctx.later`, the ones under 0.45 as low steps in the scenery); the wire bays at the end of the arcades; four wire solids on plinths down the middle of the square (a cube at [4, 8], an octahedron at [-4, 0], an icosahedron at [4, -8], a rhombicuboctahedron at [-4, -14]), each r 1.0 to 1.4, floating 0.6 over its plinth.
- **Wisps:**
  1. [-10.8, 1.1, 10]: under the west arcade.
  2. [9, 3.8, -4]: on top of a stair of lifted tiles east of the square (each 0.45 higher, top at 2.7).
  3. [11.2, 6.3, 6]: on the east arcade's roof walk.
  4. [-6, -0.1, -6]: in the sunken grid.
  5. [-7, 6.1, -23]: on the second terrace, behind the octahedron plinth.
- **Beacon:** [0, 9.6, -25], r 1.7, on the altar in the temple.
- **Budget:** about 238,000 splats in all. Terrain 105,000 or fewer (a near rectangle at 0.3, rings at 0.7 and 2.0, as the Gaol). Arcades 48,000. Temple and podium 36,000. Wire solids 6,000. Lifted tiles 10,000. Far columns 6,000. Glow (grid, sky, sun, motes) 20,000. Lamplighter 7,000. The three files 1.40 MB or less.

### 2. The Broken Cupola (`cupola`)
- **Name:** The Broken Cupola. **Sub:** "A ribbed dome split open on the hill, its coffers full of light". **Hint:** "Climb the marble rib to the lantern. Light the beacon." **Seed:** 67.
- **The picture from the start.** At night you stand on a high fallen block on the south hill. Across a valley of fallen coffers a huge red dome with white ribs sits on an octagonal drum. Its south-west sail is broken out in blocks, and the blocks float up and away in a magenta cloud. Through the break you see the gold-lit coffers of the inner shell. A thin magenta wire shows the shape of the missing sail. The lantern on top is the summit.
- **Layout.**
  - The start: a fallen piece of the lantern, a flat octagon r 3.2 at [0, 26] with its top at y 11.0, on a hill (bump [0, 28] R 12 H 9). Spawn [0, 11.13, 26], yaw π. Its north side goes down in blocks (rise 0.45) and then a path to the valley.
  - The valley: ground at about y 1.0, from z 18 to z 2. Fallen coffers (square frames 1.6 m, tilted, half in the ground) and tiles. A herringbone path of brick, 2.4 wide.
  - The drum: an octagon (`S.extrude` of an eight-point loop, laid flat) centred [0, -12], outer radius 12.0, wall 1.2 thick, from the ground (y 1.5 there) to y 5.0. A round window (a lathe cut through the wall) on each face, and a wide door (2.4 by 3.0) on the south face. A walk 2.0 wide on the drum's top, round the dome's foot, at y 5.0.
  - The ramp to the drum top: a stair round the drum's east face, from the ground at [12.5, -4] to the drum top at [12.5, -18], rise 0.35, width 2.2.
  - The dome: eight sails with the pointed profile (a lathe whose radius is that of an arch struck from centres at 4/5 of the span, then `S.join('common', ...)` with an octagonal prism, so the sails meet in ribs). The outer shell 0.7 thick (`S.shell`) to y 13.0 at the lantern ring, radius 10.6 at its foot. The inner shell 0.9 thick, 1.4 inside the outer. Eight white marble ribs (boxes along the corner curves, 2.4 wide, 0.5 proud).
  - The break: the south-west sail, between the ribs at azimuth 202° and 247°, is cut by `voxelBreak` with 1 m blocks from the foot to y 11. The cut blocks drift up and out along the sail's normal, more with height, into a cloud of 120 to 180 blocks that ends 14 m away and 9 m higher, the far ones smaller. All of them in `ctx.later`. Magenta rim dots on the cut edge.
  - The ghost sail: magenta tubes (r 0.05) along five meridians and four parallels of the missing sail.
  - The rib stair: on the east rib (azimuth 90°), steps from the drum top (y 5.0, radius 10.6) to the lantern ring (y 13.0, radius 2.4): 20 steps of rise 0.4 on the rib's top, 2.4 wide, with `ctx.stair`. A landing at step 8 (y 8.2) turns west into the gap between the two shells: a walk 1.8 wide on the inner shell's back, 4 m long, to the edge of the break.
  - The lantern: eight marble columns on a ring of radius 2.2, 3.0 high, under a small ribbed cap with a gold ball (top at y 17.5). Its floor is the lantern ring at y 13.0, open on every side (1.6 between columns). The beacon is in a gold bowl in its centre.
  - Inside the drum: the floor at y 1.5, reached by the south door. The inner shell's coffers show from below: five rows that get smaller as they go up (2.0, 1.7, 1.4, 1.1, 0.8 m), each a square cut 0.25 deep (`groove`), with a gold rosette dot in each (glow). The break lets the sky in.
  - The hills: rolling night turf round the drum (bumps at [-22, -6] R 13 H 4, [22, 8] R 12 H 3.5, [-18, 18] R 10 H 3; fBm amp 0.55; warp amp 3). The land falls north of the dome.
  - Far: a low skyline of an ideal city in the fog, at radius 70 to 90 to the north-east and north-west: a row of small domes, towers and a campanile, black on the fog (res 0.3). They are far too small for the dome to be real. That is the impossible scale.
- **The climb.** Down the start blocks from 11.0 to the valley at 1.0. North on the herringbone path to the drum. Round the east face up the ramp to the drum top at 5.0. Up the rib stair to the lantern at 13.0. The beacon is at y 13.8.
- **Palette** (29 own colours):
  ```js
  palette: [
    ['sky', [0x05020a]],
    ['skyband', [0x140818, 0x2a0e2c, 0x4a1640, 0x761f4e]],
    ['fog', [0x1e0c22]],
    ['ink', [0x050207]],
    ['shade', [0x07030a]],
    ['brick', [0x1c0a0a, 0x3a1612, 0x5e2618, 0x8a3c22]],
    ['rib', [0x1e1a26, 0x3a3446, 0x5e5670, 0x8c84a0]],
    ['lapis', [0x0a0c26, 0x141a44, 0x22306a]],
    ['gold', [0x3a2410, 0x74501e, 0xc08a34, 0xf0c862]],
    ['neon', [0x4a1240, 0x8a2070, 0xc43a90]],
    ['turf', [0x0c0a10, 0x16121a, 0x221a24]]
  ]
  ```
  The dome's tiles are `brick`, the ribs and the drum are `rib`, the coffers are `lapis` with gold. The brightest `neon` has a luminance of 0.37.
- **Light:** `{ sun: [0.55, 0.5, 0.65], amb: 0.1, sky: 0.16, sunK: 0.48, shK: 7 }`: cool moonlight from the south-east, so the east rib and its stair read. Lamps: four gold bowls on the drum top, one at the foot of the rib stair, two in the drum's interior, one at the start.
- **Fog:** `{ color: 'fog', far: 76, start: 0.5, max: 0.88 }`. **Dither:** 0.5. **Outline:** 0.45.
- **Sky (glow):** four bands of plum to magenta, lowest in the north behind the dome. A pale moon (two steps of `rib`) low in the north-east, with a soft magenta halo. 60 stars. Magenta motes round the floating blocks.
- **Props to write:** `dome(ctx, c, R, H, { shell, ribs, sails, mat, ribMat })` (the pointed profile, the two shells, the ribs), `coffers(ctx, shell, rows)`, `herringbone` (a `mod` function on brick: blocks of 0.5 × 0.25 turned ±45° by row), `drum(ctx, c, R, h, { door, windows })`, and the shared `voxelBreak`, `wireSolid` (an icosahedron r 1.2 floats over the start as a sign), `column` and `gridLines` (a magenta grid only on the floor of the drum).
- **Digital motifs:** the voxel break of the sail with its magenta rim; the cloud of drifting blocks; the ghost wire of the missing sail; a magenta grid on the drum's floor; the far skyline of impossible scale.
- **Wisps:**
  1. [-3, 2.6, -10]: inside the drum, under the break.
  2. [6, h + 2.2, 10]: on a fallen lantern capital in the valley, reached by two fallen blocks (rise 0.45).
  3. [-11.2, 6.1, -12]: on the drum top's west side.
  4. [-4, 9.3, -6]: at the end of the walk in the gap between the shells.
  5. [-14, h + 3.1, 8]: over three floating tiles west of the path, which step up 0.45 each with gaps of 0.75 (a jump).
- **Beacon:** [0, 13.8, -12], r 1.6, in the lantern.
- **Budget:** about 240,000 splats. Terrain 100,000 or fewer. Outer shell 30,000 (res 0.16). Inner shell 9,000 (only within 110° of the break). Ribs and rib stair 14,000. Drum 16,000. Coffers 8,000. Floating blocks 18,000. Lantern 6,000. Valley props 12,000. Far skyline 5,000. Glow 15,000. Lamplighter 7,000. The three files 1.40 MB or less.

### 3. The Orrery Isles (`orrery`)
- **Name:** The Orrery Isles. **Sub:** "Isles of marble hang over the grid, under a sphere of gold rings". **Hint:** "Cross the isles to the sphere. Light the beacon." **Seed:** 71.
- **The picture from the start.** In deep night you stand on a floating isle of white marble. Below, a sea of amber grid lines runs out to hills that the grid climbs too. Wire polyhedra stand on the grid like trees. Five more isles float to the north at different heights, joined by bridges and stepping blocks. Over the last, a huge gold armillary sphere floats, its rings turned against the stars.
- **Layout.**
  - The grid sea: a flat over the whole play area at y -4 (box [30, 30], blend 6), with gentle fBm (amp 0.3). At the edges the hills rise to y 6 to 10 (bumps at radius 30 to 40, R 14, H 8 to 12), and the grid lines follow the ground up them.
  - The isles: a top (a flat disc of marble paving, `S.lathe` 0.6 thick) over an underside (a lathe whose radius falls to a point 5 to 7 m below, with noise, `rock`). The tip breaks into 0.6 m blocks with `voxelBreak` that hang in a column below it, in `ctx.later`, never lower than 2.0 over the grid sea.
    - I0 start: [0, 26], r 5, top y 8.0. Spawn [0, 8.13, 26], yaw π.
    - I1: [-10, 14], r 4.5, top y 6.5.
    - I2: [6, 6], r 5, top y 5.0.
    - I3: [-6, -4], r 4, top y 7.5.
    - I4: [8, -12], r 4.5, top y 9.0.
    - I5 summit: [0, -24], r 7, top y 11.0.
    - I6 side isle: [-18, 2], r 2.5, top y 5.5.
  - The ways between isles:
    - I0 to I1: a bridge of marble slabs 2.2 wide, with a low curb (0.25) on each side and an arched underside, falling 1.5 in steps of 0.3.
    - I1 to I2: a bridge with steps, falling 1.5.
    - I1 to I6: a narrow bridge 2.0 wide, falling 1.0.
    - I2 to I3: six stepping blocks (1.2 m cubes, solid, in the scenery) that rise 0.45 each with gaps of 0.75, so each is a short jump.
    - I3 to I4: a ramp bridge rising 1.5 in steps of 0.3.
    - I4 to I5: a long stair bridge rising 2.0, 2.4 wide.
  - The ways back up from the grid sea, so a fall is no trap: a spiral stair (a newel column with blocks round it, rise 0.4) from the sea at [-14, 14] up to I1, and a straight stair (rise 0.4, width 2.4) from the sea at [14, 6] up to I2. Each is a `ctx.stair`.
  - Wire polyhedra on the grid sea: a dodecahedron r 2.5 at [12, 16], an icosahedron r 2.2 at [-16, -12], a rhombicuboctahedron r 2.0 at [16, -22], a cube frame r 1.8 at [-20, 22], each with amber `grid`-gold tubes 0.14 thick, standing on a vertex or an edge. The gaps between edges are wider than 0.8, so the lamplighter walks through a frame, and bars on the floor are one cell.
  - The summit isle I5: a round terrace with a ring balustrade (broken at the stair), a round plinth of two steps (rise 0.4) to y 11.8, and a gold bowl on it with the beacon.
  - The armillary sphere: centre [0, 19.0, -24], radius 5.0, so its lowest point is at y 14.0, 3.0 over the terrace. All of it in `ctx.later`. A horizon ring (a flat torus r 5.2, band 0.5), a meridian ring (vertical), the equator, the ecliptic band tilted 23.4° (a wider band, 0.6, with small gold tick boxes for the signs: original marks, not zodiac pictures), the two tropics and the two polar circles, and a gold globe r 1.0 in the centre. Rings are tori of tube radius 0.16.
  - Far: four small isles at radius 60 to 90 in the fog, and one huge wire icosahedron in the sky (r 30, at a distance of 160, emissive dabs along its edges in `skyband[3]`).
- **The climb.** From I0 (8.0) down the bridge to I1 (6.5), down to I2 (5.0), up the stepping blocks to I3 (7.5), up the ramp to I4 (9.0), up the stair bridge to I5 (11.0), up the plinth (11.8). The beacon is at y 12.0.
- **Palette** (28 own colours):
  ```js
  palette: [
    ['sky', [0x02040c]],
    ['skyband', [0x06101e, 0x0c1c32, 0x16304a, 0x234866]],
    ['fog', [0x0a1626]],
    ['ink', [0x010206]],
    ['shade', [0x03050a]],
    ['rock', [0x0e0d12, 0x1d1a20, 0x302a30, 0x4a4046]],
    ['marble', [0x1a1e2a, 0x2e3446, 0x4c5468, 0x767e94]],
    ['turf', [0x081010, 0x0f1c1a, 0x182a26]],
    ['gold', [0x3a2410, 0x74501e, 0xc08a34, 0xf0c862]],
    ['grid', [0x2a1806, 0x5a3410, 0x9a5c1a]],
    ['star', [0x7a86b8, 0xb8c4f0]]
  ]
  ```
  The grid sea's ground is `turf` darkened to its first step; the lines are `grid`. The brightest `grid` has a luminance of 0.40.
- **Light:** `{ sun: [0.4, 0.75, 0.5], amb: 0.12, sky: 0.2, sunK: 0.45, shK: 6 }`: high cold moonlight, so the isle tops are lit and the undersides are dark. Lamps: a gold bowl at the end of each bridge (eight in all), and the beacon's plinth.
- **Fog:** `{ color: 'fog', far: 96, start: 0.45, max: 0.85 }`. **Dither:** 0.45. **Outline:** 0.5, so the isles' edges read against the grid.
- **Sky (glow):** four bands of cold blue, the lowest at the horizon. 120 stars in `star`, more than in the other places, some in faint lines that join them (the sky as a diagram). No moon: the light is from the sphere and the stars. Amber motes over the grid sea.
- **Props to write:** `isle(ctx, c, r, top, { depth, mat, under, breakTip })`, `bridge(ctx, a, b, { width, fall, curb, mat })`, `spiralStair(ctx, c, r, y0, y1, { rise, mat })`, `armillary(ctx, c, R, { mat, tilt })`, and the shared `wireSolid`, `voxelBreak`, `gridLines` and `balustrade`.
- **Digital motifs:** the grid sea and the grid that climbs the hills; the wire polyhedra; the voxel tips of the isles; the stepping blocks; the star diagram; the huge wire icosahedron in the sky.
- **Wisps:**
  1. [12, -2.9, 13]: on the grid sea beside the dodecahedron.
  2. [2, 6.9, 0]: over the highest stepping block between I2 and I3 (top 5.8).
  3. [-18, 6.6, 2]: on the side isle I6.
  4. [10.5, 10.1, -14]: on a stack of two marble cubes on I4 (each 0.45, top 9.9; the wisp is 0.2 over a jump from it).
  5. [-14, -2.9, -20]: on the grid sea in the far west, under the summit.
- **Beacon:** [0, 12.0, -24], r 1.7, on the plinth under the sphere.
- **Budget:** about 230,000 splats. Terrain 80,000 or fewer (the sea floor is flat, so its near square can be at 0.32: the grid lines give the detail). Isles (tops and undersides) 48,000. Bridges, stairs and blocks 26,000. Armillary sphere 12,000. Wire polyhedra 8,000. Voxel tips 12,000. Far isles 5,000. Glow (grid lines 13,000, sky, stars, the big wire solid, motes) 30,000. Lamplighter 7,000. The three files 1.40 MB or less.

## Checks
- **`--check`** holds each Lattice place to every rule of the five: the budget (250,000 splats, 1.5 MB for the three files), reach of the beacon and every wisp, no trap, the summit 2 or more over the start, and the dark rule (mean luminance 0.05 to 0.32 from the start, and 0.05% to 12% of pixels over 0.55).
- Two rules more for a place with `set: 'lattice'`, in `lib/check.mjs`:
  - **The wisps stay the wisps.** No own colour (slots 1 to 31) is within an RGB distance of 60 of the wisp slots 39 (0x8cf0cc) or 40 (0xeefff6).
  - **The digital lines are not fire.** Every own colour of the place's digital ramp (`grid` or `neon`) has a luminance under 0.55, so only the fire, the lamps, the wisps, the sun and the moon pass the bright rule.
- **The preview pictures.** `node games/gloam-downs/bake.mjs <id> --check --preview --out <dir>` draws `start`, `wide`, `beacon` and `top` for each place. The builder looks at each picture and checks, in words in the build notes:
  - `start`: the summit landmark and the beacon's place are in the picture; the digital colour is in the picture; the sky shows its bands with no hard edge.
  - `wide`: the place's form and its break into blocks read at the art size.
  - `beacon`: the landmark is chunky and readable.
  - `top`: the way from the start to the beacon, and the ways back up from every low floor.
  The pictures go into the pull request.
- **Node test** `qa/lab/gloam-downs-lattice.test.mjs`: the three baked places' budget and palette; their first 32 colours differ from the five places' and from each other; the two colour rules above; the save rules of the Lattice; `mapGroups()` for a fresh save, a save with the Piazza's beacon lit, and a bad save; `?place=` choice as a pure function.
- **Stairs test**: `node qa/lab/gloam-downs-stairs.test.mjs piazza cupola orrery`, with the three in its `FLIGHTS` table.
- **Browser check** `qa/lab/gloam-downs-lattice.e2e.mjs` (with the site served): the Map at 1280×720, 390×844 and 320×640 (every row and Close inside the screen, 44 px or more, no sideways scroll, the box not scrolled); each Lattice place loads by the Map and by `?place=`; a lit Lattice beacon opens and loads the next; a reload keeps it; the downs still work as before (the explorer e2e `qa/lab/gloam-downs.e2e.mjs` runs unchanged).

## Not checked
The look on a real phone, and the frame time of the new places on a phone's GPU. The browser checks run in software WebGL.
