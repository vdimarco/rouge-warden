# Afterlight rescue mission verification

The rescue iteration passed its Chromium checks and full campaign. Opening text identifies the player as the rescue courier, names three stranded crews and six beacons, and gives the courier pack as the first destination. Projected labels identify YOU and the pack. Actual guide clicks move the player to the pack and grove.

Three viewport runs (1440×900, 390×844 and 844×390) passed spatial collection of three moving fireflies and delivery at the grove, with no duplicate reward. Cancelling or reloading a partially collected catch preserves supplies and grants no reward. Space catches one firefly per sweep; Shift and the touch dodge button activate protection and cooldown. The engine’s collision check verifies protection prevents damage. Landscape fits on screen and no horizontal overflow occurs.

The complete browser campaign passed 17 local tasks, including three firefly deliveries and three coastal escorts, followed by six direct beacon activations. Completed saves, exploration after the ending, a fresh rescue, blocked/malformed storage, pause, pagehide, switcher pause and arcade cabinet launch passed. A focused normal-motion check confirms spatial catching stays unzoomed and the visible guide follows the live firefly target. No uncaught browser errors or missing local assets occurred. Root verification also reports 31 passing pure tests and exact incremental/full-render matches for 12 region/motion combinations plus travel and resize.

Evidence: `/tmp/afterlight-rescue-mission/opening-{1440,390,844}.png`, `catch-ready-{1440,390,844}.png`, `mission-{1440x900,390x844,844x390}.png`, and `report.json`. Full campaign evidence is in `/tmp/afterlight-living-worlds/report.json` and the updated operation screenshots.

Run `node qa/afterlight/rescue-mission.e2e.mjs` and `node qa/afterlight/living-worlds.e2e.mjs` against the static server on port 8765. Movement helpers advance actual engine input and query moving positions; no player coordinates, resources, answers or completion flags are injected.

Original ASCII scenes, dot-grid objects, regional palettes and restrained monospace controls remain. Readable projected labels and explicit rescue instructions intentionally add orientation. Forest work now occurs in the landscape instead of a bearing puzzle; final beacons provide a direct payoff rather than repeating another operation. Physical devices and other browser engines remain untested.
