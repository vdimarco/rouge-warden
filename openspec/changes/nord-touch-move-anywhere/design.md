# Design

## Source
The floating stick is the common mobile 3D pattern: the stick appears where the thumb lands and reads direction from that point. No outside code was adapted.

## Input routing (`touch-controls.js`)
- `pointerDown`: when the target is the game surface, the player is on foot (`driving` is not `true`) and no pointer holds the move stick, the pointer takes the move stick with `originX`/`originY` at the touch point. Otherwise a surface pointer looks, as before.
- `move()`: a move pointer with an origin measures from it; a pointer that started on the drawn stick keeps measuring from the stick center. The 0.28 deadzone and the radius from the drawn stick size stay the same.
- The stick element gets `data-floating` and `--float-x`/`--float-y` (relative to `#touch-controls`), so CSS draws it under the thumb. Release clears them and the stick returns to its corner.
- `driving === null` (no host state yet) counts as on foot, matching the visible move stick.

## Check
- Unit: `touch-controls.test.mjs` covers move from anywhere with a second-finger look, double-tap sprint anywhere, and one-finger look in a car.
- Browser: in Chromium with touch emulation, a touch at (220, 450) on a 390×844 page centers the stick at (220, 450), dragging up sends W, and lifting sends the key release.
