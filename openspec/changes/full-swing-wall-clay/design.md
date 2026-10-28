# A second tone on the wall

## Source

Pascal Barla, Joëlle Thollot and Lee Markosian, "X-Toon: An Extended Toon Shader" (NPAR 2006). The lighting axis stays the three-band cel already in `comic.js`. A second axis, the material, is applied after that cel so quantization does not erase it. The teal and rose grade (James Gurney, Color and Light, 2010, already in `gradeInk`) is unchanged. The clay is printed on the graded colour, the same way the shop awning is mixed on after the grade. The per-unit hash and the four-corner batch stay the ones from round 13 (Lake, Marshall, Harris and Blackstein, NPAR 2000). No other surface treatment fit this shader: there is no texture sample to add, and a normal map would be a new asset.

## Decisions

- The print runs only on masonry styles (brick, stone, concrete, loft). Glass towers are left alone. Window pixels, room interiors, rails and fire escapes multiply the print back out.
- The print is a clay, stone or panel mix of the unit and the coarser batch. Up close the unit leads. Farther away the batch remains, then the print fades, so a distant wall stays the flat comic tone.
- A light course crest holds until the course is only a few pixels. It fades later than the unit tint, which already drops out while a course is still readable. The bed is not darkened. A dark bed, and a clay under 1, pushed shade faces under the ink test (max channel below 46) and flooded the canyon rows. Every clay channel stays at or above 1, so the print shifts hue without adding ink.
- The grade function is not edited. The print is a multiply after `gradeInk` on the facade fragment only. Awnings still replace that colour where the cloth is.
