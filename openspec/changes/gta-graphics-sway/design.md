# Body sway

Frank Thomas and Ollie Johnston, *The Illusion of Life* (1981), describe overlapping action: the body keeps a secondary motion of its own. A sampled walk cycle does not fit. The crew blend space is an Unreal asset, and this environment cannot pose it. The sine is the rock, not the steps.

The caller integrates the phase. Idle is 1.8 rad/s and a walk at 180 cm/s is 7.2 rad/s, blended with speed, so starting or stopping does not jump the angle or the lean. The full lean is 12°. The idle lean is 0.34 of that. Bob and pitch run at twice the rate, so the peak lean is a pure side rock. The mesh keeps its current yaw. The offset is lateral, in actor space, on top of the existing `(0, 0, -96)` rest.

The crew anim instance already drives the skeleton, so a second rock would stack. Swimming writes its own mesh rotation. A knockdown poses the hips. A fall restores the rest lean once, then leaves the mesh alone. A vehicle hides the walker.

Unreal is not installed. The offline picture is the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, yaw about 110°, horizontal FOV 90) at the surveyed sidewalk spawn. The before frame is the rest pose. The after frame is the walk peak, roll 12° and 4 cm to the side. It is not an engine capture. `QuebecGameplay.cpp` was not compiled.
