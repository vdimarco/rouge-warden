# Swing: Spider-Man moves

In Full Swing (`public/vr/`) is a plunger-swinging game. It plays in a Quest headset and on a flat screen. The user sent Spider-Man gameplay for review and asked for improvements from it:

- a 9-minute YouTube video of Spider-Man 2 (swinging, gliding, crimes, street fights);
- a 9-second clip of Spider-Man PS4 (a perch takedown, a hit warning, an object throw, a finisher prompt);
- a Giphy clip of Spider-Man PC (indoor swings, a run down a glass wall, a flip in the air).

The review is in the session notes. This change holds the first part of it: the items that change how a swing and a fight feel, built on code the game already has.

## Why

- **A swing has no payoff for good timing.** The GO cue tells the player when to let go, but with a mouse or a pad nothing happens at that moment. Spider-Man flips and gains speed there.
- **A fight is only punch, punch, kick.** Goons wind up for 0.55 s, but the player gets no warning and has no answer to the blow. Spider-Man shows a warning and lets the player dodge.
- **High ground does nothing.** A guard below the hero cannot see him, but the rope ignores a guard that has not seen the hero. In the PS4 clip, Spider-Man pulls a guard up from a beam and leaves him hanging.
- **A fight has no peak.** Spider-Man fills a meter with blows and spends it on a finisher.

## What changes

- **Release boost (mouse and pad).** A let-go while the GO cue shows adds 4 m/s forward and 3.5 m/s up, widens the view and flips the hero (`main.js releaseBoost`, `hero.js H.flip`, `MOVES.release`).
- **Hit warning and dodge (flat play).** A goon who winds up within 4 m shows a red mark over his head and the prompt `SPACE DODGE`. Space (pad A, or a DODGE button that shows on a phone) then dodges instead of jumping: the hero rolls 4 m to the side, and every blow on its way misses (`combat.js C.threat`, `C.dodge`; `main.js fightKeys`).
- **Perch takedown.** On a roof or a wall, with no swing rope out, a guard who has not seen the hero and stands 5 m or more below him is a rope target. The rope lifts him up to 5 m and leaves him hanging upside down. The guards near him do not notice (`combat.js C.perched`, the `hung` state).
- **Focus meter and finisher.** Blows, rope pulls, slams, dodges and takedowns fill a meter. With it full and a goon in reach, F (pad RB) knocks down every goon within 3.5 m. The world runs at 30 % speed for 0.7 s (`combat.js C.finish`; `main.js` loop).
- **Fight display.** A combo count (`3 HITS`) and the focus meter at the right edge, the red warning mark, and new prompts: `DODGE`, `FINISH`, `TAKEDOWN` (`actionhud.js`).
- The version goes to 1.16.0 (Quest APK code 23).

## Out of scope

These come from the same review and follow as their own changes:

- glide from a dive;
- a fast wall run, up and down, and a jump from a spire;
- crimes that start near the hero, with a spoken line;
- stopping a getaway car, and sealing a leaking tanker;
- a throw of objects, and a pull of a group of goons together;
- golden-hour light and a music layer for fights.

The headset keeps its controls. It gets no boost, no dodge and no finisher.
