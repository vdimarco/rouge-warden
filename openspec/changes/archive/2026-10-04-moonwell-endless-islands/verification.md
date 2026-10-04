# Verification

Run on the final tree, with `public/` served at http://127.0.0.1:8765/ and Playwright from `/opt/node22/lib/node_modules` (Chromium with a software GPU).

- `node qa/moonwell/world.test.mjs`: 9 checks pass. The same seed gives the same 61 islands, and another seed gives other islands. 1,000 islands join up, their numbers are sound, and no more than 12 are kept at once. Every eighth island is a sealed shrine. Over 40 seeds, no rail or portal skips a shrine, and rails end over the left slope of their last island. Over 30 seeds, nothing sits in the ground or over the flippers. Ridges, the flipper gap and mills grow with distance, and the first three islands have a moon post.
- `node qa/moonwell/play.test.mjs`: 17 checks pass. An unflipped pearl drains, and the moon post stops it. A raised flipper cradles the pearl. A late flip (at 0.72 of the flipper) clears the ridge in at least 75% of 24 tries, and an early one (0.1) in at most 20%. The right flipper sends the pearl left, and it never passes a closed gate. Over 6 bot runs of 40 s, the pearl is never inside an island. A bumper kicks. The multiplier goes 1, 2, 2, 3 and stops at 8, and a drain resets it. Two ridges in one flight are a long shot. Moonrise starts, doubles points, saves a drain and ends. A rail counts each island and closes their gates. A portal moves the pearl two islands. A shrine offers three different charms, and Second Breath adds a pearl. A big pearl stops at five pearls. The next pearl waits and drops after 3 s, and three drains end the run. The same seed and play give the same run. A 15-minute bot run passes island 150 with no bad numbers.
- `node qa/moonwell/bot.mjs 16 <skill> 8`: a casual bot (0.5) reaches island 17 (median) in 59 s on average, a good bot (0.75) island 40 in 126 s, and an expert (0.95) island 83 in 286 s. A good bot lights about 10 lanterns, takes 1.2 rails and 0.5 portals and sees 2.5 Moonrises per run.
- `NODE_PATH=/opt/node22/lib/node_modules node qa/moonwell/smoke.e2e.mjs`: 41 checks pass.
  - 1280 by 720: the title with the attract bot, the plain best line, the drawn canvas, Play, the first hint, Space drops the pearl, Z and → raise the flippers, Escape pauses and resumes, nothing moves while paused, blur pauses, and the sound button mutes and remembers it. In 20 s of bot play, the camera moves more than 2,500 units right, the pearl stays on the screen sideways in every sample, and the bowl's flippers are on the screen in at least 74 of 80 samples. No console errors.
  - A bot plays to a shrine. Three charms show, and the 2 key picks the second. The last pearl drains, the summary shows, the save holds the score and island, Space starts again at island 1, and the best flag stands on the saved island.
  - Four junk saves leave the page without errors and with a plain best line.
  - 390 by 844 with touch: with the pearl at the flippers, both flippers and the next ridge are on the screen. Two touches hold both flippers, and each one lifts on its own. The head-up display fits on one line.
  - 844 by 390: the bowl is on the screen.
  - With reduced motion, 12 s of play never shakes the screen.
- `QUIET_URL=http://localhost:8765 node qa/arcade/quiet.mjs --only=moonwell --skip=unit`: 31 of 31 checks pass. The sound starts, stops while the page is hidden (emulated, pagehide, another tab on top, a frozen page), and starts again.
- `PARTS=walk,switcher,saves,credits,focus,backlinks node qa/arcade/machines.mjs`: all pass. The machine and its switcher entry match, the new art is a 9 KB WebP, a token and START go to `/moonwell/` at 390 by 844 and 1280 by 720, junk saves leave every line plain, and a save of 12,345 at island 17 shows BEST 12,345 · ISLAND 17.
- `PARTS=layout node qa/arcade/machines.mjs`: 277 checks pass, then the swipe step at 375 by 667 stops. The Follow Suit change found the same stop on `main` with 22 machines on this container's software GPU. This change adds no machine.
- Frame rate in headless Chromium with a software GPU, bot playing: 390 by 844 holds 60 fps. 1280 by 720 runs at about 44 fps. A CPU profile puts our code under 5% of a frame, and the rest is the browser's software drawing.
- Screens looked at by eye: the title, play, a long shot, Moonrise, a gold rail with a loop, a shrine's charms, and the end of a run, at 1280 by 720, 390 by 844 and 844 by 390.

## Not checked

- A real phone, Safari on iOS, and a real GPU.
- Sound through real speakers. The effects and the music run with no errors, but nobody has listened to them.
- A real gamepad. The code reads the standard mapping: the shoulder buttons flip, A drops and confirms, B or Y pulses, and Start pauses.
