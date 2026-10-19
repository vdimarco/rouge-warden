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
- above 4.3: smash, 17 m/s, when the ball is high enough for a smash, otherwise a drive

2.3 and 4.3 stay on the lower band, matching the phone picker's inclusive top edges. The same widths per second pick the same shot at 1280 and at 2560. The swing time becomes offsetMs from crossIn the same way a gyro peak does, so ±40 ms is perfect, ±120 ms is the window, and the swing cools down for the existing 350 ms. The opening hook still wins point 1, and only for a real flick. Under 1.2 window widths per second is not a flick. A flick from that line up, inside ±200 ms, is helped to a perfect drive even when the ball is still outside the normal reach. A miss, including a speed-0 swing 383 ms early, or no flick at all, does not take that point: the feed is lost or replayed.

The bend is the flick's angle from horizontal. Screen y points down, so an upward flick has a negative dy. At least 20 degrees up is topspin and 20 degrees down is backspin, as a level-1 roll (±360 deg/s, past the 200 deg/s spin line).

## Which machine is a desktop

A fine pointer is mouse mode, even when the browser also reports touch points or a coarse pointer beside it. Otherwise a coarse pointer, or any touch points, stays on the phone gate. Everything else is a desktop, including a browser whose pointer is `none` and which still exposes `DeviceMotionEvent`. Headless Chrome at 1280 reports that pair, so a missing fine pointer is not treated as a phone.

The desktop mode is named mouse. After the gate click, `__test.state().inputMode` is `mouse`. If that first check still shows the phone gate, the first trusted `mousemove` that is not a touch compatibility event switches to mouse mode, including after play has started. A swipe URL stays on swipe. Phone sensors stop driving the bat once the mode is mouse.

## Start

The gate click still resumes audio and starts the count without asking for motion permission. After that click the canvas cursor is hidden and the frame draws a 4 px dot at the pointer. The hint reads "The bat follows the ball. Move the mouse to aim. Flick to swing."
