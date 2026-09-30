# Full Tilt: a pinball voyage

The arcade's `/lab/tilt/` route opens a six-sector space adventure. The route spans 3,600 × 2,800 world units, with open space around each planet. Its camera follows the comet and frames the active flippers on the approach. Portrait and landscape use the same upright physics world.

## Play

Press either screen half or the marked flipper pads to flip at the dock. Z and slash also control the flippers. Hold Launch or Space, then release. Pulse (Up/X) bends a shot toward an uncharged relay in any direction; A/D steer sideways. A short projected path helps you read the gravity curve. Relays open a jump gate. Enter it to choose an upgrade and fly to the next sector. The Star Engine's cores each need two hits.

For optional phone steering, hold the phone comfortably and tap **Enable tilt** on the start screen or in Pause. Allow motion access if asked. Tilting gently nudges the ball toward the lowered edge of the screen. The force is smoothed and capped at 80 world units/s², one tenth of the dock's pull, including diagonal tilts. Planetary gravity remains the main force. The shot preview includes the same nudge. Pause includes a toggle and **Recenter tilt**. Returning to play or rotating the screen sets a fresh center. Tilt starts off each page load; denied permission or missing sensors leave all touch controls usable.

**Gravity fields:** start with one charge and carry up to three. Each new relay charge and each rewarded half-orbit earns another. During flight, tap **Field** (or F) to pause and aim. Choose **Pull** to attract the ball or **Push** to repel it, then tap open space or drag and release. **Place here** uses the shown target; keyboard arrows move it and Enter places it. Cancel or Escape keeps the charge. Each field lasts five seconds of play, with a fading force inside its marked radius. Only one field can be active. Pause stops its timer. A lost ball or sector exit clears the deployed field; unspent charges carry forward. The shot guide includes the selected field and its expiry.

Planets use strong, softened radial forces. Open flight has no uniform downward pull. A local field guides returning shots through the launch dock, which has only short flipper guides. A broad return current curves distant shots back toward the active system without a hard boundary. The six sectors vary their target layouts and gravity: attraction, denser asteroid belts, changing tides, repulsion, stronger attraction, and the final core. A half-orbit earns a 750-point bonus. Progress within the current sector survives a lost ball. An early launch shield and a rescue impulse for a stalled comet prevent avoidable dead ends.

## Implementation

- `adventure.js`: seeded geometry, progression, upgrades, gravity and checkpoint recovery.
- `physics.js`: the existing 120 Hz capsule-flipper solver, with optional table gravity/drain, active-sector, speed-limit and open-space hooks. The classic geometry and regression suite remain available for solver checks.
- `camera.js`: a pure camera model with velocity lead, viewport guards and flipper framing.
- `render.js`: generated art, effects and the route map. Rails, flippers, relay charge marks and the white ball use code to keep collision and input feedback exact.
- `main.js`: touch/keyboard controls, sound, pause, route and upgrade UI.
- `motion.js`: opt-in device orientation, permission handling, screen-relative calibration, dead zone and smoothing. Sensor readings stay in the page and are not stored or sent.
- `assets/provenance.json`: exact art prompts, sources and crop bounds. Production art totals about 613 KB.

## Checks

Run from the repository root:

```
node qa/lab/tilt.sim.mjs
node qa/lab/tilt.adventure.sim.mjs
node qa/lab/tilt.camera.sim.mjs
node qa/lab/tilt.motion.sim.mjs
node qa/lab/tilt.field.sim.mjs
```

The classic physics suite covers high-speed shots, catch/pass skills, energy and two simulated hours without a trapped ball. Adventure tests cover actual relay collisions, upgrades, checkpoints and a bot that clears all six sectors. Camera tests cover 3,314 cases across seven screen sizes.

`qa/lab/tilt.e2e.mjs` contains browser checks for the public controls. `qa/lab/tilt.motion.e2e.mjs` uses a virtual phone sensor to check permission, calibration, rotation, pause, denied access and missing hardware through the public UI. Use the existing `qa/lab/lib.mjs` server configuration to run them. Physical phone tests remain useful for the native permission prompt, sensor feel, touch latency and sustained frame rate.

`qa/lab/tilt.field.sim.mjs` checks earned charges, physical pull/push flight, the five-second lifetime and cleanup. `qa/lab/tilt.field.e2e.mjs` checks placement through the public touch and keyboard controls. Field rings and direction marks are drawn from the same radius as the force, so they remain exact at every camera scale.

## Design reference

Pinball Spire's public game description informed the combination of pinball, exploration and abilities: https://store.steampowered.com/app/2601940/Pinball_Spire/. Full Tilt uses its own space setting, graphics, world and game code.
