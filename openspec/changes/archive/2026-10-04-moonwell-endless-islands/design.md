# Design

## The loop

Moonwell is a side view. Gravity pulls down the screen. Each bowl is a valley between two island ridges, with a gap over the water at the bottom and a pair of gold flippers over the gap. The pearl rolls down a slope and an inlane onto a flipper. The left flipper sends it up and right, over the next ridge. The right flipper sends it up and left, back into the bowl. So the left flipper is the shot and the right flipper is the pass, as on a real table, where a flipper sends the ball across.

A shot from early in the flipper's length falls back into the same bowl. A shot from the middle clears one ridge. A late "sweet spot" shot near the tip often clears two: a long shot. `qa/moonwell` measured this curve on 42 bowls at seven points along the flipper, and the flipper speed (16 rad/s) comes from it.

When the pearl crosses a ridge, a moon gate closes on that ridge. The run only goes forward, the camera never needs to go back, and a strong pass bounces off the gate into the bowl.

## Files

All under `public/moonwell/`, as plain ES modules with no build step.

- `world.js`: the seeded generator. Islands are made 4 ahead of the pearl and dressed with features once the islands after them exist, because a rail or a portal needs them. Islands 2 behind the pearl are dropped. One RNG per island (from the seed and the island number) keeps every island the same whatever order the code asks for them.
- `physics.js`: the pearl against slopes, flippers, bumpers, mills, lanterns, posts and gates. A tick is cut into substeps so the pearl moves at most a third of its radius per substep. A flipper is a tapered capsule on a motor. The pearl bounces relative to the flipper's own surface speed, and the rubber grips it, so cradles, drop catches and aimed shots work. A rolling pearl speeds up at 5/7 of a sliding one.
- `run.js`: the rules. Fixed 1/120 s ticks. It sends events (`score`, `ridge`, `drain`, `rail`, `moonrise` and others) for the page to draw and play.
- `bot.js`: a bot with a skill level. It flips at a point it picks for each approach, reacts late or early, and misses now and then. The title runs it as an attract mode. The QA runs use it to tune the game.
- `render.js`: canvas drawing. Sky, stars and a moon that fills with the moon meter. The left half of the painting (`far-islands.webp`, mirrored so it repeats) as a misted far layer. Procedural hills, islands with a stone pattern and grass, decorations by region, water in each gap, features, rails, the best flag, the flippers and the pearl, particles and score popups.
- `audio.js`: Web Audio effects and a music loop with a lookahead scheduler.
- `game.js`: input, the loop, the camera, the head-up display, hints, dialogs and the save.

`assets/sprites.webp` comes from the existing art: `qa/moonwell/sprites.sh` cuts the bumper, portal, star and pearl from `pinball-atlas.png` by their distance from its navy ground, and takes the flipper and ball from `scene-sprites.png`. The game mirrors the left flipper for the right one.

## Pacing and difficulty

- A director picks each bowl's features: a star shape (an arc on the ideal shot, a high arc, a line over the ridge, a zigzag, or a ring round a bumper), bumpers, lanterns, a mill, a rail or a portal, and a big pearl on every tenth island. The ideal shot's arc places the stars, so the stars teach the shot.
- Difficulty rises over the first 60 islands and creeps on after that. Ridges get taller, the flipper gap gets wider, there are more bumpers and mills, and the pace (a time scale on the physics, from 1 to 1.28) rises. A time scale keeps every shot the same shape and only makes it quicker.
- The first three islands have a moon post between the flippers. The first pearl has a 6 s moon shield, and later pearls have 3 s.
- Every eighth island is a shrine: its right ridge is sealed, and the moonwell sits on the ideal shot and pulls a passing pearl in.
- Bot runs (`node qa/moonwell/bot.mjs 16 <skill> 8`): a casual bot (0.5) reaches island 17 in about a minute, a good one (0.75) island 34 in about two minutes, an expert (0.95) island 83 in about five.

## Scoring

The multiplier is 1 + one for every two ridges in a row, up to x8. A drain resets it (Steady Tide halves it). Moonrise doubles all points for 12 s. The moon meter gains are small enough that a good player sees Moonrise about once a minute. Bonuses: swift (a ridge within 4.5 s of arriving), long shot (two or more ridges in one flight), clutch (a flip that saves a pearl below the flipper line), rail, portal, lanterns, big pearl and shrine.

## Camera

The camera keeps the current bowl's flippers 30% up from the bottom edge, and the bowl and the next ridge in view when they fit. It follows the pearl with a lead in the direction it moves, and never lets it leave the screen sideways. A pearl going up fast makes the camera zoom out ahead of it, down to 60%. Base scale: about 900 world units tall and at least 760 wide, so a phone in portrait still shows a bowl. On a phone in portrait the moonbeam can sit left of the screen's left edge before the drop, so the next ridge comes into view as the pearl rolls to the flippers.

## Feel

Each hit has a sound, particles and a popup. Big moments add a short hit pause (50 to 100 ms) and a screen shake, which reduced motion turns off. Glows are stamped from cached sprites, and the vignette is drawn once per screen size. A CPU profile shows our code under 5% of a frame, and the rest is the browser's own drawing. In this container's software renderer, 1280 by 720 runs at about 44 fps and 390 by 844 at 60.

## Save and arcade

`moonwell.best.v1` holds `{ score, island }`, the best of each over all runs. The machine shows `BEST 12,345 · ISLAND 17` and keeps its plain line for a missing or junk save. Mute is `moonwell.muted.v1`. Hints stop after a player reaches island 4 once (`moonwell.seen.v1`). The page loads `/arcade/quiet.js` first and `/arcade/switch.js`, and has Switch game buttons on the title, pause and end screens.
