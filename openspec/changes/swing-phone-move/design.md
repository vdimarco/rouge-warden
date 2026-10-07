# Design

## The pair is decided by overlap, not by time

A wider time window would also catch quick alternate taps (left, right, left at 0.3 to 0.5 s), and those must hand over. Overlap tells the two cases apart. Two thumbs pressed together are both down at some moment, and alternate taps are not. `mobile.js` marks every finger that is down when another one lands (`d.both`), and `cast()` passes the mark with the fire (`state.pairs`). `main.js` stores it per side at the shot (`firedPair`), and `phoneHandoff` skips the handover when both ropes were thrown as part of a pair.

## The stick is a HUD button, not a canvas zone

The stick is an element in `#actTouch` with its own pointer events and pointer capture. Its touches never reach the canvas, so they cannot throw a plunger or count as a pair finger. `main.js` adds its vector to `inp.move` after `D.update`, where the climb pad and the keys already add theirs, and it sets `sprintHeld` past 90 % of the throw.

## A test event for the handover

`main.js` pushes a `handoff` ring event when a rope lets go by handover. A rope that lets go by itself at the end of its arc looks the same in the rope states, so the browser test reads this event.
