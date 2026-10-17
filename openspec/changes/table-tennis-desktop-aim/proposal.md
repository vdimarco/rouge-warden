# Desktop table tennis is mouse only

The desktop court from the merged change still let the mouse drag the bat, and it still swung on a click, the arrow keys, WASD, and Space. The final desktop spec is aim and a flick. The phone tilt path stays as it is.

## Why

A desktop player was steering the bat by hand and swinging with the keyboard. The bat should meet the ball on its own, the way a phone rally already keeps the bat near the ball's line, and the mouse should only choose the shot.

## What changes

- Arrow keys, WASD, Space, and click-to-swing are gone on the desktop court.
- While the ball is coming in, the bat's sideways position eases onto the ball. The cursor's x aims the shot within ±30 degrees. The cursor's y sets the bat's depth.
- A flick is pointer speed over 60 ms, in window widths per second. Under 1.2 does not swing. 1.2 through 2.3 is a push at 6 m/s, above 2.3 through 4.3 is a drive at 11 m/s, and above 4.3 is a smash at 17 m/s when the ball is high enough. The same speed reads the same at 1280 and at 2560. Samples come from pointermove and getCoalescedEvents. Cooldown stays 350 ms.
- Contact stays inside ±120 ms, and ±40 ms stays perfect. The opening ±200 ms hook is unchanged.
- A flick that bends at least 20 degrees upward is topspin. The same bend downward is backspin.
- One click on the gate starts play and audio. The cursor becomes a small aim dot.
- The hint line matches these controls.
- A browser without a coarse pointer and without touch is a desktop, even when the pointer is none and DeviceMotionEvent exists. If the phone gate is already up, the first real mouse move switches it to the mouse copy.

Out of scope: the phone tilt path, the swipe fallback, the count-in, and the landscape hall framing.
