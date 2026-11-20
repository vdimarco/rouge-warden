# Gloam Downs: the bake

The five places of `/lab/gloam-downs/` are sculpted and baked here with [Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio), which is pinned in `package.json`. The page loads only the baked files and Ink Studio's WebGL renderer.

```sh
npm ci --prefix games/gloam-downs
node games/gloam-downs/bake.mjs                         # bake all five into public/lab/gloam-downs/worlds/
node games/gloam-downs/bake.mjs fen --check             # bake one place and check it against the spec
node games/gloam-downs/bake.mjs fen --check --preview --out /tmp/fen   # also draw CPU pictures: start, wide, beacon, top
GLOAM_COUNT=1 node games/gloam-downs/bake.mjs fen       # list the heaviest solids (to stay in budget)
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

- **Budget:** 250,000 splats or fewer in total, including about 5,400 for the lamplighter, and 1.5 MB or less gzipped.
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
- **Walk map:** a wall is anything that rises more than a step. Arches and tree crowns with 1.8 of clearance under them can be walked under. Keep the paths wide (2 or more), because the camera follows close.
  - The bake closes cracks, such as the seams between planks or between a porch and a wall. The lamplighter is 0.6 across and cannot go into them, but it stands on the floor under its centre, so it would drop through them. A crack is a cell more than 0.6 under the floor beside it, along a row or a column. When the next cell on that line is a floor within 0.1 or a wall, the crack comes up to the floor. When it is a floor up to 0.83 higher or lower, with the crack more than 0.6 under it too, the crack comes up half way between the two. Two such cells in a line, 0.5 wide, come up together, in steps between the two sides, when the cell after them is a wall or a floor within 0.83 with both more than 0.6 under it. Under a roof, the floor under the gap comes up; where that leaves less than 1.8 under the roof, the cell becomes solid. A seam at the edge of a floor, with a drop on its other side, stays open. The bake prints the number closed as `cracks`.
  - **No trap:** every place that the reach check gets to must lead back to the start or to the beacon. A place that only the controller leaves, on at least 4 of 16 headings at 30 Hz and at 60 Hz, also leads back. The bake fills each trap, such as a slot, a notch, a pit or a nook under a roof, up to the floor that it was reached from, and checks again. It prints each cell that it fills, and the number as `traps`. It fails after 4 rounds, or when it cannot raise a trap. `--check` prints `no trap: every reached cell can get back`.
  - The walk file is three `Int16` layers in centimetres, gzipped: the top, the floor under a gap (the top where there is none), and the gap's underside (0 where there is no gap). The JSON names them in `walk.layers`. Each walk file is 102 to 132 KB, and it counts in the 1.5 MB.
