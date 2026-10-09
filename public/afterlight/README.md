# Afterlight

A connected adventure at `/afterlight/` through the six original ASCII scene worlds. Supplies, health, tools, choices and restored terrain persist between places.

## Play

Move with arrows/WASD or the touch pad; tap the scene to set a walking destination. Approach a glowing landmark and use E or its contextual action. Space uses a local tool. M opens travel, J opens the journal, and P pauses. Menus, hiding the page and game switching stop expedition time.

Wake the forest groves, reconnect the city, rescue coastal crews, recover fjord bells, revive a desert oasis and carry seeds into lunar gardens. Forest restoration opens both city and coast: choose which to explore first. Harbor restoration needs the city's sonar, so supplies and tools connect the branches again. The fjord compass reveals the desert's true route. Seeds harvested or nurtured in the forest are spent in the oasis and on the moon.

Each grove offers more seeds or a permanent increase in energy capacity; the courier pack can become immediate salvage or a more efficient tool. A shield consumes salvage but reduces hazard damage. Camps refill resources and set checkpoints; emergency salvage prevents spent supplies from trapping the journey. Tool pulses briefly calm hazards. Lunar gardens progressively change the local debris field.

Your journey saves locally when storage is available. Reloads require a deliberate continuation. Invalid or blocked storage leaves the game playable. Exhaustion recovers at camp while retaining restoration. After the ending you can explore the restored network or begin a new journey.

## Engine and operations

Phaser 3.90.0 drives the scene clock, camera, dynamic ASCII texture, keyboard/pointer input, transitions and feedback tweens. The pinned runtime and MIT license are bundled locally. The deterministic campaign model remains independent for saves and checks.

Landmark operations require active decisions: rotate and focus forest light, reconnect city conductors, tether and escort drifting crews, read fjord echo channels, align desert bearings, and meet a garden’s changing needs. Numeric keys select operation choices; all choices also have native buttons. Leaving an operation keeps supplies. Rewards and costs apply once on successful completion. Movement stays available during coastal towing.

## Living scenes

Original locally bundled MIT scenes come from bas3line/ascii: misty-forest, tokyo-rain, night-coast, aurora-fjord, desert-night and earthrise. Imports reuse the existing copies beside the six standalone games, which retain source licenses. The adapter changes character cells, structures and colors in response to local progress. Weather cycles, spatial terrain, currents, moving crews and seed streams affect exploration while playing. Completed work unfolds into local growth and changes the landscape rather than switching only a static flag. Reduced motion freezes decorative changes in time while retaining permanent restoration and gameplay.

Original artwork and the refined Last Light dot-grid direction are the visual reference; no raster assets replace the user's requested ASCII art. Gameplay silhouettes, landmarks and changed terrain share the source's 200×100 dot grid. Landscape phones put interaction choices beside the scene; portrait phones keep square dots and reachable controls.

## Checks

`node --test qa/afterlight/*.test.mjs` checks legal campaigns, alternate route/resource choices, loss/recovery, upgrades, tool protection, save validation, restoration cells, optional grove blooms and active weather. `node qa/afterlight/living-worlds.e2e.mjs` uses system Chromium and the static server at localhost:8765 for the connected UI journey, scene changes, storage, menus, keyboard/touch, arcade launch and desktop/phone views.

The compositor check `node qa/afterlight/render.e2e.mjs` compares incremental and full redraws across all regions, travel, resizing and motion settings. The original `campaign.e2e.mjs` command remains a compatibility entry for the current browser campaign.

See `qa/afterlight/living-worlds-review.md` for final verification details. Physical devices and other browser engines are not covered.
