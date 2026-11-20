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
- [ ] Bake all five places with the final kit, every rule `ok`, and commit the baked files

## Page

- [x] Explorer page `public/lab/gloam-downs/`: loading bar, help, map, end card, toasts
- [x] Controller: walk, run, jump with coyote time and a jump buffer, step-up, slopes, walls, ledges, falls; camera that pulls in near walls
- [x] Walk map and controller fixes: the gap's underside layer, cracks closed and traps filled in the bake, the corners of one roof agree, a jump stops under a roof it rises into, and a running jump up a steep slope still lifts the feet 0.4
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
- [ ] Change the second place's display name to "The Crow Wall": `name` and the first comment in `games/gloam-downs/biomes/ramparts.mjs`, and `NAMES` in `public/lab/gloam-downs/main.js`
- [ ] Change the name in the baked `ramparts.json` and in `qa/lab/gloam-downs.e2e.mjs`
- [ ] Change "ramparts on the ridges" on the Lab card in `public/lab/index.html`; check that the cabinet and the Corridor caption do not name the place
- [ ] Change the Gaol's subtitle to "A prison cut into the moor, and the keep on the hill" in `games/gloam-downs/biomes/gaol.mjs`, and so the baked `gaol.json`
- [ ] After the controller fixes merge, do the Bake section's final bake, and commit the baked files
- [ ] Port `check-zones.mjs` and `walls2.mjs` from the scratch folder into `qa/lab/gloam-downs-zones.mjs`
- [ ] The zone file checks the wake rule, the guard rule, the cap of 6, the pool slots, the Ironback walls and the beacon distances
- [ ] Run `qa/lab/gloam-downs-zones.mjs` on the final walk maps, and update the zone table in design.md

### Base
- [ ] Fixed 1/60 s step in `main.js`, up to 15 steps a frame, with the step count from a pure function in `run.js`
- [ ] Move times round to the nearest step; effect times in whole steps
- [ ] Two clocks: the game clock counts every step, and the play clock the steps outside hit stop
- [ ] Moves run on the play clock, and effects on the game clock
- [ ] `run-save.js`: `fresh`, `clean`, `load` and `store` under `gloam-downs.run.v1`, with `run`, `offer` and `ended`
- [ ] `run` holds `banked`, `foes` and `bossDown`, and `entry` holds `hp`, `flasks`, `carried` and `foes` with no wicks; `ended` holds `won`
- [ ] Node tests of `run-save.js` with bad data, and with an old explorer page that stores its own save
- [ ] Store the run at once on each hit taken, each drink, each wick chosen and each buy
- [ ] Store the run at once on each lit beacon, the boss's fall and at 0 health
- [ ] Store the run every 120 steps otherwise, when the tab is hidden and on pagehide
- [ ] A wick or a buy raises the entry health, flasks and maximums by what it gives
- [ ] Node tests for a reload just after a hit and in the death fade
- [ ] Node tests for a reload after Spare oil (3 of 3 flasks) and after a Mantle bought at a beacon (75 of 115)
- [ ] `run.js` with no DOM: run states, health, flasks, glim carried and banked, foes put out, death and `ended`, and the entry snapshot
- [ ] A reload that restarts the place with its foes and wisps back, the glim carried and the foes count from `entry`, and the wicks kept
- [ ] `?seed=N`; the seed draws the wicks from their own stream, and the foes' choices from another
- [ ] `?fresh` starts with a fresh run save and a fresh explorer save
- [ ] `?test` API: `tick` takes attack, roll, heal and look, and keeps `'live'`; `?nodraw` skips the draw in `go()`
- [ ] `__gloam.run()` with the spec's fields, among them `step`, `playStep`, `stop` and `fx.grade`
- [ ] `?test` hooks that need no foe: `fx`, `set` (with `bossHp`) and `go(id)` in a run
- [ ] The `sounds()` log of cues with their game and play steps
- [ ] `__gloam.light()` in a run acts as a touch on the beacon, so it obeys the guard rule and the boss's light
- [ ] `lib/check.mjs` counts a place's JSON in its 1.5 MB

### Inputs
- [ ] Press edges with a 0.15 s buffer for attack, roll and heal; a latch for a mouse press
- [ ] Keys: J or Z, K or X, L or C; R faces the nearest awake foe within 10 m; M, P or Escape pause
- [ ] Mouse: left press attacks at once, hold goes on until 6 px of movement, drag with either button looks
- [ ] Gamepad: X or RT attack, B or LT roll, Y heal, RB face the foe within 10 m, Start or Back pause
- [ ] One press across all pads; in Wander, X walks, and RT, B, LT and Y do nothing
- [ ] Focus in cards: the d-pad, the left stick and Tab move the focus only between the card's buttons, and wrap
- [ ] A, Space and Enter press the focused button
- [ ] The main button of each card takes the focus when the card opens
- [ ] A key or a pad button that presses a card's button does nothing in play until it is released
- [ ] The page reads the pad on the loading screen, and Try again takes the focus
- [ ] Back in cards in a run: B and Escape go back where a card has a back action
- [ ] In a run, Start and Back close only the pause panel
- [ ] Wander's cards: Escape, B and Start close the help, the Map and the end card; M and Start open the Map
- [ ] Before the wick is chosen, only a wick button closes the beacon card
- [ ] The help card and the pause panel show the controls for the input in use: keys and mouse, touch, or the pad
- [ ] Touch: Attack, Roll and Heal buttons beside Jump, at the sizes in design.md, small sizes at 660 px tall or less; the Heal flask count
- [ ] The Map tool opens the pause panel, on a tap and on a mouse click
- [ ] The Look tool faces the nearest awake foe within 10 m, on a tap and on a mouse click
- [ ] A press on a tool does not swing, and does not start the stick or the look drag

### The lamplighter's moves
- [ ] The blade string: timings, damage, reach, arcs, the hold, and the early start after a finisher
- [ ] The lunge through the per-body `PARAMS` copy, and the stop 0.25 m short of the target's edge
- [ ] Soft aim with the sight test from 1.2 m to 0.9 m, the score, the 0.75 margin and the 75° turn
- [ ] The roll: 0.36 s at 9.0 m/s, the end cut to 4.5 m/s, safe time, cooldown, cancels, the ledge guard
- [ ] The plunge, with its own pose: the blade down in both hands and the lantern up behind
- [ ] Each attack tests its hit on each active step until it hits once
- [ ] The sight test along the line at steps of 0.25 m, with the gap's underside layer
- [ ] The flask drink, its stop on a hit or a roll, and the fifth-wisp refill
- [ ] Hurt: the scripted push of 1.2 m (3 m from the Ironback's charge), 0.25 s without control, 0.9 s safe, the blink every 4 steps
- [ ] Falls below y −25: last firm ground, 10 health lost

### Foes
- [ ] `foes` bake target: the Snuffer first, on 8 bones, with `foes.bin.gz` and `foes.json.gz` (ranges, bones, pivots, pose keyframes)
- [ ] Budget rules in `lib/check.mjs`: the foe files at most 200 KB together, and the boss files at most 140 KB together
- [ ] More budget rules: place and pool at most 275,000 splats, and each place's three files plus the foe files at most 1.7 MB
- [ ] `world.js` adds the pool: bone ids after the lamplighter's, each slot at density 0 and out of `boned`
- [ ] A slot joins `boned` before its density comes back, and leaves it after its density goes to 0
- [ ] `foes.js` with no DOM: bodies, the ledge probe, noticing, leash, going home, tokens, the wind-up rule, the rise
- [ ] A foe off its ground that is not home 4 s later sinks and rises at home
- [ ] Node test: a Snuffer pushed off B4's terrace is home within 7 s
- [ ] The Snuffer's hook, tell bone, sound cue and glim
- [ ] `?test` hooks for foes: `wake(zone)`, `spawn(type, x, z, yaw)` in a free slot, and `out(foe | zone)`
- [ ] `hold(foe, move, t)`, which keeps the pose and place with no hit, and `__gloam.foes()` with the spec's fields
- [ ] Node tests for each move against the spec's numbers, with a Snuffer held still
- [ ] Node test at 30, 60, 120 and 144 Hz: the same string, roll and hook land on the same play step
- [ ] In that test, each press comes at a multiple of 1/6 s
- [ ] Tell poses from the keyframes; ground markers in fire slots 34 and 35, posed by the page
- [ ] Markers on the ground: rings in six slices of 60°, and lanes in pieces of 1.5 m or less
- [ ] Each piece tilts to the plane fitted to the floor under its rim, 0.05 m up, or lies on the water's surface
- [ ] Markers stand still from 0.3 s before the hit; lane attacks hit only inside the lane; the Ironback's lane 1.6 m wide
- [ ] Node test on the real walk maps: 90% of rim points within 0.15 m of the ground (port `rimfit.mjs` and `lanefit.mjs`)
- [ ] The hit flash rows, the flinch, and the death into bone parts
- [ ] `ctx.zone()` in the biomes, and zones in each `<id>.json`
- [ ] A test that bakes a place with and without its zones: the same `.bin.gz` and walk files, and JSON that differs only in `zones`
- [ ] Zone waking and sleep: the zone's foes and the awake foes together at most 6
- [ ] A zone wakes only with a free pool slot of the right type for each of its foes
- [ ] The guard zones that keep each beacon dark
- [ ] The toast at a dark beacon names where its keepers stand
- [ ] Guard zones always wake: other zones give up their slots, the farthest first
- [ ] Their foes sink over 0.6 s while the guard zone's ember cracks show
- [ ] A test from every point within 10 m of each guard zone: cracks within 1 s, and the rise within 1.6 s
- [ ] Ember cracks from the spark pool, 24 splats a foe, for 0.6 s before the rise
- [ ] Foes put out stay out until the run ends or a reload restarts the place
- [ ] A foe knocked more than 6 m below its zone, or below y −25, goes out; its glim drops on its last firm ground
- [ ] The Pitchrook: bake, lob, ring, the one coal in the air
- [ ] The Mirelight: bake, flight over water and pits, pulse, and a fire ring as its tell
- [ ] The Ironback: bake, the wall stun, the slam
- [ ] The Ironback's charge: it stops dead at a wall, at a drop of more than 0.6 m, or 3 m past the leash
- [ ] Zone test: a wall face of 2 m or more within 3 m past the leash of B1 and of W2
- [ ] Off-screen notches at the left, right and bottom edges, clear of the touch buttons, the HUD, the tools, the toast and the boss bar
- [ ] When the foe files do not load, the loading screen says so and shows Try again

### Feel
- [ ] Every effect counts whole steps of the game clock, which go on during hit stop; moves count the play clock
- [ ] Hit stop of 3, 5, 6 and 9 steps, the cap of 9 steps in any 30, and the picture shake
- [ ] The hit flash and the hurt tint, 3 steps (0.05 s) each; a Node test at 30 and 144 Hz
- [ ] Camera kick: the square of the shake value times smooth noise; the zoom of 7 steps
- [ ] The spark pool, ported from `K.play.fx`; glim motes in the lamp colours
- [ ] Grade: hurt on slots 1 to 31 only, low health with the heartbeat every 55 steps, and the fade to ink
- [ ] The health bar pulses at each heartbeat below 30% health
- [ ] Reduced motion: no kick, no zoom, no turn of the camera by itself, the blink every 8 steps, no flash
- [ ] Reduced motion also: no shake of a hit foe, the low health tint steady at 15%, and a steady fire edge on the health bar

### Cameras
- [ ] The combat camera (spec "Combat camera", cut order 1): 0.9 rad/s after 0.8 s with no look input
- [ ] The combat camera's stop at a yaw difference of 20°, seen from the lamplighter; look input wins on the same step; Node tests
- [ ] The boss camera (spec "Boss camera", cut order 2) takes the place of the combat camera
- [ ] Its aim on the line to the boss, and its distance from 1.25 times the follow distance and 12 m, up to 24 m
- [ ] The boss camera's frame: the smallest distance and an aim that keep the feet's ground, the chests and the boss's head clear of the controls
- [ ] The boss camera's pitch eases up to 0.55 when a hill or a wall brings it closer
- [ ] The boss camera's turn: 1.5 rad/s after 0.6 s, and the stop at 15°
- [ ] The ease back over 1 s when the lamplighter is more than 7.0 m from the arena's centre
- [ ] Node tests of the boss camera at the five layouts, with the boss 2 to 13 m away on flat ground
- [ ] Node test of the boss camera at 481 pairs of points in the real arena (95%)

### The run's screens
- [ ] HUD: health bar, flask pips, glim; the toast 8 px under the HUD's measured bottom at every width
- [ ] The boss bar in the Lab bar row in every layout: at most 360 px on touch and 520 px with a fine pointer
- [ ] The overlap check with the widest HUD: 145/145, 4 of 4 flasks, 5/5 wisps, 254 glim, a boss bar and a toast of 60 characters
- [ ] The help card with the run's controls and Begin the run
- [ ] The beacon card: the wick choice, Spend glim, Walk on
- [ ] The wick offer stored with the run, and a reload at the beacon card that shows the same two wicks
- [ ] The six wicks, drawn from the wicks not yet chosen
- [ ] The Lamp-room: bank, the five upgrades, Buy, Begin the run, Wander when open
- [ ] Go on with the run in place of Begin the run while a run is in progress
- [ ] The Lamp-room from a beacon card: Back to the beacon in place of Begin the run and Wander
- [ ] Upgrades bought in a run: Mantle raises the health too, and Flask adds a full flask
- [ ] The damage bonuses of Edge, Keen edge and Close shave add, and raise the plunge
- [ ] The foe's factor and Heavy fall multiply; damage and heals round once, at the end
- [ ] Death, the fade and the run summary, also after a reload in the fade; Ash pocket
- [ ] The pause panel: the run's places, time, Resume, the sound switch, End the run
- [ ] The pause panel closes on M, P, Escape, Resume, Start, the pad's Back and B
- [ ] Wander: the explorer with no foes, `?wander`, the open rule, a reload back into Wander, the Lamp-room button in its Map
- [ ] Wander's Map and end card fit 360×640 and 800×600 with no scroll

### The boss
- [ ] `boss.bin.gz` and `boss.json.gz`: the Barrow Reeve on 46 bones, 13 for the body and 33 for the markers
- [ ] The boss's three shard rings and its 12 candles
- [ ] Measure the boss files in the first boss task, against the cap of 140 KB; if they are over, cut the boss to 11,000 splats
- [ ] Fetch the boss files during The Bell Knoll, or after play starts in Barrow Crown; the arena asleep until they have loaded
- [ ] When the boss files are not in at 11 m, pause the game and show the loading screen, with Try again when a file failed
- [ ] The boss slot parked out of `boned` until the intro, and the other slots parked in the boss fight
- [ ] The intro: the stop, the bars, the zoom, the card ("V · The last light of the downs"), the boss bar; other awake zones sleep
- [ ] The phases and the stumble; leaving and coming back
- [ ] The attacks: sweep, cage slam, lamp-shards on their three rings, stalking lunge, double sweep, and the choice by position
- [ ] The sweeps' marker: the front three slices of the slam's ring at 4.0 m
- [ ] The fall, the light that rides at the lantern, the boss's 30 glim into the glim carried, and the beacon that banks it
- [ ] After the fall no zone wakes; the run is stored with `bossDown`, and a reload starts at the arena with the light
- [ ] The win stored at once at the last beacon, and a reload on the win card that shows it again
- [ ] The win card, and the first win opening Wander

### Sound
- [ ] WebAudio cues made in code: tells, hits, hurt, glim, beacon, boss, heartbeat; start on the first press
- [ ] `/arcade/quiet.js` as the page's first script, and a `lab/gloam-downs` entry in `PAGES` of `qa/arcade/quiet.mjs`

### Checks
- [ ] `qa/lab/gloam-downs-run.test.mjs`: moves, foes, rules, saves, names with the places, budget and download sizes, and the cameras
- [ ] The same test: the sort bench in all five places (1.45) and the foe step bench (0.5 ms)
- [ ] `qa/lab/gloam-downs-bot.mjs` on the real walk maps: each bot plays until its first win, or 12 runs
- [ ] The bot spreads its bots over the cores with `worker_threads`
- [ ] Time 10 bots at skill 0.5 on the final walk maps, and write the result in design.md
- [ ] Run 60 bots at each skill in less than 10 minutes; tune against the pacing targets, and write the results and the time in design.md
- [ ] `qa/lab/gloam-downs-run.input.e2e.mjs`: every control and both tools, the cards with keys and with a mocked gamepad, the focus, Wander's cards and the sound log
- [ ] `qa/lab/gloam-downs-run.screens.e2e.mjs`: every state, the boss files after a reload, and files that fail
- [ ] The screens e2e: reloads in the death fade, at the beacon card, after the boss's fall and on the win card
- [ ] `qa/lab/gloam-downs-run.layout.e2e.mjs`: the five layouts with the overlap check, the toast, the cards that fit and screenshots
- [ ] `qa/lab/gloam-downs-run.look.e2e.mjs`: the look in a fight in the Gaol (5 foes), and in the Fen and Barrow Crown (6 foes and a marker)
- [ ] The look-in-a-fight check counts only changed pixels brighter than the 0.42 floor or the place's brightest 1%
- [ ] The look e2e: the tell and marker counts in fire slots 34 to 37, the notches, low health and reduced motion
- [ ] `qa/lab/gloam-downs-run.perf.e2e.mjs`: the frame ratio in The Bell Knoll against Wander (1.30)
- [ ] Time each e2e file, aim for about 6 minutes each, and list the five files in `AGENTS.md`
- [ ] `qa/lab/gloam-downs.e2e.mjs` through `?wander`
- [ ] Add the explorer checks that its spec names and its tests lack
- [ ] One of them: E held for 1 s turns the yaw by 2.6 rad, ±0.1
- [ ] `node qa/arcade/quiet.mjs --only=lab/gloam-downs` with the site served
- [ ] `node qa/arcade/machines.mjs` with the site served

### Text and art
- [ ] The switcher subtitle, the cabinet's aria label, the Lab card, the Corridor caption and the page's meta description say it is a combat run
- [ ] Decide the marquee subtitle (today "LIGHT THE BEACONS") and the alt text of the screen art
- [ ] Then check the marquee at 390, 320 and 1280, with the subtitle hidden at 360x640 and 800x600; run `node qa/arcade/machines.mjs`, and replace the pull request screenshots
- [ ] Cabinet and Corridor art with a foe in view, from the final bake
- [ ] `games/gloam-downs/README.md` and the Gloam Downs line in `AGENTS.md`: the foe bake, the bot and the new checks

### Close
- [ ] Specs and design.md match the build, with the tuned numbers
- [ ] `openspec validate add-gloam-downs --strict`
- [ ] Frame time on a real phone at 46k art pixels with 6 foes awake (or report that it could not run)
- [ ] Frame time on a real GPU (or report that it could not run)
