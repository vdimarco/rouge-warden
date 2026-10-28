# Hoodie run

A new gait does not fit. `Data/Art/Plateau/Civilians/Source/MenHoodie.glb` is the Quaternius CC0 rig (poly.pizza, CC0 1.0) already used for the idle and the walk. Its `CharacterArmature|Run` lasts 0.792 s. The lower leg turns about 79 degrees and the foot about 158, against about 47 and 92 on the walk.

`Scripts/plateau_life.py` imports each animation named in `Data/Art/Plateau/Civilians/Prepared/manifest.json` onto the civilian skeleton. The run is exported as animation-only FBX, frames 0–19 at 24 fps, bone `UpperLeg.L` included, no mesh. Blender's FBX exporter is the same kind of export that produced the walk. The editor import stays unchecked. Unreal is not installed, so there is no `A_MenHoodie_Run` uasset yet. Until that import, `LoadObject` returns null and a sprint still plays the walk.

The contact sheet samples the glTF run. The body rock stays off the sheet.
