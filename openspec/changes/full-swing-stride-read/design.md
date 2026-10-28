# Open the pose so the chase can see it

## Source

John Lasseter, "Principles of Traditional Animation Applied to 3D Computer Animation" (SIGGRAPH 1987), the exaggeration principle. The run stays the CMU loop credited in `public/vr/anim/CREDITS.md`. The swing stays the code pose from the arc. The recorded turns are opened past the clip so the silhouette clears the idle from behind the chase camera. No other clip fits, and the file is not rebuilt.

## Decisions

- Walk and jog stay on the captured loop. At a full run that loop foreshortens to a stand from behind the chase, so the body keeps an opened stride: the lifted knee steps out to the side and the arms swing against the legs. The knee step uses the run clip's weight, the same band as the blend that leaves the loop (above about 2.9 m/s). At a jog the shin stays on the clip. When the clips never load, the same speed band is the gate, so the fallback figure's jog is not shoved sideways. A rope arm still reaches its anchor.
- At the bottom of a swing one leg steps out to the side of the trail and the free arm opens. A quiet hang keeps the previous mild trail, and the tuck on the way up stays. The rope hand stays on the line to the anchor.
- Pose names, the twelve poses a second, the chase arm, and the chase pitch stay as they are. No new draw, and the skinned triangle count stays where it is.
