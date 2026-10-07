# River Rush generated art and integration

All assets were generated through the connected fal account. Runtime files are optimized and hosted with the arcade, with no dependence on fal downloads during play. Exact input recipes, request IDs, prices and file hashes are in [world-art-sources.json](world-art-sources.json).

## Canopy

- [Generated concept image 1](https://v3b.fal.media/files/b/0aad5207/Lp86KXj4LodbTxNe9Gg-F_ViWln7sP.png)
- [Generated 3D preview](https://v3b.fal.media/files/b/0aad522e/1EV6LLMCYDO6N3AxqYsL3_preview.png)
- [Original GLB output](https://v3b.fal.media/files/b/0aad522d/qbdAY87AYc_KJMBc_z5xZ_model.glb)
- [Original OBJ output](https://v3b.fal.media/files/b/0aad522d/R0W6bzh5Y8lJIfAwoOWDl_8685c41ba53d5b4270c3370c62d01ecc.obj)
- [Original MTL output](https://v3b.fal.media/files/b/0aad522d/MRurd-ZkYwb9wC86QxVRq_material.mtl)
- [Original TEXTURE output](https://v3b.fal.media/files/b/0aad522d/_lMhe_CMv3uUimzBi_eeU_texture_pbr_20250901_metallic.png)
- [Optimized full model](../public/models/fal-canopy.glb) — 9736 triangles, 388620 bytes. [Arcade asset](https://arcade.uptick.systems/river-rush/models/fal-canopy.glb).
- [Optimized lightweight model](../public/models/fal-canopy-lite.glb) — 2784 triangles, 118724 bytes. [Arcade asset](https://arcade.uptick.systems/river-rush/models/fal-canopy-lite.glb).

## Harbor

- [Generated concept image 1](https://v3b.fal.media/files/b/0aad5207/M8Q9Jil-J8JA0M4Z_Ya0g_z9VsdQop.png)
- [Generated 3D preview](https://v3b.fal.media/files/b/0aad522b/W1XgYN2fS-JNn5KYiTT59_preview.png)
- [Original GLB output](https://v3b.fal.media/files/b/0aad522a/44-u6CBNCu4YKUg_DtPod_model.glb)
- [Original OBJ output](https://v3b.fal.media/files/b/0aad522a/LBi7r7zzHRUF2sHdxU79L_0d3757be6d64f85bad4dd1e00d5b1bd7.obj)
- [Original MTL output](https://v3b.fal.media/files/b/0aad522a/tAxRni2FjRjTq-GH3aN1Y_material.mtl)
- [Original TEXTURE output](https://v3b.fal.media/files/b/0aad522a/QGDBfpxMM58RbLt9zO86__texture_pbr_20250901_metallic.png)
- [Optimized full model](../public/models/fal-harbor.glb) — 9172 triangles, 459912 bytes. [Arcade asset](https://arcade.uptick.systems/river-rush/models/fal-harbor.glb).
- [Optimized lightweight model](../public/models/fal-harbor-lite.glb) — 2740 triangles, 158348 bytes. [Arcade asset](https://arcade.uptick.systems/river-rush/models/fal-harbor-lite.glb).

## Driftwood

- [Generated concept image 1](https://v3b.fal.media/files/b/0aad5207/zSfjJ-HQcagvJhHm1sdzg_UswLd3n2.png)
- [Generated 3D preview](https://v3b.fal.media/files/b/0aad5223/tsIinHcBiYA18Na9W001a_preview.png)
- [Original GLB output](https://v3b.fal.media/files/b/0aad5222/xr_KO1PVYh4b0vMzI8fE2_model.glb)
- [Original OBJ output](https://v3b.fal.media/files/b/0aad5222/zgv_NJybmFfd-tLpPvFAm_2660648af9eb62b8c18a7607ba1a0c8f.obj)
- [Original MTL output](https://v3b.fal.media/files/b/0aad5222/d6_XGhpUh4QjI4DE5gTvO_material.mtl)
- [Original TEXTURE output](https://v3b.fal.media/files/b/0aad5222/Jd6JrQIjFJVzhA_K1_HMo_texture_pbr_20250901_metallic.png)
- [Optimized full model](../public/models/fal-driftwood.glb) — 5000 triangles, 235600 bytes. [Arcade asset](https://arcade.uptick.systems/river-rush/models/fal-driftwood.glb).
- [Optimized lightweight model](../public/models/fal-driftwood-lite.glb) — 1700 triangles, 110812 bytes. [Arcade asset](https://arcade.uptick.systems/river-rush/models/fal-driftwood-lite.glb).

## Vista

- [Generated concept image 1](https://v3b.fal.media/files/b/0aad5207/NVu3v4zUm76lXghu_5w_b_FFTRo9sc.png)
- [Local runtime texture](../public/art/valley-vista.webp). [Arcade texture](https://arcade.uptick.systems/river-rush/art/valley-vista.webp).

## Ground

- [Generated concept image 1](https://v3b.fal.media/files/b/0aad5258/iZi1zHyUTw-e7mV6lFif6_EXSiXWUZ.png)
- [Local runtime texture](../public/art/surface-ground.webp). [Arcade texture](https://arcade.uptick.systems/river-rush/art/surface-ground.webp).
- [Derived detail normal](../public/art/surface-ground-normal.png).

## Integration

Canopy and pavilion GLBs share instanced geometry and materials. The full path switches scenery beyond 90 meters to lightweight meshes; software WebGL uses those lightweight meshes throughout. Color textures are at most 1024 pixels and normal/roughness textures at most 512. Hunyuan source node transforms are baked before bounding and simplification. The existing rigged rider, controls, speed and action windows are preserved.

The panorama supplies distant scenery behind actual 3D terrain, trees, falls and architecture. Ground edges are stitched locally and its normal is derived from color detail. Forest, cascade and harbor stretches repeat every 600 meters. All new decoration has bounded retries, usable fallbacks, reduced motion and pause support. See [verification](world-direction-verification.json) and the [Subway Surfers design study](subway-surfers-study.md).
