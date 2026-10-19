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

Spin is the change in heading from the first part of the stroke to the last, 20 degrees or more. Upward is topspin and downward is backspin, as a level-1 roll (±360 deg/s, past the 200 deg/s spin line). Screen y points down, so an upward segment has a negative dy. A straight flick has no change, so the first heading is not spin, and neither is the chord from the first sample to the last. A curve whose chord is under 20 degrees still spins when the heading itself turns by 20.

The side reach stays 0.22 m and the depth reach stays 0.5 m. A ball 0.20 m to the side of the bat is inside that side reach, so a swing 9 ms early at that gap connects. A centre 0.23 m aside misses for reach. The serve ease-in clock can call a swing 9 ms early while the ball is still about 0.25 m short of the bat. That gap is inside the 0.5 m depth reach, so it is not a reach miss. Desktop tracking keeps the side gap near 0, well under 0.22 m.

Table ink is one layer, drawn opaque and blitted at 25% times its fade, so overlapping marks stay at or under 25%. The fade runs to 0 even after the pause ends, then the layer is cleared and that landing is not stamped again. The slash is drawn after the bat, so a push, a drive, and a smash all read on top of it. `__test.lastSlash` and `__test.splatCount` expose the latest slash and how many marks are still up.

A 2560-wide view caps the canvas backing store at 2560 px, so device pixel ratio 2 does not allocate an 8 megapixel frame. The static room is already cached. 390 and 1280 stay at the existing cap of 2.

## Which machine is a desktop

A fine pointer is mouse mode, even when the browser also reports touch points or a coarse pointer beside it. Otherwise a coarse pointer, or any touch points, stays on the phone gate. Everything else is a desktop, including a browser whose pointer is `none` and which still exposes `DeviceMotionEvent`. Headless Chrome at 1280 reports that pair, so a missing fine pointer is not treated as a phone.

The desktop mode is named mouse. After the gate click, `__test.state().inputMode` is `mouse`. If that first check still shows the phone gate, the first trusted `mousemove` that is not a touch compatibility event switches to mouse mode, including after play has started. A swipe URL stays on swipe. Phone sensors stop driving the bat once the mode is mouse.

## Start

The gate click still resumes audio and starts the count without asking for motion permission. After that click the canvas cursor is hidden and the frame draws a 4 px dot at the pointer. The hint reads "The bat follows the ball. Move the mouse to aim. Flick to swing."
