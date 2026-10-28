# Keep the day after the race

## Why
Finishing the race writes completed missions 0–2. Leaving and coming back offers the pond again, and every later beat starts over. The picnic, the court, the show, the groups, the convoy, the blank page, the tour, and putting the day away are lost.

## What changes
- The same slot still loads a version-1 race boundary. Those saves start the story after the race at the pond.
- A new write uses version 3. It stores the same mission count, still at most 2, plus the eight story steps.
- Version 2 stays the unsupported fixture. It is still rejected and still not overwritten.
- A later beat is stored only after the one before it is banked. Story progress is stored only after the race is finished.
- The chain, the hold clocks, the court misses, cash, and the side errands stay in the session.
- The campaign phase list does not grow. There is no eighth chain link.

## Out of scope
A new mission, a new mesh, cash in the slot, and persisting the caisse, the scooter, the ring, the wade, the lap, or the trio.
