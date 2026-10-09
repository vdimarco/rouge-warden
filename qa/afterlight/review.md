# Afterlight browser review

The complete campaign and integration suite passed with system Chromium. Campaign QA uses the public engine movement API in bounded timestep batches to walk to landmarks. Tools, landmark choices, menus and travel use actual page controls. Tests never assign positions, inventory, restoration flags or completion state.

Validated behavior:

- Complete all six regions through legal movement, tool use, resource costs and restoration prerequisites.
- Spend salvage on a shield, encounter the resulting scrap shortage, and recover through emergency salvage and free camp rest.
- Exhaust expedition energy through legal time advancement; preserve the lost save on reload; recover at camp with the restored forest retained.
- Carry inventory and tools across travel, return to the restored forest, and deliberately resume the saved city expedition.
- Preserve a completed save, explore the restored forest after victory, and begin a genuinely fresh journey.
- Keep ready-state journal browsing from starting play; freeze campaign time while paused or in travel/journal menus.
- Support keyboard movement, held touch controls and pointer cancellation; pause on pagehide and game switching.
- Launch Afterlight through the arcade machine picker using token 5 and start 1.
- Remain playable with malformed or blocked local storage.

Actual canvas changes with reduced motion enabled:

| Region | Changed pixels | Total pixels |
| ------ | -------------: | -----------: |
| Forest |         65,117 |      566,048 |
| City   |        101,648 |      566,048 |
| Coast  |         24,704 |      566,048 |
| Fjord  |         91,179 |      566,048 |
| Desert |         21,744 |      566,048 |
| Moon   |         40,468 |      566,048 |

All three layouts pass without horizontal overflow: 1440×900 desktop, 390×844 portrait and 844×390 landscape. Landscape document height is exactly 390px, with the scene and controls visible together. Portrait uses normal vertical scrolling for the full journal/context/footer content. Responsive review caught invalid `and(` CSS media-query syntax and a further 25px landscape overflow; both were corrected and rechecked.

Before/after world screenshots and layout screenshots are in `/tmp/afterlight-qa/`. The machine-readable result is `/tmp/afterlight-qa/report.json`. World snapshots explicitly render current state before capture. A separate post-win screenshot caught the brief frame before the next scene render and was removed; the snapshot helper now renders before that capture as well.

Original scenes blend with the new objects through the same dot grid and palette. Decisions include protection versus saved salvage, tool efficiency versus salvage, carried seeds versus permanent light capacity, and coast-first versus city-first travel. The browser campaign takes the salvage/protection path; alternate efficiency/nurture and coast-first paths are covered by engine tests.

Commands:

- `node qa/afterlight/campaign.e2e.mjs` runs the full campaign and integration checks.
- `AFTERLIGHT_LAYOUTS_ONLY=1 node qa/afterlight/campaign.e2e.mjs` checks UI, arcade and storage without repeating the campaign.
- `AFTERLIGHT_LAYOUTS_ONLY=1 AFTERLIGHT_VIEWPORT=844 node qa/afterlight/campaign.e2e.mjs` focuses on landscape plus arcade/storage checks.

Physical devices and non-Chromium browser engines have not been tested.
