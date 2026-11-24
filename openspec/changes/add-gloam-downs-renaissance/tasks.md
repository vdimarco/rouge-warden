# Tasks

## 1. The bake
- [ ] 1.1 `bake.mjs`: export `LATTICE`; `node bake.mjs lattice` bakes the three; a biome with `run: false` gets no zones and `ctx.zone()` stops its bake; its JSON has `set: 'lattice'` and no `zones`. The default list stays the five.
- [ ] 1.2 `lib/check.mjs`: for `set: 'lattice'`, the wisp colour rule (RGB distance 60 or more from slots 39 and 40) and the digital line rule (luminance under 0.55).
- [ ] 1.3 `lib/renaissance.mjs`: `column`, `arcade`, `balustrade`, `wireSolid` (cube, octahedron, icosahedron, dodecahedron, rhombicuboctahedron), `voxelBreak`, `gridLines`, `haloSun`, `mazzocchio`.
- [ ] 1.4 `biomes/piazza.mjs`: The Vanishing Piazza, as the design's brief.
- [ ] 1.5 `biomes/cupola.mjs`: The Broken Cupola, with `dome`, `drum`, `coffers` and `herringbone`.
- [ ] 1.6 `biomes/orrery.mjs`: The Orrery Isles, with `isle`, `bridge`, `spiralStair` and `armillary`.
- [ ] 1.7 Bake each with `--check --preview --out <dir>` until every line is `ok`, and the three files are 1.40 MB or less. Note the splats, sizes and luminance in design.md.
- [ ] 1.8 Look at the four previews of each place. Write a line for each in the build notes (the landmark from the start, the digital colour, the sky bands, the break into blocks, the ways back up).
- [ ] 1.9 Confirm that `git status` shows no change to the five places' baked files.

## 2. The explorer
- [ ] 2.1 `save.js`: `LATTICE`, `latticeOpen()`, `latticeWisps()`, and `clean()` for the Lattice's wisps, lit beacons and `at`. `ORDER`, `fresh()` and `wispCount()` stay.
- [ ] 2.2 `places.js` (new, no DOM): `LATTICE_NAMES`, `placeName()`, `nextOf()`, `mapGroups()`, and the choice for `?place=`.
- [ ] 2.3 `main.js`: the Map's two groups and the count line; the arrival card; `lightBeacon()` for the Lattice; Walk again keeps the Lattice; the walk time counts only on the downs; the HUD hint; `?place=`; the loading line names.
- [ ] 2.4 `index.html`: the group headings' style, two columns at 760 px wide and more, compact rows under 700 px high, and one line on the help card about the Lattice.
- [ ] 2.5 README: the Lattice places, `run: false`, `node bake.mjs lattice`, and the new checks.

## 3. Checks
- [ ] 3.1 `qa/lab/gloam-downs-lattice.test.mjs`: budgets, palettes, colour rules, the save, `mapGroups()`, `?place=`.
- [ ] 3.2 `qa/lab/gloam-downs-stairs.test.mjs`: add the three to `FLIGHTS`; run it for the three.
- [ ] 3.3 `qa/lab/gloam-downs-lattice.e2e.mjs`: the Map at 1280×720, 390×844 and 320×640 with screenshots; loads by the Map and by `?place=`; a lit Lattice beacon; a reload; the last Lattice beacon; Walk again.
- [ ] 3.4 Run the existing checks unchanged: `gloam-downs.test.mjs`, `gloam-downs-run.test.mjs`, `gloam-downs.e2e.mjs`, `gloam-downs-run.cards.e2e.mjs`.
- [ ] 3.5 Validate this change with `openspec validate add-gloam-downs-renaissance --strict`.
- [ ] 3.6 Say which checks could not run (phone GPU, real touch screen).
