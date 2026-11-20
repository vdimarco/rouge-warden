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
  - `later(fn)`: solids that must not block the feet, such as water, hanging cloth or chains. They are left out of the walk map and baked with the scenery, so its shadows fall on them. `S.sdf` inside `fn` reads the scenery alone.
  - `glow(fn)`: emissive extras after every bake (sky dome `B.sky`, moon `B.iso`, motes, clouds).
- **Props:** `lib/props.mjs` has `torch`, `brazier`, `steps`, `wall`, `tower`, `deadTree`, `roundTree`, `gibbet`, `cage`, `stakes`, `rocks` and `shrubs`. Write place-only props in your own biome file.
- **Order of the bake:**
  1. your scenery;
  2. the walk map, read from the scenery's distance field (`S.ready()` builds it before the bake);
  3. `later` solids, then one bake of them with the scenery, then the lamplighter with its own bake;
  4. glows, then finish.
- **Materials:** `{ r: ramp, g: [lit base], mod: (x,y,z) => tone shift, rf: (x,y,z) => ramp, top: { min, r }, em, fat }`.

## The rules `--check` holds a place to

- **Budget:** 250,000 splats or fewer in total, including about 4,000 for the lamplighter, and 1.5 MB or less gzipped.
  - Terrain is the biggest cost. The default is a near square of ±26 at spacing 0.24, then rings to ±52 at 0.5 and to ±104 at 1.0.
  - Keep prop spacing (`res`) at 0.08–0.14. Big flat walls can go to 0.12–0.16.
  - Far silhouettes beyond the play area can go to 0.3.
- **Reach:** the start stands on the ground, and the beacon and every wisp can be reached on foot. The rules are:
  - a step up of 0.5 (plus slope), and a jump that lifts the feet 1.40, so ledges up to 1.3;
  - the lamplighter is a disc of radius 0.3, so a way through must be wider than 0.6 on the walk map, where a bar or post takes up at least one 0.25 cell. Keep 3 clear cells or more. A bar that hangs in a doorway is a wall on the walk map, unless it touches the stone above it or lies on the floor;
  - a slope steeper than about 2.8 rise per unit is a face, and a face more than 0.83 high needs a jump;
  - the reach check jumps up to 1.3 and up to 1.0 across, along a row or a column of the grid. It lands only where the lamplighter can stand on a slope, so it does not land on the tip of a post or on the edge of a ledge. A gap of two cells can be jumped. A hop over anything higher than both ends, such as a thin wall, does not count;
  - from the top of a roof, an arch or a crown, a higher part of it is a wall, so a roof built in steps needs steps of 0.5 or less, or a jump;
  - from a ledge 1.8 or more above the floor under an arch, the arch is a wall. Keep such ledges lower, or give another way in;
  - any drop is allowed;
  - a wisp is touched from a floor 0.7 below it up to 2.1 under it, within 0.8 across.
- **Summit:** the beacon stands at least 2 above the start, on a summit that the start's camera can see.
- **Dark but not black:** in the CPU picture from the start, the mean luminance is between 0.05 and 0.32, and between 0.05% and 12% of pixels are over 0.55 (the fire).
- **Walk map:** a wall is anything that rises more than a step. Arches and tree crowns with 1.8 of clearance under them can be walked under. Keep the paths wide (2 or more), because the camera follows close.
