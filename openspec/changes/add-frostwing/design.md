# Design

## An original game, not a replica

The request asked for a one-to-one copy of a Nintendo game and for James McCloud, a character from that series. Neither can ship here. The game uses the genre and the mechanics in the reference screenshot: a team match, a shared score and clock, meteorites that give energy, radar, a systems bar and bombs. Its names, characters, ships, emblems, story, music and art are new. Silas Vane fills the role the user asked for: a veteran ace the team looks up to. He is the founder of Lantern Squadron, flies a better charged shot than anyone else, and repairs the allies who fly near him.

## Simulation apart from rendering

`sim.js` holds the whole match: ships, bolts, bombs, meteorites, orbs, scoring and bots. It has no DOM and no three.js. `step(match, dt)` advances it at a fixed 60 Hz. `takeEvents()` returns what happened (fire, hit, down, orb, wave), and the renderer turns those events into particles, sound, kill cards and radio lines. Node tests run whole matches in about 0.2 seconds each.

Flight is arcade yaw and pitch, not full 6-DOF. Pitch is clamped to about 69 degrees, and bank is drawn from the yaw rate. This keeps the controls readable on a phone, and a ship never flies upside down by accident. The U-turn and barrel roll are timed moves that take over the controls for a moment.

## Bots

Each bot picks a target every 0.6 to 1.4 s, depending on difficulty. The target is the nearest enemy, weighted by how far it is off the nose. During a shower, two bots on each team go after rocks and orbs. Bots lead their shots with a first-order intercept, `leadPoint`. Their aim error drifts as a slow sine, so they miss the way people do. They look ahead 90 and 200 units for the ground, swerve around ruins, and turn back from the storm wall. A bot with an enemy close behind rolls, makes a U-turn or breaks into a hard turn. The chosen difficulty applies to the Corvids only. Lantern wingmen always fly at Ace, and Corvid damage to the player is scaled by 0.6, 0.85 or 1.05.

The player's lasers bend 60% toward the lead point of a ship within 4 degrees of the nose. This aim assist makes touch play fair.

## Terrain, snow and light

The ground is one heightfield from `groundY()`, shared by collisions and the mesh. It is a five-octave value-noise fBm, with the upper octaves folded into ridges. A rim term past 82% of the arena radius raises a ring of peaks, so the arena reads as a bowl. Vertex colours pick snow or rock by slope, with a little noise at the boundary and a blue ice tint on low flats. Exponential fog and a gradient sky dome that matches the fog colour at the horizon hide the far edge.

Sources adapted:
- Inigo Quilez, "fBm" (iquilezles.org/articles/fbm) and the three.js `webgl_geometry_terrain` example for the noise heightfield.
- GPU Gems 3, chapter 1, "Generating Complex Procedural Terrains Using the GPU", for choosing rock or snow by the surface normal (done per vertex here, not per pixel).
- The three.js `webgl_points_sprites` example for the snowfall: one Points cloud that wraps around the camera and drifts with the wind.

Particles (exhaust, sparks, explosions, kicked-up snow) share one additive `Points` buffer of 2,400 soft discs with one draw call. Lasers are two `InstancedMesh` batches of stretched boxes with additive blending. No source was needed for these. They are the standard three.js instancing and additive-blend patterns.

## Art

Pilot portraits and the key art come from Higgsfield `gpt_image_2_6`, prompted for original designs in a "painted sci-fi arcade illustration, crisp cel-shaded edges" look. Lantern wears cyan and white with an orange lantern emblem. The Corvids wear black and violet with a crow-skull emblem. The ships in the 3D scene are built from primitives to match the key art: Lantern flies a white delta with orange bands and twin cyan engines, and the Corvids fly a dark core inside forward-curving blades. The images are 256 px WebP portraits, a 1280 px title image and a 640 px cabinet screen.

## Sound

Every sound is synthesized: square-wave lasers, filtered-noise explosions, a sawtooth engine that follows speed, and chimes for orbs. The music is a 138 BPM loop in A minor (A F C G A F G E) with a triangle bass, a square arpeggio and noise drums. It gets busier in a shower and in the last minute. The game suspends its own AudioContext on pause, and `quiet.js` handles a hidden page.

## Layout

The HUD is DOM over the canvas. In portrait the scoreboard sits alone on the top line, the systems panel and banner share the second line, and the radar moves to the top right so the buttons can sit at the bottom. On landscape phones the banner moves under the scoreboard and the buttons sit beside the radar. `qa/frostwing/smoke.e2e.mjs` checks that panels stay inside the screen and do not overlap at 1280x720, 390x664, 750x342 and 320x568.

## Save

`frostwing.save.v1` holds `best`, `wins`, `played`, the last pilot and difficulty, the pitch direction and the sound setting. Every read and write is wrapped in try/catch. The arcade home reads `best` and `wins` for the cabinet line.

## Performance

In headless Chromium with SwiftShader (software WebGL) a match draws at about 8 frames per second, which only shows the page works. A real-GPU frame-rate check has not run. The terrain mesh is 210x210 on desktop and 150x150 on touch screens. The pixel ratio is capped at 1.75, or 1.5 on touch screens.
