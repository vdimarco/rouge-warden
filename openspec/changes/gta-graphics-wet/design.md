# Opening wet asphalt

A new water shader does not fit. `Scripts/plateau_atmosphere.py` `wet_ground` already multiplies the base colour by a lerp from 1 to 0.5 on Wetness, lifts splash rings (scale 1.45, add 0.18), and drops roughness to 0.03 inside the puddle mask. The mask is `Scripts/wet_puddles.hlsl`: two octaves of value noise at a 3 m scale, `smoothstep(0.55, 0.7)`, times Puddles. That file cites Sébastien Lagarde, 2013, for puddles in the low patches, and Dave Hoskins' hash12 (MIT). The rings are `Scripts/rain_splash.hlsl`: Sarah Tariq, "Rain" (NVIDIA SDK 10, 2007), 70 cm cells, a 3.5 cm ring. Those files stay as they are.

The offline shade shows that state at Wetness 1, Puddles 1, and Rain 1. Glossy puddles take the shade's own sky, because this raster has no reflection probe. The material stores roughness 0.03 there and does not sample the sky in the base colour. Dashes stay the dry yellow. Lawn, trees, lamps, the hoodie, and the coupe stay. `QuebecSky.cpp` still starts at Clear, so this picture is the material, not the spawn clock.

The lawn and the clear sky still set the frame. It is not an engine capture. Unreal is not installed, so confirming the wet material in a viewport is unchecked.
