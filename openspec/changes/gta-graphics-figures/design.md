# One authored idle frame

The bodies are the Quaternius CC0 civilians already in `Data/Art/Plateau/Civilians/Source`, documented in that folder's README. `prepare_civilians.py` joins them in Blender for the skeletal import. Blender is not required here. `Scripts/bake_officer_stand.py` reads the GLB, samples `Idle_Neutral` at its first key, skins the four body parts, and writes an OBJ in centimetres with the feet on the origin and the face toward +X. That is one frame of the authored clip. It is not the locomotion blend space, which still cannot be posed here.

`AQuebecOfficer::ApplyLook` keeps the skeletal rig when it loads. When it does not, it loads `SM_MenSuitStand` or `SM_MenHoodieStand` and attaches it at the hip pivot so the feet land on the mesh origin. The cylinder, the sphere and the cap run only if that static mesh is also missing. Importing the OBJ is an editor step and is not run here.

Unreal is not installed. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). The before frame is the cylinder fallback. The after frame is the suit idle at the same spot, turned toward the camera. It is not an engine capture.
