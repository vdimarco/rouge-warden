# Mouse aim on the desktop court

## What this is not

The aim dot is a filled circle in the existing paper and ink colours. No grass, water, outline, or painted-look technique is involved, so none of the usual art references apply.

## Bat and aim

On the phone, sideways aim is still the player's tilt, with a light pull toward the ball. That pull is not enough once the player stops steering. Desktop play no longer steers sideways, so while the phase is incoming the bat's sideways target is the ball's own x. Any other phase rests at the middle. The same critically damped spring eases the bat onto that target, which keeps it inside the 0.22 m reach.

Cursor x, from the left edge to the right edge, maps to ±30 degrees and is the swing's tiltX. It is not fed through the bat's side reach. Cursor y maps to the same lean angles the phone uses, and that lean sets depth through the existing bat curve. It does not also pick the landing depth. The landing across the table stays the neutral aim unless the sideways aim shifts it.

## Flick

Speed is the straight-line distance over the samples that fall inside 60 ms. Dividing by the court width and multiplying by 1280 converts that to a 1280-wide court. A 2560 window has to cover twice as many pixels to read the same number. pointermove reads getCoalescedEvents so a fast flick is not dropped between frames.

That number maps onto the phone bands by degrees per second = speed * 300 / 1500, then the existing shot picker:

- under 1500: no swing
- 1500 through 3000: push, 6 m/s (300 through 600 deg/s)
- above 3000 through 5500: drive, 11 m/s
- above 5500: smash, 17 m/s, when the ball is high enough for a smash, otherwise a drive

3000 and 5500 stay on the lower band, matching the phone picker's inclusive top edges. The swing time becomes offsetMs from crossIn the same way a gyro peak does, so ±40 ms is perfect, ±120 ms is the window, and the opening ±200 ms hook still wins point 1. The swing cools down for the existing 350 ms.

The bend is the flick's angle from horizontal. Screen y points down, so an upward flick has a negative dy. At least 20 degrees up is topspin and 20 degrees down is backspin, as a level-1 roll (±360 deg/s, past the 200 deg/s spin line).

## Start

The gate click still resumes audio and starts the count without asking for motion permission. After that click the canvas cursor is hidden and the frame draws a 4 px dot at the pointer. The hint reads "The bat follows the ball. Move the mouse to aim. Flick to swing."
