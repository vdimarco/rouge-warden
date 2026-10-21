# Hero panels

## Source

Jason Mitchell, Moby Francke, and Dhabih Eng, "Illustrative Rendering in Team Fortress 2" (Valve, 2007). The diffuse warp is a warp of the albedo, so the material keeps its identity inside the bands. Round 9 kept 30 percent of the paint. This round keeps half, and moves the mip bias from −1.25 to −1.6 on the hero map only. The rim is the same paper's wrap, a little stronger. Nothing is taken from Spider-Man 2. `toonify`'s default is unchanged.

## Decisions

- The mix is `mix(paint, cel, 0.5)` on the hero material only. The lit-sphere check still sees the stock cel.
- The built-in figure already wears a cream belt on the hips. The mapped jacket's cel flattens that line, so the hero shader paints the same cream wherever the cloth is red and the pixel is about 8 cm above the hip bone. It is not a new mesh.
- The ink hull is not biased and not mixed. It stays flat ink.
- No new mesh and no new draw. The hero stays at four draws: body, hull, hair forms, outline. Skinned triangles stay the crew5 count.
- The hair follow-through and its snap distance are unchanged. The forms are still the head-bone mesh.
- The built-in figure has no colour map. It gets the stronger rim only, through the same material function.
