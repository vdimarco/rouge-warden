# Hoodie garment

A cloth simulation does not fit. The hood, the sleeve cuffs, and the hem are already in `Data/Art/Plateau/Civilians/Source/MenHoodie.glb` (Quaternius, CC0), the mesh `prepare_civilians.py` exports and the goons already load. None of the surveyed garment papers apply to a missing rig: there is no solver here, and a generated collar on the t-shirt would stack a second torso on the clothed mesh. The goon path paints every slot one ink colour, which would hide the hem and the calves, so the player does not call `SetMaterial`.

`AQuebecCharacter::ApplyCrewAppearance` still uses `SK_Body` when it loads. When it does not, and `SK_MenHoodie`, `A_MenHoodie_Idle`, and `A_MenHoodie_Walk` all load, the skeletal mesh stays visible, single-node, facing the component's +X, with its origin 96 cm below the capsule. The existing on-foot tick plays idle or walk from planar speed. There is no hoodie run clip, so a sprint keeps the walk. The sway still leans that mesh. If any of those three assets is missing, the casual walk path is unchanged, and the static stand remains after that.

The offline picture samples the GLBs at 0.75 s of each walk, with the opening walk camera and the same walk-peak rock (12° and 4 cm). The before frame is the casual body. The after frame is the hoodie. Foot dust is left out of both frames so the difference is the garment. It is not an engine capture. `QuebecGameplay.cpp` was not compiled.

Unreal is not installed. Confirming the imported hoodie in a viewport is unchecked.
