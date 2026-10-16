# Desktop table tennis

## How the court is chosen

`desktopCourt` reads the pointer media query before any tap. `(pointer: fine)` is a mouse or trackpad, so the gate switches to the click label and skips `requestPermission`. A coarse pointer, including a phone whose browser has no motion API, stays on the tilt path. That phone still falls through to the existing swipe if a sensor never arrives. The choice is made once at load. `?input=swing` and `?input=touch` stay on the swipe path.

## Bat and swing

The pointer is mapped into the same tilt angles side tilt and lean already use, then stepped with `springStep` (`BAT.springW`) once per frame. One frame does not jump the bat to the cursor. Keys replace an axis with the full side or full lean target while they are held, and the same spring follows.

A flick is the distance covered by pointer samples inside about 60 ms. 1600 px/s maps to the phone's 300 deg/s start, the same ratio idea as the swipe's px-to-deg scale, set higher so a calm aim does not swing. The resulting deg/s goes through `shotFromPeak`. The swing time is converted to `offsetMs` from `crossIn` the same way a gyro peak is, so the ±40 ms perfect band and the ±120 ms window (and the opening ±200 ms hook) are unchanged. A click, or Space, is 850 deg/s, a drive in the middle band.

No new rendering path. The count-in, the sheets, and the frame budget stay. None of the usual art sources apply here: this is an input mapping onto the spring and the shot model already in the game.
