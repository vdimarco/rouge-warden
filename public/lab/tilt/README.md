# Full Tilt: a pinball voyage

The arcade's `/lab/tilt/` route opens a six-sector space adventure. The route spans 3,600 × 2,800 world units, with open space around each planet. Its camera follows the comet and frames the active flippers on the approach. Portrait and landscape use the same upright physics world.

## Play

Press either screen half or the marked flipper pads to flip at the dock. Z and slash also control the flippers. Hold Launch or Space, then release. Pulse (Up/X) bends a shot toward an uncharged relay in any direction; A/D steer sideways. A short projected path helps you read the gravity curve. Relays open a jump gate. Enter it to choose an upgrade and fly to the next sector. The Star Engine's cores each need two hits.

Planets use strong, softened radial forces. Open flight has no uniform downward pull. A local field guides returning shots through the launch dock, which has only short flipper guides. A broad return current curves distant shots back toward the active system without a hard boundary. The six sectors vary their target layouts and gravity: attraction, denser asteroid belts, changing tides, repulsion, stronger attraction, and the final core. A half-orbit earns a 750-point bonus. Progress within the current sector survives a lost ball. An early launch shield and a rescue impulse for a stalled comet prevent avoidable dead ends.

## Implementation

- `adventure.js`: seeded geometry, progression, upgrades, gravity and checkpoint recovery.
- `physics.js`: the existing 120 Hz capsule-flipper solver, with optional table gravity/drain, active-sector, speed-limit and open-space hooks. The classic geometry and regression suite remain available for solver checks.
- `camera.js`: a pure camera model with velocity lead, viewport guards and flipper framing.
- `render.js`: generated art, effects and the route map. Rails, flippers, relay charge marks and the white ball use code to keep collision and input feedback exact.
- `main.js`: touch/keyboard controls, sound, pause, route and upgrade UI.
- `assets/provenance.json`: exact art prompts, sources and crop bounds. Production art totals about 613 KB.

## Checks

Run from the repository root:

```
node qa/lab/tilt.sim.mjs
node qa/lab/tilt.adventure.sim.mjs
node qa/lab/tilt.camera.sim.mjs
```

The classic physics suite covers high-speed shots, catch/pass skills, energy and two simulated hours without a trapped ball. Adventure tests cover actual relay collisions, upgrades, checkpoints and a bot that clears all six sectors. Camera tests cover 3,314 cases across seven screen sizes.

`qa/lab/tilt.e2e.mjs` contains browser checks for the public controls. Use the existing `qa/lab/lib.mjs` server configuration to run it. Physical phone and tablet tests remain useful for touch latency and sustained frame rate.

## Design reference

Pinball Spire's public game description informed the combination of pinball, exploration and abilities: https://store.steampowered.com/app/2601940/Pinball_Spire/. Full Tilt uses its own space setting, graphics, world and game code.
