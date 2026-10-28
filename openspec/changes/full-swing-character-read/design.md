# Character read

## Source

Jason Mitchell, Moby Francke, and Dhabih Eng, "Illustrative Rendering in Team Fortress 2" (Valve, 2007). Their toon model adds a view-dependent rim so a figure separates from the background. The rim here is that term: `pow(1 - dot(N, V), 3)`, warm where the figure faces the sun and cool in shade, added after the cel bands and kept small so the bands still read. The crowd volumes are original boxes on the existing part ids. Nothing is taken from Spider-Man 2.

## Decisions

- The crowd stays one instanced mesh plus its ink hull. New boxes use the same part ids, so the walk, cheer, and fight poses keep their pivots.
- Hair, hands, shoes, and the waist are rest-pose height tests already used for hair, hands, and shoes. The waist under 1 m takes the trouser colour.
- The hero rim is patched onto the hero material only. `toonify`'s default is unchanged, so the lit-sphere check still sees the stock cel.
- The ink hull is not rimmed.
