# Table Tennis on a desktop

Table Tennis is playable with a mouse and the keyboard when the machine has no gyro. The phone still uses tilt. The change is the input path only: the same bat spring, the same swing bands, the same count-in, and the same picture.

## Why

A desktop browser has a fine pointer and no motion sensor. The gate used to ask for motion, wait, and then offer a swipe. That is not a way to play a rally with a mouse.

## What changes

- A fine pointer, or a machine with no motion API that is not a coarse touch phone, gets a desktop court.
- The gate button reads "Click to pick up your bat" and does not call motion or orientation permission.
- The mouse position on the canvas drives bat x and depth through the existing bat spring.
- A fast flick, measured over about 60 ms, uses the same shot bands and the same contact window as a phone swing. A click, and Space, play a medium drive.
- Arrow keys or WASD move the bat.
- One line of hint text is shown.
- The 3-2-1 count-in, the painted art, and the 60 fps frame loop stay as they are.

Out of scope: a new camera for wide screens, sidespin, and any change to the phone tilt path.
