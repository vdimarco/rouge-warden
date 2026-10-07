Drivable car models made with Higgsfield image-to-3D on 2026-10-06, and packed again on 2026-10-07.

Each car started as a reference image from Higgsfield `gpt_image_2_5`: a comic cel-shaded car on a plain background with white paint, dark glass, black tyres and chrome. Higgsfield `sam_3_3d` (SAM 3 3D Objects, textured GLB) turned each image into a mesh. The Meshy `image_to_3d` route was not used: it costs about 30 credits for a textured car, and on both dates the account balance was too low (0 credits on 2026-10-07).

The first pack (2026-10-06) cut each car to 1,200 to 1,900 triangles. That gave the wheels eight sides, dented the panels and left flat facets. The second pack (2026-10-07) starts again from the full SAM meshes (13,000 to 22,500 triangles) with `higgsfield/models3d/pack-car.mjs`: weld, simplify with meshoptimizer to 5,000 triangles (error 0.004), smooth normals, a 512 px WebP base-colour texture, metallic 0 and roughness 0.6, quantized attributes (KHR_mesh_quantization). Each model is scaled to a set length in metres, centred on X/Z with the wheels at y = 0, and turned so the front faces +Z (the hatchback turns 180 degrees).

```
node pack-car.mjs muscle-sam.glb muscle.glb 5000 4.5 0
node pack-car.mjs hatchback-sam.glb hatchback.glb 5000 4.0 180
node pack-car.mjs van-sam.glb van.glb 5000 5.0 0
```

| File | Image job | 3D job |
| --- | --- | --- |
| muscle.glb | 4b0ae914-729e-412e-b7ff-7d03f2147ec1 | ac5df7f1-6684-4897-8546-a44db2078423 |
| hatchback.glb | 2d4783dd-4d66-4901-baab-0ce55134772b | 6ac8429d-74f7-498e-abb6-0825cf982eff |
| van.glb | e5aafa70-1241-40fc-9282-9191d7e1f936 | 9efefc92-e1b2-49b0-98ec-a43f4452177b |
