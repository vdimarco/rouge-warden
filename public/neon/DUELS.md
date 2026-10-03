# Blade duels

The 3D game now uses `duel.js` for health, guard and attack timing. Each fighter begins with at least six health. Closed guards stop health damage. A parry breaks the guard at once. A block adds 1 to the guard bar and a timed dodge adds 2; at 4 the guard breaks. Changing cut angle also applies guard pressure. Each opening allows one clean strike (normally two damage, capped at three with upgrades or overdrive). Surviving opponents recover and require another exchange.

Rounds 1–2 use one swordsman, 3–4 use two, 5–6 use three, 7–8 use four, and later rounds cap at five. One opponent commits to an attack at a time, and only when it is in reach and on screen. The others circle inside the view and take turns. Captains appear every fourth round with extra health. The old fixed-view fallback retains its prior combat rules.

The new health and guard bars show when to defend and when to strike. The same phone controls move the blade and view. A timed dash avoids a committed attack and weakens the guard. Stepping out of reach avoids it too, but the guard stays whole. Tablet widescreen controls remain available.

## 404 Gen asset pipeline

`node scripts/generate-neon-model.mjs --asset=ronin --submit` starts one character job using a server-side `FOUROFOUR_API_KEY`. Repeat without `--submit` to poll that task. The task ID is checkpointed to `public/neon/models/ronin.job.json`; do not discard it between runs. The script records submission intent before calling the provider and refuses a blind retry if the response is lost.

`--asset=gate` prepares a second detailed market gateway. Both use the official 404 Gen text-to-mesh endpoint and fixed briefs. Keys never enter browser files. The generated GLB and manifest must be published together after review.

No 404 Gen generation was submitted in this update because the execution environment has no API key. The existing Exploit Envoy integration was inspected for its API contract; its key was not extracted or moved. The committed manifest is empty.

`model-assets.js` loads completed local GLBs using the existing Three.js GLTFLoader. It normalizes scale and position, preserves the procedural sword for attack animation and keeps the current model when loading fails. This first 404 Gen pass produces an unrigged body; it is not a fully rigged character animation system. Limits are 12 MB, 90,000 triangles and 64 meshes per asset. The loaded body is shared across opponent clones. Optimize further if tablet frame rate drops.

## Validation

`node --test qa/neon/combat.test.cjs qa/neon/district.test.mjs qa/neon/duel.test.mjs qa/neon/onscreen.test.mjs`

29 tests pass. README.md lists what each file covers. GPU rendering is mocked in Node. `qa/neon/neon.e2e.mjs` drives the real page in Chromium. Real tablet visuals, generated-model appearance and physical motion feel remain unverified.
