# Swing: one job per thumb on a phone

After the tap, hold and drag change (`swing-touch-gestures`), the user reported: "it's still difficult to navigate on mobile let's make it dead simple".

## Why

The phone screen still asked the player to learn too much:

- **Both halves of the city threw plungers**, and a drag on either half looked around. The player had to choose a side for each throw.
- **Moving needed a fixed stick** in one corner. A thumb that landed a little off the stick threw a plunger.
- **Each mode had its own controls.** A wall showed five climb arrows, a car showed four drive buttons, and two L and R badges sat at the sides of the screen.

## What changes

- **The left thumb moves.** A stick appears wherever the left thumb lands on the left half of the city. Drag it to walk, or push it to the edge to run. The same stick steers in the air, climbs a wall and drives a car (up is gas, down brakes). The left half never throws a plunger. A faint ghost stick marked MOVE (CLIMB on a wall) shows where the thumb goes.
- **The right thumb swings.** A tap on the right half swings, and the rope lets go by itself. A hold keeps the rope until the thumb lifts. A drag looks around. These rules come from `swing-touch-gestures` and do not change.
- **The game picks the plunger.** Each throw uses the free plunger, so taps on the right chain from building to building with the hand-over as before. Two right fingers down together still throw a pair.
- **Fewer controls on the screen.** The L and R badges, the climb arrows and the GAS, BRAKE and steering buttons are gone. On a wall only a JUMP button shows, at the right.
- **Before play** (the opening), there is nothing to walk, so a tap anywhere throws.
- **The words** say "Left thumb moves. Right thumb swings." in the hint, the gesture card, the title note, How to play, the tutorial and the training card.
- Version 1.21.0 (Quest APK code 28).

## Out of scope

- The top buttons (Motion, Center, View, Pause), the action buttons (CAR, DODGE, THROW, GLIDE) and the lock-on ring stay.
- The mouse, the pad and the headset do not change.
