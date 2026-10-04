# Tasks

- [x] Cut the sprites from the existing art into `assets/sprites.webp`, and make the title and far-layer WebP files (`qa/moonwell/sprites.sh`).
- [x] Generate an endless, seeded row of islands with flippers, slopes, inlanes, gates and shrines (`world.js`).
- [x] Write the physics: motor flippers, rolling, grip, bumpers, mills, lanterns, posts and gates, with substeps (`physics.js`).
- [x] Write the rules: pearls, the moonbeam, the shield, the streak and multiplier, the moon meter and Moonrise, rails, portals, shrines, charms, big pearls, the pace ramp (`run.js`).
- [x] Add a bot with a skill level for the attract mode and the QA runs (`bot.js`), and tune the flippers and difficulty with it.
- [x] Draw the world: sky and moon meter, the painted far layer, hills, islands by region, water, features, rails, flippers, the pearl, particles and popups (`render.js`).
- [x] Make the sound effects and the music loop (`audio.js`).
- [x] Build the page: title with attract mode, the head-up display, hints, the charm, pause and end dialogs, keys, touch halves, gamepad, the camera, the save (`game.js`, `index.html`, `scene.css`).
- [x] Show the best run on the arcade machine, with new machine art and the switcher entry.
- [x] Add node checks for the world and for play, a bot balance report, and browser checks.
- [x] Run the arcade checks (`qa/arcade/machines.mjs`, `qa/arcade/quiet.mjs`) for the Moonwell machine and page.
- [x] Update `AGENTS.md` and the README.
- [x] Validate the change with the OpenSpec CLI.
