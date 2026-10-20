# Slash shape

No grass, water, outline, or painted-look reference fits a swing mark. The mark stays a stroke on the canvas 2D context the table already uses. The path is one quadratic curve, the same call the old slash used, with the tail split into that curve's own pieces so the width and the opacity can fall together.

The bat face point is unchanged. The arc starts there. Its end sits `dir * reach` along the swing, with `dir` from the swing (forehand toward screen right, backhand toward screen left) and a bow toward the table. A push uses a reach of 1.35 bat widths, which measures about 1.5 bat widths along the curve. A drive and a smash use a reach of 2 bat widths, so the sweep along the swing is 2 bat widths. The old six-segment zigzag stayed inside the face because its length was a few dozen pixels. This curve leaves the face.

Widths are 2, 4, and 6 in the same CSS pixel space as the rest of the view. `setTransform` already maps that space onto the backing store, including the 0.75 scale at 2560 CSS pixels wide, so the stroke is not multiplied by the device pixel ratio. A push is ink `#2B2A33` at a constant 2 px. A drive is ochre `#C98B3C` at 4 px, tapering and fading toward the tail. A smash is that drive arc in ember `#B5472E` at 6 px. Sparks are still drawn after the slash.

The slash still appears only after a contact, still fades with `1 - age / 0.25`, and is still gone after 250 ms. `__test.lastSlash` still returns the latest slash, including its kind, color, CSS width, reach, and direction.
