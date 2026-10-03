# Design

## Shared decisions

- **Fix before adding.** Each game first gets the bug fixes from its review. A bug that turns one mistake into a spiral counts as a fun problem, not a polish item.
- **A run must be losable, and the best run must be hard to reach.** Games that a simple bot could win at the top score get a fail state and a score that grows with skill.
- **The seed must matter.** Where a game has a seed, the seed now sets the layout. One seed always gives the same layout, so a link or a daily seed is a fair race.
- **Warnings in two senses.** A hazard warns in sight and in sound at least 0.3 s before it hits.
- **Show the ending.** The end of a run gets a short outro, and the end card says how close the player came to their best.
- **Measure.** Where a review measured a number with a bot or sim, the change measures it again, and a test holds the new number.

## The Small Worlds shell

When a game calls `finish()`, the shell keeps calling `update()` and `draw()` for 1.6 s at half speed with input off. Then the result card rises from the bottom as a sheet, so the top of the scene stays in view. The shell, not each game, compares the score with the stored best, so every game says it the same way. Bests use a new storage key, because the scoring of every game changes and old bests would mislead.

Each world opens on a seed from the date (`daySeed` in `public/lab/kit/rng.js`), so the crew plays the same world each day. A seed in the link still wins, and "A different world" picks a random seed.

Games get more ways to give feedback through the api: `noise()`, `chord()`, a `delay` on `tone()`, `slow()` for slow motion through the loop's time scale, `shake()` (off with reduced motion), and `buzz()`. They also get `seed`, `daily` and `best`.

## House Rules

The race and the reply use stamps that the link codec already has: `b=` holds the best time with the same checksum as the maker's `c=`. In Down the Drain, every change sits behind `Custom.on` in its own commit, and `qa/lab/rules.regress.mjs` now takes out every hook commit before it compares the normal game with and without the hooks.

The Settle preview copies the game's tank rule and blast word for word, and `qa/lab/rules.drift.mjs` checks the copy, as it already does for the sand rules. A drag during Settle writes into the preview only, so the layer's strokes stay as painted.

## Neon Ronin

The duel was fair only if you could see it, so attacks now start only when the attacker is on screen, and touch play turns the view toward the attacker. The duel and the circuits take their random numbers from a seed, which makes the tests repeat and gives the crew a daily duel. The guard bar is the single rule for openings: a parry fills it at once, a block adds 1 and a dodge adds 2. In touch mode only a guard pressed in the last 0.6 s counts as a parry, so holding guard all the time is a block. The broken tests now load every module that the game imports.

## Take the Plunge

The sim stays exact (only + − × ÷ and sqrt), so ghosts still replay on every device. The bed loss moved from every step of contact to once per touch, and a thud now keeps most of the speed. Ghost links are version 2, and a version 1 link opens its lakes with a note. The dive cue runs the same prediction as the dotted path, twice: for a hold now and for a hold 0.25 s later, so a slow thumb still rips.

## Small Worlds games

- Threadwake and Borrowed Bodies are now climbs that can end, and each has its own move. Threadwake is a pendulum: the thread keeps its length, and the wings push a little on each downswing so a swing can grow, because a plain pendulum never rises above where it started. While the creature still rises from a flower it let go of, a hold skips that flower, so the old flower is not always the nearest. Borrowed Bodies adds the motion of the body to the throw, so each kind of body plays in a different way.
- Foldwild builds each sheet from a random path with decoys around it, and makes a new sheet if one starts joined. Spilled water starts again from the spring, so no sheet can trap the player.
- Season Thief makes gardens from the seed and keeps only those that its own solver rates par 4 to 6, with at least two ways within 8 time and a rule that lowers par.
- The work on Foldwild and Season Thief started before the shell changed, so those games call the new helpers only when they exist.
- Storm Choir makes the flock the health: a ring needs 5 birds, a storm knocks birds out, and a quick catch saves them. Rings and storms come from the seed, and a dawn every sixth ring gives the run its peak and a harder next set.
- Heartship scores metres times the multiplier, so sailing farther now pays, and a pulse on the beat is the skill. Once the tempo caps at 130 BPM, a perfect bot sails on, so runs end through timing errors.

## Loon Echo

The review counted 1,153 of 1,253 eel hits from plain contact, with no sound before them. So only the warned lunge costs energy, and a touch from a hunting eel takes back one chick. The eels take turns to strike, and every warning comes at least 0.55 s ahead. Chicks are spaced by path length, so a honk no longer piles them on the loon.

## Up the Creek

The review suggested a flat eddy grip of 0.5 to stop eddy traps. On the new river that cut braced catches to 16%, below the existing 20% check. Instead, an eddy holds the canoe unless the paddler strokes with the bow downstream. Touch and keys now turn toward the side that is pressed: a bot that steered that way finished 12 of 12 rivers, and the old mapping finished none. The phone keeps the real paddle sides. The rapid starts about 35 m below the put-in, and the river is 60 m shorter.

## Full Tilt

The review timed the old cue: FLIP NOW lit only 0.05 to 0.25 s before the ball arrived. Now `forecastFlip()` in `physics.js` runs the same substeps, gravity, rails and blades as play on a copy of the ball. The ring, the tone and the FLIP NOW text come from that forecast, so the cue starts up to 0.9 s before the ideal press and the press it shows is the press that the grade rewards. A clean flip bends its shot only toward a target that a forecast of the real flight reaches, and after the bend the ball flies by physics alone.

The orbit is 2.5 s, and a hit on a beacon or an asteroid ends it, so a timed player flips about 16 times a minute instead of 8 or 9. The multiplier has no top, so a long clean row keeps paying, and only a lost heart resets it.

The seed picks one of three tested beacon layouts for each world, and it does not move the beacons at random. A tool sampled the layouts under the spacing rules of the tests, and a bot that flips on the cue clears each one. Long flippers is one step only, because a second step would make the gap between the blade tips smaller than the ball.

`qa/lab/tilt.cue.e2e.mjs` replaces the frame loop with its own and steps game time, so a slow machine gives the same result.
