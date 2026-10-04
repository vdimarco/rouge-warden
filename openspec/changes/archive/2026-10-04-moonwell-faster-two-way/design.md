# Design

## Two-way travel

`run.at` is the bowl the pearl is in now, and `run.far` is the furthest bowl it has reached. `crossRidges` moves `run.at` both ways. A crossing into a bowl past `run.far` scores as before: ridge points, the streak, swift and long-shot bonuses, the best flag and the region banner. Any other crossing sends a `back` or `return` event, which plays a soft chime, and scores nothing. A drain brings the next pearl back in `run.at`. The pace, the save and the summary use `run.far`.

Rails and portals still work after a trip back, but each pays its bonus once (`paid`). A shrine's seal opens when the player picks a charm, and its well is `spent`, so it draws dim and cannot open again. Stars stay taken and lanterns stay lit.

## Keeping it a choice

Free travel alone made going back happen all the time. With symmetric bowls, a bot went back about once per island, mostly from right-flipper passes and bumper bounces. A pearl that arrives from the right lands on the right flipper, so one trip back led to another. Three changes make it a choice:

- Each bowl is 40 to 140 units lower than the one before (`fy` steps down with no bound), so the ridge behind a bowl is that much taller than the ridge ahead was. Water and depth are now per island (`s.deep`), and the far layers move with the camera's height over the bowl, not with the world's height.
- The right flipper swings at 78% of the left one's speed (`PHY.PASS`). A pass from near its pivot stays in the bowl. A hit near its tip still goes back.
- Three bumpers in four stand on the forward half of the bowl.

With these, a casual bot goes back 5 times in a 17-island run and a good one 9 times in 29 islands. The bot now passes softly, as a player learns to.

## Memory

`trim` keeps the 40 islands behind `run.at` and sets a wall (`gate`) on the left ridge of the oldest one. Islands ahead are made to `run.far + 7`. Flippers move only for islands within 2,400 units of the pearl, so the longer list costs nothing per tick.

## Faster

- Pace: `1.22 + 0.33 * min(1, far / 60)`. It was `1 + 0.28 * min(1, at / 60)`. It is a time scale on the physics, so shots keep their shape.
- The next pearl drops after 1.6 s (it was 3 s), or on a flip after 0.2 s (it was 0.35 s). A stuck pearl gets its nudge after 1 s (it was 1.6 s). A swift clear is within 3.5 s (it was 4.5 s).
- Rails run at 950 to 1,900 units/s (it was 720 to 1,500). Portals take 0.5 s (it was 0.75 s).
- The camera follows at rate 7 (it was 5), and zooms out at rate 12 (it was 9). Its look-ahead goes left or right with the pearl.
- Drawing: the far painting is scaled and faded once per screen height into a canvas, and each frame copies it with no scaling. The canvas holds at most about 2.4 million pixels (it was 3.4 million), so a large high-density screen draws fewer pixels.

## Balance

`node qa/moonwell/bot.mjs 16 <skill> 8`: a casual bot (0.5) reaches island 17 in 53 s on average, a good one (0.75) island 29 in 85 s, and an expert (0.95) island 71 in 253 s. A good bot spends 2.9 s per island. Before this change it spent 3.6 s.
