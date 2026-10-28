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

## Driving follow-up
- `move()` for `steer`: `x` and `y` come from `originX`/`originY` when the wheel floats, else from the wheel center; both clamp to -1..1 over half the wheel size. Keys: 65/68 at |x| > 0.18, 87 at y < -0.28, 83 at y > 0.28. `--steer-y` moves the wheel art by `round(y * 12)` px.
- `pointerDown`: the float target is the wheel when `driving` is true, else the move stick; it floats only when no pointer already holds that stick.
- `syncKeys` already drops W when S is held in a car, so a wheel push down while Gas is held brakes.
- Menu: the button joins the 2-column `.touch-primary` grid as its fourth child, so it takes the bottom-right cell with the same 72 to 88 px round face as the other actions.

## Driving check
- Unit: the wheel-as-stick test, drive from anywhere with a second-finger look, and the crossing-center test (now horizontal).
- Browser: `steering-layout.test.mjs` checks Menu beside Use, under Jump and 16 px from the bottom-right corner at 320, 390, 844×390 and 1280; `browser.test.mjs` checks four action buttons with Menu in the corner.
- Chromium touch emulation in car mode: a touch at (220, 450) centers the wheel there, an upward drag sends W, and lifting releases it.
