# Table Tennis: the bat follows the phone

Vaughn played Table Tennis on his iPhone and the bat felt stuck. It tracked the ball in a short band, and tilt only aimed the shot. The bat should feel held in the hand: side to side across the table, and forward and back for short and deep balls.

## Why

- The drawn bat followed the ball's x, so the player's own tilt barely moved it.
- There was no depth. You could not step in or back off.
- The face did not turn with the phone, and a swing did not push the bat toward the net.

## What changes

- Side tilt (gamma, the phone's roll) moves the bat across most of the table width, with a 2.5 degree dead zone and a one-pole filter whose time constant is 16 ms.
- Forward and back tilt (beta, from the neutral pose taken after the gate) moves the bat toward the net or back to the baseline. The existing aim map is unchanged and is read at the swing.
- The face rolls with gamma, pitches with beta, and a gyro swing shoves the bat toward the net, then back.
- Auto-tracking becomes a 15% pull toward the ball's line on casual motion. Reach uses the bat's x and depth.
- The gate, the sounds, and the swipe fallback stay.

Painted sheets of the hall, the Neighbour and the bat replace those code drawings when they load. The table, net, ball, shadow and slash stay in code. A sheet that fails to load leaves that part on the code drawing.

A second pass, from the same phone session, slows the rally and restyles the room. Every serve counts 3, 2, 1 Ready before the ball moves. Neighbour serves at 3.5 m/s with a short float, and returns at 6 to 7 m/s. The bat uses a heavier spring, a gentler curve, a slow drift back to centre, and a smaller depth. The picture keeps the look-sheet palette and adds ink, grain, a glow on the ball, and a brush slash on hits.

Out of scope: sidespin, a pro tier, and a handedness toggle.
