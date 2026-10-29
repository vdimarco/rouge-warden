# Tasks

- [x] Add one instanced curb mesh (bin, bollard, hydrant) on the prop material
- [x] Place it on both sidewalks, clear of parks, carriageways, the Needle, and the Dome
- [x] Confirm the street view shows the furniture and the city render check passes

## The triangle budget (2026-10-29)

- [x] Find the cause: `perf` failed on main; a bisect named this change. The one curb mesh sent 2,446 x 132 = 322,872 triangles in every view.
- [x] One instanced mesh per kind (bin, bollard, hydrant).
- [x] Send only the spots inside the fade (`nearProps`), for the curbs, the lamps, and the steam.
- [x] `perf`: all 15 checks pass. Title `start` 956,298 to 611,790 triangles; flat play `harbour` 1,140,976 to 796,444 (the budget is 800k).
- [x] Compare the `street`, `start`, `canyon` and `harbour` shots in flat play before and after (960x540). They look the same: the near bollard, lamps and steam show. The pixels that changed (57 to 4,646 of 518,400) are on the moving cars, the steam puffs and the window flicker.
- [x] Run the suites that draw the city, each alone: `render` 51, `flat` 221, `street.e2e` 21, `play` 88, `boot` 34, `perf` 16, `city.test`: all pass.
- [ ] A headset check: frame time at 72 Hz on a Quest. It cannot run here.
- Note: flat play `harbour` has 3.6k triangles to spare. The crowd's shoulder line (`full-swing-character-read`) took 240 triangles a figure from 96, about 17k more in that view, so the next addition to that view may need its own saving.
