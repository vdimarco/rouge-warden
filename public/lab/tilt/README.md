# Full Tilt: a pinball voyage

The arcade's `/lab/tilt/` route opens a six-sector space adventure. Each zone is shown on its own, with open space around its planet. Other playfields stay hidden. Its camera follows the comet and frames the active flippers on the approach. Portrait and landscape use the same upright physics world.

The field uses luminous mineral cores, varied asteroid surfaces, diffuse orbital dust and an accretion flow around each jump gate. The route map exposes a textured spiral galaxy, with its route list at the side or below on a phone. The open-space camera centers each system without clamping it to the engine's storage coordinates.

## Play

Press either screen half or the marked flipper pads to flip. Z and X control the left and right flippers. At the dock, hold anywhere on the screen, the Launch button or Space, then let go to launch. Pulse (C) adds a course correction toward a dark beacon; it preserves incoming momentum, and A/D bias the correction sideways. R opens or closes the map, and Escape pauses or resumes. Upgrade choices use 1/2/3, and E skips a jump. All game shortcuts sit on the left side of the keyboard. A short projected path helps you read the gravity curve. Three beacons (the relays in the code) open a jump gate. Enter it to choose an upgrade and fly to the next sector. The Star Engine's beacons each need two hits.

**Launch and skill shot:** the charge sets the arc. A tap gives power 0.35 and a full charge (1.1 s) gives power 1. The launch is faster and steeper as the power grows. While you hold, a dotted arc shows the real shot. It comes from the same physics as the launch and ends at the first thing the ball meets. One beacon in each world has a gold ring and "SKILL ×2". When the arc meets it, the beacon says "LET GO NOW". A launch that lights it first pays double. In the tide world, the arc turns with the tide, so you can wait at the dock for the right moment. `qa/lab/tilt.skill.sim.mjs` checks that every world has a skill power.

**Approach cue and graded flips:** `forecastFlip()` in `physics.js` runs the same substeps, gravity, rails and blades as play on a copy of the ball, and finds the blade the ball will reach. Up to 0.9 s before the ideal press, a ring appears where the ball will meet that blade. It shrinks onto a small target circle at the ideal press and turns gold for the last 0.2 s. A rising tone, panned to that side, ends on a tick at the same moment. The pad says INCOMING, then FLIP NOW. Each powered flip gets a grade from where the ball meets the blade and how fast the blade moves (`gradeContact()`): Perfect for a blade at full speed in the middle of its swing, Good near that, Late for a press after the ball has landed or at the end of the swing. A Perfect holds the action for 50 ms, kicks the camera and plays a higher strike. Timing also shapes the shot: a Perfect leaves at full speed and can bend up to 14° toward a beacon or the open gate, a Good can bend up to 6°, and a Late shot is weak. Each bend comes from a forecast of the real flight.

**Active rallies:** after a 2.5 s orbit, or at once after the ball lights a beacon or smashes an asteroid, a return current drops the ball onto the middle of a flipper. Good and Perfect flips in a row build the rally: every two of them add one to the multiplier, with no top. A Late flip ends the row and keeps the multiplier. A lost heart resets it. The multiplier applies to beacons, the gate, orbits and smashes. Holding a flipper or flipping empty space grants no power. Pulse never restarts the return clock. Missed returns still cost a heart; a reverse scoop can recover the ball and start a new flight.

**End card:** the card shows the six worlds, the score, "New best" or the gap to the best ("1,250 short of best"), the Perfect count and the best rally.

**Drifting asteroids:** rocks now move through the orbital field and deflect ordinary shots without a bumper kick. Hit one with a powered ball to smash it for bonus points. A hollow amber warning marks a rock's return before it becomes solid; reentry waits if the ball would overlap. Rock fragments are visual only. The ball's amber ring and the Power Shot readout show how long you can still smash.

**Celestial upgrade console:** after reaching a jump gate, choose Quick pulse, Hull repair or Comet drive from the ship’s instrument bays. The console shows your route to the next sector. Tap a module or press 1/2/3 to install it and jump. Tab cycles through the choices. The orbital emblems and text remain sharp at every size; portrait phones use compact rows.

**Reverse scoop:** when the ball falls below a flipper, release and tap that flipper again. Its control turns gold while a scoop is in reach. A short gravity curl guides the ball up through the center of the dock. A fresh press is required, with a brief cooldown. Missing the recovery area still costs a ball. Z/X and the touch controls use the same action.

**Travel between worlds:** after choosing an upgrade, the camera leaves the current orbit, turns through a galaxy view, dives into a black hole from a spacecraft cockpit, and arrives at the next dock. Depth-projected stars stream past the windshield as speed builds, with slow nebula motion behind them and a gentle glow on arrival. A jump lasts 6.6 seconds. The galaxy shows symbolic route markers; it never exposes adjacent playfields. **Skip jump** goes straight to the same destination. Pause, a hidden tab, and lost focus stop travel and its sound. Flipper controls and phone tilt stay suspended until arrival. Devices with reduced motion enabled use a 1.1-second fade with no camera rotation or streaks. The destination stays at the dock until the player launches.

For optional phone steering, hold the phone comfortably and tap **Enable tilt** on the start screen or in Pause. Allow motion access if asked. Tilting gently nudges the ball toward the lowered edge of the screen. The force is smoothed and capped at 80 world units/s², one tenth of the dock's pull, including diagonal tilts. Planetary gravity remains the main force. The shot preview includes the same nudge. Pause includes a toggle and **Recenter tilt**. Returning to play or rotating the screen sets a fresh center. Tilt starts off each page load; denied permission or missing sensors leave all touch controls usable.

**Warp Surf:** drag anywhere in the spacecraft view, or hold WASD, to line up the center reticle with three approaching rings. Each ring earns 150 points. Pass through at least two for one gravity charge on arrival, up to the three-charge limit. This challenge is optional: missing or skipping has no penalty, and Skip preserves points and any charge already earned. Reduced motion grants the charge during its short fade. Releasing the pointer, pausing, hiding the tab or rotating the screen clears steering.

**Gravity fields:** start with one charge and carry up to three. Each new relay charge and each rewarded half-orbit earns another. During flight, tap **Field** (or F) to pause and aim. Choose **Pull** to attract the ball or **Push** to repel it, then tap open space or drag and release. **Place here** uses the shown target; WASD moves it, Q switches Pull/Push, and E places it. Cancel, F or Escape keeps the charge. Each field lasts five seconds of play, with a fading force inside its marked radius. Only one field can be active. Pause stops its timer. A lost ball or sector exit clears the deployed field; unspent charges carry forward. The shot guide includes the selected field and its expiry.

**Music:** an original, evolving space score combines wide synth chords, a deep bass with a phone-audible octave, glassy motifs and filtered air. Harmony and texture change over time and between sectors. Sound defaults on for Full Tilt, independent of other arcade games. The menu and HUD sound buttons stay in sync, and an explicit mute is saved as `tilt.voyage.sound`. Music starts after Start voyage, fades out for field aiming, the map and Pause, and gives way to the black-hole jump sound before returning at the next dock. Hidden tabs stay silent. The score is synthesized locally with Web Audio and needs no audio download.


Planets use strong, softened radial forces during free flight. After the free-flight window, a bounded return force guides the ball toward a blade at the launch dock, which has only short flipper guides. A broad outer current curves distant shots back toward the active system without a hard boundary. The six sectors vary their target layouts and gravity: attraction, denser asteroid belts, changing tides, repulsion, stronger attraction, and the final core. A half-orbit earns a 750-point bonus. Progress within the current sector survives a lost ball. An early launch shield and a rescue impulse for a stalled comet prevent avoidable dead ends.

## Implementation

- `adventure.js`: seeded geometry, progression, upgrades, gravity and checkpoint recovery.
- `asteroids.js`: deterministic moving paths, shatter/respawn lifecycle and shared future-position sampling.
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
node qa/lab/tilt.rallies.sim.mjs
node qa/lab/tilt.skill.sim.mjs
```

The classic physics suite covers high-speed shots, catch/pass skills, energy and two simulated hours without a trapped ball. Adventure tests cover actual relay collisions, upgrades, checkpoints and a bot that clears all six sectors. Camera tests cover 3,314 cases across seven screen sizes.

`qa/lab/tilt.rallies.sim.mjs` compares active and Pulse-only policies, checks repeatable safe asteroid paths, genuine motor-strike rewards and returning flight. It also checks the flip grades, the rally row and its multiplier, the approach forecast against the real touch, and the review's timed bot: over 24 seeds a ±30 ms timing error must score at least 30% more than a ±80 ms error, with at least 15 powered flips a minute. `qa/lab/tilt.skill.sim.mjs` checks the launch range and the skill shot in every world. `qa/lab/tilt.cue.e2e.mjs` replaces the frame loop with a manual one, so it steps game time itself: it checks that the cue and its tone start well before the flip, that a press as the ring closes is Perfect, that a touch launch fires no Pulse, and the gap to the best on the end card. `qa/lab/tilt.rallies.e2e.mjs` checks real Z/X and touch input, the shot/readout cues, smash and reentry, pause/map/field freezes and reduced motion on desktop, portrait and landscape. The transit browser test follows the visible flipper cues to reach a gate through ordinary play.

`qa/lab/tilt.e2e.mjs` contains browser checks for the public controls. `qa/lab/tilt.motion.e2e.mjs` uses a virtual phone sensor to check permission, calibration, rotation, pause, denied access and missing hardware through the public UI. Use the existing `qa/lab/lib.mjs` server configuration to run them. Physical phone tests remain useful for the native permission prompt, sensor feel, touch latency and sustained frame rate.

`qa/lab/tilt.field.sim.mjs` checks earned charges, physical pull/push flight, the five-second lifetime and cleanup. `qa/lab/tilt.field.e2e.mjs` checks placement through the public touch and keyboard controls. Field rings and direction marks are drawn from the same radius as the force, so they remain exact at every camera scale.

`qa/lab/tilt.transit.sim.mjs` checks travel timing, isolated visibility, camera transforms and arrival/skip state. `qa/lab/tilt.transit.e2e.mjs` reaches the first gate through the public launch, Pulse and flipper controls. It checks the full mobile jump, pause, hidden-tab handling, landscape skip, restored controls and reduced motion.


## Design reference

Gabriel O'Flaherty-Chan's perspective article informed Warp Surf's camera-relative depth projection: https://gabrieloc.com/2026/09/15/perspective.html. The ring renderer and collision check share the same coordinates and radius; clipping the near plane keeps projection finite. `qa/lab/tilt.warp.sim.mjs` checks deterministic crossings, scoring, rewards and clipping. `qa/lab/tilt.warp.e2e.mjs` checks real drag, touch, WASD, input cleanup, pause, skip, inventory limits and reduced motion across desktop and phone layouts.

Pinball Spire's public game description informed the combination of pinball, exploration and abilities: https://store.steampowered.com/app/2601940/Pinball_Spire/. Full Tilt uses its own space setting, graphics, world and game code.
