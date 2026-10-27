# Local light on the pavement the lamp already stands on

## Source

James Gurney, Color and Light (2010): a local light colours the nearby surface and falls off. The shop spill already uses that sentence on the wall. This is the same mix, on the ground, under a lamp.

## Decisions

- Six slots. The city has hundreds of lamps. The shader loop stays six wide, and only lamps within 80 m are considered.
- ShaderMaterial clones Vector4 arrays, so the positions are written on the material's copies.
- The disc is full inside 1.1 m and gone by 6.4 m. It is mixed after `gradeInk` and before `skyHaze`, and multiplied by one minus the pavement ink, the same place the shop spill sits on a wall.
- The colour is the spill's warm family: `vec3(1.55, 0.86, 0.36)` plus a small add. Water, the diorama, and the walls do not take it.
- A named `lamp` shot holds the camera on the pavement so a still can see the disc. The title attract does not.
