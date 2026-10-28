# A longer path toward the horizon

Naty Hoffman and Arcot J. Preetham, "Rendering Outdoor Light Scattering in Real-Time" (2002), fade a surface toward the sky as the path through the air grows. The earlier depth fade in `apply_comic_style.py` kept only their distance term: `smoothstep` from 25 m to 140 m, mixed at most halfway, because the comic node cannot add a fog volume and the clear 15:00 fog density and start scales stay at 1.

The same paper's path is longer when the ray lies near the horizon than when it looks steeply down at a surface the same distance away. The node already has `View.ViewForward` for the crew rim. `View.ViewRight`, `View.ViewUp`, and `View.TanAndInvTanHalfFOV` are the other members of that view uniform (the half-angle tangents, so a walker at 90° and a car at 85° share one expression). `ColorUV` is the post-process viewport with the origin at the top left, so the reconstructed ray's z is world elevation.

`Horizon = saturate(1 - |ray.z|)^3`. The mix is `Aerial * lerp(0.25, 1, Horizon) * 0.85`. A fully distant horizontal ray goes most of the way to `(0.62, 0.70, 0.80)`. A fully distant steep ray stays near the old halfway mix or below it. Depth under 25 m stays at mix 0, and the sky pixel is still excluded. The five comic banding names and the three `PrintedCrew` masks are unchanged.

Unreal is not installed here. The offline picture is a perspective shade of that mix on a street longer than 140 m, from the walking camera (arm 420, socket Y 70, pitch −12, horizontal FOV 90). It is not an engine capture.
