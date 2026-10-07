# Design

## Phone swinging

- All tuning lives in `PHONE` in `config.js`. The phone uses a new comfort preset, `phone` (speed cap 48, fall cap 40), and its own physics config: `SWING` with gravity 14 and drag 0.0045, plus `CLIMB`. The headset keeps `SWING`.
- `main.js` owns the phone rules, because they need the camera and the input: `phoneAim` (the tap, then `assistAim` when the target is out of reach, closer than 9 m or under 3 m above the chest), `phoneBoost` (the speed kick on attach, across the rope toward the view), `phoneRelease` (the auto-release, the vault, and release on a roof or a stall), `phoneFollow` (the camera turn) and the clog auto-pump (a yank of 3.5 m/s, which physics lets through once per cooldown).
- `physics.js` stays unaware of phones. The phone changes only its config and its inputs, so the physics tests still hold.
- The headset speed lines in `comfort.js` are tuned for a wide headset view. On a narrow phone they fall under the buttons, so the phone gets a CSS burst (`.phone-rush`, a conic gradient with a clear middle). Its opacity and a small turn change every 60 ms are compositor-only changes, and it does not move under reduced motion.
- `LINES_PHONE` gives the phone its own tutorial and clog lines. Tutorial step 4 (the yank) also passes on a fast auto-release, since a phone cannot yank.

How to check: `qa/vr/phone-swing.e2e.mjs` plays 12 s with taps only and asserts speed, distance, flings, the field of view and the speed lines. It also checks the sky tap, the clog plunge, the phone lines and both layouts.

## Climbing

- `physics.js` holds the climb, so Node can test it. `cfg.climb` turns it on, and only flat play passes it.
- The chest sphere's wall contact (`wall()`, |ny| < 0.35) is the trigger. In the air any contact grabs. On the ground, the move input must point into the wall, so a player brushing past a wall does not stick.
- On the wall the body moves along the wall plane at 6 m/s, with no gravity. Each step casts a ray straight in from the new chest position. A hit keeps the chest 0.38 m off the surface and takes the surface normal (so round towers work). A miss going up means the top: the feet go on to the roof 0.7 m in. A miss going sideways means a corner, and the move stops.
- A head sphere (1.7 m, r 0.25) that meets a ceiling going up means an overhang. `aroundLip` casts in from 40 m out, 1 m over the chest, and puts the player on that face. This is how the Needle's collars, deck and pod are climbed.
- Input: `main.js` sends `climb = { up, x, z }`. `up` is W/S. `x, z` is the view's right times A/D, so left and right stay screen-relative whichever way the player faces. On a wall, Space is a jump, not an air yank.

How to check: `qa/vr/physics.test.mjs` (grab, climb speed, gap, sideways, hold, top, air grab, bottom, jump, rope off, headset, the Needle to its tip) and `qa/vr/climb.e2e.mjs` (real keys, the hint, the phone pad, JUMP, tap off, the antenna rope and climb).

## Roof antennas

The renderer placed the masts at random, with no colliders. They now come from `city.js`: one to three per roof over 60 m, with collider radius 0.45 (wider than the drawn pole, so a rope finds it) and tag `antenna`. The collision grid is rebuilt once after they are added, because they must keep clear of spots chosen earlier (the start, the clogs, the trials, the safe spots). `cityview.js` draws the same masts and keeps its other props clear of them.

## Version

`VERSION` goes to 1.4.0 in `config.js` and `sw.js`, and the Quest APK goes to 1.4.0 (code 3), since `pwa.mjs` requires them to match. A new version makes a new offline cache, so an installed copy picks up the new files.
