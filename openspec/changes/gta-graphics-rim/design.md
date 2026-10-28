# A rim on the silhouette

Mitchell, Francke, and Eng, "Illustrative Rendering in Team Fortress 2" (NPAR 2007), add a grazing rim so a character separates from the background. Their dedicated term also multiplies by the upward normal. That upward term lands on the crown, which this shader's half-lambert already lights, and the figure's shadow side stays stuck to the wall.

The broad rim in the same paper is the grazing factor alone, typically (1 − n·v)^4. There is no rim-mask texture and no ambient cube here, so the add is a pale sky colour and the view vector is the camera forward. PrintedCrew is 0 on the city, so the street is left alone. The offline picture uses ellipses, not the shipped mesh.
