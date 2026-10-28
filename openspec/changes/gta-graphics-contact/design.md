# Eight taps at the ground contact

Martin Mittring, "Finding Next Gen: CryEngine 2", SIGGRAPH 2007, samples the depth buffer around a pixel for screen-space ambient occlusion. A full hemisphere would shade the open street. This pass keeps eight taps and accepts one only when the neighbor normal is upright and the depths are within 70 cm, which is a foot or a wall meeting the ground. A much nearer sample is the silhouette, and the ink already draws that.

The darkening is `lerp(1.0, 0.38, contact)` on upward normals. Clear-day fog scales stay 1. Unreal is not installed, so the post-process material is not recompiled. The picture is an offline shade of the same taps on a walking camera at pitch −12.
