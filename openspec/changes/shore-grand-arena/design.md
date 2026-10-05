# Design: grand arena in 3D

## 3D assets (done before the code work)
Credits were limited (406 at the start), so the pipeline uses the cheapest step that holds quality at each stage. It was chosen by a
side-by-side test on Tidewarden: Meshy 7 image-to-3D (38 credits) put the weapons on the floor in its A-pose mode and gave only a base
colour map. Tripo H3.1 (9 credits) kept the weapons and gave full PBR maps. SAM 3 (1 credit) lost the trident.

1. One reference image per hero with GPT Image 2.5: front view, A-pose, empty hands, the weapon standing apart. The first hero's image is
   the layout and style reference for the rest, so all sixteen match.
2. Tripo H3.1 turns the image into a textured PBR mesh. Weapons come out as separate mesh parts because they stood apart in the image.
3. Tripo faces +X; the Meshy rigger assumes +Z. A model that is not turned gets a broken skeleton, so the mesh is turned 90 degrees.
4. The Meshy rigger fails on a body that is not centred (a weapon on one side moves the body off centre), so only the body is rigged.
   The weapon parts are added back after rigging, fixed rigidly to the hand or forearm bone. A weapon skinned by the rigger bends like
   rope; a rigid prop does not.
5. Each rig job buys one animation clip, so every hero bought a different clip. clips.json keeps each clip with the bind pose of the
   hero it was made on. hero-rig.js retargets any clip to any hero by world-space rotation deltas, which keeps the motion and fits the
   bones. Only hip height moves, so no clip slides a hero away from its simulation position.
6. The rigger's material is a flat emissive copy of the base colour. The Tripo PBR maps (base colour, ORM, normal) are restored, because
   the rig keeps the same UV atlas, and stored as WebP. Meshes are quantized and meshopt-compressed (decoder in lib/).
7. Towers, cores, the Wild Hunt and the camp beast are static Tripo meshes. Scenery props come from one prop sheet through SAM 3 and are
   simplified for instancing.

Result: 16 heroes in about 7 MB, a 1.3 MB clip library, 1.6 MB of world models. Spent: about 400 credits, 6.25 left. The scripts are kept
with the change notes (see tasks).

## Rendering
See the renderer section added after implementation.

## Map, towers and pacing
See the map section added after implementation.

## Combat feel and bots
See the combat section added after implementation.
