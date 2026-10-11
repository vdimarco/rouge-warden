# Design

## Two zones

`mobile.js` sorts each finger on the city when it goes down:

- **Left half, in play** (`opts.canMove()`, `G.state === "play"`): the finger becomes the move stick (`mover`). The base sits where the thumb landed, kept 60 px inside the left half and the screen. The knob follows the thumb. `PHONE.stick` sets the full push (46 px), the dead zone and the run push, and `desktop.js` passes it in. The stick writes `state.moveX` and `state.moveY` (-1..1, y up) and `state.sprint`. A newer left thumb takes the stick over. The lift, or a cancel, stops it.
- **Right half, or before play**: the finger follows the tap, hold and drag rules of `swing-touch-gestures`.

`desktop.js` already adds `phone.moveX` and `phone.moveY` to `inp.move`. It now also ORs `phone.sprint` into `inp.sprintHeld`. `inp.move` drives everything that moves:

- on the ground, walking and running;
- in the air, steering;
- on a wall, climbing (`physIn.climb`);
- in a car, `DRIVE_IN.throttle` and `DRIVE_IN.steer`, as W, A, S and D do with a keyboard.

The fixed stick in `actionhud.js` and the drive pad (`T.left`, `T.right`, `T.gas`, `T.brake`) are gone, and so is their block in `main.js`.

## The plunger

`pick()` returns the plunger to throw. It is the last plunger thrown, unless that rope still holds, in which case it is the other one. A chain of taps therefore alternates plungers, and the hand-over in `main.js` keeps the swing going. Two fingers down together still set `pairs`, and the second finger gets the other plunger. `tap(side)` from code keeps its side.

A tap whose only reach is the building the other rope holds (`a.same` on an idle plunger) now keeps that rope, says "Keeping this rope." and throws nothing (`miss(i, false, true)`). Before, it was a dry fire.

## Screen

- `.phone-stick` is the ghost (`.idle`) at the bottom left, or the live stick under the thumb. It takes no touches. The lock-on ring may pass over the ghost, so the ghost does not shrink the ring's window.
- `.phone-climb` holds only JUMP, at the right above the hint.
- The L and R badges are gone. The panel has the class `holding` while a plunger holds.
- The gesture card is two lines: LEFT (drag to walk, climb and drive), RIGHT (tap to swing, hold to keep the rope, drag to look).

## Checks

- `mobile.test.mjs`: the left thumb walks, runs at the rim, never throws (a tap or a 600 ms hold), and stops on the lift. The next tap throws the free plunger. The left thumb walks while the right thumb swings. With `canMove` off, the left half throws.
- `phone-move.e2e.mjs`: the ghost shows, the stick appears under the thumb, it walks and runs, and in a car it drives at more than 4 m/s.
- `climb.e2e.mjs`: on a wall the left thumb climbs 3 m in 0.5 s, takes the hero over the top and down to the street, and JUMP sits on the right.
- `mobile.e2e.mjs`, `phone-controls.e2e.mjs`, `layout.e2e.mjs` and `phone-swing.e2e.mjs`: taps only on the right half, the JUMP button, no badges, and the new words.
