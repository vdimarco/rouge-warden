# Afterlight

A full-screen 3D action-rescue game with a luminous dot treatment at `/afterlight/`. Blast shadow creatures, reach stranded survivors and lead them to the golden beacon. Bring three survivors home, protect the beacon, and defeat its guardian to open the next rescue route. Six distinct worlds connect into one campaign.

## Play

WASD/arrows move. Aim and hold click to fire; hold Space or the Fire button to aim at nearby threats automatically. Shift or Dodge bursts through danger with brief protection and a cooldown. Break violet tethers before bound survivors can follow, then escort them to the beacon. Hold fire too long and the weapon overheats; release to cool it. E or Pulse interrupts nearby attacks and destroys hostile bolts. Violet telegraphs warn of attacks. Each guardian alternates a spreading bolt fan with a charge; its visible health bar marks the final threat. Health and temporary triple-light pickups help the rescue. P/Escape pauses. Touch provides held movement/fire and dodge controls.

A lost rescue can restart the current world without erasing completed worlds. Valid progress saves locally, and continuation is deliberate. Hidden pages and the arcade switcher pause play. Motion can be reduced, and optional synthesized sound is off until enabled.

## A living picture

Locally bundled Three.js renders real perspective terrain, layered forest geometry, cyan water and mist, luminous beacons, projectiles and restoration effects. A following camera and ground raycasting connect movement and aiming to the scene. Bloom and a dot treatment carry the original ASCII-inspired color direction into 3D. The six regions retain distinct encounters and atmospheres. There is no runtime CDN. Hardware rendering uses a bounded 640px target; detected software WebGL uses a smaller 240px target and cheaper bloom to reduce cost.

The editable source is split into `action-engine.js` (deterministic campaign), `depth-render.js` (shared 3D renderer), `action-game.js` (input/lifecycle), and `action.css`/`index.html` (HUD and controls).

## Battle Tanks

The parallel game at `/battle-tanks/` uses a dedicated luminous 3D dot renderer with separate campaign saves. W/S accelerates and reverses, A/D turns the hull, and the pointer aims the turret independently. Space auto-aims fire, Shift deploys smoke, and E calls an artillery strike. Cover blocks shells and vehicles. Disable three guarded relay guns, then reach extraction; complete three sectors. Driving charges a double-damage piercing shot. Scouts, scatter tanks and bruisers have different warned attacks. Destroying a relay drops a repair and grants five seconds of rapid fire while its position lights up. Touch controls provide the same actions; optional cannon/impact sound is off until enabled.

## Classic

The previous exploration adventure remains at `/afterlight/classic.html`. It retains its original shared tools, supplies, spatial firefly tasks and three-crew story. Its storage is separate from action mode, so switching modes does not overwrite existing journeys. Its engine, rendering and browser checks remain available.

## Checks

`node --test qa/afterlight/*.test.mjs` checks both action and Classic models. `node qa/afterlight/action.e2e.mjs` checks the action UI in Chromium using the static server at localhost:8765. See `qa/afterlight/depth-review.md` for actual verification and visual evidence.

For Classic, set `AFTERLIGHT_URL`/the relevant path as documented in its scripts or use the retained model and compositor checks. `qa/afterlight/rescue-review.md` records the previous iteration. Physical devices and other browser engines require separate verification.
