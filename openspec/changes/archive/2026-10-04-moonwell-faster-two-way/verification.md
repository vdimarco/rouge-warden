# Verification

Run on the final tree, with `public/` served at http://127.0.0.1:8765/ and Playwright from `/opt/node22/lib/node_modules` (Chromium with a software GPU).

- `node qa/moonwell/world.test.mjs`: 9 checks pass. Over 1,000 islands, each floor steps 40 to 140 down, the ridge behind each bowl is taller than the one ahead was, and the world keeps 40 islands behind with a wall.
- `node qa/moonwell/play.test.mjs`: 20 checks pass. New: the pearl goes back over a ridge with no change to the score or the streak, and going forward again over that ridge pays nothing; a drain behind the furthest island brings the next pearl back in that island; a second rail ride pays no bonus; a shrine's seal opens and its spent well stays shut; the oldest island kept is 40 behind, and the pearl cannot pass its wall; the pace is at least 1.2 at the start and 1.5 from island 61. A late flip still clears the ridge, and an early one still falls back.
- `node qa/moonwell/bot.mjs 16 <skill> 8`: see the balance in `design.md`.
- `NODE_PATH=/opt/node22/lib/node_modules node qa/moonwell/smoke.e2e.mjs`: 43 checks pass. New: a strong pass goes back an island, the camera follows it left and keeps the pearl on the screen, and the head-up display shows the furthest island. The reduced-motion check now forces a drain, which always shakes the screen unless motion is reduced.
- `QUIET_URL=http://localhost:8765 node qa/arcade/quiet.mjs --only=moonwell --skip=unit`: 31 of 31 checks pass.
- Frame rate, the bot playing, measured back to back with `main` in the same container: 1280 by 720, 31 fps against 28 on `main`; 390 by 844, 59 fps against 57. The container was slower than when the first version was measured, so these numbers are for comparison only.
- Screens looked at by eye: play with the stepped islands, and a trip back with ISLAND 4 · FURTHEST 5 on the head-up display.

## Not checked

- A real phone, Safari on iOS, a real GPU, sound through speakers and a real gamepad.
