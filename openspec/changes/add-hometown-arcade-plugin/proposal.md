# Add the Hometown Arcade Hermes plugin

## Why

The Hermes Agent plugin hackathon (due 11 November 2026) wants plugins that do more than a prompt or a skill can. NORD already turns OpenStreetMap data for Parc La Fontaine into a playable Unreal map. Hometown Arcade brings that idea to any address and any Hermes user, with no engine install: the agent builds a drivable browser game of a real place, writes missions from the real places nearby, and reads the player's times back.

## What changes

- New plugin folder `hermes-plugins/hometown-arcade/` with a Hermes `plugin.yaml`, six tools (`hometown_build`, `hometown_places`, `hometown_mission`, `hometown_open`, `hometown_scores`, `hometown_maps`), the `/hometown` slash command and one bundled skill.
- A dependency-free WebGL2 game page written per map: buildings with heights and windows, streets, paths, parks, water, trees, sun shadows, three times of day, car, bike and on-foot play, missions, free roam, minimap, place labels, touch controls and synth sound.
- A local web server on 127.0.0.1 that serves the pages and takes finished runs at `/api/results`.
- Unit tests, a browser test, and a path-filtered workflow `.github/workflows/hermes-hometown.yml`.

## Out of scope

- No arcade cabinet. The plugin makes a page per map inside the user's Hermes data folder; there is no fixed route under `public/` to put on a machine.
- No change to NORD, the arcade, or other games.
- The Hermes catalog pull request goes to `NousResearch/hermes-agent` from the repository owner's account. This change only drafts its entry.
