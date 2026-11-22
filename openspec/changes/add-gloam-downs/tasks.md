# Tasks

## Bake

- [x] Pin Ink Studio in `games/gloam-downs/package.json` and copy its WebGL renderer into `public/lab/gloam-downs/ink/` (`vendor.mjs`)
- [x] Shared kit in `games/gloam-downs/lib/`: palette with shared fire, wisp, cloak, iron and lamp colours; rolling hills; terrain rings; walk map; lamplighter with bones; props
- [x] Bake script with `--check`, `--preview` and `GLOAM_COUNT`, and the spec's budget and darkness rules in `lib/check.mjs`
- [x] Lamp light falls off as a warm ramp, on a material and on its `top`
- [x] The Gaol
- [x] The Crow Wall (`ramparts`)
- [x] The Fen
- [x] The Bells
- [x] The Barrows
- [x] A polish pass on each place
- [x] Bake all five places with the final kit, every rule `ok`, and commit the baked files (b6fd31f5)

## Page

- [x] Explorer page `public/lab/gloam-downs/`: loading bar, help, map, end card, toasts
- [x] Controller: walk, run, jump with coyote time and a jump buffer, step-up, slopes, walls, ledges, falls; camera that pulls in near walls
- [x] Walk map and controller fixes: the gap's underside layer, cracks closed and traps filled in the bake, the corners of one roof agree, a jump stops under a roof it rises into, and a running jump up a steep slope still lifts the feet 0.4
- [x] The blade in the lamplighter's right hand, on the arm's bone, visible from the follow camera at rest and in a cut ("I dont see my weapon"); the five places baked again
- [x] Tight spaces ("it zooms in too much" in the Gaol's torn cell): the eye uses a room's height, the aim comes down under a roof, the follow zoom, the near fade that keeps the blade, and no distance under 0.5 m; checked in `gloam-downs-camera.test.mjs` and screenshots
- [x] Review of the tight-space fix: the framed shot (the picture turns to the nearest clear yaw in a nook, the mouse's yaw untouched), the near fade leaves out all of the figure but the blade and the lantern from 0.9 m, no rise that hides the head, the dip only where it reaches the full distance, the blade held level with a thin edge near its tip and over the floor in every pose; checked in `gloam-downs-camera.test.mjs`, `gloam-downs-mouse.test.mjs`, `gloam-downs.test.mjs` and screenshots
- [x] Recheck of the framed shot: the picture stood still while the mouse turned in a nook and moves went sideways on screen; the shot is now a lean of the view itself (one yaw for the picture, the moves and the bearings), at most 60° and 15% of a player's turn, and a wall holds back at most 15% of a turn; checked in `gloam-downs-mouse.test.mjs` (28 spots, both sizes, mouse and stick), `gloam-downs-camera.test.mjs` and `gloam-downs-mouse.e2e.mjs` (forward goes up the screen at 8 mouse yaws in the torn cell)
- [x] Review of 1974d668: the framed shot's lean goes with the player's turns, and with the view still only as the calm camera allows (never with the mouse taken or reduced motion, never against a run camera, 0.5 rad/s, a held move keeps its way); the near fade leaves out the lantern and the blade too from 1.6 m; `c.off` follows a wall hold; checked in `gloam-downs-camera.test.mjs`, `gloam-downs-mouse.test.mjs`, `gloam-downs.test.mjs` and `gloam-downs-mouse.e2e.mjs`
- [x] Review of 19b99dd8 (the eye came to 1 m in the torn cell and the near fade hid the figure): the cutaway keeps the player's yaw, stands 3.2 m back, raises the pitch over the roof where that clears it, and leaves out the splats between (`cut.js`), eased in 0.15 s and out 0.25 s; checked in `gloam-downs-camera.test.mjs` (28 spots, both sizes, splat-level sight), `gloam-downs-mouse.test.mjs` and `gloam-downs-cutaway.e2e.mjs` (8 mouse yaws in the cell, both sizes, screenshots)
- [x] Review of 8afff94f (a slow pan in from the mouth came in to 0.8 m blind before the cutaway came on and popped out; the mouse's pitch did nothing in the cutaway; it could come back on within 0.25 s; the checks counted a faded figure as seen; a view at 1.28 rad at the Gaol's wisp): the cutaway comes on from the follow eye's goal and never comes nearer, the mouse's pitch moves it at once, a 0.4 s hold before it comes back, its pitch capped at 1.15 rad; checked in `gloam-downs-camera.test.mjs` (slow pans, the mouse's pitch, walking and the mouse together, the sweep with the fade counted) and `gloam-downs-cutaway.e2e.mjs` (every step of each turn, pictures halfway and at the nearest step of a slow pan, the mouse's pitch)
- [x] Stairs ("I got stuck between the stairs"): the bake lists each flight in the place's JSON (`stairs`), and `qa/lab/gloam-downs-stairs.test.mjs` walks every flight in the explorer and the run; no stop is stuck on the walk maps of round 7
- [ ] A cutaway of the near scenery in a nook under 2 m deep, which needs a change to the pinned Ink Studio renderer
- [x] Keyboard, mouse, touch stick and look, jump button, gamepad
- [x] Wisps, the beacon, unlocks, the next place, the end card when all five beacons burn, and Walk again
- [x] Saved progress, and a bad save is cleaned
- [x] Art size that adapts to the frame time, `?q=low|mid|high`, and a manual `?test` mode for software WebGL
- [x] A message when WebGL 2 or DecompressionStream is missing, and Try again when a place does not load

## Arcade

- [x] Cabinet at the end of the Lab row, marquee rules at 320 and in short windows
- [x] Switcher entry with `labOnly: true`, Lab page card, All Games dates
- [x] Corridor cabinet 46, counts and light slots for 47 cabinets
- [x] `qa/arcade/machines.mjs` and `qa/lab/riftwalk.e2e.mjs` counts
- [ ] Cabinet and Corridor art from the final bake (`node games/gloam-downs/art.mjs`)

## Checks

- [ ] Node tests: `node qa/lab/gloam-downs.test.mjs`
- [ ] Browser checks: `node qa/lab/gloam-downs.e2e.mjs`
- [ ] `node qa/arcade/machines.mjs` with the site served
- [ ] Homepage screenshots at 390, 320 and 1280 for the pull request
- [ ] `openspec validate add-gloam-downs` (or report that the CLI could not run)
- [ ] Frame rate on a real GPU and on a real phone

## Combat run

### First
- [x] Change the second place's display name to "The Crow Wall": `name` and the first comment in `games/gloam-downs/biomes/ramparts.mjs`, and `NAMES` in `public/lab/gloam-downs/main.js` (20391343)
- [x] Change the name in the baked `ramparts.json` and in `qa/lab/gloam-downs.e2e.mjs` (20391343, b6fd31f5)
- [x] Change "ramparts on the ridges" on the Lab card in `public/lab/index.html`; check that the cabinet and the Corridor caption do not name the place
- [ ] Change the Gaol's subtitle to "A prison cut into the moor, and the keep on the hill" in `games/gloam-downs/biomes/gaol.mjs`, and so the baked `gaol.json`
- [x] After the controller fixes of rounds 4 and 5 merge, do the Bake section's final bake, and commit the baked files (b6fd31f5)
- [x] After the merge, check that design.md says three `Int16` layers: the top, the floor under a gap and the gap's underside
- [x] `games/gloam-downs/lib/zones.mjs`: each zone's centre, leash, foe types, guard flag and keeper name, the one home of the zone table
- [x] Port `check-zones.mjs` and `walls2.mjs` from the scratch folder into `qa/lab/gloam-downs-zones.mjs`, which imports `lib/zones.mjs`
- [x] Each place's route (`ROUTES` in `lib/zones.mjs`), ported from the design survey; the zone file walks it as a runner and as a fighter
- [x] The zone file checks the wake rule, the guard rule, the cap of 6, the pool slots, the Ironback walls and the beacon distances
- [x] For the guard rule, it takes the zones within 26 m (10 + 16) of the guard's centre
- [x] The guard rule also takes the zones whose foes chase: the zone file uses the rule of `foes.js` (stage 2)
- [x] Run `qa/lab/gloam-downs-zones.mjs` on the committed walk maps (b6fd31f5), and update the zone table in design.md
- [ ] After the trap pass of the controller fixes merges (`lib/traps.mjs`), bake all five places and commit them. Then run `qa/lab/gloam-downs-zones.mjs`, `qa/lab/gloam-downs-bake-zones.mjs`, `qa/lab/gloam-downs-foes.test.mjs`, the marker fit and the arena camera check again, and update design.md

### Base
- [x] Fixed 1/60 s step in `main.js`, up to 15 steps a frame, with the step count from a pure function in `run.js`
- [x] The step count: n = floor(`acc` × 60 + 10⁻⁶), and `acc` loses n/60
- [x] A press counts on the first step after the frame reads it
- [x] Node check: 1,440 frames of 1/144 s give 600 steps
- [x] Node check: after the frame at k/6 s, the step total is 10k at 30, 60, 120 and 144 Hz
- [x] Move times round to the nearest step; effect times in whole steps
- [x] Two clocks: the game clock counts every step, and the play clock the steps outside hit stop
- [x] Moves run on the play clock, and effects on the game clock
- [x] `run-save.js`: `fresh`, `clean`, `load` and `store` under `gloam-downs.run.v1`, with `run`, `offer` and `ended`
- [x] `run` holds `banked`, `foes` and `bossDown`, and `entry` holds `hp`, `flasks`, `carried` and `foes` with no wicks; `ended` holds `won`
- [x] Node tests of `run-save.js` with bad data, and with an old explorer page that stores its own save
- [x] When `localStorage` throws, the run keeps its save in the page, and no store throws
- [x] Store the run at once on each hit taken, each drink and each wick chosen
- [x] The Lamp-room stores the run at once after each buy (`storeRun()`; stage 2)
- [x] Store the run at once on each lit beacon and at 0 health
- [x] Store the run at once at the boss's fall, with `bossDown` (stage 3)
- [x] Store the run every 120 steps otherwise, when the tab is hidden and on pagehide
- [x] A wick or a buy raises the entry health, flasks and maximums by what it gives
- [x] Node tests for a reload just after a hit and in the death fade
- [x] Node tests for a reload after Spare oil (3 of 3 flasks) and after a Mantle bought at a beacon (75 of 115)
- [x] `run.js` with no DOM: run states, health, flasks, glim carried and banked, foes put out, death and `ended`, and the entry snapshot
- [x] A reload that restarts the place with its wisps back, the glim carried and the foes count from `entry`, and the wicks kept
- [x] The foes come back on each place load: `go()` builds them with the place (stage 2)
- [x] `?seed=N`; the seed draws the wicks from their own stream, and the foes' choices from another
- [x] `?fresh` starts with a fresh run save and a fresh explorer save
- [x] `?test` API: `tick` takes attack, roll, heal and look, and keeps `'live'`; `?nodraw` skips the draw in `go()`
- [x] `tick(s, 'live')` reads the pad on every step in every mode, cards and the loading screen too; a card that opens reads `navigator.getGamepads()`
- [x] `__gloam.run()` with the spec's fields, among them `step`, `playStep`, `stop` and `fx.grade`
- [x] `fx.kick` as the camera's offset in metres, [x, y, z], and `fx.zoom` as a factor, 1 for no zoom
- [x] `?test` hooks that need no foe: `fx`, `set` and `go(id)` in a run
- [x] More `?test` hooks: `post`, `posts`, `hurt`, `project`, `setTargets`; `set({ wicks })`; and `move`, `t`, `safe`, `combo`, `entry`, `ended` and `fx.blink` in `run()`
- [x] The `sounds()` log of cues with their game and play steps
- [x] `__gloam.light()` in a run acts as a touch on the beacon
- [x] `lib/check.mjs` counts a place's JSON in its 1.5 MB

### Inputs
- [x] Press edges with a 0.15 s buffer for attack, roll and heal; a latch for a mouse press
- [x] Keys: J or Z, K or X, L or C; R faces the nearest awake foe or the boss within 10 m; M, P or Escape pause
- [x] Mouse: left press attacks at once, hold goes on until 6 px of movement, drag with either button looks (replaced by mouse look below)
- [x] Gamepad: X or RT attack, B or LT roll, Y heal, RB face the foe or the boss within 10 m, Start or Back pause
- [x] One press across all pads; in Wander, X walks, and RT, B, LT and Y do nothing
- [x] Focus in cards: the d-pad, the left stick and Tab move the focus only between the card's buttons, and wrap
- [x] A, Space and Enter press the focused button
- [x] The main button of each card takes the focus when the card opens
- [x] A key or a pad button that presses a card's button does nothing in play until it is released
- [x] The page reads the pad on the loading screen, and Try again takes the focus
- [x] Back in cards in a run: B and Escape go back where a card has a back action (Resume and No built; `cards.show({ back })`)
- [x] Back to the beacon (stage 2's Lamp-room) passes its back action to `cards.show`
- [x] Step back (stage 3's boss loading screen) passes its back action to `cards.show`
- [x] While End the run asks again, Escape and B choose No; M, P, Start and the pad's Back do nothing
- [x] In a run, Start and Back close only the pause panel
- [x] Wander's cards: Escape, B and Start close the help, the Map and the end card; M and Start open the Map
- [x] Wander's cards follow the focus rules: the d-pad, the left stick and Tab move the focus, and A, Space and Enter press
- [x] Wander's Map opens with the focus on the current place, and a pad alone moves the focus in it
- [ ] A pad alone reaches the Lamp-room button in Wander's Map (stage 3, with Wander; the Lamp-room's Back to Wander is built)
- [x] Before the wick is chosen, only a wick button closes the beacon card
- [x] The help card and the pause panel show the controls for the input in use: keys and mouse, touch, or the pad
- [x] A pad that first shows up on the help card changes the card to the pad's controls, and that press presses nothing
- [x] Touch: Attack, Roll and Heal buttons beside Jump, at the sizes in design.md, small sizes at 660 px tall or less; the Heal flask count
- [x] The Map tool opens the pause panel, on a tap and on a mouse click
- [x] The Look tool faces the nearest awake foe or the boss within 10 m, on a tap and on a mouse click
- [x] A press on a tool does not swing, and does not start the stick or the look drag
- [x] In a run, the Map tool reads Pause, and the touch help says "Pause stops the run"
- [x] In a run, a press outside a card's box does nothing, but on the pause panel it resumes; Escape, B and Start do nothing on the run's help card

### The lamplighter's moves
- [x] The blade string: timings, damage, reach, arcs, the hold, and the early start after a finisher
- [x] The lunge through the per-body `PARAMS` copy, and the stop 0.25 m short of the target's edge
- [x] Soft aim with the sight test from 1.2 m to 0.9 m, the score, the 0.75 margin and the 75° turn
- [x] The roll: 0.36 s at 9.0 m/s, the end cut to 4.5 m/s, safe time, cooldown, cancels, the ledge guard
- [x] The plunge, with its own pose: the blade arm down in front and the lantern up behind
- [ ] A blade: a boned piece in `foes.bin.gz`, sculpted in the lamplighter's rest frame, whose bone copies `armR` in `pose()` (the lamplighter's sculpt has none, and the places' files must not change)
- [x] The lamplighter's attacks and the plunge test their hit on each active step until they hit once
- [x] The foes' attacks do the same: `runner.hurt()` gives `'safe'` in a safe time, so a foe tests its later active steps (stage 2)
- [x] The sight test along the line at steps of 0.25 m, with the gap's underside layer
- [x] The flask drink, its stop on a hit or a roll, and the fifth-wisp refill
- [x] Heal at full health keeps the flask, and a toast says that health is full
- [x] Hurt: the scripted push of 1.2 m (3 m from the Ironback's charge), 0.25 s without control, 0.9 s safe, the blink every 4 steps
- [x] Falls below y −25: last firm ground, 10 health lost
- [x] After a fall, 0.9 s safe with the blink; feet below the fall line are never firm ground

### Foes
- [x] The spark pool, ported from `K.play.fx`; glim motes in the lamp colours
- [x] `foes` bake target: the Snuffer first, on 8 bones, with `foes.bin.gz` and `foes.json.gz` (ranges, bones, pivots, pose keyframes)
- [x] Budget rule in `lib/check.mjs`: the foe files at most 200 KB together
- [x] Colour rule in `lib/check.mjs`: in all five palettes, each foe colour snaps under 0.42, or to slots 32 to 39 or 44 to 47
- [x] No foe colour snaps to wisp slot 40; the Mirelight uses wisp slots 38 and 39
- [x] More budget rules: place and pool at most 275,000 splats, and each place's three files plus the foe files at most 1.7 MB
- [x] `pool.js` `makePool()` adds the pool: bone ids after the lamplighter's, each slot at density 0 and out of `boned`
- [x] A slot joins `boned` before its density comes back, and leaves it after its density goes to 0
- [x] `foes.js` with no DOM: bodies, the ledge probe, noticing, leash, going home, tokens, the wind-up rule, the rise
- [x] A foe off its ground that is not home 4 s later sinks and rises at home
- [x] Node test: a Snuffer knocked off B4's terrace is back on its ground within 7 s (on the committed map it climbs back onto the 3.6 m shelf); the sink and rise at home on a made-up 4.5 m terrace
- [x] The four foe figures with their tell bones, marker bones and clips: the Snuffer, the Pitchrook, the Mirelight and the Ironback; and the carried light
- [x] The Snuffer's hook, its hit, sound cue and glim
- [x] `?test` hooks for foes: `wake(zone)`, `spawn(type, x, z, yaw)` in a free slot, and `out(foe | zone)`
- [x] A spawned foe is already risen, with no cracks and no cooldown
- [x] A spawned foe is a zone of its own, with its home at its spawn point and a leash of 4 m
- [x] `hold(foe, move, t)`, which keeps the pose and place with no hit, and `__gloam.foes()` with the spec's fields
- [x] Node tests for each move against the spec's numbers, with a Snuffer held still
- [x] Node test at 30, 60, 120 and 144 Hz: the same string, roll and hook land on the same play step
- [x] In that test, each press comes at a multiple of 1/6 s
- [x] Tell poses from the keyframes; ground markers in fire slots 34 and 35, posed by the page
- [x] Markers on the ground: rings in six slices of 60°, and lanes in pieces of 1.5 m or less
- [x] `pool.marker()` tilts a piece by a shear to a given plane, and lifts it (0.16 m in a run: `MARK_LIFT` in `fight.js`)
- [x] Each piece tilts to the plane fitted to the floor under its rim, or lies on the water's surface (stage 2)
- [x] Markers stand still from 0.3 s before the hit; lane attacks hit only inside the lane; the Ironback's lane 1.6 m wide
- [x] Node test on the real walk maps: 90% of rim points within 0.15 m of the ground (port `rimfit.mjs` and `lanefit.mjs`)
- [x] The hit flash rows (`pool.flash()`)
- [x] The flinch, and the death into bone parts (stage 2)
- [x] `ctx.zone()` in the biomes, which takes the zones from `lib/zones.mjs`, and zones in each `<id>.json`
- [x] The zone test fails when a baked `<id>.json` holds zones that differ from `lib/zones.mjs`
- [x] `bake.mjs --no-zones --worlds <dir>`: `save()` takes the folder, so a test does not write over the committed files
- [x] The Node test bakes the Gaol with and without its zones into `os.tmpdir()`: the same `.bin.gz` and walk files
- [x] In that test, the two JSON files differ only in `zones`
- [x] `qa/lab/gloam-downs-bake-zones.mjs` does the same for all five places, one bake at a time
- [x] Zone waking and sleep: the zone's foes and the awake foes together at most 6
- [x] A zone wakes only with a free pool slot of the right type for each of its foes
- [x] The guard zones that keep each beacon dark; `__gloam.light()` obeys the guard rule
- [x] The toast at a dark beacon names a landmark where its keepers stand; no toast uses a compass word
- [x] A touch on a dark beacon shows a notch for 3 s that points to the guard zone's centre
- [x] Guard zones always wake: other zones give up their slots, the farthest first
- [x] Their foes sink over 0.6 s while the guard zone's ember cracks show
- [x] A test from every point within 10 m of each guard zone: cracks within 1 s, and the rise within 1.6 s (a 2 m grid with the foes' minds; every 1 m point in the zone check)
- [x] Ember cracks from the spark pool, 24 splats a foe, for 0.6 s before the rise
- [x] Foes put out stay out until the run ends or a reload restarts the place
- [x] A foe knocked more than 6 m below its zone, or below y −25, goes out; its glim drops on its last firm ground
- [x] The Pitchrook: bake, lob, ring, the one coal in the air
- [x] The Mirelight: bake, flight over water and pits, pulse, and a fire ring as its tell
- [x] The Ironback: bake, the wall stun, the slam
- [x] The Ironback's charge: it stops dead at a wall, at a drop of more than 0.6 m, or 3 m past the leash
- [x] Zone test: a wall face of 2 m or more within 3 m past the leash of B1 and of W2
- [x] A foe above the view gives a notch at the top edge, under the Lab bar row and clear of the HUD and the tools; notches also keep clear of ◀ Lab and Games
- [x] On a small screen the tells grow, so a metre covers no fewer art pixels than at 1280x720, up to 2 times (`tellGrow` in `fight.js`)
- [x] Off-screen notches at the left, right and bottom edges, clear of the touch buttons, the HUD, the tools, the toast and the boss bar
- [x] Each notch fills from empty to full over the wind-up
- [x] When the foe files do not load, the loading screen says so and shows Try again
- [ ] The loading screen keeps ◀ Lab and Games above it, and shows Wander when the foe files did not load and Wander is open

### Feel
- [x] Every effect counts whole steps of the game clock, which go on during hit stop; moves count the play clock
- [x] Hit stop of 3, 5 and 9 steps, the cap of 9 steps in any 30, and the picture shake
- [x] Hit stop of 6 steps and `feel.shock()` for the boss slam (stage 3)
- [x] The hit flash and the hurt tint, 3 steps (0.05 s) each; a Node test at 30 and 144 Hz
- [x] Camera kick: the square of the shake value times smooth noise; the zoom of 7 steps
- [x] Grade: hurt on slots 1 to 31 only, low health with the heartbeat every 55 steps, and the fade to ink
- [x] The health bar pulses at each heartbeat below 30% health: the HUD sets `.low`, and the fight sets `.beat` for 12 steps after each beat
- [x] Reduced motion: no kick, no zoom, no turn of the camera by itself, the blink every 8 steps, no flash
- [x] With reduced motion, `fx.kick` stays [0, 0, 0] and `fx.zoom` stays 1 on hits and hurts
- [x] The boss intro's zoom of 1.15 goes through `feel`, so with reduced motion `fx.zoom` stays 1 (stage 3)
- [x] Reduced motion also: no shake of a hit foe, the low health tint steady at 15%, and a steady fire edge on the health bar

### Cameras
- [x] The combat camera (spec "Combat camera", cut order 1): 0.9 rad/s after 0.8 s with no look input, while any foe is awake (now 0.6 rad/s after 2 s: see Mouse look and a calm camera)
- [x] The combat camera keeps its foe until another is 1.5 m nearer; Node test with two Snuffers that swap distances
- [x] While a camera turns by itself, a held move keeps its world direction until the input turns by 20° or is let go
- [x] The combat camera's stop at a yaw difference of 20°, seen from the lamplighter; look input wins on the same step; Node tests
- [x] The boss camera (spec "Boss camera", cut order 2) as a module, `makeBossCam` in `cameras.js`, whose turn goes before the combat camera's
- [x] Stage 3 wires the boss camera in `main.js` with the real boss and the arena's centre, and calls its step after `cam.follow`
- [x] It is on within 7.0 m of the arena's centre while the fight has started and the boss is up (Node test with a stand-in boss)
- [x] Outside the arena, to 16 m, stage 3 hands the boss to the combat camera as a target with `range: Infinity` while the fight has started and the boss is up
- [x] The boss camera's own ease reaches its aim and distance in 60 steps
- [x] Its aim on the line to the boss, and its distance at least the layout's follow distance and at least 12 m, up to 24 m
- [x] The boss camera's frame: the smallest distance and an aim that keep the feet's ground, the chests and the boss's head clear of the controls
- [x] The boss camera's pitch eases up to 0.55 when a hill or a wall brings it closer
- [x] The boss camera's turn: 1.5 rad/s after 0.6 s, and the stop at 15°
- [x] The follow camera's framing for each window (`camLayout` in `play.js`): 48° and 8.5 m in landscape, ±4.6 m of view at the lamplighter in a tall window (15.33 m), the horizon under the HUD, and the rise over hills and walls before it comes closer
- [x] The combat camera's range: the nearest awake foe within 10 m that is not home, walking home or sinking
- [x] The ease back over 1 s when the lamplighter is more than 7.0 m from the arena's centre
- [x] Node tests of the boss camera at the five layouts, with the boss 2 to 13 m away on flat ground
- [x] Those tests use the spec's HUD and tools rects
- [x] Node test of the boss camera at 481 pairs of points in the real arena (95%)

### Mouse look and a calm camera (after play on the preview)
- [x] A click on the view takes the mouse (Pointer Lock API, raw movement where offered); that click does nothing else
- [x] Taken: a move with no button turns the view at 0.0022 and 0.0018 rad per px, one event at most 120 px, the pitch in 0.08 to 1.05
- [x] Taken: in a run the left button attacks and holds the string, the right button rolls; in the explorer the left button jumps
- [x] Escape or the browser frees the mouse; in play in a run that opens the pause panel, and the same Escape does not close it
- [x] Every card frees the mouse; a button that goes back to play takes it again when its press is a gesture
- [x] Chrome's limit on requests: no second ask with the raw option, and a refusal waits 1.5 s (5 s after a second one in a row)
- [x] The fallback without pointer lock: the right drag turns the view, the left button attacks or jumps
- [x] The hint "Click to look with the mouse", the help card and the pause panel's controls say how the mouse works
- [x] No turn by itself while the mouse is taken; after 2 s and slower on touch, keys and pads; never with a move held across the view
- [x] The pull-in near walls eases both ways with a damped spring, and starts early where the view turns toward a wall
- [x] Node test `qa/lab/gloam-downs-mouse.test.mjs` and e2e `qa/lab/gloam-downs-mouse.e2e.mjs`; the old left-drag steps in the input e2e
- [ ] Try the mouse look on a real desktop browser with a real mouse (Chrome, Firefox, Safari), and tune the speed by feel
- [x] Review: a refusal of the lock is a wait, not the fallback: a click in the wait asks again and never swings, the hint says "Click again to look with the mouse", and the page asks again by itself after a first refusal (e2e step with a `requestPointerLock` that rejects once)
- [x] Review: the pull-in has speed limits (15 m/s past something between, 33 m/s to keep the eye out of a wall, 12 m/s out, 360 m/s²), an early start for the line of sight as the player turns, and a turn held back for a step where the eye would go into a wall; the eye check uses the room from before the grace rule
- [x] Review: the line-of-sight look-ahead starts the camera in at 15 m/s, not 33 m/s; only the eye's look-ahead (its whole path for 0.3 s) allows 33 m/s, and the turn is held back where the eye would pass through a wall; the place sweep checks 15 m/s with the eye clear and 360 m/s²
- [x] Review: the 33 m/s limit follows the eye itself (its present distance, its path round for 0.3 s), a nearer goal's crossing only brings the goal in at 15 m/s, and the rise waits where easing down would lower the eye into the scenery; the place sweep runs both ways and reads "eye clear" from the walk map, not from `c.squeeze`
- [x] Review: Node checks for walls 0.5 and 1 m thick at 1 and 2 m at 1.2, 3 and 6 rad/s, a walk past a pillar, a mouse sweep at each spawn and wisp of the five places, and the boss camera with the mouse taken or a move across held

### The run's screens
- [x] HUD: health bar, flask pips, glim; the toast 8 px under the HUD's measured bottom at every width
- [x] At 520 px wide or less, the health line is one row, with a 12 px number, a 56 × 8 px bar and 6 px pips
- [x] `#hud.boss` hides the hint, and `gloam-downs-run.cards.e2e.mjs` checks that the widest HUD and the tools fit the spec's rects at the five layouts
- [x] Stage 3 sets `#hud.boss` in the boss fight; `gloam-downs-run.boss.e2e.mjs` (`ONLY=layout`) checks it in the real fight at the five layouts until the layout e2e is built
- [x] The boss bar in the Lab bar row in every layout: at most 360 px on touch and 520 px with a fine pointer (boss e2e: 214, 144, 184 and 360 px on touch at 390, 320, 360 and 800 wide; 520 × 44 at 1280×720)
- [x] The overlap check with the widest HUD: 165/165, 5 of 5 flasks, 5/5 wisps and 254 glim
- [x] The overlap check also has the longest toast in the run's data (86 characters) and a toast of 96 characters
- [x] The overlap check also has a boss bar (stage 3; in the boss e2e, with the widest HUD and a toast of 96 characters)
- [x] No card button under ◀ Lab or Games: in a run the cards clear the Lab bar row
- [x] No card button under the boss bar, and the boss bar hides while a card shows (stage 3; the pause panel in the fight at the five layouts, in the boss e2e)
- [x] The help card with the run's controls, the text about keepers and banking, and Begin the run
- [x] The beacon card: the wick choice, Spend glim, Walk on
- [x] The wick offer stored with the run, and a reload at the beacon card that shows the same two wicks
- [x] The six wicks, drawn from the wicks not yet chosen; each button shows the wick's name and its text
- [x] Node tests of Long wick, Quick heels, Close shave and Heavy fall against the spec's numbers
- [x] The Lamp-room: bank, the five upgrades, Buy, Begin the run
- [ ] The Lamp-room's Wander button when Wander is open (stage 3: `wanderOpen()` returns false until then)
- [x] Each upgrade shows what its next level gives, as "Mantle 1 · +15 health · 40 glim"
- [x] Go on with the run in place of Begin the run while a run is in progress
- [x] The Lamp-room from a beacon card: Back to the beacon in place of Begin the run and Wander
- [x] Upgrades bought in a run: Mantle raises the health too, and Flask adds a full flask
- [x] The damage bonuses of Edge, Keen edge and Close shave add, and raise the plunge
- [x] The foe's factor and Heavy fall multiply; damage and heals round once, at the end
- [x] Death, the fade and the run summary, also after a reload in the fade; Ash pocket
- [x] The pause panel: the run's places, time, Resume, the sound switch, End the run
- [x] The pause panel closes on M, P, Escape, Resume, Start, the pad's Back and B
- [x] The pause panel's Back to the start asks again, then restarts the place as a reload does
- [x] Toasts, the arrival card, the fade to ink and the waits before the beacon card and the summary count steps of the game clock
- [ ] Wander: the explorer with no foes and no sound, `?wander`, the open rule, a reload back into Wander, the Lamp-room button in its Map
- [ ] Begin the run and Go on with the run set `wander` to false
- [ ] Wander's Map and end card fit 360×640 and 800×600 with no scroll

### The boss
- [x] `boss.bin.gz` and `boss.json.gz`: the Barrow Reeve on 46 bones, 13 for the body and 33 for the markers
- [x] Budget rule in `lib/check.mjs`: the boss files at most 140 KB together
- [x] The colour rule covers the boss; the cage light uses wisp slots 38 and 39
- [x] The boss's three shard rings and its 12 candles
- [x] Measure the boss files in the first boss task, against the cap of 140 KB; if they are over, cut the boss to 11,000 splats
- [x] Fetch the boss files during The Bell Knoll, or after play starts in Barrow Crown; the arena asleep until they have loaded
- [x] When the boss files are not in at 11 m, pause the game and show the loading screen, with Try again when a file failed
- [x] Step back beside Try again: the lamplighter goes back 13 m or more from the arena's centre, and the arena stays asleep
- [x] Every slot, the boss slot too, starts parked and out of `boned`
- [x] The boss slot wakes at the intro, and the other slots park in the boss fight (stage 3)
- [x] The boss joins the targets of the blade, soft aim, R, Look and RB (`__gloam.setTargets`) while the fight has started and the boss is up
- [x] The intro: the stop, the bars, the zoom, the card ("V · The last light of the downs"), the boss bar; other awake zones sleep
- [x] The phases and the stumble; leaving and coming back
- [x] `set({ bossHp })` puts the boss in the phase of that health, with one hit stop and one stumble
- [x] The attacks: sweep, cage slam, lamp-shards on their three rings, stalking lunge, double sweep, and the choice by position
- [x] The sweeps' marker: the front three slices of the slam's ring at 4.0 m
- [x] In a sweep's wind-up, the boss turns at 1.5 rad/s at most
- [x] It holds its facing and the sweep's slices from 0.3 s before the hit
- [x] The fall, the light that rides at the lantern, the boss's 30 glim into the glim carried, and the beacon that banks it
- [x] The bars at the fall ease out over 30 steps after the hit stop, and come in again at the last beacon
- [x] `__gloam.light()` obeys the boss's light; the dark beacon's toast names the open ground below the standing stones
- [x] After the fall no zone wakes; the run is stored with `bossDown`, and a reload starts at the arena with the light
- [x] The win stored at once at the last beacon, and a reload on the win card that shows it again
- [x] The win card, and the first win opening Wander
- [x] `qa/lab/gloam-downs-boss.sim.mjs`: a boss bot on Barrow Crown's walk map with the game's moves, runner and boss mind, at skills 0.3, 0.5, 0.7 and 0.9; wins, tries, fight length and hits by attack, written in design.md
- [x] Every boss attack dodged by a bot with no mistake that reads each wind-up 0.25 to 0.55 s after it starts
- [x] The boss camera raises its pitch over the grave stones by the least that keeps its distance (to 1.1), and the arena check of 122 pairs in `gloam-downs-boss.test.mjs`
- [x] Each boss wind-up looked at in its last third at 1280×720 and 390×844, with the boss camera on
- [x] The phone's shard rings: the boss gives the camera four rim points of each ring as marks, and the raise takes the one that sees the most of them; over the arena each whole ring is inside the middle 94% of the width and under no control at 1280×720 and 390×844, and the ground hides 33 and 44 of 2928 rim points (211 and 254 with the centres alone). The boss e2e lets the boss camera settle 1.2 s before each wind-up's picture
- [x] The boss camera stays on through an attack under way out to 16 m from the arena's centre, so the lunge from 7.5 m is framed from 12 m; the boss e2e asserts the boss camera on, 11.9 m or more and no fade at every wind-up, and the fire inside each part of each marker as a share of its drawn area
- [x] The scenery in front of a boss marker fades over 0.25 s (`veil.js` makeOccluders): the yew at (17, −13.5) in front of the west shard ring
- [x] A reload on the win card shows it over the place won, with its beacon lit

### Sound and music
- [x] Copy the six FluidR3_GM instruments (harp, strings, contrabass, flute, choir, timpani) to `public/lab/gloam-downs/audio/`, only the notes the score plays, with the license note in `audio/README.md` and a manifest; 500 KB or less, and a budget check in `gloam-downs-run.test.mjs`
- [x] `/arcade/quiet.js` as the page's first script; no `AudioContext` in the explorer, Wander or a Lamp-room from Wander's Map
- [x] `sound.js`: the graph (effects bus, music bus, duck gain, master high-pass, compressor and limiter), the phone mix, the voice limits, the context on the first key, click or tap in a run
- [x] Lay the cues of a frame at the frame's time plus 1/60 s a step, capped at 0.25 s; add `at` and `v` to the sound log
- [x] Carry `wind`, `act` and the hit id on `swing`, the hang on `plunge`, and the target types on `hit`; stop the whoosh when a roll cancels a wind-up
- [x] The hit recipes in three layers (body with a pitch drop and harmonics, crunch by material, tick or ring), the sub on heavy hits, 4 variants in a shuffle, ±4% pitch and ±1.5 dB, the duck
- [x] The lamplighter's other cues: roll, near miss, plunge, drink and heal, fall, death, heartbeat
- [x] Glim with its rising scale, the wisp and the beacon
- [x] Each tell with its own cue from the first step of its wind-up: rename the Ironback's charge tell to `paw`; distance, pan and the −10 dB floor for tells
- [x] The foes' other cues (coal, pulse, charge, slam, clang, cracks, rise, out) and the boss's (reeve, bossBar, sweep, slam, shards, shard, lunge, stumble, fall, light)
- [x] The cards' ticks, choice, buy and refused buy; the pause panel stops the effects
- [x] `music.js`: the lookahead scheduler (25 ms timer, 150 ms ahead plus the latency, late notes dropped, a stall resumed on a bar line), the sampler with fallback voices, the bells, water, wind and drums made in code, the room and the 9 kHz low-pass
- [x] The five place themes and the Lamp-room theme, each with its explore and combat layers; the arrival card's quiet start
- [x] The combat layer's enter on the beat and leave on the bar after 2 s; the guard part
- [x] The boss theme with its intro silence, three phases and the silence after the fall
- [x] The stingers (beacon, death, win), the Lamp-room theme on the cards, low health and pause in the score
- [x] The Sound and Music switches in the pause panel, `rs.music` in the run's save with its check, and the gamepad-alone line
- [x] `__gloam.music()`: the state and the last 32 changes with their bar lines
- [x] `qa/lab/gloam-downs-sound.test.mjs`: the cue table, the shuffle, the bar maths, the scheduler on a fake clock, the long frame, the combat rules, the save
- [x] `qa/lab/gloam-downs-music-demo.mjs`: every cue, variant, theme part, phase, stinger and the scripted fight in both mixes to mp3, and `loudness.json`
- [ ] Listen to every mp3 of the demo, tune the levels and the recipes by ear, and write the measured figures in design.md. Done by measurement only: the levels and the recipes were tuned against the demo's `ebur128` figures, the band energies and the body pitch, and the figures are in design.md "As built". Nobody has listened yet
- [ ] `qa/lab/gloam-downs-run.sound.e2e.mjs`: the first press, the logs, the swing timing, the duck, the switches, the bank's load and failure, low health and pause are done (the bands and the loudness are in the demo). The gamepad-alone line is still open
- [x] A `lab/gloam-downs` entry in `PAGES` of `qa/arcade/quiet.mjs`, with `music: true`, and its run (32 of 35 checks pass; the three that fail are the sound coming back after a show, which this loaded machine takes longer than 8 s to do; see design.md "Not checked")
- [x] The Gloam Downs line in `AGENTS.md`: the sound test, e2e and demo commands
- [x] Report that no speakers, headphones or phone played the sound, if none could

### Checks
- [ ] `qa/lab/gloam-downs-run.test.mjs`: moves, rules, saves and screens (built), names with the places, budget and download sizes
- [x] `qa/lab/gloam-downs-foes-ai.test.mjs`: the foes' moves, tokens, leash, zones, guards, glim, markers and feel
- [x] `qa/lab/gloam-downs-camera.test.mjs`: the follow camera's framing at 14 windows and on the five routes, the combat camera and the boss camera
- [ ] `qa/lab/gloam-downs-names.json` with the Dead Cells place and boss names that the spec lists
- [ ] The sort bench in all five places (1.45)
- [x] The foe step bench (0.5 ms), in `gloam-downs-foes-ai.test.mjs`
- [ ] `qa/lab/gloam-downs-bot.mjs` on the real walk maps: each bot plays until its first win, or 12 runs
- [ ] The bot spreads its bots over the cores with `worker_threads`
- [ ] Time 10 bots at skill 0.5 on the final walk maps, and write the result in design.md
- [ ] Run 60 bots at each skill in less than 10 minutes; tune against the pacing targets, and write the results and the time in design.md
- [x] `qa/lab/gloam-downs-run.input.e2e.mjs`, stage 1: keys, mouse, touch and a mocked gamepad on the run's first cards and in play, both tools, the focus
- [ ] `qa/lab/gloam-downs-run.input.e2e.mjs`: every control and both tools, the cards with keys and with a mocked gamepad, the focus, Wander's cards and the sound log
- [x] `qa/lab/gloam-downs-run.lineup.e2e.mjs`: the pool parked, one of each figure in view at 1280x720 and 390x844, and foe files that do not load
- [x] `qa/lab/gloam-downs-run.fight.e2e.mjs`: a fight in each place but Barrow Crown, the tells, rings and lanes in fire, the guard rule with its toast and notch, and a phone's tell, notch and slam ring
- [x] `qa/lab/gloam-downs-run.cards.e2e.mjs`: every card of stage 2 at the five layouts with the widest HUD, a full loop with keys, a beacon card with a gamepad alone, and a reload in the death fade
- [x] `qa/lab/gloam-downs-camera.e2e.mjs`: each layout in each place, the combat camera on a phone, the lineup in view on phones, and the frame ratio against stage 1's framing
- [x] `qa/lab/gloam-downs-foes.test.mjs`: the figures, the clips, the pool, the zones, the colours, the budgets and the bake of the Gaol with and without its zones
- [ ] `qa/lab/gloam-downs-run.screens.e2e.mjs`: every state, the boss files after a reload, and files that fail
- [ ] The screens e2e: reloads in the death fade, at the beacon card, after the boss's fall and on the win card
- [ ] `qa/lab/gloam-downs-run.layout.e2e.mjs`: the five layouts with the overlap check, the toast, the cards that fit and screenshots
- [ ] `qa/lab/gloam-downs-run.look.e2e.mjs`: the look in a fight in all five places, with the foes and markers that the spec lists
- [x] Each new e2e file launches Chromium from `/opt/pw-browsers/chromium` when that path exists, as `gloam-downs.e2e.mjs` does
- [ ] The look-in-a-fight check counts only changed pixels brighter than the 0.42 floor or the place's brightest 1%
- [ ] The look checks measure "within 12" on each of R, G and B
- [ ] No pixel that the foes add is within 12 of wisp slot 40
- [ ] The look e2e: the tell and marker counts in fire slots 34 to 37, the notches, low health and reduced motion
- [ ] `qa/lab/gloam-downs-run.perf.e2e.mjs`: the frame ratio in The Bell Knoll against Wander (1.30)
- [ ] Time each e2e file, aim for about 6 minutes each, and list the five files in `AGENTS.md`
- [ ] `qa/lab/gloam-downs.e2e.mjs` through `?wander`
- [ ] Add the explorer checks that its spec names and its tests lack
- [x] One of them: E held for 1 s turns the yaw by 2.6 rad, ±0.1
- [ ] `NODE_PATH=/opt/node22/lib/node_modules node qa/arcade/quiet.mjs --only=lab/gloam-downs` with the site served
- [ ] `node qa/arcade/machines.mjs` with the site served

### Text and art
- [ ] The switcher subtitle, the cabinet's aria label, the Lab card, the Corridor caption and the page's meta description say it is a combat run
- [ ] Decide the marquee subtitle (today "LIGHT THE BEACONS") and the alt text of the screen art
- [ ] Then check the marquee at 390, 320 and 1280, with the subtitle hidden at 360x640 and 800x600; run `node qa/arcade/machines.mjs`, and replace the pull request screenshots
- [ ] Cabinet and Corridor art with a foe in view, from the final bake
- [ ] Retune the figures' glows, so that the look in a fight reaches 95% (and a flash 90%) at stage 2's framing in every view of `gloam-downs-run.lineup.e2e.mjs`, and raise its measured floors (`SHORT`) to match
- [ ] `games/gloam-downs/README.md` and the Gloam Downs line in `AGENTS.md`: the foe bake, the bot and the new checks

### Close
- [ ] Specs and design.md match the build, with the tuned numbers
- [ ] `openspec validate add-gloam-downs --strict`
- [ ] `openspec archive add-gloam-downs`, then review `openspec/specs/gloam-downs/spec.md` and `openspec/specs/gloam-downs-run/spec.md` against the build
- [ ] Frame time on a real phone at 46k art pixels with 6 foes awake (or report that it could not run)
- [ ] Frame time on a real GPU (or report that it could not run)
