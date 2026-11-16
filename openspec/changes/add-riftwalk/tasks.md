# Tasks

First version (shipped in pull request 836, then replaced):
- [x] Four PINOC worlds, the wisp walk, its packer, its tests and its cabinet.

The hall of portals:
- [x] Make a draft world and the full world with the World Labs API; record the prompt and the ids.
- [x] Remove the wisp game, its worlds, its packer and its tests.
- [x] Write the rules (`hall.js`) and their node test, with the check against the homepage rows.
- [x] Write the page: the hall, the two rings of portals, the name card, the buttons, the launch, the list of links.
- [x] Pass `qa/lab/riftwalk.test.mjs` (5 checks) and `qa/lab/riftwalk.e2e.mjs` (8 checks) in software WebGL.
- [x] Look at the real hall with the portals on a captured frame (500,000 splats). It is the cabinet art.
- [x] Update the cabinet words and art, the switcher line, the Corridor piece, the Lab card and the date.
- [x] Pass the static part of `qa/arcade/machines.mjs` for the cabinet (its only failures are for `/x/`, a page on main with no cabinet), and check the homepage at 390, 320 and 1280 px: last of 20 in the Lab row, whole title, 44 px slots and Start.
- [ ] Run the browser parts of `qa/arcade/machines.mjs` again (they passed for this cabinet before the words changed).
- [ ] See the full-resolution file drawn, and play on a real phone and a real graphics card (not possible in this session).
