# Afterlight

A full-screen ASCII action-rescue game at `/afterlight/`. Blast shadow creatures, reach stranded survivors and lead them to the golden beacon. Bring three survivors home, protect the beacon, and defeat its guardian to open the next rescue route. Six distinct worlds connect into one campaign.

## Play

WASD/arrows move. Aim and hold click to fire; hold Space or the Fire button to aim at nearby threats automatically. Shift or Dodge bursts through danger with brief protection and a cooldown. Survivors follow when approached and reach safety at the beacon. Violet telegraphs warn of attacks. Each guardian alternates a spreading bolt fan with a charge; its visible health bar marks the final threat. Health and temporary triple-light pickups help the rescue. P/Escape pauses. Touch provides held movement/fire and dodge controls.

A lost rescue can restart the current world without erasing completed worlds. Valid progress saves locally, and continuation is deliberate. Hidden pages and the arcade switcher pause play. Motion can be reduced, and optional synthesized sound is off until enabled.

## A living picture

Phaser 3.90.0 renders locally bundled bas3line/ascii scenes with region-specific broad light, weather, cinematic depth, animated native-dot characters, projectile trails and expanding restoration effects. Forest, city, coast, fjord, desert and moon share the action loop but have distinct enemy behaviors and atmospheres. The playfield fills the viewport behind a compact HUD. Source artwork and licenses remain bundled; there is no raster replacement or runtime CDN.

The editable source is split into `action-engine.js` (deterministic campaign), `action-art.js` (scene composition), `action-game.js` (Phaser/input/lifecycle), and `action.css`/`index.html` (HUD and controls).

## Classic

The previous exploration adventure remains at `/afterlight/classic.html`. It retains its original shared tools, supplies, spatial firefly tasks and three-crew story. Its storage is separate from action mode, so switching modes does not overwrite existing journeys. Its engine, rendering and browser checks remain available.

## Checks

`node --test qa/afterlight/*.test.mjs` checks both action and Classic models. `node qa/afterlight/action.e2e.mjs` checks the action UI in Chromium using the static server at localhost:8765. See `qa/afterlight/action-review.md` for actual verification and visual evidence.

For Classic, set `AFTERLIGHT_URL`/the relevant path as documented in its scripts or use the retained model and compositor checks. `qa/afterlight/rescue-review.md` records the previous iteration. Physical devices and other browser engines require separate verification.
