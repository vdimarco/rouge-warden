# Shop awnings

## Source

None of the facade-dressing papers fit a three-band comic awning. The band is the one the flat facade already painted, kept once the window atlas replaces that facade. Nothing is taken from Spider-Man 2.

## Decisions

- The band is `f.y` 0.60 to 0.94 of the street floor. The shop window rectangle ends at 0.56, so the cloth sits on the wall above the glass and does not cover the lit pane.
- It runs after the warm shade bounce and after the teal grade. The bounce stays on the masonry. A shaded cloth sits in the grade's hold, and grading it would turn the red and the teal into the same muddy green, so the caller mixes the cel cloth on after `gradeInk`. Ink still cuts the band.
- Each bay picks red or teal from the column hash already used for the shop tile. A hem darkens the lower fifth. A seam one bay wide uses `stripe`, which fades on `fwidth`, the same rule as the brick courses.
- `detail` still gates it, so a floor that is only a few pixels does not keep a shimmering stripe.
- No extra draw. The street draw budget is unchanged.
