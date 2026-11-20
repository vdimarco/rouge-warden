# Tasks

## Bake

- [x] Pin Ink Studio in `games/gloam-downs/package.json` and copy its WebGL renderer into `public/lab/gloam-downs/ink/` (`vendor.mjs`)
- [x] Shared kit in `games/gloam-downs/lib/`: palette with shared fire, wisp, cloak, iron and lamp colours; rolling hills; terrain rings; walk map; lamplighter with bones; props
- [x] Bake script with `--check`, `--preview` and `GLOAM_COUNT`, and the spec's budget and darkness rules in `lib/check.mjs`
- [x] Lamp light falls off as a warm ramp, on a material and on its `top`
- [x] The Gaol
- [x] The Ramparts
- [x] The Fen
- [x] The Bells
- [x] The Barrows
- [x] A polish pass on each place
- [ ] Bake all five places with the final kit, every rule `ok`, and commit the baked files

## Page

- [x] Explorer page `public/lab/gloam-downs/`: loading bar, help, map, end card, toasts
- [x] Controller: walk, run, jump with coyote time and a jump buffer, step-up, slopes, walls, ledges, falls; camera that pulls in near walls
- [x] Keyboard, mouse, touch stick and look, jump button, gamepad
- [x] Wisps, the beacon, unlocks, the next place, the end card when all five beacons burn, and Walk again
- [x] Saved progress, and a bad save is cleaned
- [x] Art size that adapts to the frame time, `?q=low|mid|high`, and a manual `?test` mode for software WebGL
- [x] A message when WebGL 2 or DecompressionStream is missing, and Try again when a place does not load

## Arcade

- [x] Cabinet at the end of the Lab row, marquee rules at 320 and in short windows
- [x] Switcher entry with `labOnly: true`, Lab page card, All Games dates
- [x] Corridor cabinet 46, counts and light slots for 47 cabinets
- [x] `qa/arcade/machines.mjs` and `qa/lab/riftwalk.e2e.mjs` counts
- [ ] Cabinet and Corridor art from the final bake (`node games/gloam-downs/art.mjs`)

## Checks

- [ ] Node tests: `node qa/lab/gloam-downs.test.mjs`
- [ ] Browser checks: `node qa/lab/gloam-downs.e2e.mjs`
- [ ] `node qa/arcade/machines.mjs` with the site served
- [ ] Homepage screenshots at 390, 320 and 1280 for the pull request
- [ ] `openspec validate add-gloam-downs` (or report that the CLI could not run)
- [ ] Frame rate on a real GPU and on a real phone
