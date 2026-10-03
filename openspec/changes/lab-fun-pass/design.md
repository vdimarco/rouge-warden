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

## The other games

Each game's own section is added here when its work lands.
