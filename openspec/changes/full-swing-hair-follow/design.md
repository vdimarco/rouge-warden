# Hair follows through a turn

## Source

John Lasseter, "Principles of Traditional Animation Applied to 3D Computer Animation" (SIGGRAPH 1987). Follow-through and overlapping action: the hair keeps moving after the head has started the turn, and it arrives later. The drag is a clamp on that lag, not a cloth sim.

## Decisions

- The mesh stays one draw. Position is the head, plus at most 12 cm along the head's right while the turn lags. The turn eases at rate 1, slower than the head's look.
- A teleport, or the first frame, snaps. The hair does not trail across the city. The snap distance follows the frame time at the phone's 48 m/s cap, plus 1.5 m. A fixed 0.7 m was only about 8.5 m/s at 12 Hz, so a swing snapped the hair on every pose. Between poses the hair moves with the body, so it stays on the skull while the turn eases.
- The skinned crew mesh and the hero's four draws are unchanged.
- The built-in figure has no separate hair mesh, so it is unchanged.
