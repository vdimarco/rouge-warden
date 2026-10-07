# Swing: car crashes and cleaner car models

The user asked for collisions between cars, and called the car models "super ugly, janky, unrefined". They asked for Meshy to improve them.

## Why

- **Cars passed through each other.** A driven car stopped only at walls. Parked cars, job cars and street traffic did not collide with it.
- **The car models looked rough.** The first pack cut each Higgsfield SAM 3D mesh to 1,200 to 1,900 triangles. That gave the wheels eight sides, dented the panels and left flat facets. Only the 3 nearest parked cars used a model at all. Every street car, and most parked ones, used a simple box shape.
- **Meshy could not run.** The Higgsfield account has 0 credits, and a textured Meshy car costs about 30. The full-detail SAM meshes were still on Higgsfield, so the cars were packed again from them.

## What changes

- **Car against car (`cars.js` `collide`).** Each car is two circles (radius 0.95 m, 1.25 m in front of and behind its middle). A hit pushes the cars apart, but never into a wall, and trades their speed along the hit with restitution 0.3. A parked car that is hit rolls away and coasts to a stop. A hard hit makes a bump sound and rumble.
- **The driven car against street traffic.** A street car in front of the driven car becomes a real car on the spot (`K.steal(t, from, true)`, a `struck` event). Its shader car is hidden, and the crash then pushes it like any other car.
- **The models (`higgsfield/models3d/pack-car.mjs`).** Each car is packed again from the full SAM mesh at 5,000 triangles, with smooth normals, a 512 px WebP texture and quantized attributes (about 330 KB each). The loader in `actionview.js` turns quantized attributes into floats before it resizes the mesh.
- **Models in more places.** Every parked car and job car drawn (up to 8) shows its model. The 12 nearest street cars within 60 m are also drawn as models: their shader cars are veiled (`cityview.js` `veilTraffic`, an `aHide` instance attribute), and their lanes stay as they are, so theft and crashes still find them. Far street traffic keeps the simple body.
- Version 1.19.0 (Quest APK code 26).

## Out of scope

- New Meshy models. They need about 90 Higgsfield credits for the three cars. `pack-car.mjs` already takes a Meshy GLB.
- Crashes between two street cars, or between a street car and a parked car. Only the driven car turns street cars into real cars.
