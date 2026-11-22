# Gloam Downs: the bake

The five places of `/lab/gloam-downs/` are sculpted and baked here with [Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio), which is pinned in `package.json`. The page loads only the baked files and Ink Studio's WebGL renderer.

```sh
npm ci --prefix games/gloam-downs
node games/gloam-downs/bake.mjs                         # bake all five into public/lab/gloam-downs/worlds/
node games/gloam-downs/bake.mjs fen --check             # bake one place and check it against the spec
node games/gloam-downs/bake.mjs fen --check --preview --out /tmp/fen   # also draw CPU pictures: start, wide, beacon, top
GLOAM_COUNT=1 node games/gloam-downs/bake.mjs fen       # list the heaviest solids (to stay in budget)
node games/gloam-downs/bake.mjs foes boss --check       # bake the combat run's foe files and boss files, and check them
node games/gloam-downs/bake.mjs gaol --worlds /tmp/w --no-zones   # write into another folder, and leave the zones out of gaol.json
node games/gloam-downs/vendor.mjs                       # copy Ink Studio's renderer into public/lab/gloam-downs/ink/
```

`--check` prints `ok` or `FAIL` for each rule and exits with 1 on a failure. A `--preview` picture is what the page shows to within about half a percent of its pixels: Ink Studio's CPU `colored` render matches its WebGL renderer.

## The look

The user asked for environments "inspired by dead cells but give it a 3d supermarket 64 vibe with rolling hills", and then "make it look gritty and dark".

- **Dead Cells: the mood, not the content.**
  - Ruined stone, torch light, and a palette that is saturated but never welcoming.
  - Outdoor places use analogous hues. Cool shadow falls on the place, and warm fire picks things out.
  - Each place has its own signature, but they read as one world.
- **N64 platformer: the form, not the content.**
  - Chunky, round, readable forms: fat posts, thick walls, big rocks, doors wider than they need to be.
  - Rolling hills everywhere. A low resolution. Few colour steps.
  - A summit landmark you can see from the start, with a path that climbs to it in terraces.
- **Gritty and dark.**
  - Dusk or night only.
  - Most of the picture is dark ground, stone and sky. Fire, lanterns, wisps and the moon are the only bright things.
  - Dither and noise on the surfaces, so they read as rough.
- **Original.**
  - No name, place, layout or character from Dead Cells or Super Mario 64.

## A place: `biomes/<id>.mjs`

`biomes/gaol.mjs` is the reference. A place exports:

```js
export default {
  id, name, sub, hint, seed,
  palette: [['sky', [0x05060c]], ['skyband', [...]], ['fog', [...]], ['ink', [...]], ['shade', [...]], ...], // slots 0..31, dark to light per ramp
  light: { sun: [x, y, z], amb, sky, sunK, shK },   // baked: the sun (or moon) direction, ambient, sky fill, key strength
  fog: { color: 'fog', far: 44, start: 0.5, max: 0.9 },  // far: the depth where the fog is at its max (units)
  dither: 0.5, outline: 0.45,
  walk: { half: 34 },                                // the play area is -34..34 on x and z
  hills: { bumps, fbm, warp, far, flats, paths, pits, box },  // see lib/common.mjs hills()
  build(ctx) { ... }
};
```

- **Palette.** You name up to 32 colours. Index 0 is the background (the darkest sky). Slots 32–47 are shared and appended for you:
  - `fire` (6 steps), `wisp` (3), `cloak` (3), `iron` (2), `lamp` (2).
  - The names `ink` (the outline colour), `shade` (the lamplighter's round shadow) and your fog colour's name must exist.
  - `ctx.ramp(name)` gives the indices of a named ramp.
  - The resolve snaps every pixel to the nearest of these 48 colours, so dark places need several dark steps.
- **`ctx` in `build`:**
  - `S` (the sculptor), `B` (the builder), `K` (the kit) and `h(x, z)` (the height).
  - `terrain(mat, { near, res, rings })`.
  - `lamp(p, r, s)`: a baked light. A material with `g: [index]` turns warm near it: the bake widens a one-step `g` into a six-step ramp, from that colour's own darker step through the shared fire ramp, so lamp light falls off as a warm pool. You can give `g` a full ramp of your own instead.
  - `fire(p, s, { embers, lamp, r, k, hot })`: a flame, embers and its lamp.
  - `wisp(p)` (exactly five), `beacon(p, r)` (one), `spawn(p, yaw)` (one; yaw 0 faces +z).
  - `stair(line, width)`: records a flight of steps (the walked line from foot to head, `[x, z]` points, and its width) in `<id>.json` as `stairs`, for `qa/lab/gloam-downs-stairs.test.mjs`. Every stair helper in the biomes calls it.
  - `zone(id)`: places a zone of the combat run from `lib/zones.mjs`. It adds nothing to the scenery, only to `<id>.json`. A place must place every zone that the module gives it, or the bake stops.
  - `later(fn)`: solids that must not block the feet, such as water, hanging cloth or chains. They are left out of the walk map and baked with the scenery, so its shadows fall on them.
  - `glow(fn)`: emissive extras after every bake (sky dome `B.sky`, moon `B.iso`, motes, clouds).
  - **Where `S.sdf` is valid:**
    - Inside a `later` callback, `S.sdf` reads the scenery alone.
    - Inside a `glow` callback, `S.sdf` reads the scenery and the `later` solids. The lamplighter has a sculptor of its own, so it is never in this field.
    - In `build` itself, outside these callbacks, do not use `S.sdf`. The field does not know where the solids are until the bake calls `S.ready()` before the walk map.
- **Props:** `lib/props.mjs` has `torch`, `brazier`, `steps`, `wall`, `tower`, `deadTree`, `roundTree`, `gibbet`, `cage`, `stakes`, `rocks` and `shrubs`. Write place-only props in your own biome file.
- **Order of the bake:**
  1. your scenery;
  2. the walk map, read from the scenery's distance field (`S.ready()` builds it before the bake), with its cracks closed (`lib/cracks.mjs`) and its traps filled (`lib/traps.mjs`);
  3. `later` solids, then one bake of them with the scenery, then the lamplighter, in its own sculptor and its own bake;
  4. glows, then finish.
- **Materials:** `{ r: ramp, g: [lit base], mod: (x,y,z) => tone shift, rf: (x,y,z) => ramp, top: { min, r }, em, fat }`.

## The rules `--check` holds a place to

- **Budget:** 250,000 splats or fewer in total, including about 7,000 for the lamplighter and its blade, and 1.5 MB or less for the three files: the gzipped splat file, the gzipped walk file and the JSON.
  - Terrain is the biggest cost. The default is a near square of ±26 at spacing 0.24, then rings to ±52 at 0.5 and to ±104 at 1.0.
  - Keep prop spacing (`res`) at 0.08–0.14. Big flat walls can go to 0.12–0.16.
  - Far silhouettes beyond the play area can go to 0.3.
- **Reach:** the start stands on the ground, and the beacon and every wisp can be reached on foot. The rules are:
  - a step up of 0.5 (plus slope), and a jump that lifts the feet 1.40, so ledges up to 1.3;
  - the lamplighter is a disc of radius 0.3, so a way through must be wider than 0.6 on the walk map, where a bar or post takes up at least one 0.25 cell. Keep 3 clear cells or more. A bar that hangs in a doorway is a wall on the walk map, unless it touches the stone above it or lies on the floor;
  - a slope steeper than about 2.8 rise per unit is a face, and a face more than 0.83 high needs a jump;
  - the reach check jumps up to 1.3 and up to 1.0 across, along a row or a column of the grid. It lands only where the lamplighter can stand on a slope, so it does not land on the tip of a post or on the edge of a ledge. A gap of two cells can be jumped. A hop over anything higher than both ends, such as a thin wall, does not count. Where the lamplighter already touches something too high, such as after a drop beside a wall, it walks only along that or away from it;
  - from the top of a roof, an arch or a crown, a higher part of it is a wall, so a roof built in steps needs steps of 0.5 or less, or a jump;
  - feet below a gap's underside are in the gap. So a walk from a ledge drops into an arch whose underside is above the feet, and a jump under a high arch does not meet it. The corners of one roof decide together. A gap corner whose underside is more than 1.0 off each corner of that roof whose top is out of reach, or whose top the feet can stand on and is more than 1.0 off, is another solid, such as a hut's body over its crawl space or a lean-to against a hall, and has no say;
  - the feet do not rise up through a roof's underside. A jump from under the edge of a roof stops there and falls, so a roof edge 1.5 over a lower roof is not climbed;
  - a running jump up a slope steeper than about 0.6 is held back while it rises, so the feet still rise 0.4 over the slope. The run then picks up again in the air. From a walk the feet rise more on a slope up to about 1.2, and from a stop they rise 1.40. So to jump onto a ledge on a steep slope, stop next to it first;
  - any drop is allowed;
  - a wisp is touched from a floor 0.7 below it up to 2.1 under it, within 0.8 across.
- **Summit:** the beacon stands at least 2 above the start, on a summit that the start's camera can see.
- **Dark but not black:** in the CPU picture from the start, the mean luminance is between 0.05 and 0.32, and between 0.05% and 12% of pixels are over 0.55 (the fire).
- **Walk map:** a wall is anything that rises more than a step. Arches and tree crowns with 1.8 of clearance under them can be walked under. Keep the paths wide (2 or more). The camera rises over a wall before it comes closer, so a narrow lane costs a steep view, not a close one. Under a roof it dips under the lintel and uses the room's height, and where the walls still bring it in, its field of view widens and the lamplighter thins out (keeping its blade), but a nook under 2 m deep still brings the eye within about 1 m.
  - The bake closes cracks, such as the seams between planks or between a porch and a wall. The lamplighter is 0.6 across and cannot go into them, but it stands on the floor under its centre, so it would drop through them. A crack is a cell more than 0.6 under the floor beside it, along a row or a column, where the reach check stands on that floor, by its own walks and jumps or by its wide jumps (see No trap). So the tops of beams and rails that nobody reaches are not floors. When the next cell on that line is a floor within 0.1 or a wall, the crack comes up to the floor. When it is a floor up to 0.83 higher or lower, with the crack more than 0.6 under it too, the crack comes up half way between the two. Two such cells in a line, 0.5 wide, come up together, in steps between the two sides, when the cell after them is a wall or a floor within 0.83 with both more than 0.6 under it. A floor on the far side must be one that the reach check stands on too, so a hole between a porch and the top of a post stays a hole. A cell that the pass closed to a floor counts as stood on, so a chain of seams closes. Under a roof, the floor under the gap comes up; where that leaves less than 1.8 under the roof, the cell becomes solid. In the open the top comes up. Where a side of the crack is open air over the crack's floor (a gap whose floor is within 0.83 of it, such as a porch over the water or a beam over a floor), the cell becomes a slab like it, so the way under it stays open. Else the cell is solid from its old floor up. A seam at the edge of a floor, with a drop on its other side, stays open. The bake prints the number closed as `cracks`.
  - **No trap:** every place that the lamplighter gets to must lead back to the start or to the beacon. To find those places, the reach check also makes wide jumps from each place near a step: on 16 headings, as far as the run carries the jump, over anything lower than the jump's top and under any roof that the feet can pass under. A step across a corner goes through one of the two cells beside it. Wide jumps are more open than the controller, so they find a pocket that only a running jump over a thin wall gets into. They do not count for the beacon and the wisps. A place leads back by the reach check's own walks and jumps. A place that only the controller leaves, on at least 4 of 16 headings at 30 Hz and at 60 Hz, also leads back. Knockback is not tried. The bake fills a trap the size of a crack: a drop of more than 0.6 from the cell beside it, in a hole at most 2 cells across. It comes up to the floor of that cell, or to the lowest floor beside it that is not a drop. The bake prints each cell that it fills, and the number as `traps`. A wider trap, or one that only a jump gets into, fails the bake with its place, because the scenery must give it a way out, such as steps or a ramp. After each search the crack pass runs again for the places that the search now reaches, and the bake prints each crack that it closes then. The bake fails after 4 rounds. `--check` prints `no trap: every reached cell can get back` with the number of trap cells left.
  - The walk file is three `Int16` layers in centimetres, gzipped: the top, the floor under a gap (the top where there is none), and the gap's underside (0 where there is no gap). The JSON names them in `walk.layers`. Each walk file is 102 to 132 KB, and it counts in the 1.5 MB.

## The combat run: zones, foes and the boss

The page plays the combat run with `?run`. Without it, the page is the explorer. Stage 1 of the run baked these files and data, and stage 2 made the foes fight back, fixed the camera and built the run's HUD and cards. `openspec/changes/add-gloam-downs/design.md` ("The combat run") has the numbers.

- **`lib/zones.mjs`** is the one home of the zone table. `ZONES` gives each place's zones: the centre `c` [x, y, z] (y is the floor there), the leash, the foes by type (`S` Snuffer, `P` Pitchrook, `M` Mirelight, `I` Ironback, `B` the Barrow Reeve), the guard flag, and for a guard the keeper, the landmark that a toast names. `POOLS` gives each place's pool of slots. `ROUTES` gives each place's route: waypoints a few metres apart on the floor, from the start past the guard zone to the beacon. The biomes place the zones with `ctx.zone(id)`, and the bake writes them into `<id>.json` as `zones`. The zones change no splat file and no walk file.
- **The foe files.** `node bake.mjs foes` writes `worlds/foes.bin.gz` and `worlds/foes.json.gz`: the four foe types and the light carried after the boss's fall (`L`), from `lib/foes.mjs`. `node bake.mjs boss` writes `worlds/boss.bin.gz` and `worlds/boss.json.gz`: the Barrow Reeve (`B`) on 46 bones and its 12 grave candles (`C`), from `lib/boss.mjs`. `lib/figures.mjs` bakes both.
  - A figure is `{ code, name, title, height, radius, bones, sculpt, lay, shadow, res, apart, weights, clips }`. Each bone is `{ name, parent, pivot, hidden }`. A bone whose parent is `'ground'` (the shadow and the markers) is placed by the page, not by a clip.
  - Each figure bakes its body and what glows over it (tells, cores, lights) in two sculptors. In one sculptor the glow swallows the part it glows over.
  - A clip is `{ dur, loop, at, keys }`, with a key `[rx, ry, rz, sx, sy, sz, tx, ty, tz]` for each bone: a turn Y, then X, then Z about the pivot, in the parent's rest frame, with Catmull-Rom between keys. The body's lean and squash come from `K.acts.frames('windup' | 'attack' | 'hurt')`; the limb moves are our own.
  - Rings are six slices of 60° and lanes are pieces of 1.5 m or less, each on its own bone. They are flat emissive dabs in fire slots 34 and 35.
  - `--preview` draws sheets of the figures and a lineup in a place into `--out`.
- **The rules `--check` holds the figures to** (`lib/check.mjs`): the foe files at most 200 KB together, and the boss files at most 140 KB. In all five palettes, each figure colour snaps under 0.42 luminance, or to the fire, wisp, iron and lamp slots (32 to 39 and 44 to 47). None snaps to slot 40, the brightest wisp, or to the cloak slots 41 to 43, which are the lamplighter's. Each place with its pool has 275,000 splats or fewer, and each place's three files plus the foe files are 1.7 MB or less. A place's `--check` adds its own pool rules when the foe files are baked.

## The pool in the page

`public/lab/gloam-downs/pool.js` has no DOM, so the bake's previews, the Node tests and the page pose the figures with the same code. `makePool(world, meta, slots, { extra })` adds a place's slots after its splats, with bone ids after the lamplighter's, and `extra` splats after the slots for the spark pool. Every slot starts parked: at density 0 and out of `world.anim.boned`, so the sorter does not pay for it. `wake` puts a slot on the bones first and then brings its density back, and `park` does the reverse. `pose`, `marker`, `place`, `flash` and `placeGroups` pose a slot, lay a marker piece, place one bone, flash a hit and place the candles. `figures.js` loads the figure files once and lists a place's slots, and `world.js` has `loadFigures()`. With `?run&test&lineup`, `__gloam.lineup()` stands one of each figure in front of the lamplighter. With `?run&lineup` and no `?test`, they stand there and play each of their clips in turn. `poseFigure`'s `grow` option scales named bones about their pivots, so the tells can grow on a small screen.

## The run in the page

These modules have no DOM unless the list says so, so the Node tests use them as they are.

- **`foes.js`**: the foes' minds. Bodies on the walk map with a ledge probe, noticing, the leash and the way home, attack tokens (two melee, one coal), the wind-up rule, the flinch, the knock-down, the rise and the sink, foes off their ground, the off-edge rule, glim motes, and zones that wake and sleep under the cap of six with free slots. Guard zones keep each beacon dark, always wake, and take slots from other zones. `fits()` and `makeRoom()` are the rules that the zone check shares.
- **`fight.js`** (the page's glue; DOM only for the notches): it builds the foes with each place, wakes, parks and flashes the pool's slots, poses each foe with its tell, lays the markers, flies the coal, breaks foes put out into their bone parts, and shows the ember notches. On a small screen it grows the tells (`tellGrow`).
- **`markers.js`**: fits each ring slice and lane piece to the ground, or to the Fen's water (`fitRing`, `fitLane`).
- **`sparks.js`**: a port of Ink Studio's `K.play.fx`: sparks, flashes, rings, ember cracks and glim motes.
- **`feel.js`**: the camera kick, the zoom, the hurt tint, the low-health grade with its heartbeat, the fade to ink, the boss's fall (`fall()`) and its shocks (`shock()`), and reduced motion.
- **`cameras.js`**: the combat camera, the move lock, and the boss camera (wired to the Barrow Reeve in `main.js`), on top of `play.js`'s follow camera. `camLayout(w, h)` in `play.js` gives each window's framing.
- **`screens.js`**: what each screen shows, as pure functions: the HUD's health line, the wick buttons, the Lamp-room's rows and buttons, the summary, the pause panel's places and questions, the game-time waits, and the card that a load opens.
- **`main.js`** wires them: `newRunner()` builds the fight with each place, `fightView()` hands the awake foes to the combat camera, and the `?test` hooks (`foes`, `wake`, `spawn`, `hold`, `out`, `notches`, `combat`, `draw({ time, pool })`, `layout`, `kill`, `toast`, `lamp`) let the checks set up each picture.

## Checks

- `node qa/lab/gloam-downs.test.mjs`: the explorer's controller, walk map, saves and loader (`GLOAM_WORLDS=0` skips the baked places).
- `node qa/lab/gloam-downs-run.test.mjs`: the run's step and clocks, the lamplighter's moves, the rules, the saves, the pads and the screens.
- `node qa/lab/gloam-downs-foes-ai.test.mjs`: the foes' moves, tokens, leash, zones and guards on the baked walk maps, glim, the marker fit and the feel (`GLOAM_WORLDS=0` leaves out the baked places).
- `node qa/lab/gloam-downs-boss.test.mjs`: the Barrow Reeve's mind (`boss.js`): phases, the choice by position, timings at four frame rates, damage, the turn limit, ring, slice and lane hits, the fall and the stored states, and the boss camera over the whole arena (its distance, the boss and the shard rings in view).
- `node qa/lab/gloam-downs-boss.sim.mjs [bots] [tries] [seed]`: a boss bot that fights the Barrow Reeve on Barrow Crown's walk map with the game's own moves, runner and boss mind, at skills 0.3, 0.5, 0.7 and 0.9; it prints wins, tries to the first win, fight length and the hits each attack lands (200 bots in about 20 s). `REACT=0.5 SKILLS=1` is a bot with no mistake and a fixed reaction time; `BHP`, `GAP` and `DSWEEP` try the boss's health, gaps and the double sweep's second wind-up. design.md "Measured in stage 3a" has the results.
- `node qa/lab/gloam-downs-camera.test.mjs`: the follow camera's framing at 14 windows and on the five routes, the Gaol's torn cell and a mouse sweep at every wisp (tight spaces, the framed shot, what the figure covers of the view), the near fade, the combat camera and the boss camera.
- `node qa/lab/gloam-downs-stairs.test.mjs [place ...]`: every flight of steps listed in the places' JSON, walked by the controller in the explorer and the run; no stop may be stuck (`GLOAM_WALKS=<dir>` walks other walk maps; about a minute).
- `node qa/lab/gloam-downs-foes.test.mjs`: the figures, their clips and poses, the pool, the colours, the budgets, the zones on the baked walk maps, and the bake of the Gaol with and without its zones (`GLOAM_BAKE=0` skips that bake).
- `node qa/lab/gloam-downs-zones.mjs`: the zones on the walk maps: the wake rule, the guard rule, the cap of 6, the pool slots, the routes, the Ironback walls and the beacon distances.
- `node qa/lab/gloam-downs-bake-zones.mjs [place ...]`: each place baked with and without its zones into the system's temp folder, one bake at a time (about 1.5 minutes for all five).
- With the site served: `node qa/lab/gloam-downs.e2e.mjs` (the explorer), `node qa/lab/gloam-downs-run.input.e2e.mjs` (the run's inputs and first cards), `node qa/lab/gloam-downs-run.lineup.e2e.mjs` (the pool and the figures), `node qa/lab/gloam-downs-run.fight.e2e.mjs` (a fight in four places and on a phone), `node qa/lab/gloam-downs-run.cards.e2e.mjs` (the HUD and every card at five layouts; `ONLY=keys|pad|layout`) `node qa/lab/gloam-downs-camera.e2e.mjs` (the cameras at five layouts) and `node qa/lab/gloam-downs-run.boss.e2e.mjs` (port 8831: the boss fight from the intro to the win card, reloads after the fall and on the win card, and boss files that fail). Each takes 1 to 7 minutes in software WebGL.

## Design tools

`tools/` keeps the scripts that measured the combat run's design. They are not checks. `sort-bench.mjs`, `sort-bench-page.mjs` and `sort-mix.mjs` time the sort with foes on bones, `layout.mjs` measures the page's controls, `marker-fit.mjs` and `lane-fit.mjs` fit markers to the ground, and `boss-frame.mjs` and `boss-arena.mjs` solve the boss camera's frame. The later stages port what their tests need.
