# Local partial hand/eye rig pilot

Derived locally from the retained neutral CurlyMetalhead body, without generation or edits to original sources. This adds controls to the existing body; it does not deliver the proposed mature replacement anatomy or finished graphic-novel rendering.

- `body.fbx`, `body.glb`: neutral rest mesh, 24 unchanged body joints plus 20 weighted child finger joints. Each coarse digit has two segments, named `GN_Left_Index1/2` etc. No locomotion clip is replaced or exported here.
- `pilot.blend`: editable authoring source with finger weights and facial shape keys.
- `GN_EyeNarrow_L/R`: restrained squint controls, reviewed at 0 and 1. These are **not blinks**. The left control affects the character's left eye (+X).
- `provenance.json`: original source hashes/bind transforms, weight/morph counts, export hashes and round-trip checks. New bones and morphs need actual clip/runtime driving before any in-game animation claim.

CPU source face/clay/hand views were inspected before authoring. The hand mesh contains a thumb and four distinct coarse finger lobes. `pilot-hand-rest.png`, `pilot-hand-flex.png` and `pilot-hand-flex-side.png` show an 18-degree flex at each finger segment: actual skinned geometry moves without changing rest geometry. The side view retains the source's broad fingers and webbing; this is a partial hand improvement, not detailed hand acting.

`pilot-face-open.png` and `pilot-face-narrow.png` show the accepted restrained narrowing test without the strong brow deformation of the first full-closing attempt. `rejected-full-blink.png/json` retain that failed experiment: painted eyes and coarse triangles pull one brow into the eye during full closure. Full blinking requires local eyelid/eye topology work. A jaw, mouth cavity, separate eyeballs, facial performance and speech are not supplied.

The preparation script checks that all source hashes, all 24 body bind matrices/hierarchy and all rest vertices remain unchanged; weights are finite and normalized, every added bone has weighted vertices and the test flex visibly moves skin. FBX reimport checks the full 44-bone hierarchy, original binds, rest vertices, morph names and normalized weights. GLB inspection confirms 44 joints and the same two morphs. These checks establish asset structure, not native rendering, co-op, runtime animation or performance acceptance.

Regenerate only this owned derived folder from the repository root:

```sh
blender --background --factory-startup --python-exit-code 1 --python games/nord-unreal/Scripts/prepare_graphic_novel_rig.py
```

Use `-- --inspect` for source inspection images only. The source textures remain linked to their immutable original paths in the Blender file; the GLB embeds its texture.
