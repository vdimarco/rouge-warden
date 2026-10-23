# Near extinction, then the far window

Hoffman and Preetham, "Rendering Outdoor Light Scattering in Real-Time" (2002), already weight a horizontal ray more than a steep one in the far haze. That term is locked and still starts at 25 m. Coarse dust (their Mie haze, less blue than the Rayleigh sky) belongs on a shorter path. The new band uses the same horizon weight, rises from 5 m to 18 m, and is gone by 70 m so the cool sky mix still owns the distance. Dust colour is `(0.74, 0.71, 0.64)` against the sky haze `(0.62, 0.70, 0.80)`. NightFactor 1 leaves the colour. Sky pixels stay clear. The sky model, the night exposure and the window glow stay as they are.

Unreal is not installed. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) on the brick street. The before frame is the far haze, the day hue and the shade. The after frame adds the dust. It is not an engine capture.
