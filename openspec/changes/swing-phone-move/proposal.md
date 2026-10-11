# Swing: phone move stick, free look and two-thumb pairs

After playing on a phone, the user reported three problems:

1. Both plungers could not be shot at the same time.
2. There was no way to just move around.
3. They wanted to tap and drag to move the view of the character by hand.

## Why

- **No way to walk.** On a phone the move input came only from the climb pad on a wall. On a roof or a street the hero could not walk at all, only swing.
- **The view did not stay where it was dragged.** A drag already turned the view. But in the air at speed, the camera turned back toward the flight 0.7 s after the drag, so a manual look did not hold.
- **The second plunger let the first one go.** Two plungers held together only when they were thrown within 0.3 s. Otherwise, the first one let go 0.12 s after the second caught (the handover that chains taps on alternate sides). Two thumbs rarely lift that close together on a real phone, so a two-thumb press often became a handover. In the emulator, both plungers fired and caught every time.

## What changes

- **A move stick** at the bottom left on a phone (`actionhud.js`, `PHONE.stick`). Drag the knob to walk, or push it to the rim to sprint. In the air it steers. It hides while driving and on a wall, where the climb pad already shows. Touches on it never throw a plunger.
- **Free look holds.** In the air, the camera follow now waits 2.5 s after the last drag or tilt (`PHONE.follow.idle`, was 0.7 s).
- **A two-thumb pair.** Two fingers down on the city at the same time throw a pair, however far apart they lift. Neither plunger hands over to the other (`mobile.js` `both`, `inp.phonePair`, `main.js firedPair`). Taps on alternate sides that do not overlap still hand the swing over, so tap chains keep their feel. The 0.3 s time rule stays as well.
- Version 1.18.0 (Quest APK code 25).
