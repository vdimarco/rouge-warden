# Walk, run, and a turn

A blend space asset does not fit. Unreal is not installed, and the hoodie still plays one sequence on a single node, cutting from the walk to the run above 520 cm/s.

The posed share is linear from a walk at 450 cm/s to a sprint at 800. At 625 the joints are a slerp halfway from the CC0 walk to the CC0 run, both at the same point in the cycle. The side run is `CharacterArmature|Run_Left` from the same glTF, turned toward the camera so the stride crosses the body. Both clips are the Quaternius set already in `MenHoodie.glb`.

Blending the run into the idle at a mid stride bent the trailing shoe back on itself. That pose is not used. The opening pitch and the socket stay.
