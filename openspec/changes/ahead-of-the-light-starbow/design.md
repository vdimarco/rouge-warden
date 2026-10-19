# Design: the starbow, in ascii

## Sources

- **ascii.rest** (github.com/bas3line/ascii, MIT, v0.4.0, commit c556be4), the library the user asked for and the one
  the arcade's ASCII Scenes games already use. We vendor its built `mount.js`, `banner.js` and `pieces/galaxy.js`
  unchanged. `mount` draws each (character, colour) pair once into an atlas and copies only the cells that changed,
  which keeps a 160 × 50 grid cheap. The game's frame follows the library's piece contract: `meta` with a 64-colour
  palette, and `frame(t, env)` returning the grid as text with `env.color` filled per cell.
- **The starbow** is the look of the sky near light speed: aberration crowds the stars toward the way ahead and the
  Doppler shift turns them blue there and red behind, with a ring of colour between. We draw it as a hue by distance
  from the centre and a faint rainbow band, not a physical model.
- **Brightness to characters** uses the library's ramp (` .:-=+*#%@`, with `·` added).

## Decisions

- **A tube, not open space.** You stay within 15 m of the line home, so a star in your path is a real choice: left,
  right, up or down. Every slice of the tube keeps a way through (`world.test.mjs`).
- **Skim to win.** A pass within 1.8 m of a star's edge adds 4 % charge, so flying close is how a good pilot outruns
  the light. The bot passes stars closer the better it is.
- **The pace** (light 26 m/s over your cruise, plus up to 14 by Earth) is tuned with the bot: a good bot gets home on
  6 of 8 seeds or more, a weak one is caught on 2 or more (`flight.test.mjs`).
- **The camera** rides 7 m behind and 1.7 m above the ship, so the ship's sprite sits under the way ahead and a star
  you hit passes over it. A star you would hit within a second gets red brackets.
- **HUD at the top** (sector, speed as a fraction of c, the burst's gap, hull, shield, boost and the way home), so the
  bottom stays clear for the ship and the touch buttons.

## How we check the look and the pace

`smoke.e2e.mjs` keeps shots of the title, the flight, a sector's banner, the pause, the result and home at five sizes
in `/tmp/ahead-of-the-light-smoke`, checks the grid fits the window, and reports the time to build a frame (about 2 ms
at 1280 × 800 under SwiftShader, 7 ms at the 95th percentile).

## Depth and crispness (after "a bit too 2d ... less fuzzy")

- Characters are written back to front and a nearer one overwrites a farther one; the haze of half-lit cells (the
  glow round stars and the starbow's band) is gone, and only the flash and the burst's edge still light cells.
- Streaks are lines of `-` `/` `|` `\` along their own direction on screen, with a `*` or `+` head.
- The tube shows as dotted rings every 40 m coming at you and eight lines along its wall to the vanishing point.
- A star is a ball shaded from the upper left (the ascii.rest donut's idea: a normal per cell, a light, a ramp).
  Beyond 60 m stars are drawn up to 1.9 times larger so they read; nearer than that they are their true size, so a
  hit matches what you see.
- The galaxy is drawn in the library piece's own characters.
