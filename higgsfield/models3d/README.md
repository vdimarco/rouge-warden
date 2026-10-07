# 3D model steps for Shore of the Ancients

These scripts made the models in `public/tidebreak/models/`. Generation ran on Higgsfield (job IDs are in
`public/tidebreak/models/sources.json`). Install with `npm install` in this folder, then run the steps in order for each hero.

1. `node turn.mjs tripo.glb turned.glb -90` turns a Tripo mesh (it faces +X) to face +Z, the front the Meshy rigger expects.
2. `node strip.mjs turned.glb body.glb` keeps only the body and centres it. The rigger fails on a body that is not centred.
3. Upload `body.glb` (Higgsfield media upload, type file) and rig it with `meshy_rigging`, one animation clip per hero.
4. `node process-hero.mjs rigged.glb tripo.glb hero.glb clips.json '<config>'` restores the Tripo PBR maps, adds the weapons from
   `turned.glb` as rigid props on the hand bones, resets the bind pose, turns the model to face +Z and appends the clip to `clips.json`
   with its source bind pose. Config example:
   `{"slug":"tidewarden","clip":"thrust","propsFrom":"turned.glb","props":[{"bone":"LeftForeArm","mode":"shield"},{"bone":"RightHand","grip":0.42,"mode":"weapon"}]}`
   Props are listed from the hero's right side to the left side. `mode`: `weapon` (long weapon; `grip` is the fraction of its height from the
   bottom; `flip` turns the far end up; `tilt` leans it forward in degrees), `shield` (upright on the forearm, facing out), `held`
   (upright in the hand). `scale` resizes a prop.
5. `node pack.mjs hero.glb packed.glb` quantizes and meshopt-compresses for the game.
6. Static models: `node pack-static.mjs in.glb out.glb <triangles> <turnDegrees> <textureSize> <maxError>` puts the feet on y = 0,
   centres the model, scales it to height 1, simplifies it and compresses it.

The game slims `clips.json` to rotation tracks plus hip translation, rounded to 4 decimals.

# Cars for In Full Swing

`node pack-car.mjs in.glb out.glb <triangles> <lengthMetres> [turnDegrees] [textureSize] [maxError]` packs a Higgsfield
image-to-3D car (SAM 3D or Meshy) for `public/vr/models/cars/`: wheels on y = 0, centred, scaled to the length, front to +Z,
simplified with smooth normals, a WebP base colour, and quantized attributes. It does not meshopt-compress, because
`public/vr/js/actionview.js` loads the cars with a plain GLTFLoader. The commands and job IDs are in
`public/vr/models/cars/CREDITS.md`.
