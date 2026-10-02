# Full Tilt: a pinball voyage

The arcade's `/lab/tilt/` route opens a six-sector space adventure. Each zone is shown on its own, with open space around its planet. Other playfields stay hidden. Its camera follows the comet and frames the active flippers on the approach. Portrait and landscape use the same upright physics world.

The field uses luminous mineral cores, varied asteroid surfaces, diffuse orbital dust and an accretion flow around each jump gate. The route map exposes a textured spiral galaxy, with its route list at the side or below on a phone. The open-space camera centers each system without clamping it to the engine's storage coordinates.

## Play

Press either screen half or the marked flipper pads to flip at the dock. Z and X control the left and right flippers. Hold Launch or Space, then release. Pulse (C) bends a shot toward an uncharged relay in any direction; A/D steer sideways. R opens or closes the map, and Escape pauses or resumes. Upgrade choices use 1/2/3, and E skips a jump. All game shortcuts sit on the left side of the keyboard. A short projected path helps you read the gravity curve. Relays open a jump gate. Enter it to choose an upgrade and fly to the next sector. The Star Engine's cores each need two hits.

**Reverse scoop:** when the ball falls below a flipper, release and tap that flipper again. Its control turns gold while a scoop is in reach. A short gravity curl guides the ball up through the center of the dock. A fresh press is required, with a brief cooldown. Missing the recovery area still costs a ball. Z/X and the touch controls use the same action.

**Travel between worlds:** after choosing an upgrade, the camera leaves the current orbit, turns through a galaxy view, dives into a black hole from a spacecraft cockpit, and arrives at the next dock. Depth-projected stars stream past the windshield as speed builds, with slow nebula motion behind them and a gentle glow on arrival. A jump lasts 6.6 seconds. The galaxy shows symbolic route markers; it never exposes adjacent playfields. **Skip jump** goes straight to the same destination. Pause, a hidden tab, and lost focus stop travel and its sound. Flipper controls and phone tilt stay suspended until arrival. Devices with reduced motion enabled use a 1.1-second fade with no camera rotation or streaks. The destination stays at the dock until the player launches.

For optional phone steering, hold the phone comfortably and tap **Enable tilt** on the start screen or in Pause. Allow motion access if asked. Tilting gently nudges the ball toward the lowered edge of the screen. The force is smoothed and capped at 80 world units/s², one tenth of the dock's pull, including diagonal tilts. Planetary gravity remains the main force. The shot preview includes the same nudge. Pause includes a toggle and **Recenter tilt**. Returning to play or rotating the screen sets a fresh center. Tilt starts off each page load; denied permission or missing sensors leave all touch controls usable.

**Warp Surf:** drag anywhere in the spacecraft view, or hold WASD, to line up the center reticle with three approaching rings. Each ring earns 150 points. Pass through at least two for one gravity charge on arrival, up to the three-charge limit. This challenge is optional: missing or skipping has no penalty, and Skip preserves points and any charge already earned. Reduced motion grants the charge during its short fade. Releasing the pointer, pausing, hiding the tab or rotating the screen clears steering.

**Gravity fields:** start with one charge and carry up to three. Each new relay charge and each rewarded half-orbit earns another. During flight, tap **Field** (or F) to pause and aim. Choose **Pull** to attract the ball or **Push** to repel it, then tap open space or drag and release. **Place here** uses the shown target; WASD moves it, Q switches Pull/Push, and E places it. Cancel, F or Escape keeps the charge. Each field lasts five seconds of play, with a fading force inside its marked radius. Only one field can be active. Pause stops its timer. A lost ball or sector exit clears the deployed field; unspent charges carry forward. The shot guide includes the selected field and its expiry.

**Music:** an original, evolving space score combines wide synth chords, a deep bass with a phone-audible octave, glassy motifs and filtered air. Harmony and texture change over time and between sectors. Sound defaults on for Full Tilt, independent of other arcade games. The menu and HUD sound buttons stay in sync, and an explicit mute is saved as `tilt.voyage.sound`. Music starts after Start voyage, fades out for field aiming, the map and Pause, and gives way to the black-hole jump sound before returning at the next dock. Hidden tabs stay silent. The score is synthesized locally with Web Audio and needs no audio download.


Planets use strong, softened radial forces. Open flight has no uniform downward pull. A local field guides returning shots through the launch dock, which has only short flipper guides. A broad return current curves distant shots back toward the active system without a hard boundary. The six sectors vary their target layouts and gravity: attraction, denser asteroid belts, changing tides, repulsion, stronger attraction, and the final core. A half-orbit earns a 750-point bonus. Progress within the current sector survives a lost ball. An early launch shield and a rescue impulse for a stalled comet prevent avoidable dead ends.

## Implementation

- `adventure.js`: seeded geometry, progression, upgrades, gravity and checkpoint recovery.
- `physics.js`: the existing 120 Hz capsule-flipper solver, with optional table gravity/drain, active-sector, speed-limit and open-space hooks. The classic geometry and regression suite remain available for solver checks.
- `camera.js`: a pure camera model with velocity lead, viewport guards and flipper framing.
- `transit.js`: shared travel timing, camera stages and isolated-sector visibility.
- `warp-surf.js`: seeded ring targets, smooth ship steering, perspective projection, crossing checks and one-time rewards.
- `transit-audio.js`: a small reusable audio graph driven by travel progress, with a deep horizon hush and arrival chord.
- `space-music.js`: a bounded, reusable Web Audio score with evolving harmony, stereo pads, bass, glass motifs and echo.
- `render.js`: generated art, effects and the route map. Rails, flippers, relay charge marks and the white ball use code to keep collision and input feedback exact.
- `cosmic-textures.js`: cached spiral-galaxy and orbital-dust layers. Fine stars are drawn once, then reused each frame.
- `art/organic/mineral-sprites.webp`: original generated stone, iron and ice asteroids plus a stellar mineral core, about 444 KB. Its provenance file records the prompt, source and alpha bounds.
- `main.js`: touch/keyboard controls, sound, pause, route and upgrade UI.
- `motion.js`: opt-in device orientation, permission handling, screen-relative calibration, dead zone and smoothing. Sensor readings stay in the page and are not stored or sent.
- `assets/provenance.json`: original celestial art prompts, sources and crop bounds, about 613 KB.
- `art/transit/event-horizon.webp`: original generated black-hole plate, about 285 KB. Its companion provenance file records the provider and prompt. Camera motion, lens effects and the cockpit warp run in the renderer, with no video download or playback dependency.

## Checks

Run from the repository root:

```
node qa/lab/tilt.sim.mjs
node qa/lab/tilt.adventure.sim.mjs
node qa/lab/tilt.camera.sim.mjs
node qa/lab/tilt.motion.sim.mjs
node qa/lab/tilt.field.sim.mjs
node qa/lab/tilt.transit.sim.mjs
node qa/lab/tilt.reverse.sim.mjs
node qa/lab/tilt.warp.sim.mjs
```

The classic physics suite covers high-speed shots, catch/pass skills, energy and two simulated hours without a trapped ball. Adventure tests cover actual relay collisions, upgrades, checkpoints and a bot that clears all six sectors. Camera tests cover 3,314 cases across seven screen sizes.

`qa/lab/tilt.e2e.mjs` contains browser checks for the public controls. `qa/lab/tilt.motion.e2e.mjs` uses a virtual phone sensor to check permission, calibration, rotation, pause, denied access and missing hardware through the public UI. Use the existing `qa/lab/lib.mjs` server configuration to run them. Physical phone tests remain useful for the native permission prompt, sensor feel, touch latency and sustained frame rate.

`qa/lab/tilt.field.sim.mjs` checks earned charges, physical pull/push flight, the five-second lifetime and cleanup. `qa/lab/tilt.field.e2e.mjs` checks placement through the public touch and keyboard controls. Field rings and direction marks are drawn from the same radius as the force, so they remain exact at every camera scale.

`qa/lab/tilt.transit.sim.mjs` checks travel timing, isolated visibility, camera transforms and arrival/skip state. `qa/lab/tilt.transit.e2e.mjs` reaches the first gate through the public launch, Pulse and flipper controls. It checks the full mobile jump, pause, hidden-tab handling, landscape skip, restored controls and reduced motion.


## Design reference

Gabriel O'Flaherty-Chan's perspective article informed Warp Surf's camera-relative depth projection: https://gabrieloc.com/2026/09/15/perspective.html. The ring renderer and collision check share the same coordinates and radius; clipping the near plane keeps projection finite. `qa/lab/tilt.warp.sim.mjs` checks deterministic crossings, scoring, rewards and clipping. `qa/lab/tilt.warp.e2e.mjs` checks real drag, touch, WASD, input cleanup, pause, skip, inventory limits and reduced motion across desktop and phone layouts.

Pinball Spire's public game description informed the combination of pinball, exploration and abilities: https://store.steampowered.com/app/2601940/Pinball_Spire/. Full Tilt uses its own space setting, graphics, world and game code.
