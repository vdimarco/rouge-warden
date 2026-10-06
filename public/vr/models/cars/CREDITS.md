Drivable car models made with Higgsfield image-to-3D on 2026-10-06.

Each car started as a reference image from Higgsfield `gpt_image_2_5`: a comic cel-shaded car on a plain background with white paint, dark glass, black tyres and chrome. Higgsfield `sam_3_3d` (SAM 3 3D Objects, textured GLB) turned each image into a mesh. The Meshy `image_to_3d` route was not used because its cost (30 credits textured) was more than the account balance.

Post-processing used @gltf-transform: weld, prune and dedup; each car was then simplified with meshoptimizer to 1,200 to 1,900 triangles so they fit the game's triangle budget (the three nearest cars show the model, the others a built-in box car); base-colour textures were resized to 512 px WebP; materials were set to metallic 0 and roughness 0.6. Each model was scaled to a set length in metres, centred on X/Z with the wheels at y = 0, and turned so the front faces +Z.

| File | Image job | 3D job |
| --- | --- | --- |
| muscle.glb | 4b0ae914-729e-412e-b7ff-7d03f2147ec1 | ac5df7f1-6684-4897-8546-a44db2078423 |
| hatchback.glb | 2d4783dd-4d66-4901-baab-0ce55134772b | 6ac8429d-74f7-498e-abb6-0825cf982eff |
| van.glb | e5aafa70-1241-40fc-9282-9191d7e1f936 | 9efefc92-e1b2-49b0-98ec-a43f4452177b |
