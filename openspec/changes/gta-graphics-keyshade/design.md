# Half-lambert value

Mitchell, Francke and Eng, "Illustrative Rendering in Team Fortress 2" (2007), the half-lambert already used for the crew key. The city hue grade keeps its luminance. This term is a scalar: `lerp(0.58, 1.0, smoothstep(0.12, 0.48, Half))`. A surface toward the sun stays at 1, so the clear-day exposure does not move. There is still no shadow ray, so the road under a wall does not get a cast shadow. Gloss, the sky and printed crew stay. NightFactor 1 leaves the colour. The sky model, the night exposure and the window glow stay as they are.

Unreal is not installed. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) looking down the same brick street as the hue round. The before frame is the hue grade. The after frame multiplies the shade. It is not an engine capture.
