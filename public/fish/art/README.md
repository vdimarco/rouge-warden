# Fishing art

`ghibli-lake.webp` is the first Ghibli-inspired title illustration, retained as source art. It was generated through Higgsfield on 2026-09-29 with `gpt_image_2_5`, job `086e09fe-381c-4e8c-ad55-d74f47350373`, and exported as a 1344 × 752 WebP (about 200 KB).

`ghibli-sky.webp` is a second Higgsfield illustration used on the sky and in the water reflections during play. Model: `gpt_image_2_5`; job: `888d325a-9533-4b58-8c85-4992d8f5351a`. The sky-only brief requested ivory cumulus clouds, soft blue shadows and brush texture. It loads once on demand; the procedural sky remains available if the image fails.

The brief called for a hand-painted Ontario lake, a wooden dock, cedar and pine forest, a small lakeside cottage, jade water and warm morning clouds. It excluded text, logos, people and UI.

The Higgsfield connector resolved the request as a style brief, so generation used the image model directly. No catalog preset ID was executed. This is an independent game with an optional art style.

Ghibli is the default for new players and saves without an art preference. An explicit Original choice is preserved. Both styles can be selected from the title or Settings.

In Ghibli mode, fish have fuller bodies, larger eyes and simplified painted markings; instanced trees use painted cutouts; and the reel uses flat colors and ink outlines. Shared materials use soft cel shading and colored shadows, alongside the painted sky and water reflections. Original geometry and textures remain available when switching styles. The day cycle, fish animation and fishing cues remain live. The game needs no art-generation account or runtime API call.

## Painted film pass

The 2026-09-29 film pass uses three images made with the built-in image generation tool:

- `film-lake.webp` (1536 × 1024, 332,520 bytes): the visual concept and title backdrop. Source generation `exec-308f1746-9112-4205-ade9-85ac03bdd9b5`. The brief specified a first-person Canadian lake, honey bamboo rod and jade reel, gouache forest layers, cream clouds and broad turquoise ripples, in the aesthetic of a Ghibli film. It excluded text, UI, people and new gameplay objects.
- `painted-forest.webp` (1254 × 1254, 726,220 bytes, alpha): four isolated forest cutouts. Source generation `exec-82ebbda7-00bb-402c-ac31-b5d6f9aca99b`. The brief requested a cedar, birch, windswept pine and willow/alder, arranged in a 2 × 2 transparent atlas with gouache foliage, warm highlights and blue-green shadows. The lake concept supplied the style reference.
- `painted-water.webp` (1254 × 1254, 194,854 bytes): a repeating gouache water texture. Source generation `exec-e2bf6398-f3a3-48bd-8d16-60110eaeb875`. The brief requested even top-down turquoise water, horizontal cream/mint brush strokes, fine paper texture and no shore, objects or perspective. It supplies moving surface detail in the existing water shader, tinted by depth and time of day. Failed loads keep the shader's procedural paint.

The source images were encoded as WebP without artistic edits. `painted-forest.js` uses the delivered atlas bounds and one quad per tree, drawn in up to three instanced layers. Trees retain the original terrain placement, face the camera around their vertical axis and sway gently. Each layer shares a cached texture; travel and style changes free the instance geometry and material. A failed image load falls back to the existing 3D trees.

The water remains a live shader with broad paint shapes and broken horizontal strokes. The rod and fish remain live meshes because their bending, swimming, and line attachment must follow play. These are intentional 2.5D choices. The menu retains its controls and uses the same lake illustration; paper-colored HUD labels sit over the scene. Original mode preserves the previous rendering.

## Regenerated 3D models

`cartoon-models.glb` was built through Higgsfield 3D Jutsu with Blender 5.2 on 2026-09-29. Project: `b85c63a1-6192-41ac-bc7c-f7e36556a937`; committed model revision: 1; operation: `build-cartoon-fishing-model-set-v2`. The editable generation script is `scripts/build-fishing-cartoon-models.py`.

The pack contains a bamboo rod with a rounded enamel reel, a painted lure and its leaf blade, pine and broadleaf trees in two detail levels, a far-tree mesh, a cottage and a cartoon loon. The game imports the named meshes, joins their material colors into one geometry per asset and reuses the existing bend, spinner and swimming animation. The 3D rod, casting panel and touch rod control share the bamboo and jade palette.

The Ghibli request was resolved as a style brief. These are generated Blender meshes through Higgsfield 3D Jutsu, rather than the output of a catalog preset. The existing cartoon fish and other procedural scenery retain the same cel treatment. Original mode restores its original rod, lure and scenery. The procedural cartoon versions remain available when the model file fails to load.
