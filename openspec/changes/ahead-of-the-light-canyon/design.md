# Design: the canyon run

## Sources

- **The look** is adapted from Null Range (nullrange.com), the user's reference: we flew it in a browser and took
  its parts: points with contour lines for the ground, the orange instruments, scanlines and the colour split, the
  sonar ping, boost, and the orange-and-black title page. We use our own code, words and layout.
- **The colour split, scanlines and vignette** follow the idea of three.js's `RGBShiftShader` example (sample red and
  blue a little apart from green, growing toward the screen's edge), written as one small post shader.
- **The point-cloud ground** is a plain height field sampled on a grid and drawn as GL points; the contour lines
  are the points whose height is near a multiple of 3 m (`fract(y / 3)`), the usual way to draw iso-lines in a
  shader. No outside source fit the ring-buffer streaming better, so it is ours: rows on a fixed x grid, and only the
  rows that come into reach are computed each frame.
- **The FOV widening with speed** is the usual racing-game trick (Wipeout and F-Zero do it): 74° at cruise up to about
  92° at full boost, 92° base on a tall phone.

## Decisions

- **One world function.** `core/world.js` gives the height at any (x, d) for a seed: value-noise floor, walls about
  1.5 m up per metre across, spires on the floor, and gates in the air. The renderer, the flight, the bots and the
  tests all read it, so what you see is what you hit.
- **Strafe, not yaw.** The ship always faces down the canyon; you strafe and climb. Strafe grows with speed
  (26 m/s + 0.3 × speed), so the bends never take more than about 80 % of it at full boost (`world.test.mjs`).
- **The light's pace.** The light runs 19 m/s over your cruise (plus up to 11 more by Earth). Cruising alone loses;
  gates and boost win. Tuned with the bot: a good bot gets home on most seeds, a weak one is caught on some
  (`flight.test.mjs`).
- **Sonar is the eyes.** The ground fades out about 450 m ahead; a ping lights it out to about 2.6 times as far for
  1.2 s and marks the gates within 650 m for 7 s, with brackets and their distance.
- **Above the canyon** (64 m) the burst's light burns the shield and then the hull, so you stay low.
- **Two grids.** A wide grid (2.4 m, or 3.4 m on low tier) out to the fog, and a fine one (1.1 m, or 1.6 m) that
  follows the canyon's middle for the first 150 m, so the ground under you is dense.
- **Tiers.** `high` (the post pass, finer grids) on a computer; `low` (no post pass) on a touch screen with less than
  4 GB or 4 cores; `?tier=` overrides.
- **Touch.** A drag anywhere on the view is a stick from where it started; BOOST is held and SONAR tapped, bottom
  right; pause top left. On a narrow screen the HUD's bottom bars lift clear of the buttons.

## How we check the look and the pace

- `smoke.e2e.mjs` keeps screenshots of the title, a ping, a sector banner, the result and the home card at five sizes
  in `/tmp/ahead-of-the-light-smoke`; the HUD parts must be on screen and clear of the touch buttons.
- `__race.frameMs()` reports the CPU time per frame; under SwiftShader it was about 1.5 ms p50 on desktop and 0.6 ms on
  a phone size.
