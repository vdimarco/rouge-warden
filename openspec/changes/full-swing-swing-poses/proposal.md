# Swing and run poses in the chase

The chase still is one idle stance. A run on the ground already plays the captured run loop. In the air with a rope, the body holds one hang, so a swing reads as that same stance.

## What changes

On a rope, the pose follows the arc. At the bottom the chest leads and the legs trail. On the way up the knees tuck. A quiet hang stays the old mild pose. The run loop is unchanged. No new mesh and no new draw.

## Capabilities

- `swing-arc-pose`: an airborne rope shows a trail or a tuck, and a stop on the ground still shows the idle.
