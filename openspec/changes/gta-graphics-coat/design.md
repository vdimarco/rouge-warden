# Fresnel, not a clearcoat lobe

Christophe Schlick, "An Inexpensive BRDF Model for Physically-based Rendering" (Computer Graphics Forum, 1994), approximates the Fresnel term as `(1 - n·v)^5`. A Cook-Torrance clearcoat lobe does not fit the comic post-process node. What was adapted is that weight on a reflected sky colour.

`reflect(Ray, NormalC)` is the view ray about the world normal. The reflected direction samples the same afternoon gradient the offline street shades use, `(0.64, 0.76, 0.90)` at the horizon to `(0.30, 0.50, 0.84)` overhead, plus one octave of the cloud noise so a hood is not a flat tint. It is not a second copy of the two-octave cumulus, and it does not change that paint.

Roughness comes from the gbuffer. The authored seventies materials are paint 0.30, glass 0.18, chrome 0.23 and rubber 0.92 (`prepare_seventies_cars.py`). `smoothstep(0.20, 0.42, Roughness)` keeps the first three and drops the rubber. The facing mix is 0.62 and the grazing edge goes to 1, which is the lowest facing share that still reads on the hood in the walking frame. A 0.22 facing share was shaded and did not show. The pond's existing smooth-reflection case, printed crew and foliage multiply the coat by zero. Sky pixels multiply by zero, so the cumulus stays the sky paint from the previous round. The haze mix line is unchanged. Weather scalars are unchanged.

Unreal is not installed here. The offline picture rasterizes `Car70Body0`, `Car70Cabin0`, `Car70Roof0` and the four wheels from `Data/SeventiesCars/Geometry`, placed on the walking-camera street (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). The before frame is Lambert on the authored albedo. The after frame is the same Lambert plus this coat. It is not an engine capture.
