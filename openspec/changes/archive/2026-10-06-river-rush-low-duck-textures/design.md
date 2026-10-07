# Design

Keep the approved rear-facing long-haired rider and modest loincloth. A separate near-prone duck sprite has shoulders/head close to the deck and a horizontal paddle; do not squash the jumping image. Register its feet/deck baseline at the existing anchor. Use the same action selection in 3D and fallback.

Generate a local seamless surface atlas, extract bounded-resolution texture tiles, derive subtle normal/bump maps and keep shared material instances. Use detailed maps on ground, rocks and obstacle wood; add small scrolling water-detail samples to both shaders, leaving displaced geometry and buoyancy untouched. Retain Meshy's original bank/raft UV artwork. Full detail can use normal maps; software uses the same diffuse maps and inexpensive water shading. No added postprocessing or instance counts.

Check the duck silhouette is at most 45% of jumping height without scaling its anatomy; inspect real jump/duck inputs on phone, desktop, landscape and fallback. Verify readable hazards, pause, reduced motion, loading retries, engine/physics preservation and shader errors. Build, deploy and verify live bytes before archiving.

Use an analytic critically damped steering spring at omega 36 rather than 60. At 60 Hz the first visual step moves about 12% rather than 26%, reaching 95% in about 132 ms. Logical lane selection/collision intent stays immediate. Repeated and reversed swipes preserve position and velocity; do not restart a tween or add a lane-change lock. A small raft yaw and rider lean follow the continuous steering velocity in normal motion, with matching 2D lean.
