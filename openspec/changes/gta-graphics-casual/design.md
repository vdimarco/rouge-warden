# One authored idle on the lead

The body is the Quaternius CC0 civilian already in `Data/Art/Plateau/Civilians/Source/MenCasual.glb`, documented in that folder's README. `prepare_civilians.py` joins the civilians in Blender for the skeletal import. Blender is not required here. `Scripts/bake_officer_stand.py` already skins an `Idle_Neutral` first key. The same baker writes `SM_MenCasualStand.obj` in centimetres, feet on the origin, face toward +X. That is one frame of the authored clip. The locomotion blend space still cannot be posed here, so it does not fit.

`AQuebecCharacter::ApplyCrewAppearance` keeps the skeletal rig when `SK_Body` loads, and hides the stand. When `SK_Body` is missing, it loads `SM_MenCasualStand`, shows it on the capsule at (0, 0, −96), and hides the skeletal mesh so the mannequin is not drawn with it. If the stand is also missing, the mannequin stays. Importing the OBJ is an editor step and is not run here.

Unreal is not installed. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). The before frame is the white mannequin. The after frame is the casual idle at the same spot, turned toward the camera. It is not an engine capture. A normal session that has `SK_Body` still shows the crew rig.
