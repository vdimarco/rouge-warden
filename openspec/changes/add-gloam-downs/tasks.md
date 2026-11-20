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
- [ ] After the controller fixes merge, do the Bake section's final bake, and commit the baked files
- [ ] Run `check-zones.mjs` again on the final walk maps, with the guard rule and the Ironback walls; update the zone table in design.md

### Base
- [ ] Fixed 1/60 s step in `main.js`, up to 15 steps a frame, with the step count from a pure function in `run.js`
- [ ] Move times round to the nearest step; effect times in whole steps
- [ ] `run-save.js`: `fresh`, `clean`, `load` and `store` under `gloam-downs.run.v1`, with `run`, `offer` and `ended`
- [ ] Node tests of `run-save.js` with bad data, and with an old explorer page that stores its own save
- [ ] Store the run at once on each hit taken, each drink, each wick chosen, each lit beacon and at 0 health
- [ ] Store the run every 120 steps otherwise, when the tab is hidden and on pagehide
- [ ] Node tests for a reload just after a hit and in the death fade
- [ ] `run.js` with no DOM: run states, health, flasks, glim carried and banked, death and `ended`, and the entry snapshot
- [ ] A reload that restarts the place with its foes and wisps back
- [ ] `?seed=N`; the seed draws the wicks from their own stream, and the foes' choices from another
- [ ] `?fresh` starts with a fresh run save and a fresh explorer save
- [ ] `?test` API: `tick` takes attack, roll, heal and look; `__gloam.run()`
- [ ] `?test` hooks that need no foe: `fx`, `set`, `go(id)` in a run, and the `sounds()` log of cues with their steps
- [ ] `lib/check.mjs` counts a place's JSON in its 1.5 MB

### Inputs
- [ ] Press edges with a 0.15 s buffer for attack, roll and heal; a latch for a mouse press
- [ ] Keys: J or Z, K or X, L or C; R faces the nearest awake foe within 10 m; M, P or Escape pause
- [ ] Mouse: left press attacks at once, hold goes on until 6 px of movement, drag with either button looks
- [ ] Gamepad: X or RT attack, B or LT roll, Y heal, RB face the foe within 10 m, Start or Back pause
- [ ] One press across all pads; in Wander, X walks, and RT, B, LT and Y do nothing
- [ ] Focus in cards: the d-pad and the left stick move the focus; A, Space and Enter press the focused button
- [ ] Back in cards: B and Escape go back where a card has a back action; Start and Back close only the pause panel
- [ ] Before the wick is chosen, only a wick button closes the beacon card
- [ ] Touch: Attack, Roll and Heal buttons beside Jump, at the sizes in design.md, small sizes at 660 px tall or less; the Heal flask count
- [ ] The Map tool opens the pause panel, on a tap and on a mouse click
- [ ] The Look tool faces the nearest awake foe within 10 m, on a tap and on a mouse click
- [ ] A press on a tool does not swing, and does not start the stick or the look drag

### The lamplighter's moves
- [ ] The blade string: timings, damage, reach, arcs, the hold, and the early start after a finisher
- [ ] The lunge through the per-body `PARAMS` copy, and the stop 0.25 m short of the target's edge
- [ ] Soft aim with the sight test from 1.2 m to 0.9 m, the score, the 0.75 margin and the 75° turn
- [ ] The roll: 0.36 s at 9.0 m/s, the end cut to 4.5 m/s, safe time, cooldown, cancels, the ledge guard
- [ ] The plunge
- [ ] The flask drink, its stop on a hit or a roll, and the fifth-wisp refill
- [ ] Hurt: the scripted push, 0.25 s without control, 0.9 s safe, the blink every 4 steps
- [ ] Falls below y −25: last firm ground, 10 health lost

### Foes
- [ ] `foes` bake target: the Snuffer first, on 8 bones, with `foes.bin.gz` and `foes.json.gz` (ranges, bones, pivots, pose keyframes)
- [ ] Budget rules in `lib/check.mjs`: the foe files at most 200 KB together, and the boss files at most 100 KB together
- [ ] More budget rules: place and pool at most 275,000 splats, and each place's three files plus the foe files at most 1.7 MB
- [ ] `world.js` adds the pool: bone ids after the lamplighter's, each slot at density 0 and out of `boned`
- [ ] A slot joins `boned` before its density comes back, and leaves it after its density goes to 0
- [ ] `foes.js` with no DOM: bodies, the ledge probe, noticing, leash, going home, tokens, the wind-up rule, the rise
- [ ] The Snuffer's hook, tell bone, sound cue and glim
- [ ] `?test` hooks for foes: `wake(zone)`, `spawn(type, x, z, yaw)` in a free slot, `hold(foe, move, t)` that keeps the pose and place, and `__gloam.foes()`
- [ ] Node tests for each move against the spec's numbers, with a Snuffer held still
- [ ] Node test: the same string, roll and hook land on the same step at 30, 60, 120 and 144 Hz
- [ ] Tell and ground marker poses from the keyframes, the markers in fire slots 34 and 35
- [ ] The hit flash rows, the flinch, and the death into bone parts
- [ ] `ctx.zone()` in the biomes, and zones in each `<id>.json`
- [ ] A test that bakes a place with and without its zones: the same `.bin.gz` and walk files, and JSON that differs only in `zones`
- [ ] Zone waking and sleep: the zone's foes and the awake foes together at most 6
- [ ] A zone wakes only with a free pool slot of the right type for each of its foes
- [ ] The guard zones that keep each beacon dark
- [ ] The toast at a dark beacon names where its keepers stand
- [ ] Guard zones always wake: other zones give up their slots, the farthest first, and their foes sink over 0.6 s
- [ ] A test from every point within 10 m of each guard zone: the guard starts to rise within 0.6 s
- [ ] Ember cracks from the spark pool, 24 splats a foe, for 0.6 s before the rise
- [ ] Foes put out stay out until the run ends or a reload restarts the place
- [ ] A foe knocked more than 6 m below its zone, or below y −25, goes out; its glim drops on its last firm ground
- [ ] The Pitchrook: bake, lob, ring, the one coal in the air
- [ ] The Mirelight: bake, flight over water and pits, pulse
- [ ] The Ironback: bake, the wall stun, the slam
- [ ] The Ironback's charge: it stops dead at a wall, at a drop of more than 0.6 m, or 3 m past the leash
- [ ] Zone test: a wall face of 2 m or more within 3 m past the leash of B1 and of W2
- [ ] Off-screen notches at the left, right and bottom edges
- [ ] When the foe files do not load, the loading screen says so and shows Try again

### Feel
- [ ] Every effect counts whole steps of the game clock, which go on during hit stop
- [ ] Hit stop of 3, 5, 6 and 9 steps, the cap of 9 steps in any 30, and the picture shake
- [ ] The hit flash and the hurt tint, 3 steps (0.05 s) each; a Node test at 30 and 144 Hz
- [ ] Camera kick: the square of the shake value times smooth noise; the zoom of 7 steps
- [ ] The spark pool, ported from `K.play.fx`; glim motes in the lamp colours
- [ ] Grade: hurt, low health with the heartbeat every 55 steps, and the fade to ink
- [ ] The health bar pulses at each heartbeat below 30% health
- [ ] Reduced motion: no kick, no zoom, no turn of the camera by itself, the blink every 8 steps, no flash, no pulse

### Cameras
- [ ] The combat camera (spec "Combat camera", cut order 1): 0.9 rad/s after 0.8 s with no look input
- [ ] The combat camera's stop at a yaw difference of 20°, seen from the lamplighter; look input wins on the same step; Node tests
- [ ] The boss camera (spec "Boss camera", cut order 2): the aim point at 0.35, and 1.25 times the follow distance, at least 12 m
- [ ] The boss camera's turn: 1.5 rad/s after 0.6 s, the stop at 15°, and the ease back over 1 s
- [ ] Node tests of the boss camera at the five layouts, with the boss 2 to 13 m away

### The run's screens
- [ ] HUD: health bar, flask pips, glim; the toast 8 px under the HUD's measured bottom at every width
- [ ] The help card with the run's controls and Begin the run
- [ ] The beacon card: the wick choice, Spend glim, Walk on
- [ ] The wick offer stored with the run, and a reload at the beacon card that shows the same two wicks
- [ ] The six wicks, drawn from the wicks not yet chosen
- [ ] The Lamp-room: bank, the five upgrades, Buy, Begin the run, Wander when open
- [ ] The Lamp-room from a beacon card: Back to the beacon in place of Begin the run and Wander
- [ ] Upgrades bought in a run: Mantle raises the health too, and Flask adds a full flask
- [ ] The damage bonuses of Edge and Keen edge add, and damage rounds to the nearest whole number
- [ ] Death, the fade and the run summary, also after a reload in the fade; Ash pocket
- [ ] The pause panel: the run's places, time, Resume, the sound switch, End the run
- [ ] The pause panel closes on M, P, Escape, Resume, Start, the pad's Back and B
- [ ] Wander: the explorer with no foes, `?wander`, the open rule, a reload back into Wander, the Lamp-room button in its Map
- [ ] Wander's Map and end card fit 360×640 and 800×600 with no scroll

### The boss
- [ ] `boss.bin.gz` and `boss.json.gz`: the Barrow Reeve on 20 bones, with three shard rings, and its 12 candles
- [ ] Fetch the boss files during The Bell Knoll, or after play starts in Barrow Crown; the arena asleep until they have loaded
- [ ] When the boss files are not in at 11 m, pause the game and show the loading screen, with Try again when a file failed
- [ ] The boss slot parked out of `boned` until the intro, and the other slots parked in the boss fight
- [ ] The intro: the stop, the bars, the zoom, the card, the boss bar on touch and with a fine pointer
- [ ] The phases and the stumble; leaving and coming back
- [ ] The attacks: sweep, cage slam, lamp-shards on their three rings, stalking lunge, double sweep, and the choice by position
- [ ] The fall, the light that rides at the lantern, and the beacon that banks the glim carried
- [ ] The win card, and the first win opening Wander

### Sound
- [ ] WebAudio cues made in code: tells, hits, hurt, glim, beacon, boss, heartbeat; start on the first press
- [ ] `/arcade/quiet.js` as the page's first script, and a `lab/gloam-downs` entry in `PAGES` of `qa/arcade/quiet.mjs`

### Checks
- [ ] `qa/lab/gloam-downs-run.test.mjs`: moves, foes, rules, saves, names with the places, budget and download sizes, and the cameras
- [ ] The same test: the sort bench in all five places (1.45) and the foe step bench (0.5 ms)
- [ ] `qa/lab/gloam-downs-bot.mjs` on the real walk maps: each bot plays until its first win, or 12 runs
- [ ] Run 60 bots at each skill in less than 10 minutes; tune against the pacing targets, and write the results and the time in design.md
- [ ] `qa/lab/gloam-downs-run.e2e.mjs`: every control and both tools, and the cards with keys and with a mocked gamepad
- [ ] The same e2e: every state, with a reload in the death fade and at the beacon card
- [ ] The same e2e: the five layouts with the overlap check, the toast and screenshots
- [ ] The same e2e: the look in a fight in the Gaol (5 foes), and in the Fen and Barrow Crown (6 foes and a marker)
- [ ] The look-in-a-fight check counts only changed pixels brighter than the 0.42 floor or the place's brightest 1%
- [ ] The same e2e: the tell and marker counts in fire slots 34 to 37, reduced motion, and the sound log
- [ ] The same e2e: the frame ratio in The Bell Knoll against Wander (1.30), the boss files after a reload, and files that fail
- [ ] `qa/lab/gloam-downs.e2e.mjs` through `?wander`
- [ ] `node qa/arcade/quiet.mjs --only=lab/gloam-downs` with the site served
- [ ] `node qa/arcade/machines.mjs` with the site served

### Text and art
- [ ] The switcher subtitle, the cabinet's aria label, the Lab card, the Corridor caption and the page's meta description say it is a combat run
- [ ] Cabinet and Corridor art with a foe in view, from the final bake
- [ ] `games/gloam-downs/README.md` and the Gloam Downs line in `AGENTS.md`: the foe bake, the bot and the new checks

### Close
- [ ] Specs and design.md match the build, with the tuned numbers
- [ ] `openspec validate add-gloam-downs --strict`
- [ ] Frame time on a real phone at 46k art pixels with 6 foes awake (or report that it could not run)
- [ ] Frame time on a real GPU (or report that it could not run)
