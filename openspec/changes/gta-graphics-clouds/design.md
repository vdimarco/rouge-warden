# A cloud layer, not a volume march

Andrew Schneider, "The Real-Time Volumetric Cloudscapes of Horizon: Zero Dawn" (SIGGRAPH 2015, Advances in Real-Time Rendering), places clouds in a layer and marches density through it. `apply_comic_style.py` is a post-process custom node. It cannot march a volume, and the volumetric cloud component already in the level is an editor material this environment cannot shade. Weather `CloudCover` stays 0.15. Clear-day fog density and start scales stay 1.

What was adapted is the layer. The horizon block already builds a unit view ray. `CloudUv = Ray.xy / max(Ray.z, 0.07)` is that ray meeting a plane above the camera, so the field packs toward the horizon. Two octaves of value noise stand in for a low-frequency shape plus a little breakup. They are not Schneider's 3D Perlin-Worley. Coverage is `smoothstep(0.52, 0.68, Field)`, with a thinner skirt under it. `Lift` fades the paint out between ray elevation 0.04 and 0.13 so the horizon line stays a line. Thicker samples go toward white `(0.98, 0.98, 0.96)`. Thinner edges go toward a blue-grey underside and a warm tint on the afternoon-sun side of the blob. The sun's horizontal direction is `normalize(float2(-0.62, -0.48))`, the same afternoon sun as the crew key.

The paint multiplies by `(Sky ? 1 : 0)`. The haze mix line is unchanged, and sky pixels still take none of that mix. The five comic banding names and the three `PrintedCrew` masks are unchanged.

Unreal is not installed here. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) with the cloud function applied only where the ray misses the street. It is not an engine capture.
