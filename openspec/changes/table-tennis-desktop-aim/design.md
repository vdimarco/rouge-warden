# Mouse aim on the desktop court

## What this is not

The aim dot is a filled circle in the existing paper and ink colours. No grass, water, outline, or painted-look technique is involved, so none of the usual art references apply.

## Bat and aim

On the phone, sideways aim is still the player's tilt, with a light pull toward the ball. That pull is not enough once the player stops steering. Desktop play no longer steers sideways, so while the phase is incoming the bat's sideways target is the ball's own x. Any other phase rests at the middle. The same critically damped spring eases the bat onto that target, which keeps it inside the 0.22 m reach.

Cursor x, from the left edge to the right edge, maps to ±30 degrees and is the swing's tiltX. It is not fed through the bat's side reach. Cursor y maps to the same lean angles the phone uses, and that lean sets depth through the existing bat curve. It does not also pick the landing depth. The landing across the table stays the neutral aim unless the sideways aim shifts it.

## Flick

Speed is the straight-line distance over the samples that fall inside 60 ms, divided by the window width and by the time. The unit is window widths per second, not pixels. A 2560 window has to cover twice as many pixels to read the same number. pointermove reads getCoalescedEvents so a fast flick is not dropped between frames.

That number picks the phone shot:

- under 1.2: no swing
- 1.2 through 2.3: push, 6 m/s
- above 2.3 through 4.3: drive, 11 m/s
- above 4.3: smash, 17 m/s, whether the ball is high or low

2.3 and 4.3 stay on the lower band, matching the phone picker's inclusive top edges. The same widths per second pick the same shot at 1280 and at 2560. The swing time becomes offsetMs from crossIn the same way a gyro peak does, so ±40 ms is perfect, ±120 ms is the window, and the swing cools down for the existing 350 ms. Drift is 0 degrees inside ±40 ms and rises to 25 degrees at ±120 ms, about 6 degrees at 58 ms. A hit inside that window stays in play: the arc lofts until it clears the net, which is why a low drive 58 ms early used to die, and a landing within 8 cm is still nudged in. The average bot's timing spread is triangular out to ±180 ms so that, with those shots landing in, the Neighbour still takes 20 to 40 percent of points. The opening hook still wins point 1, and only for a swing that clears its own line. On the phone that line is a rotation rate above 300 deg/s, the same bar the swing detector uses. On the desktop it is 1.2 window widths per second. A speed of 0, or anything under the line for that input, does not take point 1, even if the other unit looks fast. A counted flick inside ±200 ms is helped to a perfect drive even when the ball is still outside the normal reach. A miss, including a speed-0 swing 383 ms early, or no flick at all, loses the feed or replays it.

Spin compares the stroke direction in the first 50 ms with the last 50 ms before peak speed. A bend of 20 degrees or more upward is topspin and the same bend downward is backspin, as a level-1 roll (±360 deg/s, past the 200 deg/s spin line). Screen y points down, so an upward segment has a negative dy. A straight diagonal flick of 20 degrees or more counts the same way. A flatter bend and a flatter diagonal add none.

Any swing inside the ±120 ms window connects. A miss for reach inside that window is a tracking bug. Desktop auto-track eases toward the ball and is held inside the 0.22 m side reach, so a sudden sideways jump cannot leave the bat short of the ball. Swings 9 ms early and at the 120 ms edge connect, including when the ball is 0.20 m or 0.23 m aside.

Table ink is one shared layer. Each splat fades to 0 over about 0.6 s and is then removed. The countdown clears the layer immediately. The layer is blitted once at 25% opacity, so two marks on the same pixel cannot go above 25%. `__test.splatCount` is how many marks are still up.

The slash is drawn after the bat and starts at the bat face. A push is a thin stroke. A drive is the full curved slash. A smash is a wider slash in #B5472E. It fades over 250 ms. `__test.lastSlash` is the latest slash.

The 2560 backing-store cap is not part of this change. The canvas still uses the existing device-pixel cap of 2.

## Which machine is a desktop

A fine pointer is mouse mode, even when the browser also reports touch points or a coarse pointer beside it. Otherwise a coarse pointer, or any touch points, stays on the phone gate. Everything else is a desktop, including a browser whose pointer is `none` and which still exposes `DeviceMotionEvent`. Headless Chrome at 1280 reports that pair, so a missing fine pointer is not treated as a phone.

The desktop mode is named mouse. After the gate click, `__test.state().inputMode` is `mouse`. If that first check still shows the phone gate, the first trusted `mousemove` that is not a touch compatibility event switches to mouse mode, including after play has started. A swipe URL stays on swipe. Phone sensors stop driving the bat once the mode is mouse.

## Start

The gate click still resumes audio and starts the count without asking for motion permission. After that click the canvas cursor is hidden and the frame draws a 4 px dot at the pointer. The hint reads "The bat follows the ball. Move the mouse to aim. Flick to swing."
