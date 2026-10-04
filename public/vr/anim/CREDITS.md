# Hero motion credits

`locomotion.json` holds the hero's idle, walk, jog and run. They are motion capture and keyframed loops from the two sources below, retargeted to the hero's rig (`/wild/models/crew5.glb`) by `qa/vr/bake-mocap.mjs`.

## Sources

| Clip | Source | Author | Licence |
| --- | --- | --- | --- |
| idle | Universal Animation Library (Standard), `Idle_Loop` | Quaternius | CC0 1.0 |
| walk | CMU Graphics Lab Motion Capture Database, subject 16, trial 15 ("walk") | Carnegie Mellon University Graphics Lab | Free for all uses, see below |
| jog | CMU Graphics Lab Motion Capture Database, subject 35, trial 17 ("run/jog") | Carnegie Mellon University Graphics Lab | Free for all uses, see below |
| run | CMU Graphics Lab Motion Capture Database, subject 9, trial 01 ("run") | Carnegie Mellon University Graphics Lab | Free for all uses, see below |

### Universal Animation Library

- Author: Quaternius. Pack page: https://quaternius.com/packs/universalanimationlibrary.html
- Download used: https://opengameart.org/content/universal-animation-library (`universal_animation_librarystandard.zip`, file `Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb`).
- Licence: CC0 1.0 Universal, public domain dedication (https://creativecommons.org/publicdomain/zero/1.0/), as stated in the pack's `License.txt`. No attribution is required; we give it anyway.

### CMU Graphics Lab Motion Capture Database

- Database: http://mocap.cs.cmu.edu/
- Terms, from the database: "This data is free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form." The game includes the motion; it does not sell the data.
- Acknowledgement requested by CMU: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217."
- BVH conversion: Bruce Hahne (cgspeed), who writes that "CMU places no restrictions on the use of the original dataset, and I (Bruce) place no additional restrictions on the use of this particular BVH conversion."
- Download used: the BVH zips mirrored in https://github.com/Shriinivas/cmubvh: `https://raw.githubusercontent.com/Shriinivas/cmubvh/main/Sequence-015-019/16/Data/16_15.zip`, `.../Sequence-035-039/35/Data/35_17.zip` and `.../Sequence-001-009/09/Data/09_01.zip`. Unzip each next to the others.

## What was changed

`qa/vr/bake-mocap.mjs` makes these changes. It reads the source files from a folder outside the repo.

1. **Retargeting.** Each hero bone takes its source bone's world rotation from the source's rest pose. The arms and legs are first turned so that the source's rest directions match the hero's. The arms also roll about their length: the sources stand with the palms down and crew5 with the palms forward, so the thumbs are matched (otherwise the palms turn up). The feet are matched so that a foot flat on the floor in the source is flat on the hero. The hips' movement is scaled by the ratio of leg lengths (crew5 0.731 m of thigh and shin).
2. **Loops.** The capture trials are cut at the gait cycle (found by autocorrelation) where the poses at both ends match best. The small difference that remains is spread over the cycle so the loop closes. The forward travel is removed (the hips keep their bob, sway and surge). Each loop is turned to run straight ahead and starts at the left foot's strike. The idle uses Quaternius's loop as it is.
3. **Resampling.** The loops are resampled to 30 fps (the idle to 15 fps), and the values are rounded to 4 decimals.
4. **Feet.** The loop is set on the floor. A planted foot rolls from the heel to the ball without sliding on a floor that moves back at the clip's speed. The legs reach the pinned ankle by two-bone IK, with the knee kept in its plane. Where a straight leg cannot reach at the heel strike, the hips sink a little, the same at both steps. The clip speed is the speed at which the hero's own planted feet travel.

To rebuild, download the files above into one folder (for example `mocap/`, outside the repo) and run `node qa/vr/bake-mocap.mjs mocap`. `node qa/vr/mocap-sheet.mjs out.png` draws contact sheets of the result on crew5.
