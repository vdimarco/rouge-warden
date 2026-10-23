# Casual walk stride

The pose is the Walk action already in `Data/Art/Plateau/Civilians/Source/MenCasual.glb` (Quaternius, CC0). `prepare_civilians.py` exports that action as `A_MenCasual_Walk`. A new sine on extra limb boxes does not fit: the clothed mesh already contains the stride, and a second pair of legs would stack on the body. Frank Thomas and Ollie Johnston, *The Illusion of Life* (1981), describe a walk as opposing feet and arms. That is what this clip does. The sample is the clip itself, not a new formula.

`AQuebecCharacter::ApplyCrewAppearance` still uses `SK_Body` when it loads. When it does not, and `SK_MenCasual`, `A_MenCasual_Idle`, and `A_MenCasual_Walk` all load, the skeletal mesh stays visible, single-node, facing the component's +X (the axis a pedestrian root already walks along), with its origin 96 cm below the capsule. The existing on-foot tick plays idle or walk from planar speed. The sway still leans that mesh. The casual prop stays hidden. If any of those three assets is missing, the static `SM_MenCasualStand` path is unchanged, and that stand still does not step.

The offline picture samples the GLB. The before frame is `Idle_Neutral` at its first key. The after frame is the walk at the widest foot span, about 0.78 s into the 1.33 s clip. Both use the opening walk camera and the same walk-peak rock (12° and 4 cm), so the difference is the stride. It is not an engine capture. `QuebecGameplay.cpp` was not compiled.

Unreal is not installed. Confirming the imported skeleton's facing in a viewport is unchecked.
