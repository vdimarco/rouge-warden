# A scalar shade on source colour

Half-lambert (Mitchell, Francke, Eng, "Illustrative Rendering in Team Fortress 2", 2007) is already the crew light. It was a coloured multiply, blue in shade `(0.62, 0.70, 0.86)` and warm in light `(1.16, 1.06, 0.94)`, after a cool shadow wash. That pair replaces a dark colour's hue. A coloured key does not fit this pass.

The replacement is a scalar from 0.70 to 1.08, the luminance of that old key, masked by `PrintedCrew`. The cool wash `(0.05, 0.07, 0.11)` stays on the city and is multiplied by `(1.0 - PrintedCrew)`. The pale rim stays. Banding names and the three `(1.0 - max(PrintedCrew, Foliage))` masks stay.

The picture is a walking-camera shade at pitch −12 and yaw 180, so the camera sees the shaded side. The tee albedo is the warm-dark mean sampled from the CurlyMetalhead base colour, not a new texture. Unreal is not installed, so the post-process material is not recompiled here.
