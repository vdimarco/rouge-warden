# Swing marks that leave the bat

A push, drive, and smash currently share a short zigzag drawn on the bat face. The mark should be one arc that starts on the face and follows the swing, with a width the player can tell apart, including on a 2560-wide court whose canvas is drawn at 0.75 scale.

## What changes

- A push is a 2 px ink arc, about 1.5 bat widths long, starting at the bat face.
- A drive is one arc that leaves the bat face and sweeps about 2 bat widths along the swing. It is 4 px, ochre, and thins and fades toward the tail.
- A smash is that same arc at 6 px in ember. The sparks stay drawn on top of it.
- Widths are CSS pixels. The 250 ms fade, the draw order above the bat, and the shot timing stay as they are.

Out of scope: shot speeds, the bat, the table, and any new drawing library.
