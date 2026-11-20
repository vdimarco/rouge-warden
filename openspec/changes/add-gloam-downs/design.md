# Design

## The idea in the user's words
"Environments inspired by dead cells but give it a 3d supermarket 64 vibe with rolling hills", then "make it look gritty and dark". We read "supermarket 64" as Super Mario 64.

- **From Dead Cells (mood only):** a run through a chain of different places, ruined stone, torch light, and color that is saturated but never welcoming. Warm light falls on the hero, and cold shadow falls on the place.
- **From N64-era platformers (form only):** chunky round forms, rolling hills and a low resolution. Flat shading in a few steps, fog that hides the far edge, and a summit goal in view from the start.
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
- **Hills:** Inigo Quilez, "fBm" (https://iquilezles.org/articles/fbm) and "Domain warping" (https://iquilezles.org/articles/warp). The height is a sum of compact smooth bumps `h·(1−r²/R²)³`, plus 2 to 3 octaves of fBm with gain 0.5, plus one warp of the input point. We keep the bump height under 0.35 of its radius, so slopes stay walkable.
- **Fog:** Inigo Quilez, "Fog" (https://iquilezles.org/articles/fog/). The fog color is the horizon color. Ink Studio's renderer applies the fog as a smoothstep over view depth. We set the depth range for each frame, so the fog stays at the same distance as the camera moves in and out.
- **Far terrain:** geometry clipmaps (Losasso and Hoppe, SIGGRAPH 2004). The terrain is three square rings, and the splat spacing doubles in each ring away from the play area.
- **Pixel outlines:** David Holland, "3D Pixel Art Rendering" (https://davidholland.netlify.app/articles/3d-pixel-art-rendering). Outlines go at depth breaks. Ink Studio's `outline: { c, edge }` does this in its own resolve pass.
- **Splat pixel art:** Ink Studio itself (https://github.com/siliconjungle/shapeshift-labs-ink-studio, commit 6a8c622, MIT). We use its sculptor, bake, palette resolve, codec and WebGL renderer as they are. No other splat-stylization method fit: the papers we found are about style transfer, not pixel art.

## Bake offline, draw in the page
- `games/gloam-downs/` installs Ink Studio from GitHub, pinned to commit 6a8c622.
- `bake.mjs` builds each place with the full toolkit (about 2.7 MB of source) and writes three files:
  - `worlds/<id>.bin.gz`: the splat rows, as `SplatCodec` bytes, gzipped;
  - `worlds/<id>.walk.bin.gz`: the walk map, three `Int16` layers, gzipped;
  - `worlds/<id>.json`: the settings and the gameplay points.
- The page loads only the renderer:
  - `pixel-look.js`, `splat-codec.js` and seven `webgl/*.mjs` files, about 48 KB gzipped, copied into `public/lab/gloam-downs/ink/` with Ink Studio's license;
  - the page decompresses with `DecompressionStream`.
- Baking in the page would need the 770 KB toolkit and about one second of CPU time for each place, so we do not do it.

## A place
`biomes/<id>.mjs` exports `{ id, name, sub, palette, light, sky, fog, build(ctx) }`. The shared helpers in `lib/common.mjs` give:
- **Palette slots:** the colors for the lamplighter, the wisps, the fire and the beacon are the same in every palette. Only the place's own colors change.
- **Hills:** bumps, fBm and a warp, cached on a grid with `K.tab2`.
- **Terrain:** a near tile, then rings whose spacing about doubles. `terrain()` uses 0.24, 0.5 and 1.0 by default, and each place sets its own spacing with `tile()`. Each tile is bounded, so it keeps its own material.
- **Paths:** a polyline distance gives the dirt color and a slight dip in the ground.
- **Props:** rocks, trees, torches, braziers, stone blocks and fences.
- **Points:** the start point, five wisps, and the beacon on the summit.

## The walk map
- Before the bake, `S.ready()` lets `S.sdf` answer for the whole scenery. On a grid of 0.25 units, the bake marches down from above and stores the top surface; a column beside a wall's face follows it down to the foot. Where a gap of at least 1.8 units opens under that surface, it also stores the floor below the gap and the gap's underside, the bottom of what lies over the gap. Players can then walk under arches and tree crowns.
- A grid point can fall in a seam: between two planks, or between a porch and a hut's wall. It then reads the water or the ground far under the boards. The lamplighter is 0.6 across and cannot go into such a crack, but it stands on the floor under its centre, so it would drop through. On a boardwalk it fell into the water; on a hut's porch under the eave it fell through to the crawl space under the hut, where the walk map has no way out. So the bake closes cracks (`lib/cracks.mjs`): a cell whose floor, for feet on a neighbour's floor, is more than 0.6 under it, along a row or a column. When the next cell on that line is a floor within 0.1 or a wall, the crack comes up to the neighbour's floor. When it is a floor within a climb (0.83), with the crack more than 0.6 under it too, the crack comes up half way between the two: the gaol had such a slot, 0.4 wide and 2 deep, between floors at 0.01 and 0.49, and no wander got out of it. Two cells in a line (0.5, still narrower than the disc) come up together, in steps between the two sides, when the cell after them is a wall or a floor within a climb with both more than 0.6 under it: the fen had such a notch, 2 by 2 cells and 1.5 deep, in a platform at 4.9. Under a gap the floor under the gap comes up, and where that leaves less than 1.8 under the underside the cell is solid. In the open the top comes up, and it takes the neighbour's gap under it when the feet come from the neighbour's top. A seam at a floor's edge, with a drop on its other side, stays open. This is a closing of one or two cells, as morphological closing fills gaps narrower than its structuring element in image processing. It closes 38 to 234 cells in a place, and with the controller held fixed the reach changes by -29 to +66 cells.
- Each round found one more trap of this kind, so the bake also holds a general rule (`lib/traps.mjs`): no place in reach is a trap. The reach search keeps every walk and jump that it makes and runs them back from the start and from the beacon (once it burns, the map opens the next place). Each state that it reaches must lead back to one of them. The search moves along rows and columns only, so beside a post or in a corner it can miss a way out. So a state that it cannot leave is tried with the controller itself, from its grid point: on 16 headings, a walk and a running jump, at 30 and 60 Hz. The state leads back when the controller gets to a state that leads back on at least 4 headings at both rates. A notch whose only way out is one exact jump, as in the fen (1 or 2 headings of 16), is still a trap. The bake fills each trap up to the floor of the state it was reached from, searches again, and fails after 4 rounds or when no trap can be raised. After the crack pass no place has a trap: the search finds 0 to 3 states that it cannot leave, and the controller leaves each of them on 8 or more headings. A fill can leave a crack beside it where the search did not go, such as a trench's floor beside its walls, so the crack pass runs again after each round. With round 5's crack pass instead, the rule finds and fills the gaol slot (5 cells) and the fen notch (2 cells), and its crack pass then closes the rest. The check uses the rule's last reach search, so a bake takes about 1 s more a place.
- Water, hanging cloth and chains (`later`) are added after the walk map, so they never block the feet. They are baked with the scenery in one bake, so its shadows fall on them and what of them is buried in it is dropped.
- At run time the lamplighter is a disc of radius 0.3 that stands on the floor under its centre. Each grid corner gives its top, or the floor under its gap when the top is out of reach and the feet are in the gap, and the four are blended after that choice, so an arch's edge reads as flat floor from below and as a clean edge from above.
- The feet decide which layer a corner gives, not the height that the disc reaches. The feet are in a gap when they are lower than its underside. Then a corner gives the floor under its gap, also when that floor is above the feet: then the floor is a step or a wall at its own height. Higher feet are on the roof, so the corner gives its top. A map without the underside layer takes the underside as the floor plus 1.8, the lowest a gap can be.
- The corners of one roof agree. For a corner that asks (a gap under a top out of reach), the underside under the feet is blended, with the corners' own weights, over the gap corners of the cell that are the same roof: their underside is within 1.0 of that of a corner that asks and is in the roof already, and so is their top when the feet can stand on it. So the roof grows through the corners that ask, and at the rim of a dome, where the undersides step from 1.22 to 2.22 across one cell, all four corners are one roof. In round 5 each corner took only the corners within 1.0 of its own underside, and 12 of 18,384 drops in such cells landed on a shelf in mid-air. A walkable slope (2.77 per unit) rises about 1.0 across a cell's diagonal, and a roof that slopes down under the feet goes on in its top too. Corners that ask are not held to the top rule, because a roof's top can step up over one underside, as at a merlon over a parapet's lip: there two corners of one wall face have tops 1.14 apart, and splitting them left a shelf in mid-air. So a landing never blends a roof corner with a floor corner of the same roof. Without this, a jump down a sloped floor under a roof could land on a shelf in mid-air, 1.65 to 1.74 over the floor, made of roof corners downhill and floor corners uphill, and a thin roof over a floor that slopes with it let a jump through.
- A gap corner further off belongs to another solid and has no say: a grate over a pit beside a vault, the body of a hut over its crawl space beside the porch under its eave (undersides 1.4 and 3.6), or a lean-to whose top the feet stand on, against a hall (tops 4.5 and 6, undersides 4.2 and 5). Round 4 blended over every corner that asked, and over every corner whose top was in reach and whose underside was over the asking floor, and one height decided for the whole cell. In the fen that let a hut's body give its crawl space as floor to feet on the porch, so the lamplighter dropped into it, 36 times in 600 wanders on one hut's porch. A lean-to's underside also pulled the hall's under the feet, so the hall's roof became a wall in mid-air. Now each corner decides on its own blend: the fen wanders end in a crawl space 0 times in 600, and runs off a lean-to never stop in the air.
- The feet do not rise up through a roof over the centre. Where a jump would take the feet from under a roof's underside to above it, with the centre under that roof, they stop there and fall, as against a wall. Without this, a lamplighter that walked off a lean-to's edge and jumped in its coyote time rose into the hall's roof edge and stood on the blend between the two roofs, from which it stepped onto a hall roof 1.5 over the lean-to, which no jump reaches. The step tests this before the landing, with the feet read 0.05 over their height before and after the step, so it holds however thin the roof is and however far the feet rise in one step: with the reach held at the height they rose from, the corners under the centre give their floor for the feet before the step and their roof for the feet after it. In round 5 the landing came first, so feet that reached the top of a roof 0.02 to 0.05 thick in one step landed on it, 72 times in 1,344 coyote jumps at 30 and 60 Hz.
- So feet on a roof, an arch's top or a tree crown read a higher part of it as a slope or a wall, not as a hole down to the floor under it. A jump or a fall lands on a sloped top at any frame rate, also on a thin roof (1.85 to 2.0 over its floor) over a floor that slopes with it, and from a low roof a higher roof is a wall or a step.
- Under a roof, the higher side of a sloped floor is floor, not roof. A jump or a fall lands on that floor at any frame rate, also past the lip of an overhang. From a ledge lower than an arch's underside, a walk drops into the arch. A jump under a high roof does not meet the roof: a running jump down a slope under a roof 6 high flies as it does in the open. In a map without the underside, feet 1.8 or more over a gap's floor are on its roof, so that roof is a wall at the top of such a jump, and from a ledge 1.8 or more over the floor under an arch the arch's roof is a wall.
- Nothing inside the disc may rise more than a climb above the base: 0.5 plus the slope over the radius, 0.83 in all. The base is the floor where the feet last stood on a slope, a floor no steeper than a climb per radius. On a steeper face the base stays where the face began. So a ledge over 0.83 stops a walk from any heading and at any frame rate, and the jump (1.40) is the way up. Without that rule, a 1.2 ledge with a 0.7 step on its lip could be walked up, because the climb would be spent again on each frame.
- In the air the disc may not overlap anything above the feet, except the slope under its centre. Where the floor under the centre is in reach and no steeper than a climb per radius (2.77), nothing inside the disc may rise over the plane along that slope, 0.05 over its floor, taken at the start of the frame. So the uphill side of the disc does not stop a running jump up a slope, at the take-off or just before the landing, and the centre goes on up the slope over the frame. A wall, a ledge or a face rises off that plane, so it still stops the disc. Without this, a running jump up a slope of 0.3 or 0.6 lost 80% to 99% of its speed at the take-off or the landing, and how much depended on the frame rate. Now it keeps 99% or more of it, at 30, 60, 120 and 144 Hz, and the jump goes as far from the take-off at each rate, within one frame of travel at 30 Hz.
- It lands on the floor under its centre when the feet are at or below it and that floor is in reach (on the slope's plane it may be a little over the feet). That holds on the way up too, and the feet never go under the slope. A face is never leaned on, so jumping again and again at a hillside of 4 per unit does not climb it.
- On a run up a steep slope the slope rises under the feet nearly as fast as the jump. In round 4 a running jump lifted the feet 0.4 over a slope of 0.6, 0.2 over 0.8, 0.07 over 1.0 and nothing from 1.2: the jump was gone. Now, while the feet rise faster than 3.82 per second and are less than 0.4 (`slopeLift`) over the slope under the centre, the move up that slope is held back so that the slope rises under them no faster than 3.82, the speed at which a held jump still lifts the feet 0.4 (8.2 less the square root of 2 × 24 × 0.4). On a plain slope that rise stays the same at any frame step, so the feet rise 0.4 over every slope at 30, 60, 120 and 144 Hz, and after that the run picks up again in the air. A slope of 0.6 at a run rises 3.84 per second, so the run keeps 99% of its speed; at 1.0 it slows to 3.8 while the feet rise, at 2.0 to 1.9. A walk up a slope of about 1.2 or less, a move across or down the slope, and a jump that starts 0.4 or more over the slope are not held back. The 85% of the run speed that a jump up a slope of 0.6 keeps limits slopeLift to about 0.5; we take 0.4, the lift at 0.6 before. No source fit: this is our own rule. A jump from a stop still lifts 1.40, so a block 1.0 over a slope of up to 1.0 is reached from a stop against its face, not from a run.
- On the ground the shadow lies at the feet. In the air it lies on the floor that the feet would land on.
- The reach search uses the same disc and base, at each grid point and halfway to it, with the feet on the floor that they stand on. A jump rises up to 1.30, the jump less 0.1, and lands up to 1.0 away along a row or a column of the grid. The disc must be clear at the top of the jump at each grid point and halfway between. On the way, the feet are read at the top of the jump, which is the highest that the controller reads them. No floor on the way may be higher than both ends, so a hop over a thin wall does not count. The jump lands only at a point where the disc can stand and each cell round the point is a slope, with the feet on that floor. So it does not land on the tip of a stake or on the edge of a ledge. A test plays such jumps with the controller at each frame rate. Where the disc already reaches over something more than a climb over the base, as after a drop beside a wall, a walk goes only where the halfway point and the end are no nearer to it, as the controller's own rule is. Before, such a state was a dead end, and the search could not get back from 220 states in the gaol.
- The camera marches from the lamplighter to the eye and stops short of the first thing in the way, on the top surface or under a gap. When that is too close to frame the figure, the view tilts up until the eye is clear.
- The map is three `Int16` layers, in centimeters, one after the other, gzipped: the top, the floor under a gap (the top where there is no gap) and the gap's underside (0 where there is no gap). The JSON names them in `walk.layers`, and the page checks that the file holds that many. The underside layer is mostly zeros, so it adds 0.8 to 2.6 KB: the five walk files are 102 to 132 KB. A loader test serves the page's loader a walk file of two layers under a JSON that names three, and it is refused.

## The lamplighter
- The figure is sculpted in each world after the scenery bake, high above the map, so the place's shadows do not fall on it. It is baked with that place's light.
- `K.bones.tag` puts its splats on seven GPU bones: body, head, two legs, two arms with the lantern, and the shadow disc. The page writes 12 numbers for each bone every frame, and no splat rows are uploaded.
- The controller, camera and pose live in `play.js` with no DOM, so Node can test them.

## Wisps and the beacon
- **Wisps:** emissive splats that bob in the shader.
- **Beacon flames:** emissive splats that start with zero density.
- **Changes:** to put out a wisp or light the beacon, the page sets the density of those rows, and the renderer uploads only the changed 512-splat rows.

## Speed
- The renderer sorts all splats on the CPU when the view changes. That costs about 3 ms for 100k splats and 7.5 ms for 300k. Each place is kept under 250k splats, and under 275k with its pool of foes.
- The art size is about 64,000 pixels (320×200), or 46,000 on a touch screen, scaled up by a whole number. The page keeps the last 40 frame times. If their median is over 45 ms for two seconds, the page steps the art size down to 72% of its pixels. It stops when the art size is 24,000 pixels or less.
- The game moves in fixed steps of 1/60 s, as many as the frame took, up to 15 steps (0.25 s) for each frame. So a slow phone does not play in slow motion, and a long pause does not move the lamplighter far.

## Not done
- Foes, combat and sound in Wander. The combat run below adds foes, combat and sound.
- Runtime point lights: the renderer has no path for them, so all light is baked.
- A check on a real phone or a real graphics card. This session has only software WebGL.

## The combat run
The user asked: "beautiful now can we turn this into a playable game?" These are the user's decisions:
- a combat run in the spirit of Dead Cells;
- a blade, a dodge roll, and foes with clear warning moves;
- health, and flasks to heal;
- a restart at the Gaol on death;
- a currency that buys lasting upgrades;
- a boss at Barrow Crown.

The five places and their look stay. Everything is original. Keys, mouse, touch and gamepad work, at 320x640, 390x844, 1280x720, 360x640 and 800x600.

### The choice
Two designs were made: A (player feel first) and B (ship-safe first). Both texts in the brief stop part way: A in its section 5, and B in its section 6. We judge what they give.

| | A | B |
|---|---|---|
| Player feel | 5 | 4 |
| Fairness | 4 | 5 |
| Feasibility in the measured budgets | 3 | 5 |
| Testability | 4 | 5 |
| Phone fit | 4 | 5 |
| Originality | 4 | 4 |
| Keeps the user's decisions | 5 | 5 |
| Total | 29 | 33 |

- **Player feel.** A has six foe types, wicks at the beacons, a light carried to the last beacon and a richer boss. B has four types and no choice inside a run.
- **Fairness.** In B, every wind-up has a pose, a fire glow and a sound, and every ring or lane also has a ground marker. B's shortest wind-up is 0.55 s, and its largest hit is 24. A answers its wave attacks with jump windows of 0.27 to 0.32 s. Touch delay makes those hard on a phone.
- **Feasibility.** B totalled each place with its pool of foes: 256,668 to 263,498 splats, under 275,000. B needs four foe sculpts and one boss. A needs six foe sculpts, 57 foes, a poise meter, a combat camera and burning ground. A did not total its pools.
- **Testability.** B has a run seed, `?wander`, an entry snapshot for reloads and a sim with knobs. A has a pacing model and a list of assists.
- **Phone fit.** B places the health line, the toast and the boss bar from measured failures. A keeps the string going while Attack is held, but its jump windows are tight on touch.
- **Originality.** Both have original names and looks. Both use genre devices, such as a ring to roll out of or a charge into a wall, and copy no game.
- **The user's decisions.** Both keep all of them and the look.

**B is the base.** We take these parts of A:
1. Holding Attack goes on with the string. On a phone this saves taps.
2. The roll stops at a drop of more than 3 m unless the stick pushes over it. The Bells' spire terrace is a ring about 3 m wide at y 4.5, and a 3.5 m roll would leave it.
3. A fall below y −25 does not end the run. The lamplighter comes back on the last firm ground and loses 10 health.
4. Wicks: at each of the first four beacons, the player chooses one of two boons for the rest of the run. This gives each run its own shape.
5. The light carried to the last beacon. B's light rose to the beacon by itself. A ends the run on the game's own verb: light the beacon. The path from the arena to the beacon is 15.9 m on the real walk map (`run/flamewalk.mjs`).
6. The currency is glim, motes in the lamp colours, so fire stays the colour of danger. B's amounts stay.
7. Foes rise from the ground when their zone wakes. This hides a pool slot that comes on in view.
8. A ring of grave candles marks the edge of the boss arena.
9. The push of a hit on the lamplighter is a scripted move. A measured that a plain velocity brakes at once: 5 m/s slides 0.31 m.
10. A combat camera turns the view toward the foes when the player does not turn it (see Cameras in a run). It is the first thing to cut.

We do not take A's poise meter. B's wind-up rule is simpler, and B's sim showed the endless flinch that the rule stops. We do not take A's six types, its bell foe with its wave, its burning ground or its tier multipliers. The budgets and the jump windows on touch are against them. A's beacon heal stays a tuning lever, off at first.

### Numbers we checked
We ran the design scripts again at commit 6c66c210 (scratch folder `design/`), and read the code they rely on.
- `run/feel.mjs` on the real `play.js`: a full jump peaks at 1.33 m after 0.33 s and stays 0.60 s in the air. It keeps the feet over 0.5 m for 0.47 s. A tap jump peaks at 1.07 m. `JUMP` is 1.401.
- `ss/roll.mjs`: a roll of 0.36 s at 9.0 m/s moves 3.26 m. That holds in 8 directions, on flat ground and on the Gaol, the Bells and the Barrows. With no clamp it then coasts 1.05 m. With the speed cut to 4.5 m/s at the end, it coasts 0.25 m, so 3.51 m in all.
- `ss/roll.mjs` also gives the lunges by the per-body `PARAMS` copy: 0.46 m and 0.81 m. An Ironback charge of 0.7 s at 10 m/s goes 6.94 m, and 2.11 m into a wall 3 m away. It must stop dead at the end, or it coasts 2.67 m.
- `ss/plan2.mjs`: the place and its pool, in splats, are Gaol 256,969, Crow Wall 260,410, Fen 256,668, Bells 263,498 and Barrows 262,907. B's brief gave 264,110 as the top, and the rerun gives 263,498. The boss's three shard rings (see The boss) add about 600 splats to the Barrows: 263,507, the new top.
- `ss/plan2.mjs` also walks each route without a fight. That wakes at most 5 foes at once in the Gaol and the Crow Wall, and 6 in the other places. A full run holds 254 glim: 124 from foes, 100 from wisps and 30 from the boss.
- `ss/sim.mjs` is B's flat-ground sim. Its defaults are a Snuffer hook of 14, a boss of 960 and a heal of 40%, which are not the design's numbers. We ran it with the design's numbers (`SDMG=16 PDMG=18 MDMG=18 IDMG=20 BHP=1300 HEAL=0.35`), 300 bots and 12 runs. The median first win is run 3 at skill 0.3, run 2 at 0.5, and run 1 at 0.7 and 0.9. The boss fight takes a median of 72 to 75 s. A winning run takes 5.7 to 5.8 minutes of game time. The 90th percentile of boss tries is 4, 3, 2 and 2.
- `run/pacing.mjs` is A's model with its own roster: a design aid, not used for numbers. Without a beacon heal, the Crow Wall ends 60% and 42% of a new player's first two runs. With a heal of 25%, it ends 41% and 21%. A's brief said 62 to 73%, and the rerun does not give that.
- The code today: `main.js` steps the game by at most 1/30 s, and `?test` steps it by 1/60 s. The toast sits at `sat + 116px`, and the hint hides at 520 px wide or less. Gamepad button 0 jumps, 2 walks, 5 looks ahead and 9 opens the Map. The splat and walk files of a place add up to 1.320 MB (Gaol) to 1.480 MB (Barrows).

After the first review, we measured two more things (scratch folder `run-rev/`).

**The sort with each place's pool** (`sortmix.mjs`, the review's `sortpool.mjs` with parked slots added). The base is the place with the lamplighter's bones and no pool. Each figure is the best median of 3 rounds of 60 frames, and each row is 3 runs.

| Place | On bones | Parked | Ratio |
|---|---|---|---|
| Gaol | 16,500 (5 S) | 0 | 1.27 to 1.31 |
| Crow Wall | 16,900 | 0 | 1.28 to 1.36 |
| Crow Wall with a second Pitchrook slot (not used) | 20,600 | 0 | 1.31 to 1.49 |
| Fen, every slot on bones | 20,800 | 0 | 1.38 to 1.54 |
| Fen, the largest awake set (6 of 8 slots) | 18,200 | 2,600 | 1.33 to 1.38 |
| Bells | 19,500 | 0 | 1.31 to 1.38 (6 runs) |
| Barrows, every slot and the boss on bones | 31,500 | 0 | 1.56 to 1.65 |
| Barrows before the boss, the boss parked | 19,500 | 12,000 | 1.37 to 1.39 |
| Barrows in the boss fight, the boss alone on bones | 12,000 | 19,500 | 1.32 |

With every slot on bones, Barrow Crown fails a pass of 1.40, and the Fen's worst run does too. So a parked slot leaves the bones (see Rendering). Then the worst place is 1.39, and the spec's pass is 1.45 in each place. The review measured 1.302 for the Bells and 1.528 for the Barrows with every slot on bones. Our runs are a little higher, which shows the spread on this machine. The second Pitchrook row is from this round (`spec-r3/`), and it is why the Crow Wall keeps one Pitchrook slot (see Guard zones). The boss is now 12,600 splats. Its 600 more splats on bones add about 0.03 ms to a sort of about 3 ms, about 1%. The renderer survey gives 0.05 ms for each 1,000 boned splats.

**The brightest 1% today, with no foes** (`bright2.mjs`, the review's `bright.mjs` at two sizes). This is the share of the brightest 1% of art pixels that is within 12 of a fire, wisp, lamp or moon colour. It is the baseline for the look in a fight.

| Place | Desktop, 320×180 | Phone, 130×282 | Pixels that miss |
|---|---|---|---|
| Gaol | 72% | 100% | the Gaol's moonlit stone 4f5c8a |
| Crow Wall | 40% | 38% | 737c36 and 987456 |
| Fen | 79% | 33% | the sick green lanterns e2ec86 and 9cae34; on the phone, 48502f and 5a4f2a |
| Bells | 48% | 94% | the dusk ramp 9e6224, 9c3b29 and cc9238 |
| Barrows | 99% | 100% | a6f27e |

The pixels that miss are each place's own colours in slots 1 to 31: lit stone, lanterns and the dusk ramp. Foes cannot change that, and the explorer's rule already lets lanterns and the moon be bright. So a fixed share of 90% fails before any foe is added. The share also swings with the art size: the Fen has 79% and 33%. A rule that compares the share with foes to the share without them can fail when a foe hides a torch. At the phone size, the Gaol and the Barrows are already at 100%.

So the spec's check looks only at the pixels that the foes change. It counts a changed pixel when it is brighter than a floor. The floor is the larger of two values: 0.42, the luminance of fire slot 34, and the dimmest of the brightest 1% with no foes. Of the pixels counted, at least 95% must be fire, lamp or wisp. In the Gaol at the desktop size, the brightest 1% starts at about 0.36. That takes in the moonlit stone 4f5c8a (0.363), and iron slot 45, 5a5868 (0.351), is just under it. A foe's rag in the moonlight can snap to 4f5c8a, and without the 0.42 floor it would count as a miss. The 5% allows for outline and dither pixels at a foe's edge. It is an estimate, and the first build checks it.

In this round (scratch folder `spec-r3/`), we measured three more things.

**Guard zones.** For each guard zone, we listed the other zones that can be awake while the lamplighter is near the guard. Near means within 10 m of the guard's centre. A zone stays awake while the lamplighter is within 16 m of its centre, or while its foes are not home. So we listed the zones whose centre is within 26 m (10 + 16) of the guard's centre. A zone farther away is awake there only while its foes chase or walk home. Then we added their foes by type.

| Place | Guard | Zones that reach it | Foes by type | Pool |
|---|---|---|---|---|
| Gaol | G5 (SSS) | G3 | 5 S | 5 S |
| Crow Wall | R4 (SSP) | R3, R2 | 4 S, 2 P | 4 S, 1 P |
| Fen | F4 (SSP) | F2, F3 | 4 S, 1 M, 1 P | 4 S, 3 M, 1 P |
| Bells | B4 (SP) | B1 (24.3 m), B2 (22.5 m) | 3 S, 1 M, 1 P, 1 I | 3 S, 1 M, 1 P, 1 I |

F1 is 26.2 m from F4, just outside. The Bells fill their pool of 6 exactly, so they fit. Only the Crow Wall's guard can be kept asleep by the types. R3's Pitchrook chases within 12.4 m of a centre that is 11.4 m from R4's, and the pool has one Pitchrook slot. Then the beacon stays dark with no keeper in sight. A second Pitchrook slot gave a sort ratio of 1.31 to 1.49 in 3 runs, over the 1.45 pass once. So a guard zone takes the slots it needs from other zones (see The foes).

**Ironback walls** (`walls2.mjs` on today's walk maps). We looked for a rise of 2 m or more within 0.5 m, out to 3 m past each Ironback zone's leash.
- B1 vale: bearings 204° to 225°, 5.0 to 6.5 m from the centre. That is 0.5 to 2.0 m past its leash of 4.5 m.
- W2 hollow: bearings 66° to 90° and 318° to 324°, 7.8 to 8.5 m from the centre. That is 2.3 to 3.0 m past its leash of 5.5 m.

So a charge must be able to run up to 3 m past the leash, or it can never reach a wall. The final bake must keep these walls, and the zone test checks them.

**The boss camera** (`bosscam.mjs`). See Cameras in a run.

In the fourth round (scratch folder `spec-r4/`), we measured three more things after the second review.

**Markers on rolling ground** (`rimfit.mjs`, `lanefit.mjs`, after the review's `marker.mjs` and `markerfit.mjs`). A flat ring that only scales sinks into the ground. The review found the ground a median 0.36 to 0.72 m above a flat ring or lane. In the Fen, the bed is 0.5 m under the water, and nothing under the water is drawn. We fitted each piece of a marker to the floor under its rim. The floor is `walk.support` from 2.5 m over the zone's centre, or the water's surface (0) in the Fen where that is higher. The table gives the share of rim points within 0.15 m of the fitted plane, at 36 points across each leash.

| Marker | One plane | Six slices of 60° |
|---|---|---|
| B1 slam ring, 3.0 m | 91% | 96% |
| W2 slam ring, 3.0 m | 89% | 96% |
| Arena cage slam ring, 3.4 m | 73% | 98% |
| Arena shard ring, 1.3 m | 94% | 99% |
| F2 pulse ring, 2.2 m | 64% | 93% |
| F1 pulse ring, 2.2 m | 82% | 97% |
| R3 coal ring, 1.4 m | 89% | 97% |

Lanes 1.6 m wide in pieces give these shares. The Ironback's 7 m lane in B1 and W2 has 90% in 3 pieces and 93% in 5. The boss's 9 m lane has 86% in 3 pieces and 94% in 6. So every ring is six slices, and every lane is pieces of 1.5 m or less. The spec's pass is 90%.

**The boss camera's frame** (`framing.mjs`, `rects.mjs` and `arena3.mjs`, after the review's `feet.mjs` and `arenacam.mjs`). See Cameras in a run for what we found, the frame rule and its numbers.

**The boss file** (the review's `weights.mjs`). The lamplighter's real boned rows (the Gaol, 5,436 splats), encoded again with the vendored `SplatCodec` and gzip -9, take 7.47 B a splat. The cloak's second-bone weights on 35% of the splats raise that to 9.92 B, or to 8.41 B in steps of 1/8. So 12,600 boss splats with weights in steps of 1/8 are about 106 KB before the JSON.

**Where the scripts are.** The scripts named in this section are in the session's scratch folder, not in the repository, and that folder can be cleared. The build ports what a test needs into `qa/lab/`:
- The zone table goes first into `games/gloam-downs/lib/zones.mjs`: each zone's centre, leash, foe types, guard flag and keeper name. The biomes' `ctx.zone()` and the zone test both import it.
- `check-zones.mjs` and `walls2.mjs` become `qa/lab/gloam-downs-zones.mjs`: the wake rule, the guard rule, the cap of 6, the pool slots, the Ironback walls and the beacon distances.
- `sortmix.mjs` becomes the sort bench, `rects.mjs` and `arena3.mjs` the camera test, and `rimfit.mjs` and `lanefit.mjs` the marker test, all in `gloam-downs-run.test.mjs`.

### The run
- **Order.** Gaol, Crow Wall, Fen, Bells, Barrow Crown (`ORDER` in `save.js`). There is no Map travel in a run.
- **Start.** On the first visit, the help card shows, and then run 1 starts in the Gaol. A player with a finished explorer walk goes from the help card to the Lamp-room, where Wander is open. On later visits, the Lamp-room shows over the Gaol's start view.
- **Seed.** Each run has a seed: `hash(runs, Date.now())`, or `?seed=N`. The seed draws the wick offers and the foes' choices of move and cooldown.
- **Guards.** The beacon lights only when its guard zone is clear: G5, R4, F4 and B4. At Barrow Crown the boss holds the light. All other zones can be passed.
- **Where the keepers stand.** The Crow Wall's beacon is 14.0 m from its guard zone R4, and the Fen's is 9.2 m from F4. So a player can touch a dark beacon while its keepers are still in the ground. The toast names a landmark where they stand: the keep, by the broken wall below the tower, the mill, or the terrace. The game has no compass, so no toast uses a compass word. A notch at the screen's edge also points to the guard zone's centre for 3 s.
- **A lit beacon** before Barrow Crown banks the glim carried and fills the flasks. It saves the run at the start of the next place, with the two wicks offered. Then it shows the beacon card: choose a wick, then Spend glim or Walk on.
- **A choice raises the entry.** A wick or a buy changes the run after the entry values were taken. So it raises the entry health, flasks and maximums by what it gives, and the run is stored at once. Without this, a reload took back Spare oil's flask and Long wick's 20, and the wick stayed chosen.
- **Reload.** The run goes on at the start of the current place. The place restarts, so its foes, its guard foes and its wisps are all back. Health and flasks are the lower of the entry values and the last stored values. Glim carried and the count of foes put out go back to their entry values. The wicks do not change. So a reload cannot heal, and it cannot give the same glim twice. The foes that come back give no glim that the reload did not take away.
- **A reload at the beacon card.** Before the choice, the beacon card shows again over the next place's start, with the same two wicks from the save. After the choice, the run goes on at the start of the next place.
- **When the run is stored.** At once on each hit taken, each drink, each wick chosen, each buy, each lit beacon, the boss's fall and at 0 health. Otherwise every 120 steps (2 s), when the tab is hidden, and on pagehide. Today's page stores every 120 frames only, so a reload in the death fade could keep a run alive. A store is one small `localStorage` write.
- **Death.** Hit stop of 9 steps, a fade to ink over 1.2 s, then the run summary. At 0 health the page stores the ended run at once. Runs and deaths go up, and the glim carried is lost (Ash pocket keeps 30%). `run` becomes null, and `ended` holds the summary. So a reload in the fade shows the summary. Closing the summary clears `ended`. The Lamp-room follows, and the next run starts in the Gaol with every foe back.
- **The boss's fall.** The page stores the run at once with `bossDown: true`. The boss's 30 glim go straight to the glim carried. After the fall, no zone of Barrow Crown wakes. A reload after the fall starts the lamplighter at the arena with the light at its lantern, and the boss stays down. The glim carried is the entry value plus the boss's 30, as for any reload. The wisps come back, as their glim went back too.
- **The win.** When the last beacon lights, the page stores at once: the bank, `wins` plus 1, `bestWin`, `run` as null and the win's figures in `ended`. A reload before the win card closes shows the win card again. A reload in the 1.8 s before the card shows it at once.
- **Run time.** It runs in play, and stops in cards, in the pause panel and at the win.
- **Test hooks.** Software WebGL draws about one frame a second. So the e2e sets up each picture with hooks under `?test`:
  - `wake(zone)`;
  - `spawn(type, x, z, yaw)`, which uses a free pool slot and reports when there is none. The foe is already risen, with no cracks and no cooldown. It counts as an awake zone of its own, with its home at that point and a leash of 4 m;
  - `hold(foe, move, t)`, which keeps a foe's pose and place at time t of a move while the rest of the game steps. A held foe does not hit, so a test holds a wind-up at its last step, 0.54 s for the hook;
  - `out(foe)` and `out(zone)`, which put out one foe or a zone's foes as a death does, and drop their glim;
  - `fx({ stop, flash, kick, zoom, grade, shake })`;
  - `set({ hp, flasks, carried, bank, up, bossHp })`. A `bossHp` puts the boss at once in the phase of that health. A change of phase gives one hit stop of 9 steps and one stumble of 120 steps, however many thresholds it crosses;
  - `go(id)`, which moves the run to the start of a place;
  - `light()`, which acts as a touch on the beacon, so it obeys the guard rule and the boss's light;
  - `sounds()`, a log of the cues with their game and play steps, so a test can check a sound with no speakers.
- `run()` returns `mode`, `place`, `hp`, `max`, `flasks`, `flasksMax`, `carried`, `bank`, `wisps`, `wicks`, `offer`, `foes`, `banked`, `bossDown` and `time`.
- `run()` also returns the clocks: `step` (the game clock), `playStep` (the play clock) and `stop` (hit stop left). Its `fx` holds `kick`, the camera's offset in metres as [x, y, z], and `zoom`, a factor that is 1 for no zoom. It also holds `bars` and `grade`, the 48 colours after the grade.
- `foes()` returns `id`, `type`, `zone`, `x`, `y`, `z`, `hp`, `move`, `t` and `flash` for each awake foe and the boss. `t` is the time in the move, and `flash` the steps of flash left.
- The explorer's `teleport`, `draw`, `stats` and `tick(s, 'live')` stay. `tick(s, 'live')` reads the pad on every step in every mode, also in cards and on the loading screen. `?fresh` starts with a fresh run save and a fresh explorer save. `?nodraw` makes `go()` skip its draw, for e2e steps that need no picture.
- **Length.** A winning run should take 8 to 15 minutes for a person. That is an estimate only, and no test checks it. The spec checks a bot measure instead. At skill 0.5, the median winning run that takes every wisp lasts 6 to 12 minutes of game time. B's flat-ground sim takes 5.7 minutes. It walks each route at 55% of run speed and takes only the wisps less than 15 m off the route. The nine wisps that it leaves are 177 m off the route in all. Going there and back at the same speed adds about 1.7 minutes, so a run that takes every wisp comes to about 7.4 minutes. That is inside 6 to 12.
- **Bot time.** Every pacing target is about the first win, so a bot plays until its first win, or 12 runs. With 60 bots that stop at the first win, the check plays about 630 runs: 60 bots, about 3.5 runs each, at 3 skills. A winning run that takes every wisp is about 7.4 minutes, or 26,600 steps. The 630 runs are about 180 wins and 450 losses. Most losses end in the first two places, so we take a loss as about a quarter of a win, 6,900 steps. So the check is about 180 × 26,600 + 450 × 6,900, or 7.9 million steps. That is a mean of about 12,500 steps a run. The review's `stepbench.mjs` gives 0.04 to 0.07 ms a step for 7 bodies with the controller fixes. That is before any foe thinks or any sight test runs. At 0.05 to 0.08 ms a step, one core takes 7 to 11 minutes. So the bot spreads its bots over the 4 cores with `worker_threads`, which gives about 2 to 3 minutes. If a loss is half a win, the check is about 10.8 million steps, and 4 cores take about 2.2 to 3.6 minutes. After the bot works, the build times 10 bots at skill 0.5 on the final walk maps and writes the result here.

### The step
The page steps the game at a fixed 1/60 s, as many steps as the frame took, like `public/lab/kit/loop.js`. It takes up to 15 steps (0.25 s) a frame. A safe time of 0.28 s cannot be kept with steps of up to 1/30 s. The step count comes from a pure function in `run.js`, so Node tests it at 30, 60, 120 and 144 Hz. It adds each frame's time to `acc`, takes n = floor(`acc` × 60 + 10⁻⁶) steps, and takes n/60 from `acc`. A plain floor gave 599 steps in 10 s at 144 Hz, and each press at a multiple of 1/6 s came one step late. The cause is that 24 × (1/144) × 60 floors to 9 in floating point. With the small term, 1,440 frames of 1/144 s give 600 steps (`stepcount.mjs` in the scratch folder). "Speed" above now gives this step, for the run and for Wander.

A move time that is not a whole number of steps rounds to the nearest step. For example, the cut's active 0.08 s is 5 steps, and its recovery of 0.26 s is 16 steps. So the spec's move timings allow ±1 step. Effect times are given in whole steps.

There are two clocks. The game clock counts every step. The play clock counts the steps outside hit stop. Moves, wind-ups, recoveries, safe time, cooldowns and the hold all run on the play clock. Effects run on the game clock. `sounds()` logs both. A test that plays the same presses at 30, 60, 120 and 144 Hz puts each press at a multiple of 1/6 s. That is the shortest time that is a whole number of frames at all four rates. A frame reads the input before its steps, and a press counts on the first step after it is read. So a press read by the frame that starts at k/6 s counts on step 10k + 1 at every rate.

### The lamplighter's moves
| Hit | Wind-up | Active | Recovery | Damage | Reach | Arc | Lunge | Push on the foe |
|---|---|---|---|---|---|---|---|---|
| 1, cut | 0.10 s | 0.08 s | 0.24 s | 10 | 1.8 m | ±45° | 0.45 m | 0.4 m |
| 2, cut | 0.10 s | 0.08 s | 0.26 s | 11 | 1.8 m | ±50° | 0.45 m | 0.4 m |
| 3, finisher | 0.20 s | 0.10 s | 0.40 s | 22 | 2.1 m | ±70° | 0.8 m | 1.2 m; a light foe is knocked down for 0.6 s |

- **The string.** A press is kept for 0.15 s. The next hit can start 0.10 s into the recovery of the hit before, also the first cut after a finisher. The string starts again 0.35 s after the recovery of the last hit ends. A full string is 43 damage in 1.26 s, about 34 a second. Holding Attack goes on with the string.
- **Hit it while it recovers.** From the first press, the cuts land at 0.10 s and 0.38 s, and the finisher at 0.76 s. So two cuts land in a Snuffer's recovery of 0.7 s, for 21 damage. The finisher lands just after that and knocks the Snuffer down for 0.6 s, to 1.36 s. The next cut starts at 0.96 s and lands at 1.06 s, inside the knock-down. The four hits deal 10 + 11 + 22 + 10 = 53. So that cut puts out a Snuffer of 50 health.
- **Reach** is from the lamplighter's centre to the foe's edge. The lunge runs through the per-body `PARAMS` copy (run = walk = v, accel 400, turnRate 0), so walls still stop it. It stops 0.25 m short of the target's edge.
- **The lunge check.** The spec's check starts 2.1 m from the edge of a Snuffer held still, so the hits do not push it. The gaps at the three hits are then 1.65, 1.20 and 0.40 m. So each hit is in reach, and no lunge is cut short. From 1.5 m, the finisher's lunge would stop at 0.25 m and move only 0.35 m.
- **Time to kill, swinging only (B's sim):** Snuffer 4 hits in 1.54 s, Pitchrook 3 hits in 1.26 s. Mirelight 2 hits in 0.56 s, Ironback 9 hits in 3.78 s. The sim waits for the finisher's whole recovery. With the early start after a finisher, the Snuffer's fourth hit lands at 1.06 s. That keeps a normal foe under the 3 s that we read from Bénard's two-second rule, scaled for our fewer kills.
- **Roll.** 0.36 s at 9.0 m/s, then the speed is cut to 4.5 m/s: 3.51 m in all. It is safe from 0.02 to 0.30 s. The next roll can start 0.25 s after one ends. The direction is fixed at the start: the stick or keys, or straight back from the facing. It passes through foes and slides along walls. It stops at a drop of more than 3 m unless the stick pushes over. It cancels a wind-up (the hit is lost) or a recovery, never active time.
- **Plunge.** Attack with the feet 0.8 m or more over the floor starts it. It hangs for 0.08 s, then falls straight down at 16 m/s. The landing hits within 1.6 m for 16, plus 3 a metre over 1 m, up to 28. It pushes 1.5 m out and knocks light foes down. Its recovery is 0.30 s. Lower, Attack does the first cut with no lunge.
- **The plunge's pose.** The blade points down in both hands, and the lantern swings up behind on its arm. It is not a seated drop, and it copies no game's pose. A short hang before a fall straight down is a common timing, so the pose is what makes it ours.
- **Flask.** 2 at the start. A drink takes 0.8 s at 1.5 m/s and heals 35% of the maximum at its end. At full health, Heal keeps the flask, and a toast says that health is full. A hit or a roll stops it and keeps the flask. Every lit beacon fills all flasks, and the fifth wisp of a place fills one. Foes never drop health.
- **Hurt.** 0.25 s with no control, and a push of 1.2 m (the dash method at 4.8 m/s, so walls stop it). The Ironback's charge pushes 3 m instead, at 12 m/s for the same 0.25 s. It is safe for 0.9 s from the moment of the hit. The figure hides and shows every 4 steps (0.067 s), or every 8 steps (0.133 s) with reduced motion. There is no damage by touch. Bodies push apart as a velocity before each step, but not during a roll.
- **Fall.** Below y −25, the lamplighter comes back on the last firm ground and loses 10 health, never below 1. The last firm ground is the last point where the feet stood at least 1 m from a ledge.
- **Hit tests.** Every attack, the lamplighter's and the foes', tests its hit on each of its active steps, until it hits once.
- **Soft aim.** A candidate is a foe within 4.5 m to its edge, inside ±70° of the held direction, or ±100° of the facing with no direction. The lamplighter must see it. The walk map's sight test runs from its eye, 1.2 m up, to the foe's chest, 0.9 m up. A batch of 10,000 tests takes 16 to 18 ms. The score is the distance plus 2 × the angle in radians. The current target stays while its score is within 0.75 of the best. Each hit turns up to 75° toward it. The mouse aims as the keys do.
- **The sight test.** The line is clear when every point on it, 0.25 m apart, is out of the walk map's solids. A point must be above the floor under it (`walk.support` is not null). Where there is a gap, it must also be below the gap's underside, the third layer. Tested against the top alone, the line would be blocked under arches and tree crowns, where the controller now lets the feet go.
- **No guard and no parry.** A parry needs a fifth phone button and a short window. Touch delay and tests at 1 frame a second both make that window hard. The roll answers every attack.

### The foes
Each foe is `makeBody(walk, …, {...PARAMS, radius, walk, run, accel: 18, jumpV: 0, stepUp: 0.35, turnRate: 6})`. On the controller fixes, 7 bodies cost about 0.04 to 0.08 ms a step (the review's `stepbench.mjs`). A probe 0.7 m ahead (`walk.support`) stops a foe 0.62 m before a pit. A foe notices the lamplighter within 8 m with sight, or within 3 m without. It chases within its leash L plus 8 m, walks home after 4 s outside, and does not heal at home. It never walks out of L. Only an Ironback's charge and a push move a foe past it.
- **Off its ground.** A foe is off its ground when it is outside L, or more than 2 m below its zone's centre. The pushes (1.2 m from the finisher, 1.5 m from the plunge) can put it below a ledge. A foe with a step of 0.35 and no jump cannot climb back. If it is not home 4 s later, it sinks over 0.6 s and rises at a home spot over 0.9 s, with its health. A guard foe pushed off The Bell Knoll's 4.5 m terrace is home again in about 6.1 s. So a beacon is never left with its keeper out of reach.

| | Snuffer (light) | Pitchrook (light, thrower) | Mirelight (light, floats) | Ironback (heavy) |
|---|---|---|---|---|
| Look | hunched, soot rags, 1.4 m, ember eyes under a hood, a 1.8 m iron snuffer pole whose cup holds the tell glow | tall and thin, 1.7 m, a beaked mask, a ragged feather cape, a pot of burning pitch, a coal in hand | a pale flame the size of a head, a fire-red core, three soot tails, 1.3 m up | broad, 1.9 m, a cracked bronze bell as a shell, fire in the crack, small head, thick arms |
| Bones | 8: body, head, legL, legR, armL, armR with the pole, shadow, tell | 15: the 8, the flying coal, and its ring in 6 slices | 10: body, core (tell), tails, shadow, and the ring in 6 slices | 19: the 8, a lane in 5 pieces of 1.4 m, and a ring in 6 slices |
| Splats (target) | 3,300 | 3,700 | 1,300 | 4,600 |
| Radius, health | 0.40 m, 50 | 0.40 m, 30 | 0.35 m, 14 | 0.70 m, 120 |
| Speed | 1.6 m/s, closes at 3.4 | 1.6, keeps 5 to 9 m, backs off under 3.5 | 2.6, flies over water and pits | 1.2 |
| Attack | hook within 3.2 m: wind-up 0.55 s (tracks at 1.2 m/s), active 0.15 s with a 1.0 m step, reach 2.2 m plus the step, ±60°, 16; recovery 0.7 s | lob from 3 to 11 m: wind-up 0.80 s, flight 0.65 s onto a ring fixed where you stood at the start, 0.2 to 1.4 m, 18; recovery 0.4 s | pulse within 2.0 m: wind-up 0.70 s, a 2.2 m ring (±1.8 m of height), 18; drifts back 3 m, again after 1.6 s; it does not die | charge from 3 to 9 m: wind-up 0.90 s, 10 m/s for 0.7 s, 24 and a 3 m push; it stops dead at a wall, at a drop of more than 0.6 m, or 3 m past the leash; recovery 1.4 s. Slam within 2.8 m: wind-up 0.75 s, a 3.0 m ring, 20; recovery 1.1 s |
| Tell | the pole swings back, the cup glows, the body leans back 15°, a metal scrape | the coal arm rises, the coal glows, an ember ring grows, a rising whistle | it swells to 1.6×, the core turns white-hot, a fire ring grows, a hum from 220 to 440 Hz | two scrapes with the head low, the crack glows, an ember lane of 1.6 × 7 m grows; for the slam, it rears up and a ring grows |
| Cooldown | 0.8 to 1.4 s | 1.6 to 2.2 s | 1.6 s | 1.0 to 1.6 s |
| Weakness | the recovery; the finisher or a plunge stops its wind-up | 30 health, cannot jump, turns slowly | two cuts or a plunge | a charge into a wall stuns it for 2.0 s, and it takes +50% |
| Glim | 3 | 4 | 2 | 8 |
| From | the Gaol (alone there) | the Crow Wall | the Fen | the Bells |

- **The wind-up rule.** A plain hit never stops a wind-up. The finisher and the plunge stop the wind-up of a light foe. Outside a wind-up, a light foe flinches for 0.4 s, at most once every 1.5 s. Heavy foes and the boss never flinch. When every hit stopped a wind-up, B's sim showed a pack of Snuffers that never landed a hit, even on a bot that never rolled. The spec's check: in 10 s with seed 7, at least 3 hooks hit a bot that swings at three Snuffers and never rolls.
- **Tokens.** At most 2 melee attacks at once, and 1 coal in the air. A foe without a token holds at 3.5 m and spreads round the lamplighter.
- **Off the edge.** A foe knocked more than 6 m below its zone, or under y −25, is put out. Its glim drops on the last firm ground it stood on, so the player can take it.
- **Zones.** A zone wakes within 10 m of its centre when it fits. It fits when its foes and the awake foes together are no more than 6. The pool must also have a free slot of the right type for each of its foes. "Fewer than 6 awake" alone would let a zone of 3 bring the count to 8 in the Fen, whose pool has 8 slots.
- **The rise and sleep.** When a zone wakes, ember cracks show for 0.6 s. Then its foes rise over 0.9 s, and they cannot hurt or be hurt in the rise. A zone sleeps beyond 16 m when its foes are home, and that frees its slots. A living foe keeps its health. Home spots are 1.2 m apart, within 1.5 m of the centre.
- **Guard zones always wake.** A guard zone that does not fit takes slots from other awake zones, the farthest zone first. Only a zone whose slots help goes. It helps when it holds a foe of a type for which the pool has too few free slots for the guard zone. It also helps when the cap of 6 stops the guard zone. That zone sleeps, and its foes keep their health. They sink over 0.6 s while the guard zone's ember cracks show, over the same 0.6 s. Then the guard zone's foes rise. So the rise starts 0.6 s after the wake, and the spec's check allows 1.6 s. See "Guard zones" in Numbers we checked for the case that needs it.
- **Ember cracks.** The spark pool draws them: 24 splats for each foe, in short lines on the ground. They are in fire slots 34 and 35, and they flicker and fade. The Snuffer has no ring bone, so the cracks cannot be a bone of the foe. A zone of 3 uses 72 of the pool's 256 splats for 0.6 s.
- **Put out.** A foe put out stays out until the run ends or a reload restarts the place. The run keeps a set of foes put out for the current place only. The save does not hold it, because a reload restarts the place.

| Place | Zones (S Snuffer, P Pitchrook, M Mirelight, I Ironback), centre and leash L | Ground in the leash | Pool |
|---|---|---|---|
| Gaol | G1 yard south (0.3, −2.29, 11.8) L 3.8 S · G2 by the cells (−5.5, −2.29, 4.5) L 4.3 SS · G3 lower lane (−3, 0.31, −6.5) L 4 SS · G5 keep, guard (2.3, 4.21, −23.8) L 3 SSS | 45 · 58 · 38 · 28 m² | 5 S |
| Crow Wall | R1 (−4.3, −0.7, 11.3) L 5 SS · R2 (−1.5, −1.01, −3.8) L 5 SS · R3 west flank (−14.3, 0.18, −4.8) L 4.4 P · R4 by the broken wall, guard (−18.8, 0.15, −15.3) L 5 SSP | 79 · 78 · 61 · 79 | 4 S, 1 P |
| Fen | F1 wading (4.5, −0.49, 7.6) L 3 MM · F2 east pool (7, −0.49, −3.8) L 3 SM · F3 north shore (−8.3, 1.59, −8) L 3 S · F4 mill, guard (8.3, 1.86, −18.3) L 3.5 SSP | 26 · 27 · 28 · 39 | 4 S, 3 M, 1 P |
| Bells | B1 vale (−0.5, −0.04, 12) L 4.5 I · B2 side path (9.5, 0.56, 9.5) L 3.5 SSM · B3 under the clock hill (−11.3, 0.59, 12) L 3.3 PM · B4 terrace, guard (3, 4.5, −12) L 3 SP | 63 · 38 · 34 · 17 | 3 S, 1 M, 1 P, 1 I |
| Barrows | W1 (0, 1.06, 14.3) L 5 SS · W2 hollow (1, 0.18, 3.5) L 5.5 IS · W4 before the gate (−0.5, 1.52, −4.8) L 3 PM · the arena (18, 0.68, −22) L 6.5, the boss | 78 · 95 · 28 · 133 | 3 S, 1 I, 1 P, 1 M, the boss |

The zones come from the page survey's `check-zones.mjs`. Every zone is reached from the start. The worst point in a place has 6 to 8 foes in range. All such points are off the route, and there the cap of 6 keeps a zone asleep. The survey ran on today's walk maps, before the guard rule. The script is in the session's scratch folder. So the first combat-run task ports it into `qa/lab/gloam-downs-zones.mjs`, with the guard rule and the Ironback walls, and runs it on the final walk maps. `gloam-downs-run.test.mjs` imports it for the zone scenarios.

The table has one home: `games/gloam-downs/lib/zones.mjs`. It holds each zone's centre, leash, foe types, guard flag and keeper name. It comes first, before the port, so the zone test can read it before the bake writes zones. The biomes' `ctx.zone()` takes the zones from it. Once the zones are baked, the zone test reads each `<id>.json` and fails if its `zones` differ from the module.

The bake writes zones into `<id>.json` through a new `ctx.zone()`. So of each place's three files, `<id>.bin.gz` and `<id>.walk.bin.gz` do not change, and `<id>.json` gains `zones`. The bake is deterministic. So a test bakes a place with its zones and again without them. It checks that the two `.bin.gz` files and the two walk files are the same. It also checks that the two `<id>.json` files differ only in `zones`. This test does not depend on old hashes, so the controller fixes may still rebake the walk maps.

Today `save()` in `bake.mjs` always writes into `public/lab/gloam-downs/worlds/`, and there is no way to leave the zones out. So the bake gains `--no-zones` and `--worlds <dir>`, and `save()` takes the folder. A bake takes 16 to 21 s a place (the round 5 bake logs). So the Node test bakes only the Gaol, twice, into `os.tmpdir()`: about 40 s. `node qa/lab/gloam-downs-bake-zones.mjs` does all five places, one bake at a time, in about 3.5 minutes.

### The boss: the Barrow Reeve
- **Look.** It is 3.4 m tall and gaunt, in a long cloak of barrow earth and roots in the place's own darks. A crown of six iron spikes echoes the summit's six stones. A rib-cage lantern in its chest holds a pale-green caged light (wisp slots 38 and 39, never slot 40). Its long iron crook has a hook that glows fire in a wind-up. It is never brighter than the beacon fire.
- **Bones.** 12,600 splats on 46 bones. The body has 13 bones: `body`, `cloak`, `head` (with the crown), `cage`, `light`, `armL`, `handL`, `armR`, `crook`, `crookTip`, `legL`, `legR` and `shadow`. The cloak has second-bone weights in steps of 1/8. The caged light has its own bone, because it rises and rides at the lantern after the boss breaks apart. The markers have 33: `ring1` to `ring6`, `lane1` to `lane6`, `shard1` to `shard3`, and six slices for each of the three shard rings.
- **The shard rings.** Each is a flat ring of 1.3 m, about 200 splats, like the Pitchrook's ring of 1.4 m (about 220). A ring must stay on the ground while its shard flies, so a shard bone cannot carry it. The cage slam keeps the six `ring` slices for its ring of 3.4 m, and the lunge keeps the six `lane` pieces. The three rings add about 600 splats. Marker pieces add bones but no splats: the page poses them, so they add no keyframes.
- **The crook sweeps' marker.** The sweep and the double sweep show the front three slices of the slam's ring, grown to 4.0 m over the wind-up. That marks the sweep's ±90° and its reach, with no new splats. "Enemy Attacks and Telegraphing" asks for a marker for each area attack.
- **The sweep's facing.** In a sweep's wind-up, the boss turns toward the lamplighter at no more than 1.5 rad/s. It holds its facing from 0.3 s before the hit, and the slices stop with it. So the sweep hits only inside the slices that the player saw. In the 0.8 s wind-up it can turn for 0.5 s, up to 0.75 rad. The double sweep's second sweep grows its own slices over its 0.6 s wind-up, and holds for its last 0.3 s.
- **Arena.** The east foot of the crown at (18, 0.68, −22). It has an open radius of 6.6 m, and 133 m² inside a leash of 6.5 m, at heights 0.22 to 1.32. It is 14.9 m from the beacon across the ground and 10.5 m below it, and it can be seen from the start. No other zone is within 25 m, and there is no wall. Twelve grave candles at r 7.0 m light at the intro. The lamplighter is in the arena while its centre is within 7.0 m of the arena's centre. The intro, and the pause for the boss files, start within 11 m of that centre. So after the intro, the boss camera starts only when the lamplighter first comes within 7.0 m. Between 7 and 16 m, the combat camera counts the boss as an awake foe.
- **The boss camera wins.** In the boss fight, the boss camera takes the place of the combat camera.
- **Intro.** The first time in a visit within 11 m, the game stops for 2.4 s. Bars ease to 0.12, and the zoom goes to 1.15. The arrival card has three lines. They are "V · The last light of the downs", "The Barrow Reeve", and "It holds that light in a cage of ribs." Then the bars ease out over 0.5 s, and the boss bar shows.
- **Other zones at the intro.** At the intro, every other awake zone sleeps, and its foes sink over 0.6 s. At 11 m from the arena, the lamplighter can still be 14.3 m from W4, inside W4's sleep range of 16 m. The sort figure for the boss fight assumes that the other slots are parked, and this rule makes it so.
- **Phases.** 1,300 health: phase 1 to 800, phase 2 to 350, phase 3 to 0. At each change it stumbles for 2.0 s and takes no damage. The cage flares, and the camera kicks 0.2. A test that sets the boss's health with `set` gets one stumble, however many thresholds the change crosses.

| Attack | From | When | Wind-up and tell | Hit | Recovery |
|---|---|---|---|---|---|
| Crook sweep | phase 1 | within 4.0 m and ±100° in front | 0.80 s: the crook goes back over the shoulder, the tip glows | 0.20 s, ±90°, 4.0 m, 18 | 1.0 s |
| Cage slam | phase 1 | within 3.5 m; when you are behind it, unless its last two attacks were slams | 1.00 s: it rears up, lifts the cage, a ring grows to 3.4 m | 22, kick 0.25 | 1.5 s on one knee, ×1.5 damage |
| Lamp-shards | phase 2 | 3.5 to 9 m | 0.90 s: the cage pulses; three rings of 1.3 m grow on the shard-ring bones, at you and 2.5 m to each side | flight 0.6 s, 14 each, only inside a ring | 0.8 s |
| Stalking lunge | phase 2 | over 6 m | 0.70 s: it crouches with the crook forward; a lane of 1.6 × 9 m grows | 13 m/s for 0.69 s, 20, stops at the leash | 1.0 s |
| Double sweep | phase 3 | as the sweep | the sweep, then a second wind-up of 0.6 s the other way | 16 | 1.2 s |

- It picks from where the lamplighter is, which reads better than a planned pattern (Team Cherry on Silksong). It never uses the same attack three times in a row. Gaps: 1.0, 0.75 and 0.55 s. Walk: 1.8 m/s, and 2.4 in phase 3. Largest hit 22.
- At 6 to 9 m in phase 2, both the shards and the lunge can come. Beyond 9 m, only the lunge can come. So the spec's check stands 10 m from a boss at the arena's edge.
- It is a test of the four tells learned on the way. The sweep is the Snuffer's hook, the shards are the Pitchrook's rings, the lunge is the Ironback's lane, and the slam is the Mirelight's ring.
- If the lamplighter leaves, the boss walks back and keeps its damage.
- **The fall and the light.** The last hit has the full hit stop of 9 steps, and the bars come in over those steps. Then the bars ease out over 30 steps, so they are gone while the light is carried. They come in again over 30 steps when the last beacon lights. One white grade flash of 6 steps (0.1 s) shows, and none with reduced motion. The boss breaks into its bone parts. The caged light, emissive boned splats on its own `light` bone, rises and then rides at the lantern. The boss's 30 glim go to the glim carried. A toast says "Carry the light to the beacon". After the fall, no zone of Barrow Crown wakes. The 15.9 m walk would wake none anyway: the nearest, W4, is 13.0 m from the beacon, beyond its 10 m. The page stores the run at once with `bossDown` (see The run). Touching the beacon lights it and stops the run clock. It banks the glim carried, the boss's 30 among it, and shows the win card 1.8 s later.

### Glim, wicks and upgrades
- **Glim** drops as motes in the lamp colours, from the spark pool. They fly to the lamplighter from within 6 m after 0.4 s. A run holds 254: Snuffer 3, Pitchrook 4, Mirelight 2, Ironback 8, wisp 4, boss 30.
- **Wicks.** At each of the first four beacons, the seed draws two of the wicks that the run has not chosen. It draws from 6, then 5, 4 and 3. A wick offered but not chosen can come back. So the Gaol's offer depends on the seed alone. Each later offer depends on the seed and the wicks chosen before it. The draw uses its own stream of the seed, so the foes' choices do not move it.

| Wick | Effect for the rest of the run |
|---|---|
| Long wick | +20 maximum health, and heal 20 now |
| Keen edge | +15% blade damage |
| Quick heels | the roll's cooldown falls from 0.25 to 0.12 s |
| Heavy fall | plunge damage ×1.5, and its ring grows from 1.6 to 2.0 m |
| Spare oil | one more flask, full |
| Close shave | an attack that passes in the roll's safe time makes the next hit within 1 s deal +50% |

- **Upgrades** are sold in the Lamp-room before each run and from each beacon card. A buy at a beacon works at once. A Mantle level bought in a run raises the maximum health and the health by 15. A Flask level bought in a run adds a full flask. From a beacon card, the Lamp-room shows Back to the beacon in place of Begin the run and Wander.
- **Bonuses add.** Edge, Keen edge and Close shave add their percentages, so Edge 3 and Keen edge give +51%. Edge and Keen edge raise the plunge too. Then a foe's own factor multiplies: ×1.5 on a stunned Ironback, and on the boss after its slam. Heavy fall multiplies the plunge by 1.5. Damage rounds to the nearest whole number once, at the end. So the first cut deals 15 and the finisher 33. A plunge of 2 m with Edge 3, Keen edge and Heavy fall on a stunned Ironback deals 19 × 1.51 × 1.5 × 1.5 = 64.55, so 65.
- **Draught** adds 10 percentage points of the maximum health to each flask's heal, so 35%, then 45% and 55%. At 145 maximum health, 55% heals 79.75, so 80. Heals round as damage does.

| Upgrade | Effect | Costs |
|---|---|---|
| Mantle | +15 maximum health (100 to 145) | 40 · 80 · 140 |
| Flask | +1 flask (2 to 4) | 60 · 150 |
| Edge | +12% blade damage (to +36%) | 50 · 100 · 170 |
| Draught | +10 percentage points of heal for each flask (35% to 55% of the maximum health) | 45 · 110 |
| Ash pocket | keep 30% of the glim carried at death | 120 |

All of them cost 1,065 glim, about 4.2 full runs. These are the first levers to tune, in this order: Snuffer damage (14 to 17) and the flask heal (35% to 50%). Then boss health (960 to 1,300), and a beacon heal (0% to 25%). The real-map bot decides, against the pacing targets in the spec.

### Saves and modes
- **The run's save** is its own key, `gloam-downs.run.v1`, with its own `clean()` in `run-save.js`. It holds `{ v, bank, up: {mantle, flask, edge, draught, ash}, runs, wins, deaths, furthest, bestWin, sound, seen, wander, run, ended }`.
- `run` is null, or `{ seed, place, time, hp, flasks, carried, banked, foes, wicks, offer, bossDown, entry: {hp, flasks, carried, foes} }`. `offer` holds the two wicks of a beacon card not yet chosen, or null. `banked` is the glim banked in this run, and `foes` the foes put out in it, for the summary and the win card. `bank` is the bank of all runs.
- `entry` holds no wicks, because a reload never takes a wick away. A wick or a buy raises the entry values by what it gives. The maximum health and flask count come from the upgrades and the wicks, so they are not stored.
- `ended` is null, or the summary of a run whose card has not closed: `{ won, place, time, foes, lost, banked }`. A win sets `won`.
- Unknown upgrades are dropped, and levels are clamped. An `offer` with an unknown wick, or with a wick already chosen, is dropped. The save holds no foe state: a reload restarts the place, with every foe back.
- **The explorer's save**, `gloam-downs.save.v1`, and its `clean()` stay as they are. The page survey suggested that we add the run to that key. But its `clean()` drops unknown fields, so a cached old page would wipe the bank and the upgrades. Two keys stop that.
- **Wander** is the explorer of today with no foes and no sound. It opens from the Lamp-room after the first win, when the explorer's save has `done ≥ 1`, and with `?wander`. `wander: true` in the run's save opens it again after a reload. Begin the run and Go on with the run set it to false. Its Map has a Lamp-room button.
- **Blocked site data.** When `localStorage` throws, the run keeps its save in the page, as the explorer's `main.js` does. No store throws, so a hit or a buy cannot stop the run.
- **A run in progress.** `?wander` can open Wander while a run is saved. Then the Lamp-room shows Go on with the run in place of Begin the run, so the run is not lost. Go on with the run goes on as a reload does.

### Inputs
| | Keys | Mouse | Touch | Gamepad |
|---|---|---|---|---|
| Move, walk | WASD or arrows, Shift | | stick on the left half | left stick, light tilt |
| Look | Q, E | drag with either button | drag on the right half | right stick |
| Jump | Space | | Jump | A (0) |
| Attack | J or Z | left press, at once; hold for the string until the pointer moves 6 px | Attack: tap aims, hold for the string | X (2) or RT (7) |
| Roll | K or X | | Roll | B (1) or LT (6) |
| Heal | L or C | | Heal, with the flask count | Y (3) |
| Face the foe | R | | Look | RB (5) |
| Pause | M, P or Escape | | Map | Start (9) or Back (8) |
| In a card | Tab, Space or Enter; Escape goes back | click | tap | d-pad or left stick, A; B goes back |

- Attack, roll and heal take press edges from the held state, as `s.held` and `padStart` do, with a buffer of 0.15 s. A mouse press sets a latch, so a press between frames is not lost. `?test` `tick` passes held names. An edge is a tick with the name held after one without.
- Shift still walks. In a run, gamepad button 2 attacks; in Wander it walks, as today. A light tilt walks, because `step` reads the stick's size.
- The mouse attacks on the press. A short-click rule (under 250 ms and 6 px) would add up to 250 ms before each swing. A left drag still turns the view, so the explorer's "a mouse drag turns the camera" holds. A left drag in a run starts with one swing. The right button looks with no swing.
- R, Look and RB face the nearest awake foe or the boss within 10 m, or look ahead as today when there is none. With reduced motion, the boss camera does not turn by itself, so R, Look and RB are how the player turns to the boss.
- The Map and Look tools act on a tap and on a mouse click the same way. Map opens the pause panel, and Look faces the foe. A press on a tool stops there, so it does not swing the blade or start the stick or the look drag.
- **Cards.** Today a gamepad has only Start in cards, and Start closes any panel (`closePanels()` in `main.js`). The run needs choices on cards, so the d-pad and the left stick move the focus, and A presses the focused button. In a run, B and Escape go back where a card has a back action: Resume, Back to the beacon, No, or Step back. While End the run asks again, Escape and B choose No and keep the panel, and M, P, Start and the pad's Back do nothing. Before a wick is chosen, Start, the pad's Back, B and Escape do not close the beacon card. So a player with only a gamepad can finish a run.
- **The focus.** When a card opens, its main button has the focus. On the beacon card that is the first wick, and Walk on after the choice. In the Lamp-room it is Begin the run, Back to the beacon or Go on with the run. Elsewhere it is the help card's button, Resume, No, the summary's button, the win card's Lamp-room button or Try again. The d-pad, the left stick and Tab move the focus only between the card's buttons, and wrap at the ends. Without this, Tab reached ◀ Lab first, and Enter there left the game. This is the dialog pattern of WAI-ARIA.
- **A press that closes a card** does nothing in play until it is released. A is also Jump, B also Roll and Space also Jump, and `main.js` reads the pad on every frame. So A on Resume would jump on the first play step.
- **The loading screen.** Today `frame()` returns before `readInput()` while the mode is `loading`, so a pad cannot press Try again. The run reads the pad there too, and Try again takes the focus. This matters for the pause for the boss files, which comes in the middle of a run.
- **Wander's cards** follow the run's focus rules. In the explorer, a pad can close a card only with Start, and it cannot move the focus. So a player with only a pad could not reach the Lamp-room button in Wander's Map, and `wander: true` would open Wander again after each reload. Now the d-pad, the left stick and Tab move the focus, and A, Space or Enter press the focused button. When Wander's Map opens, the focus is on the current place. Escape, B and Start close the help card, the Map and the end card, and M and Start open the Map in play. The explorer e2e checks that Escape closes the help for good.
- **The controls on the cards.** The help card and the pause panel show the controls for the input in use. Today the help card says only "A gamepad works too". The run adds six pad actions, so with a pad the cards list them. A browser shows a pad to `navigator.getGamepads()` only after its first press. So when a pad first shows up on the help card, the card changes to the pad's list. That press does not press Begin the run. Then the second A begins it.

### Cameras in a run
- **The explorer's camera** (`makeCamera` in `play.js`) swings behind a running lamplighter after 0.8 s with no look input. Its follow distance is `camDist()` in `main.js`. That is 8.5 m in landscape, and 8.5 × min(1.5, 1 + 0.6 × (h/w − 1)) in portrait. So it is 12.75 m at 320×640 and 390×844, and 12.47 m at 360×640. The explorer's Look requirement now says that the run's cameras apply in a run.
- The run adds two cameras that turn the view by themselves. In both, the player's look input wins on the same step.
- **The yaw difference.** Both cameras measure the angle from the lamplighter, between the view's forward direction and the direction to the foe or the boss. An angle seen from the eye would be smaller. At 390×844 the view is only about ±9° wide.
- **The combat camera.** While any foe is awake, it replaces the swing behind the lamplighter. A foe from the `spawn` hook counts too. After 0.8 s with no look input, the yaw turns at no more than 0.9 rad/s toward its foe. It stops when the yaw difference is 20° or less. With no foe awake, the explorer's swing comes back.
- **The combat camera's foe.** It takes the nearest awake foe when the turn starts. It keeps that foe until another is 1.5 m nearer, or its foe goes out or goes home. With no margin, two foes at about the same distance would swap from step to step, and the view would swing back and forth. The aim has its own margin of 0.75.
- **Moves while a camera turns.** Movement is relative to the camera. A player who holds W to run from a foe behind would see the view turn up to 180° at 0.9 rad/s. The path would then curve back into the foe. So while the combat camera or the boss camera turns by itself, a held move keeps the world direction it had when the turn started. That stops when the input turns by more than 20°, or is let go. The explorer's swing needs no such rule, because it turns toward the direction of the run.
- **The boss camera.** In the boss fight, it takes the place of the combat camera. It aims at a point on the line from the lamplighter to the boss, 1.15 m up. Its distance is at least 1.25 times the follow distance and at least 12 m: 15.9 m on the phones and 12.0 m in landscape. It is at most 24 m. Within those limits it picks the aim point and the smallest distance that keep the frame clear. Its own ease reaches them in 60 steps (1 s). The follow camera's ease of 2.5 per second would reach only 15.68 m in 1 s, so it does not apply. The boss camera is on while the fight has started, the boss is up and the lamplighter is within 7.0 m of the arena's centre. After 0.6 s with no look input, the yaw turns at no more than 1.5 rad/s, until the yaw difference is 15° or less. When the boss falls or the lamplighter leaves the arena, the camera eases back over 1 s.
- **The frame.** The frame is clear when the lamplighter's chest and the ground within 1.3 m of its feet are inside the screen. They must also be under no touch button, the HUD or the tools. The boss's head, chest and feet have the same rule. They must also be in the middle 80% of the width and below the Lab bar row. The ground within 1.3 m of the feet is where a shard ring falls.
- **Why a frame.** The second draft aimed at a fixed 0.35 of the way, and the review found the feet under the controls. On flat ground (`framing.mjs`), the ring at the feet went under a touch button at 320×640 in 31 of 69 cases. It went under the bottom boss bar at 1280×720 in 33 of 69. With the boss 13 m away in landscape, the feet sat at 93% of the half-height. The frame rule needs these distances, with the boss 2 to 13 m away and a yaw difference up to 15°:

| Layout | Follow distance | Least distance | Largest distance the frame needs |
|---|---|---|---|
| 320×640 | 12.75 m | 15.9 m | 20.2 m |
| 360×640 | 12.47 m | 15.6 m | 19.8 m |
| 390×844 | 12.75 m | 15.9 m | 15.9 m |
| 800×600 | 8.5 m | 12.0 m | 12.0 m |
| 1280×720 | 8.5 m | 12.0 m | 12.0 m |

- These needs use rects for the HUD and the tools, as x,y w×h in px. The spec's "The HUD in the boss fight" gives the same rects. The HUD is 10,60 180×88 at 320, 220×88 at 360, 250×88 at 390, and 262×91 at 800 and 1280. The tools are 98×44 at 10 px from the right, at y 60. The layout e2e checks that the real HUD in the boss fight fits them.
- **Why the HUD is smaller in the boss fight.** The first table used a HUD of 180×88 at every width. The review measured the widest HUD with the page's CSS in Chromium. It was 180×135 at 320, 220×135 at 360 and 250×117 at 390. It was 346×133 at 800 and 1280. With that HUD, the frame needs 26.9 m at 320 and 26.8 m at 360, over the cap of 24 m. Even a HUD of 99 px with one health row needs 21.4 m. So at 520 px wide or less, the health line is one tight row, and the HUD is at most 88 px tall. In the boss fight the hint hides, so in landscape the HUD is at most 262×91.
- At 320 and 360 wide, a closer camera puts the boss's head under the HUD and the ring at the feet under Attack and Heal. At 20.2 m the lamplighter is about 10% of the screen's height, about 30 art pixels on a phone (an estimate).
- **The boss bar moves to the top.** In every layout, the boss bar is in the Lab bar row. At the bottom centre it covered the feet in landscape. At the top, the frame keeps the boss's head below it.
- **The real arena** (`arena3.mjs`). At 481 pairs of points in the arena, 3 to 9 m apart, the crown's slope pulls the camera in at 104 to 123 pairs. Then the pitch eases up from 0.34 to 0.55, as the review suggested. With that, both chests are inside 80% of the half-width and inside the screen's height at 98.5% to 99.8% of the pairs, in each layout. The spec's pass is 95%.
- The worst start is a yaw difference of 180°. It needs 0.6 + 2.9 / 1.5 = 2.5 s, so the spec's check steps 3 s. Round the boss at 5 m, a run of 6.4 m/s needs 1.28 rad/s, under the turn of 1.5 rad/s.
- **Walls and hills.** Both cameras still come closer in front of a hill or a wall, as the explorer's does.
- **Reduced motion.** Neither camera turns by itself. The boss camera still aims and pulls back over 1 s, because that does not turn the view.
- Both cameras are pure functions of the camera state in `play.js`. So the Node test checks the turn rates, the stops and the hand-back to look input.

### HUD and layouts
- The HUD gets a line under the place. It has a health bar of 120 × 10 px in ember with its number ("74/100"), and a CSS pip for each flask. At 520 px wide or less, the line is one row. It has a 12 px number, a bar of 56 × 8 px and pips of 6 px. The count line reads "◆ 2/5 wisps · ● 18 glim". On phones the HUD grows from 57 to 88 px tall, and no more. Below 30% health, the bar pulses at each heartbeat.
- Above 520 px wide the hint line stays, so the HUD is taller still. In the boss fight the hint hides. A long centred toast at `sat + 116px` would then overlap it at 800×600. So the page places the toast 8 px under the HUD's measured bottom (`getBoundingClientRect`) at every width, and again when the HUD changes size. The HUD's bottom is lower than the tools' bottom in every layout, so the toast also clears the tools. The page survey measured the overlap without this move.
- The boss bar is a name and a bar, in the Lab bar row in every layout. On touch it runs from x 85 to 8 px left of Games. There it is at most 360 px wide and 44 px tall, about 144 px at 320. With a fine pointer it is centred between ◀ Lab and Games, at most 520 × 44 px.
- No third button joins the tools row: at 320 it would meet the HUD, whose right edge is at 188 px. The sound switch is in the pause panel.
- Off-screen notches are small HTML shapes of our own at the screen edge. The page places them with the camera maths of `view.mjs` (38° field of view). A foe to the side gives a notch at the left or right edge. A foe behind the eye gives one at the bottom edge. At most 3 show. In portrait the view is only about ±9° wide, so a foe 2.5 m beside the lamplighter is off screen at 390×844.
- A notch fills from empty to full over the wind-up, so its fill shows the time left. At 390×844 the view shows only about 2 m to each side of the lamplighter. So foes that wait at about 3.5 m are often off screen, and the notch is the only warning that the player sees.
- A touch on a dark beacon while its keepers stand also shows a notch for 3 s. It points to the guard zone's centre, or to the arena's centre at Barrow Crown.
- A notch overlaps no touch button, the HUD, the tools, the toast or the boss bar. On touch, a notch at the bottom edge sits 8 px or more above the buttons' top. At 390×844 that is y 656 or less, because Attack starts at y 664. A notch at the right edge sits between the tools and the buttons.
- **The HUD at its widest.** Mantle at level 3 and Long wick give 165 health. Flask at level 2 and Spare oil give 5 flasks, and the Heal button shows up to 5. At 320 the HUD is at most 180 px wide (100vw − 140 px). "165/165", the bar of 120 px and 5 pips would need about 240 px. So at 520 px or less, the line uses the small bar. So the overlap check runs with 165/165 health, 5 of 5 flasks, 5/5 wisps, 254 glim, a boss bar and a toast of 60 characters.
- Touch buttons are a right-thumb group at the bottom right, measured by the page survey (x,y w×h in px). Windows 660 px tall or less use the small sizes.

| Layout | Attack | Roll | Jump | Heal |
|---|---|---|---|---|
| 320×640 | 228,480 76×76 | 160,562 60×60 | 240,564 64×64 | 168,498 48×48 |
| 360×640 | 268,480 76×76 | 200,562 60×60 | 280,564 64×64 | 208,498 48×48 |
| 390×844 | 290,664 84×84 | 214,750 64×64 | 302,756 72×72 | 226,682 52×52 |
| 800×600 touch | 708,440 76×76 | 640,522 60×60 | 720,524 64×64 | 648,458 48×48 |
| 1280×720 touch | 1180,540 84×84 | the same rules | | |

The stick keeps the left half below the HUD: 160 × 492 px at 320×640. The overlap check found no overlap with the Lab bar, the HUD, the tools, the toast or each other.

### Rendering
The run changes no renderer file and no place file. It uses the paths that the lamplighter already uses.
- **The foe files and the boss files.** A new `foes` target in `bake.mjs` sculpts each foe type once, with its own sculptor and a neutral moonlight, on its own bones. It writes `worlds/foes.bin.gz` with the splats. The four types have about 12,900 splats, so the file is about 96 KB at the measured 7.47 B a boned splat.
- It also writes `worlds/foes.json.gz`: the types, splat ranges, bone names, pivots, and pose keyframes sampled from `K.acts.frames('windup' | 'attack' | 'hurt' | 'dodge')`. The keyframes are many numbers, so the JSON is gzipped, and it counts in the 200 KB.
- The boss goes in `worlds/boss.bin.gz` and `worlds/boss.json.gz`. With the cloak's weights in steps of 1/8, the splats are about 106 KB. The JSON adds perhaps 10 to 20 KB, so about 116 to 126 KB in all. Weights stored exactly would make the splats about 125 KB. So the cap is 140 KB, and the first boss task measures the files. If they are over, the boss drops to 11,000 splats. The page fetches them while The Bell Knoll plays.
- **Download.** The explorer gives each place 1.5 MB. Its check in `lib/check.mjs` counts only the splat and walk files today, so the run's check adds the place's JSON. With their JSON, today's places are 1.324 MB (Gaol) to 1.485 MB (Barrows). The JSON is 3.4 to 5.9 KB, and the zones add about 1 KB. The controller fixes add a third walk layer of 0.8 to 2.6 KB. So the Barrows come to about 1.489 MB.
- The foe files and the boss files do not count toward the 1.5 MB. Before play starts in a place, the page loads only the place's three files and the two foe files. It skips the foe files when the cache has them. A place of 1.5 MB with foe files at their 200 KB limit is 1.7 MB, the spec's limit. With the estimated 96 KB foe splat file, the first load of a run is about 1.42 MB before the foe JSON.
- The boss files always load after play starts. They load during The Bell Knoll. After a reload in Barrow Crown, they load while the lamplighter walks to the arena, about 51 m from the start in a straight line. The arena stays asleep until the files are in. If they are still not in at 11 m from the arena, the game pauses and the loading screen shows. When a file failed, it shows Try again and Step back. The loading screen covers the Lab bar, so with no network Try again alone would leave the player no way on. Step back puts the lamplighter at the last point of its path 13 m or more from the arena's centre. Play goes on, and the arena stays asleep.
- **A pool in each place.** When a place loads, `world.js` adds the place's pool to `world.data`. It moves the pool's bone ids after the lamplighter's 7, and parks each slot at density 0. Adding 8 copies took 10.5 ms in Node.
- **Only awake slots ride bones in the sort.** The sorter projects every splat, at density 0 too, and a boned splat costs about four times a plain one. So `world.anim.boned` holds the lamplighter and the awake slots only. A kind-12 splat that is not in `boned` sorts by its rest position. That order is wrong for a splat that draws. But a parked slot is at density 0, and the shader culls it before the bone fetch, so its order does not matter.
- A slot joins `boned` before its density comes back, and leaves it after its density goes to 0. Rebuilding the list is a short `Int32Array` copy. The boss slot is parked like the others until the intro, and in the boss fight the other slots are parked. Measured in "Numbers we checked": 1.39 at worst, against 1.65 with every slot on bones.
- **Colour.** Foe bodies use dark tones that are in no palette, so the resolve snaps them to each place's own darks. The renderer survey checked this in the Gaol and in Barrow Crown only. The Crow Wall has lit colours above the 0.42 floor: 737c36 (0.459) and 987456 (0.476). So has The Bell Knoll: cc9238 (0.595). A foe part that snapped to them would count as a miss there. So a rule in `lib/check.mjs` snaps every foe and boss colour in each of the five palettes. Each must land under 0.42 luminance, or on slots 32 to 39 and 44 to 47. Eyes and tells use the fire slots, and blades the iron slots. The Mirelight and the cage light use wisp slots 38 and 39. Slot 40 (eefff6, 0.983) is brighter than the top fire slot 37 (fff4cc, 0.955), so no foe uses it. Nothing uses the cloak slots, which are the lamplighter's. The run adds no palette colour: all five places use 48 of 48. The foes pass through the same resolve, so they get the same dither, pixel snap and outlines as the places.
- **Tells.** A tell bone carries emissive boned splats in the fire steps inside the weapon, and it grows from nothing over the wind-up. A tell glows steady, with no flicker, because Ink Studio's flames cannot ride bones. So each foe has one tell bone, as the bone lists give.
- **Ground markers.** A ground marker is a boned ring or lane in fire slot 34, with its rim in slot 35. It scales from 0 to 1 over the wind-up. A ring is six slices of 60°, each on its own bone. A lane is pieces of 1.5 m or less, each on its own bone. When the marker is laid, the page fits a plane to the floor under each piece's rim, at 24 points for a ring. The floor is `walk.support` from 2.5 m over the foe's feet, or the water's surface where that is higher. Nothing under the water is drawn. Each bone tilts to its plane, 0.05 m above it. A flat shape that only scales sank into the rolling ground (see "Markers on rolling ground" in Numbers we checked). Slots 32 and 33 (0x3a0f0c, 0x8a2814) are not used for markers, because they are close to the dark ground. Slot 35 is brighter than 0.55, so a rim adds to the bright share. We estimate a full Ironback rim 4 m away at a few hundred art pixels. That is well under the 12% cap (6,900 art pixels at 320×180), and the fight check measures it. Tells and markers are both poses, with no upload.
- **When a marker stops.** A ring or a lane stays in one place from at least 0.3 s before its hit. The Pitchrook's ring stays where it was laid at the start. The Ironback's lane stops 0.3 s before the run starts. The boss's lane stops at 0.4 s of its 0.7 s wind-up, and the shard rings at 0.6 s of 0.9 s. A lane attack hits only a lamplighter whose centre is in the lane. So a walk of 1.5 m to the side of a lane 1.6 m wide is always enough. A walk of 1.5 m away from the boss takes the lamplighter out of the shard rings. The side rings are 2.5 m to the side.
- **Waking and death.** Waking sets the slot's density back: one upload of about 7 to 10 rows of 32 KB. Death breaks the foe into its bone parts, which tumble with gravity and shrink. Then the slot goes to density 0. A hidden bone is scaled to 0 and moved to y −500, because a bone at scale 0 still draws a dot (`u_dilate`).
- **Hit flash.** For 3 steps (0.05 s) of game time, the foe's packed colour is fire step 5. Then the saved colour comes back: two uploads of its rows. A flash timed in frames would last 14 ms at 144 Hz and up to 133 ms at 30 Hz. The timing follows `K.acts.hitFlash`. The flinch is a squash and spring on its bones, after the hit recipe in Ink Studio's `k1-stage.js`.
- **Hit stop.** The simulation stops and the picture goes on. Hit stop is 3 steps for a cut, and 5 for the finisher, the plunge and a hurt lamplighter (0.08 s would be 4.8 steps). It is 6 steps for the boss slam, and 9 for a phase change and for death. The cap is 9 steps in any 30.
- The hit foe's picture shakes ±0.04 m every 2 steps (30 Hz), but its hit shape does not move. All of it runs on game time, so `?test` plays it the same. The game clock counts steps during hit stop too. Every effect (flash, tint, blink, kick, zoom, bars, grade) counts those steps. Moves count the play clock, which stops in hit stop (see The step).
- **Reduced motion** also keeps a hit foe still, with no shake. The low health tint stays at 15% with no pulse, and the health bar shows a steady fire edge with no pulse.
- **Camera kick.** `world.anim.kick` moves the camera along its right and up vectors. Each hit adds to a shake value (`trauma` in Eiserloh's talk) that falls over time. The kick is the square of that value times smooth noise. A hit landed adds 0.03 to 0.05, a hurt adds 0.1, and a boss slam 0.2 to 0.3. It has no fixed length: it ends when the shake value falls to 0. The renderer moves the camera, not its angle, so the kick stays small to keep the eye out of the scenery.
- **Zoom and bars.** `world.anim.zoom` is 1.05 for 7 steps (0.117 s) on a heavy hit, and 1.15 for the boss intro. `world.anim.bars` eases from 0 to 0.12 over 30 steps (0.5 s) for the intro and for the last beacon.
- **Grade.** `world.anim.grade` is ported from the blends of `K.anim.show`. At low health, it pulls slots 1 to 31 up to 25% toward dark red at each beat, every 55 steps (0.92 s). It leaves slots 32 to 47 as they are. A hurt shows red on slots 1 to 31 for 3 steps (0.05 s). Slots 32 to 47 stay as they are, so fire, lamp and wisp colours never change. The review suggested 0.04 s, but that is not a whole step at 1/60 s. Death is a fade to ink over 72 steps (1.2 s). The grade output is not snapped back to the palette, so its colours stay near palette colours.
- **Sparks and glim.** A port of `K.play.fx` (sparks, flash, ring, drops) keeps about 256 splats at the end of the data. It uploads one row of 32 KB a frame.
- **Candles.** The boss file holds 12 flames of 5 splats. The page writes their base positions at the arena once, and sets their density at the intro, as `setLit` does for the beacon.
- **Effects in layers.** Each effect has its own flag. The game must play with all of them off.
- **In reserve.** A draw order made by the page (`fast-sort.mjs`) could help if phones turn out short of CPU. It took 2.23 ms against 3.77 ms with no foes, and 3.00 ms against 5.74 ms with 40k foe splats. A `frame.uniforms` hook, proposed upstream, would give flashes, moving lights and burnt ground with no upload. Neither is in the first version.

**Cost.** The renderer survey measured these in SwiftShader at the phone art size (147×317):
- 6.9 s a frame today;
- 8.8 s (+27%) with 6 untrimmed foes on screen (32.6k boned splats);
- +10% with them hidden by bones, and +15% at density 0;
- +25% with a boss at 3 times its size.

Our largest awake set is The Bell Knoll's 6 slots, 19.5k splats. So the picture check uses that place with all 6 slots awake on screen, 4 to 8 m in front of the lamplighter. Its pass is 1.30. The cost depends on how large the foes are on screen, so the check sets where they stand. Its base is the same view in Wander, which loads no pool, so the ratio also pays for the parked slots. In Node, the sort of each place's largest awake set is 1.27 to 1.39 times the place alone. The other slots are then parked off the bones (the table in "Numbers we checked"). So the pass is 1.45 in each place. The worst case is 1.39, and one bench spread from 1.38 to 1.54 on the Fen. So the bench times the place alone and the fight in alternate rounds in one process, and it passes on the best of 3 runs. In both checks, "the place alone" is the place with the lamplighter's bones and no pool. A phone runs JavaScript perhaps 3 to 5 times slower (an estimate). A phone already near 45 ms a frame would likely drop one art size step in a fight.

### Sources
Most pages below were read through search extracts, because gamedeveloper.com, 80.lv and deepnight.net did not resolve in this session.
- **Foes on bones, pose keyframes, hit flash, flinch, sparks, grade blends:** Ink Studio, siliconjungle, https://github.com/siliconjungle/shapeshift-labs-ink-studio (commit 6a8c622): `K.bones.tag`, `K.acts.frames`, `K.acts.hitFlash`, the hit reaction in `k1-stage.js`, `K.play.fx`, `K.anim.show`.
- **Hit stop:** Masahiro Sakurai, "Thoughts on Hitstop", Famitsu column vol. 490, translated by Source Gaming, https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/. We take two things: a longer stop for a heavier hit, up to a cap, and a shake of the picture, not of the hit shape.
- **Camera kick:** Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math", GDC 2016, https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing. We take the square of the shake value and smooth noise. The talk prefers a turn of the camera. Our renderer has only a move, so we keep it small.
- **Effects in layers, marks that stay:** Jan Willem Nijman, "The Art of Screenshake", INDIGO 2013, https://www.gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games.
- **Squash on every event, an off switch for each effect:** Martin Jonasson and Petri Purho, "Juice It or Lose It", GDC Europe 2012, https://gdcvault.com/play/1016487/.
- **Zoom and bars:** none fit as a published source. Ink Studio's renderer already has `world.anim.zoom` and `world.anim.bars` (the renderer survey). The timings are our own: a short zoom on a heavy hit, and bars only for the boss intro and the last beacon.
- **The hurt blink:** none fit. The figure's bones park off screen on alternate groups of steps, the renderer survey's method, with no upload. The timing is our own.
- **Wind-up, active and recovery; a wind-up of at least reaction time plus the answer's start:** GD Keys, "Keys to Combat Design #1: Anatomy of an Attack", 2020, https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/.
- **A ground marker and a sound for each area attack, a ring of space round the player:** "Enemy Attacks and Telegraphing", Game Developer, https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing (no author in the extract).
- **Attack tokens:** Kurt Loudy and Jake Campbell, "Embracing Push Forward Combat in DOOM", GDC 2018, https://gdcvault.com/play/1024940/Embracing-Push-Forward-Combat-in (from summaries).
- **Off-screen warnings, spacing of foes that wait:** Mihir Sheth, "Evolving Combat in 'God of War' for a New Perspective", GDC 2019, https://gdcvault.com/play/1026085/Evolving-Combat-in-God-of (from summaries). Our notch shape and colours are our own.
- **Soft aim:** Ravenwhisp, "Implementing Directional Target Selection for Player Combat", https://ravenwhisp.github.io/Ravenwhisp/blog/implementing-directional-target-selection-for-player-combat. Tap to aim on touch: Brawl Stars controls, Deconstructor of Fun, 2018, https://deconstructoroffun.com/blog/2018/5/11/bs.
- **Quiet help for the player:** Sébastien Bénard, "'Dead Cells': What the F*n!?", GDC 2019, https://www.gdcvault.com/play/1025788/-Dead-Cells-What-the; Maddy Thorson, "Celeste & Forgiveness", https://maddymakesgames.com/articles/celeste_and_forgiveness/.
- **Time to kill:** "Designing each of the 50 weapons in Dead Cells to feel distinctive", Game Developer, interview with Sébastien Bénard, https://www.gamedeveloper.com/design/designing-each-of-the-50-weapons-in-i-dead-cells-i-to-feel-distinctive.
- **One verb for each foe:** Garret Bright, "Build a Bad Guy Workshop", https://www.gamedeveloper.com/design/build-a-bad-guy-workshop-designing-enemies-for-retro-games.
- **The boss:** Mike Birkhead, "Tips from a combat designer: The art of boss design", https://www.gamedeveloper.com/design/tips-from-a-combat-designer-the-art-of-boss-design; Tom Allins, "Rule of 3 deaths in a boss fight", https://gamedeveloper.com/design/rule-of-3-deaths-in-a-boss-fight; Team Cherry on how the Silksong bosses pick attacks, GamesRadar, https://www.gamesradar.com/games/platformer/compared-to-hollow-knight-silksong-reworked-how-the-bosses-pick-their-attacks-and-suddenly-i-realize-why-i-got-crushed-so-often.
- **The boss camera:** Yoshiaki Koizumi, MIGS 2007, https://www.gamedeveloper.com/game-platforms/migs-2007-nintendo-s-koizumi-on-the-path-from-garden-to-i-galaxy-i-. We take only the idea of a camera that suits the arena. The frame rule and the numbers are our own. The aim is on the line to the boss, and the distance is the smallest that keeps the frame clear. It is at least 1.25 times the follow distance and at least 12 m. The turn is 1.5 rad/s after 0.6 s with no look input.
- **The combat camera:** none fit. It is the explorer's own swing behind the lamplighter (`makeCamera` in `play.js`: after 0.8 s with no look input), pointed at the nearest awake foe.
- **Ember cracks when a zone wakes:** none fit. They are sparks from the ported `K.play.fx` pool, laid in lines on the ground.
- **Round shadows and the ground marker shape:** none fit. We keep our own boned shadow disc. The marker colours (fire slots 34 and 35) come from the review's measure of what reads on the dark ground.
- **Markers fitted to the ground:** none fit. The usual answer is a projected decal, as in the Decal Projector of Unity's High Definition Render Pipeline. The Ink Studio renderer has no decal pass that reads depth. So each slice is a boned plane fitted to `walk.support`, which is our own method.
- **Death into bone parts:** none fit beyond Nijman's marks that stay. It is our own.
- **A page-made draw order:** none fit. It is our own test.
- **Sound:** none fit. A few oscillator and noise envelopes in WebAudio, made in code.

### The names and the order of the places
The user asked that no name be copied from Dead Cells. The reviews found three things that come close.
- **"Crow Ramparts".** Dead Cells has a biome named Ramparts. The old name had the same word, and our run puts that place second, after a prison.
- **The order.** Our first four places are a prison, a wall on the ridges, a stilt hamlet over water and a bell tower. The review compares this to a Dead Cells route through Prisoners' Quarters, Ramparts, Stilt Village and Clock Tower. The forms and the looks of our places are our own, but the chain is similar.
- **"Barrow Crown" and its boss card.** The reference survey (section 8) flags this too. Dead Cells has a place called The Crown, where a last boss waits, as ours does. Our boss card said "The keeper of the crown", and Dead Cells has the Time Keeper. The Gaol's subtitle, "Cells cut into the moor", has the word "Cells".

**The decision.** For originality, the lead changed the second place's display name from "Crow Ramparts" to "The Crow Wall". Only the name that the player sees changes. The id `ramparts`, its files, its bake, its order and its look stay. The places and their order are the user's decisions, so they stay too.

The new name went into these places in the code, in commits 20391343 and b6fd31f5:
- `name` in `games/gloam-downs/biomes/ramparts.mjs` and its first comment, and so the baked `ramparts.json`;
- `NAMES` in `public/lab/gloam-downs/main.js`;
- the explorer e2e, which now passes "the beacon lights and The Crow Wall loads";
- the Lab card in `public/lab/index.html`, which said "ramparts on the ridges" and now says "a crow wall on the ridges".

The cabinet and the Corridor caption do not name the place today.

**The decision on Barrow Crown.** We keep the name "Barrow Crown". It is a place that the user chose. Its crown is a ring of standing stones on a barrow, with no throne, castle or queen. Its form is our own: grassy mounds, a ruined keep and teal ghost fog. We change three lines that add to the echo:
- the boss card's first line becomes "V · The last light of the downs";
- the boss card's third line becomes "It holds that light in a cage of ribs";
- the Gaol's subtitle becomes "A prison cut into the moor, and the keep on the hill", in `games/gloam-downs/biomes/gaol.mjs` and so the baked `gaol.json`.

The user can change this choice. A new display name for Barrow Crown would change only its `name`, as for The Crow Wall. The spec's "Original names" lists the names. Its test checks that no name or card title has a phrase from a list of Dead Cells places, foes and bosses. The list holds "The Crown" and "Time Keeper", but not the word "crown" alone.

### Checks
- `node qa/lab/gloam-downs-run.test.mjs`:
  - the step at 30, 60, 120 and 144 Hz, with presses at multiples of 1/6 s;
  - 600 steps from 1,440 frames of 1/144 s;
  - the two clocks, and effects in steps at 30 and 144 Hz;
  - the string, the aim and its clear line, the roll (3.3 to 3.7 m), the plunge and the drink;
  - foe tells, tokens, leash and ledge, foes off their ground, the charge's stops, and the knock-off rule;
  - markers on the real walk maps (90% of rim points within 0.15 m), and the step out of a lane or the shard rings;
  - the zone scenarios, through `qa/lab/gloam-downs-zones.mjs`: the wake rule with the cap and the free slots, the guard zones, the Ironback walls and the beacon distances. It also checks that each baked `<id>.json` holds the zones of `lib/zones.mjs`;
  - the combat camera, the boss camera at the five layouts, and the boss camera in the real arena (95%);
  - glim, banking, death, wicks that never come back once chosen, upgrades, and how the bonuses add;
  - the run's save with bad data and with an old explorer page;
  - the store at once on a hit and at 0 health, with a wick offer, and after a wick or a buy;
  - the names lists, and the phrases from Dead Cells in `qa/lab/gloam-downs-names.json` that no name or card title may hold;
  - the bake of the Gaol with and without its zones, into `os.tmpdir()`;
  - the budget: file sizes, 275,000 splats, 1.5 MB for a place's three files, and 1.7 MB before play;
  - the sort bench in all five places (1.45, alternate rounds, the best of 3 runs), and the foe step bench (0.5 ms).
- `node qa/lab/gloam-downs-zones.mjs`, the port of `check-zones.mjs`, also runs on its own on the final walk maps.
- `node qa/lab/gloam-downs-bake-zones.mjs` bakes each of the five places into `os.tmpdir()` with `--worlds <dir>`, with and without `--no-zones`, one bake at a time. The `.bin.gz` and walk files are the same, and `<id>.json` differs only in `zones`. The Node test does this for the Gaol only.
- `node qa/lab/gloam-downs-bot.mjs <bots> <skill> <seed>`: the page's own rules on the real walk maps. Each bot plays until its first win, or 12 runs, and the bots spread over the cores with `worker_threads`. The check runs 60 bots at each skill, in less than 10 minutes in all.
- The run's e2e is five files, as First Breath splits its own, so that each takes about 6 minutes. Each runs in SwiftShader, with `?test`, the hooks and `?nodraw` where no picture is needed. Each launches Chromium with `executablePath` set to `/opt/pw-browsers/chromium` when that path exists, as `gloam-downs.e2e.mjs` does. The Playwright of `qa/browser` wants a Chromium build that this machine does not have:
  - `qa/lab/gloam-downs-run.input.e2e.mjs`: every control on keys, mouse, touch and gamepad, and the Map and Look tools. Also the cards with keys alone and with a mocked gamepad alone, the focus, Wander's cards and the sound log;
  - `qa/lab/gloam-downs-run.screens.e2e.mjs`: each state and card, and the boss files after a reload. Also reloads in the death fade, at the beacon card, after the boss's fall and on the win card, and files that fail;
  - `qa/lab/gloam-downs-run.layout.e2e.mjs`: the five layouts with the overlap check at the widest HUD, the toast, the cards that fit, and screenshots;
  - `qa/lab/gloam-downs-run.look.e2e.mjs`: the look in a fight in all five places, and the tell and marker counts in fire slots 34 to 37. Also the hit flash, the notches, low health and reduced motion;
  - `qa/lab/gloam-downs-run.perf.e2e.mjs`: the frame ratio in The Bell Knoll against Wander (1.30).
- `node qa/lab/gloam-downs.e2e.mjs` checks the explorer through `?wander`.
- `NODE_PATH=/opt/node22/lib/node_modules node qa/arcade/quiet.mjs --only=lab/gloam-downs`: the sound starts on Begin the run and stops while hidden. The repository has no root `node_modules`, so the script needs that path.

### Cut order
If time runs short, cut from the top, and change the spec to match:
1. The combat camera. Remove the spec's "Combat camera", "The combat camera's foe" and its part of "Reduced motion" and "Moves while the camera turns". In "Look input wins", keep 0.6 s for the boss camera. In the explorer's "Look", remove the words "the combat camera and".
2. The boss camera. Remove "Boss camera" and the other "Boss camera" requirements, and "The HUD in the boss fight". Remove the boss camera's part of "Look input wins", "Moves while the camera turns" and the explorer's "Look".
3. One wick, Close shave. Five wicks stay, so the fourth beacon offers the last two. Cut no second wick. If a build ever keeps only four, the fourth beacon offers the last wick and a fixed second choice: heal to full health. A full flask refill is no choice there, because every lit beacon fills the flasks.
4. The grave candles.
5. The wicks.
6. Sound (the scrape, whistle and hum cues go; the visual tells stay).

### What this replaces
- "Speed" above: its step sentence now gives the fixed 1/60 s step (see The step).
- "Not done" above: its first item now points to the combat run. Runtime point lights are still not done.
- `save.js` stays the explorer's save. The run's state is in `run-save.js`.
- The toast at `sat + 116px`: in a run and in Wander, it sits 8 px under the HUD's measured bottom.
- `lib/check.mjs` counts a place's JSON in its 1.5 MB.

### Not checked
Nothing ran on a real phone, a real graphics card or real speakers. The frame costs are ratios in SwiftShader and Node on this machine. The pacing comes from bots, not from players. The first build must check the frame time on a real phone at 46k art pixels with 6 foes awake.
