# Fishing art

`ghibli-lake.webp` is the Ghibli-inspired title illustration. It was generated through Higgsfield on 2026-09-29 with `gpt_image_2_5`, job `086e09fe-381c-4e8c-ad55-d74f47350373`, and exported as a 1344 × 752 WebP (about 200 KB).

`ghibli-sky.webp` is a second Higgsfield illustration used on the sky and in the water reflections during play. Model: `gpt_image_2_5`; job: `888d325a-9533-4b58-8c85-4992d8f5351a`. The sky-only brief requested ivory cumulus clouds, soft blue shadows and brush texture. It loads once on demand; the procedural sky remains available if the image fails.

The brief called for a hand-painted Ontario lake, a wooden dock, cedar and pine forest, a small lakeside cottage, jade water and warm morning clouds. It excluded text, logos, people and UI.

The Higgsfield connector resolved the request as a style brief, so generation used the image model directly. No catalog preset ID was executed. This is an independent game with an optional art style.

Ghibli is the default for new players and saves without an art preference. An explicit Original choice is preserved. Both styles can be selected from the title or Settings.

In Ghibli mode, fish have fuller bodies, larger eyes and simplified painted markings; instanced trees have rounded crowns; and the reel uses flat colors and ink outlines. Shared materials use cel shading, reduced highlights and shaded edges, alongside the painted sky and water reflections. Original geometry and textures remain available when switching styles. The day cycle, fish animation and fishing cues remain live. The game needs no Higgsfield account or runtime API call.

## Regenerated 3D models

`cartoon-models.glb` was built through Higgsfield 3D Jutsu with Blender 5.2 on 2026-09-29. Project: `b85c63a1-6192-41ac-bc7c-f7e36556a937`; committed model revision: 1; operation: `build-cartoon-fishing-model-set-v2`. The editable generation script is `scripts/build-fishing-cartoon-models.py`.

The pack contains a bamboo rod with a rounded enamel reel, a painted lure and its leaf blade, pine and broadleaf trees in two detail levels, a far-tree mesh, a cottage and a cartoon loon. The game imports the named meshes, joins their material colors into one geometry per asset and reuses the existing bend, spinner and swimming animation. The 3D rod, casting panel and touch rod control share the bamboo and jade palette.

The Ghibli request was resolved as a style brief. These are generated Blender meshes through Higgsfield 3D Jutsu, rather than the output of a catalog preset. The existing cartoon fish and other procedural scenery retain the same cel treatment. Original mode restores its original rod, lure and scenery. The procedural cartoon versions remain available when the model file fails to load.
