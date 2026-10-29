# Tasks

- [x] Add one instanced curb mesh (bin, bollard, hydrant) on the prop material
- [x] Place it on both sidewalks, clear of parks, carriageways, the Needle, and the Dome
- [x] Confirm the street view shows the furniture and the city render check passes

## The triangle budget (2026-10-29)

- [x] Find the cause: `perf` failed on main; a bisect named this change. The one curb mesh sent 2,446 x 132 = 322,872 triangles in every view.
- [x] One instanced mesh per kind (bin, bollard, hydrant).
- [x] Send only the spots inside the fade (`nearProps`), for the curbs, the lamps, and the steam.
- [x] `perf`: all 15 checks pass. Title `start` 956,298 to 611,790 triangles; flat play `harbour` 1,140,976 to 796,444 (the budget is 800k).
- [ ] Compare the `street`, `start`, `canyon` and `harbour` shots in flat play before and after.
- [ ] Run the suites that draw the city: `render`, `flat`, `street.e2e`, `play`, `boot`.
- [ ] A headset check: frame time at 72 Hz on a Quest. It cannot run here.
