# Design

- **One post-process pass after tonemapping.** The material samples `PostProcessInput0`, `SceneDepth` and `WorldNormal` in one custom HLSL node. Running after the tonemapper keeps the halftone and bands in display colour, where the thresholds are stable under auto exposure.
- **Applied per camera, not by volume.** The character and car cameras carry the material as a weighted blendable. F2 sets the weight to 0 or 1 on the local view target only, so each friend chooses their own look and a listen server does not replicate it.
- **Edges.** Relative depth difference (silhouettes) plus normal difference (creases), sampled one ink width away in four directions. Line strength fades past 300 m so distant trees do not turn into solid ink.
- **Misregistration instead of depth of field.** Red and blue samples shift horizontally by up to about 3 px with depth, as in the film's offset print plates.
- **Animation on twos.** The character mesh's component tick interval is set to 1/12 s. Movement and the camera stay at the full frame rate, so only the pose steps.
- **Sound words** are drawn by the HUD from local state (jump, throttle from rest, handbrake). They are cosmetic and do not replicate.
