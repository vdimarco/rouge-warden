# Walk cycle sheet

A new motion set does not fit. `Data/Art/Plateau/Civilians/Source/MenHoodie.glb` is the Quaternius civilian (CC0 1.0, via poly.pizza). `Data/Art/Plateau/Civilians/Prepared/manifest.json` prepares that body's walk as `A_MenHoodie_Walk.fbx` with duration 1.333 s, the same length as the glTF clip `CharacterArmature|Walk`. The game plays that sequence whenever the hoodie is on and the speed is above a walk. The prepared manifest has no run, and the hoodie block sets `CrewRun` to null, so the sheet does not invent a sprint.

The sheet is a side view of the skinned clip, six samples, feet on one ground line. The before row repeats the 0.75 s pose a still can show. The sway rock is left off the sheet so the stride is the clip. It is not an engine capture. Unreal is not installed, so confirming the imported sequence in a viewport is unchecked.
