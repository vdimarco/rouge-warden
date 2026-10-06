# Design

Use fal Nano Banana Pro concept images followed by Meshy 7.1 image-to-3D: an expedition raft, serpent temple landmark, jaguar guardian obstacle, and a humanoid rider with automatic skeletal rigging. Meshy supports the needed humanoid rig; retain compatible existing foliage. Store all input recipes and source URLs; deploy optimized local assets with no runtime generation dependency.

Animate the rider's bones and a physical paddle from a continuous simulation-time stroke, with two-arm inverse kinematics and smooth steering/body weight shifts. Render at display requestAnimationFrame cadence without a low-frame sprite clock. Near-prone duck and raised jump remain separate anatomical poses, with short transitions and immediate collision action. Keep rear-facing sprites as the 2D/model-failure substitute.

Pool/instance repeated temple and guardian models, avoid full-screen postprocessing, preserve bounded pixel/texture/scene budgets. Improve sky, lighting and shadows while keeping the upcoming route readable. Measure frame timings and scene budgets in browser QA; headless software GPU results are not physical device frame-rate guarantees.
