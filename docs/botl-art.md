# Breath of the Lake: painted environment artwork

The environment uses eight WebP textures derived from five initial Higgsfield image jobs and one cartoon facade restyle, generated with `gpt_image_2_5`, high quality, 2k resolution. The supplied anime cottage frame guided the facade, material atlas and sky: aged seafoam paint, honey oak, cream lace, floral upholstery and sunlit summer clouds. The reference image and video are not shipped in the game.

## Source artwork

Generated on 2026-09-29 in the Higgsfield project **Breath of the Lake — painted world** (`3607b537-ca1d-42c4-806a-9b70aecadef1`). These are generated 2D images; the cottage geometry is authored in JavaScript, not a generated 3D model.

| Artwork | Job ID | Source | Export |
| --- | --- | --- | --- |
| Straight-on cottage facade, weathered teal wall, central oak door and two lace windows | `b8840ba9-1c31-4425-af87-e95bcb261b40` | [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/hf_20260929_044647_b8840ba9-1c31-4425-af87-e95bcb261b40.png) | 2048×1360 WebP |
| Four-quadrant material atlas: siding, oak, shingles, floral linen | `12dd63c7-8d1d-45ad-9d6d-48a2bf2f446a` | [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/hf_20260929_044722_12dd63c7-8d1d-45ad-9d6d-48a2bf2f446a.png) | Four 1024×1024 quadrant crops, WebP |
| Wide summer sky with painted cumulus clouds | `837aff96-d50b-4605-aaf9-303796a08499` | [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/hf_20260929_044725_837aff96-d50b-4605-aaf9-303796a08499.png) | 2688×1152 WebP |
| Botanical leaf cluster with transparent background | `7723d2ff-38d2-41c1-a08a-b0e4f6d782c1` | [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/hf_20260929_044758_7723d2ff-38d2-41c1-a08a-b0e4f6d782c1.png) | 1024×1024 WebP with alpha |
| Fine sage grass, clover and moss meadow floor | `24deef7a-5a41-4218-a96c-10c1faed99b8` | [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/hf_20260929_045851_24deef7a-5a41-4218-a96c-10c1faed99b8.png) | 1024×1024 WebP |

The local runtime assets total 3,227,164 bytes (3.08 MiB). They are served from `public/wild/tex/`; gameplay makes no generation-provider requests. File sizes and SHA-256 hashes are recorded in [botl-art-assets.json](botl-art-assets.json).

## Rendering

- The facade is partitioned into measured UV regions on recessed windows, raised frames and a separate door plane. Roof courses, window jambs, porch furniture and ceramics add real depth. Static cottage surfaces merge into 15 material batches without dropping UVs.
- Instanced trees use crossed, alpha-tested botanical leaf cards and retain their wind deformation. Far trees use fewer cards. Grass blades are shorter and narrower to reveal the painted ground.
- The panoramic sky fades back into the dynamic sky at sunset, night and storm transitions; its wrap seam and zenith are blended. Procedural clouds remain available when its image fails to load.
- Color textures use sRGB decoding, intermediate render targets remain linear, and the final post pass performs one display conversion. The mean-normalized ground mask is decoded explicitly in its shader. Imported models retain their color maps and use the shared cartoon light ramp. Three broad tones with soft transitions, stronger warm sunlight, cool skylight, clearer character outlines and a small edge-preserving paint filter give the scene an animated look. Ground texture contrast is reduced so grass and landscape read as larger color shapes.
- Missing generated images fall back to colored cottage geometry, procedural foliage, terrain color and the existing sky. The roof collider follows the new roof height.

## Verification

Serve `public/` on port 8765, install Playwright and its Chromium browser, then run:

```sh
node qa/wild/render.mjs
node qa/wild/level.mjs
SHOTS=/tmp/botl-art node qa/wild/art.mjs
```

`art.mjs` checks loaded maps and UVs, cottage draw batches, color spaces, night lighting, portrait rendering and a playable fallback with every generated WebP request blocked. `render.mjs` checks image contrast and shader errors for three graphics presets across day, dusk and night. `level.mjs` covers towers, kayak traversal, stairs and fishing locations.

Visual review uses desktop and portrait screenshots. Software-WebGL browser checks do not establish performance on physical phones. The existing character models and animation are retained. The cottage remains a solid, climbable exterior with a furnished veranda; it does not provide the reference video's explorable room or cinematic character fidelity.

## Cartoon direction

The user clarified that the goal is a cohesive Ghibli-like animated aesthetic and how light hits surfaces, rather than greater texture realism. [Higgsfield’s article](https://higgsfield.ai/blog/61UhiQpNLVrX41WA7QGFdc) documents a Ghibli image preset. The connected preset catalog did not resolve it and the website required separate authentication, so the facade restyle used an explicit Studio Ghibli hand-drawn background prompt through the connected image generator; it was not an execution of the named UI preset.

Facade restyle job: `d3e7d219-c53a-4807-9083-c85e35c81085`, using the original generated facade and the supplied reference frame. [Generated source PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/hf_20260929_063356_d3e7d219-c53a-4807-9083-c85e35c81085.png). The prompt preserves the UV layout while replacing realistic grain and grunge with clean ink contours, broad mint and honey gouache shapes and simplified lace.

`cartoon.js` supplies a common cel-light ramp and pigment treatment for imported characters, the cottage and foliage. Terrain shares the ramp; the post pass gently groups small texture details while retaining silhouettes. Lighting and cast shadows are computed live, so the aesthetic remains consistent as the player moves. The image preset itself is not a realtime game renderer.
