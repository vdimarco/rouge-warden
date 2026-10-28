# Window spill

## Source

James Gurney, Color and Light (2010). A local light colours the nearby surface and dies with distance. The three-band cel stays the lighting axis. The teal and rose grade stays the paper. The pool is printed after `gradeInk`, the same way the shop awning is mixed on after the grade, so that grade cannot turn the lamp teal. No other local-light trick fit this shader: there is no second geometry for a light card, and a full-screen pass is out of bounds.

## Decisions

- The spill uses the same `inFloors` visibility mask as the window. Blank bays and incomplete top-floor rows cannot emit light from a suppressed window.

- The pool is a distance from the window rectangle in the cell, not a new light or a new draw. Inside the glass the window keeps its own glow. Outside, it fades across about 0.28 of the cell.
- A sunlit face keeps about a quarter of the pool. A shaded face keeps it. The lamp has to read in the shade, where the grade is one teal.
- The shop cloth takes the same warm light on the hem, nearest the glass, and keeps its own colour at the top. A dark shop does not.
- Every channel of the pool stays at or above the graded colour. The round-23 bed showed that darkening a shade face floods the canyon ink test.
