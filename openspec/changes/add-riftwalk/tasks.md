# Tasks

First version (shipped in pull request 836, then replaced):
- [x] Four PINOC worlds, the wisp walk, its packer, its tests and its cabinet.

The hall of floating portals (replaced after the user saw it):
- [x] A draft world and a full world with the World Labs API, a ring of portals, tests and cabinet.

The den of machines whose screens are portals:
- [x] Make a darker, denser world with cabinets in a circle and white screens; record the prompts, ids and costs in `worlds/sources.json`.
- [x] Find the screens in the panorama (`find-screens.py`) and place them in the world (`place-screens.mjs`); write `worlds/screens.json`.
- [x] Write the rules (`hall.js`): seats for games, pages, pick, facing, neighbour, walk. Node test with the check against the homepage rows.
- [x] Write the page: a portal with a live edge on each screen, names over the screens, collection buttons, More, the name card, the launch, the list of links.
- [x] Pass `qa/lab/riftwalk.test.mjs` (5 checks) and `qa/lab/riftwalk.e2e.mjs` (8 checks) in software WebGL.
- [x] Look at the real world with the portals on a captured frame (150,000 splats, `shots/hall-machines.jpg`). The portals sit on the machine screens. The frame is the cabinet art.
- [x] Update the cabinet art, the switcher line, the Corridor piece, the Lab card and the date.
- [x] Pass the static part of `qa/arcade/machines.mjs` for the cabinet.

The bigger hall with zones:
- [x] Make three more worlds for the zones (amber, green, violet); record prompts, ids and costs.
- [x] Find and place the screens of each zone; `face-screens.py` for the Cottage world; `door-art.py` for the door pictures.
- [x] Rules: `ZONES`, `zoneGames`, `doors`. Page: zone worlds that load on the way, rift doors, zone buttons and keys.
- [x] Pass `qa/lab/riftwalk.test.mjs` (20 checks) and `qa/lab/riftwalk.e2e.mjs` (9 checks, with two real 150,000-splat zones).
- [x] Look at each zone and a door in a captured frame of the real worlds (150,000 splats, `shots/zones.jpg`).

One zone for each category, and higher fidelity:
- [x] Six zones in the homepage order; Strategy and GTA from the two earlier worlds; door rule for an open wall.
- [x] Full-resolution file for every zone; neighbour zones loaded ahead; three worlds kept in memory; art colours and filtering.
- [x] Pass `qa/lab/riftwalk.test.mjs` (28 checks) and `qa/lab/riftwalk.e2e.mjs` (9 checks).
- [x] Look at the Strategy and GTA zones in captured frames of the real worlds (`shots/zones.jpg`).

A cleaner look:
- [x] Tube look for screens, names only for the machine in view, idle machines in the zone's colour, arch doors, the GTA world's own arches, a look for each zone, the zone banner.
- [x] Pass both tests again; look at three zones in captured frames (`shots/look.jpg`).

Magic:
- [x] Motes in the air, sparks and stars at the doors, a glint on the screen in view, a blooming light on the way through.
- [x] Pass both tests; look at the motes over two real worlds (`shots/magic.jpg`).
- [ ] See the 500,000 and full-resolution files drawn with the portals (software WebGL was too slow for a frame at that size in this session).
- [ ] Play on a real phone and a real graphics card (not possible in this session).
