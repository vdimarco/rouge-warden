# Design

## An original game, not a replica

The request asked for a one-to-one copy of a Nintendo game and for James McCloud, a character from that series. Neither can ship here. The game uses the genre and the mechanics in the reference screenshot: a team match, a shared score and clock, meteorites that give energy, radar, a systems bar and bombs. Its names, characters, ships, emblems, story, music and art are new. Silas Vane fills the role the user asked for: a veteran ace the team looks up to. He is the founder of Lantern Squadron, flies a better charged shot than anyone else, and repairs the allies who fly near him.

## Simulation apart from rendering

`sim.js` holds the whole match: ships, bolts, bombs, meteorites, orbs, scoring and bots. It has no DOM and no three.js. `step(match, dt)` advances it at a fixed 60 Hz. `takeEvents()` returns what happened (fire, hit, down, orb, wave), and the renderer turns those events into particles, sound, kill cards and radio lines. Node tests run whole matches in about 0.2 seconds each.

Flight is arcade yaw and pitch, not full 6-DOF. Pitch is clamped to about 69 degrees, and bank is drawn from the yaw rate. This keeps the controls readable on a phone, and a ship never flies upside down by accident. The U-turn and barrel roll are timed moves that take over the controls for a moment.

## Bots

Each bot picks a target every 0.6 to 1.4 s, depending on difficulty. The target is the nearest enemy, weighted by how far it is off the nose. During a shower, two bots on each team go after rocks and orbs. Bots lead their shots with a first-order intercept, `leadPoint`. Their aim error drifts as a slow sine, so they miss the way people do. They look ahead 90 and 200 units for the ground, swerve around ruins, and turn back from the storm wall. A bot with an enemy close behind rolls, makes a U-turn or breaks into a hard turn. The chosen difficulty applies to the Corvids only. Lantern wingmen always fly at Ace, and Corvid damage to the player is scaled by 0.6, 0.85 or 1.05.

The player's lasers bend 60% toward the lead point of a ship within 4 degrees of the nose. This aim assist makes touch play fair.

## Touch: drag and tap

The user asked for "tap and drag on mobile". The first version had a steering area on the left and eight buttons on the right, which covered a third of a phone screen. Now the whole screen is the control. A drag anywhere steers from the point where it began, and a ring marks that point. The lasers fire while a finger steers, because lasers have no ammunition and a held fire button added nothing. A touch that lifts within 300 ms and moves under 12 px is a tap. A tap asks the sim for a quick shot: a charged homing shot fired at once at the rival within 110 px of the finger, or at the rival nearest the nose. The sim then holds the next quick shot for the pilot's lock time plus one second, so a tap is never faster than charging by hand on a keyboard, and the pilots keep their differences. A second finger can tap while the first steers. Four buttons remain: roll (toward the side the finger steers), U-turn, bomb and boost. Brake has no touch control. The drag area sits under the HUD in the page, so the pause button stays on top of it.

## Terrain, snow and light

The ground is one heightfield from `groundY()`, shared by collisions and the mesh. It is a five-octave value-noise fBm, with the upper octaves folded into ridges. A rim term past 82% of the arena radius raises a ring of peaks, so the arena reads as a bowl. Vertex colours pick snow or rock by slope, with a little noise at the boundary and a blue ice tint on low flats. Exponential fog and a gradient sky dome that matches the fog colour at the horizon hide the far edge.

Sources adapted:
- Inigo Quilez, "fBm" (iquilezles.org/articles/fbm) and the three.js `webgl_geometry_terrain` example for the noise heightfield.
- GPU Gems 3, chapter 1, "Generating Complex Procedural Terrains Using the GPU", for choosing rock or snow by the surface normal (done per vertex here, not per pixel).
- The three.js `webgl_points_sprites` example for the snowfall: one Points cloud that wraps around the camera and drifts with the wind.

Particles (exhaust, sparks, explosions, kicked-up snow) share one additive `Points` buffer of 2,400 soft discs with one draw call. Lasers are two `InstancedMesh` batches of stretched boxes with additive blending. No source was needed for these. They are the standard three.js instancing and additive-blend patterns.

## Graphics: generated models and the High look

The user asked for the graphics to be raised "using Meshy or whatever is needed". `look.js` holds that work, and `game.js` keeps the scene and the match view.

Models. The two ships, the monolith, the broken gate, the beacon tower and the meteorite are generated meshes. Each started as an original GPT Image 2.6 product render on grey. The ships went through Meshy 7 image-to-3D with PBR maps and symmetry on. The props went through Tripo H3.1. `higgsfield/models3d/pack-ship.mjs` centres, scales and turns each one to face -z, simplifies it, converts the textures to WebP and meshopt-compresses it. The six files total 2.9 MB. Job ids and pack commands are in `public/frostwing/models/sources.json`. Tripo returned the gate as two pillars with no lintel, so the sim now treats a gate as two pillar cylinders 70 units apart, and ships can fly through the gap. If the models fail to load in 15 seconds, the game falls back to the first version's ships built from primitives.

High and Fast. High is the default on a computer. It adds sun shadows, bloom, point-light flashes on explosions, the PBR snow shader and sky reflections on the models. Fast is the default on touch screens. It uses a Lambert ground, Lambert twins of the model materials, two cloud octaves and no post-processing. The pilot screen has a Graphics High / Fast setting. When the player has not chosen and High holds under 22 frames per second for 4 seconds, the game drops to Fast and says so.

Sources adapted:
- Image-based light: three.js `PMREMGenerator`, baked from the game's own sky shader each time the weather changes. The split-sum approach behind it is Brian Karis, "Real Shading in Unreal Engine 4" (SIGGRAPH 2013).
- Bloom: three.js `UnrealBloomPass`, a mip-chain blur after Unreal Engine's bloom, with `OutputPass` for tone mapping. The threshold is above lit snow, so only lasers, engines, glints, lamps and explosions bloom.
- Shadows: three.js `PCFSoftShadowMap` on one directional light whose 360-unit box follows the player. Ships that are far away fall outside the box and get no shadow.
- Snow: wind ripples as a world-space normal perturbation and sparse glints that flash when a grain's facet faces the half vector, after John Edwards, "Sand Rendering in Journey" (GDC 2013).
- Clouds: fBm on the sky dome projected to a plane, after Inigo Quilez's fBm and cloud articles. Stars are a hashed grid. No source fit the aurora; it is one fBm curtain between two heights.
- Engine trails: camera-facing ribbons sampled at 45 Hz that taper and fade, the same idea as Unity's `TrailRenderer`. They fade in fog and near the lens.
- Model pipeline: this repository's `higgsfield/models3d` steps (gltf-transform and meshoptimizer), first written for Shore of the Ancients.

Weather. `WEATHER` in `look.js` holds four presets: day, dusk, night with stars and an aurora, and storm with thick fog and heavy snow. Each sets the sky, fog, sun, ambient light, exposure, snowfall and where the gas giant Varrow sits. The story picks one per operation.

How it is checked. `qa/frostwing/smoke.e2e.mjs` starts High, confirms the models load, runs a match through every weather and expects no page errors. The gameplay checks run on Fast, because software WebGL draws High at about 2 frames per second. They wait on game time, not wall time. Frame rate on a real GPU and on a phone has not been measured.

## Story and world

The user asked for cut scenes and story "to do some worldbuilding". The world is Frostwing's own. Hollowmere is a frozen moon of the gas giant Varrow, settled by a refugee fleet three generations ago. Twice a year the Fall brings meteorites that hold amberlight, the crystal that powers each town's lantern towers. Lantern Squadron are volunteers who harvest the Fall. Ostrander Deepcore, a mining combine, claims the whole Fall and hires the Corvid Pack to enforce it. The Quiet Makers left the monoliths and gates that wake during the Fall. Silas Vane founded the squadron, closed Karrow Gate twenty years ago at the cost of two wings, and retired. Vex Morrow, his best cadet, now leads the Pack and wants the gates open.

`story.js` is data only: the prologue, five operations and the logbook. Each operation names its place, sky, clock, shower interval, rosters, rival level and optional boss, plus a briefing, two opening radio lines, a debrief and a line for a loss. `sim.js` takes those as `createMatch` options (`lantern`, `corvid`, `time`, `waveEvery`, `boss`). Operation 1 is three on three, because Silas has not returned and Vex has not shown himself. Rivals fly at Cadet for operations 1 and 2 and at Ace after that. In operation 5 Vex flies the Nightjar. With bots flying every ship, Lantern wins between 4 and 8 of 10 matches per operation, so a player who flies better than an Ace bot wins.

A cut scene is DOM over the page, not 3D. Each slide is a generated 16:9 still with a slow CSS pan (the Ken Burns move), a caption that types at about 65 characters a second, and for dialogue the speaker's portrait, name and call sign. Enter, the right arrow, a click or a tap finishes the line and then advances. Esc or SKIP ends the scene. A soft four-voice pad plays under it. The 3D scene does not draw behind a cut scene. With reduced motion the stills hold still and captions show at once. A hidden live region holds each full caption for screen readers.

The save adds `story` (operations won in this run), `log` (the most ever won, which opens logbook entries), `storyDone` and `sky`. A win is saved when the match ends, before the debrief. A finished story starts again from operation 1 and keeps the logbook open.

`qa/frostwing/story.test.mjs` checks that every still and portrait exists, every speaker is a pilot, every radio line comes from a pilot in that match, each caption has at most 240 characters, and the story text uses none of the Nintendo series' names.

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
