# Design

## The release boost uses the cue of the last frame

The physics lets go of a rope inside its step, and main hears the `detach` event after the step. By then the rope is idle and `releaseWindow` cannot judge it. `flatHud` therefore stores each rope's cue in the air (`cueAir[i]`) every frame, and `releaseBoost` reads that value. The stored cue is one frame old, which is 17 ms at 60 Hz.

The boost needs a real press (`latch[i]`), as the attach kick does, so a test hook gets neither. A swing that fires a new rope inside the window also boosts, because firing lets go of the old rope. This matches the game it copies. The boost has a 0.6 s cool-down so two ropes cannot stack it.

The flip reuses the roll's turn about the hips (`S.roll`), with no ground under it. The pose name is `flip`.

## The dodge marks the blows, not only a time window

A blow lands at mid-swing, 0.55 + 0.15 s after the wind-up starts. A dodge window of 0.5 s that starts early in the wind-up ends before that. So `C.dodge` marks every goon within 4 m who is in his wind-up or swing (`g.dodged`), and his blow misses whenever it lands. `dodgeT` (0.5 s) also keeps off blows from goons who start later. The mark clears when the next wind-up starts.

Space is the jump key and the yank key in the air. The dodge takes it only when a threat exists, and `fightKeys` clears `inp.jumpDown` so the jump and the air yank do not also run.

## The takedown is judged where the rope was fired

A rope fired from a wall pushes the hero off the wall, and the hero is in the air when the cup lands. `shoot()` stores `heroFight().perch` for that hand (`firePerch[i]`), and `ropeCatch` judges the takedown with that value.

A guard is a perch target only while the hero stands on a roof or holds a wall and has no swing rope out. Without that rule, quiet guards on clog roofs would take the auto target away from buildings during every swing.

A hung goon has his feet at the rope point and his body pitched by π about the feet, so he hangs head down. This is how `streetview.js` already draws `bp`. He counts as down for jobs and stays for 7 s.

## The sound words come from the painted atlas

`fx.word` draws only the words in `art/words.json`: THWIP, THUCK, YANK, SPLORT, FLUSH, WHOOSH, KASPLASH, BONK and GLUG. New words would need new Higgsfield art. The change reuses words already on the sheet: THWIP for a takedown, WHOOSH for a dodge, KASPLASH for a finisher. The warning mark is a screen element (`#actWarn`), not a world word.

## Slow motion runs in the loop

`loop()` scales the `dt` that it hands to `tick` by 0.3 while `slowT` runs. `slowT` counts down in real time. Test steps (`G.test.step`) call `tick` directly and run at full speed.

## The fight display

The hearts and the energy gauge sit at the bottom left, under the training panel and beside the key strip. The combo count and the focus meter go at the right edge (`#actFight`), 170 px from the top, or 260 px on screens narrower than 600 px, so the caption bubble does not cover them.
