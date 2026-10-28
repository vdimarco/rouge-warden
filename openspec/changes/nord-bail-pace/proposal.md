# Keep the car's pace when you get out

## Why
Getting out of a moving car plants the player. The car keeps going. The player does not.

## What changes
- Getting out above a walk keeps the car's pace, forward and sideways, for a short run-out.
- The run-out is capped at 900 cm/s and eases off at 1400 cm/s each second.
- A car at a walk or slower still plants the player.
- Walking, jumping, or swimming cancels the run-out.
- A blocked door still says the doors are blocked and does not move the player.
- A knockdown that pulls someone out of a car is not this run-out.

## Out of scope
A new phone button, a change to the handbrake slide, stream latency, and a ninth story mission.
