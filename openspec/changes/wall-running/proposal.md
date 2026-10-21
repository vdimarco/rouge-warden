# Wall running

A sprint into a building side sticks and runs. Forward goes up the wall, sideways goes along it, and the roof is a vault onto the top.

## Why

- A fast hit on a wall used to spend the speed in a decaying climb, then leap off the top. The run never lasted as a move you could steer.
- The roof of a short building is a step away if the hero can run the face. A leap past the edge threw that away.

## What changes

- Touching a building side at 4 body-heights a second or faster sticks. At least half of that speed has to go into the wall, so a brush still does not grab.
- With no sideways push, and with forward, the hero runs up at 6 body-heights a second. A sideways push runs along the wall at 7. A slower touch still clings and climbs at 6 m/s, and holds still with no input.
- The run lasts 3 seconds, then the hero slides down at 2 body-heights a second. Landing, including the vault onto a roof, resets the timer. Leaving the wall in the air does not.
- At the roof edge the hero vaults onto the roof. Jump kicks off at 8 body-heights a second, straight away from the wall. Firing a web still swings straight off the wall.
- On a phone, a swipe up while on the wall jumps. The climb pad and its JUMP button stay. No new button.
- The existing run cycle in `hero.js` turns 90 degrees so the feet are on the wall. Every other step drops a small smog puff, `#8A8378`, drawn in code. No new sprite sheet.
- `window.__test.wall` is `{ onWall, face, timer, mode }`.

## Out of scope

- Easy swinging stays off while the hero is on a wall. Phone taps, first person, a headset, and a test aim keep their existing aim.
- A slow cling, the Needle, antennas, and a brushed wall still behave as they do now.
- No version bump. No new buttons.
