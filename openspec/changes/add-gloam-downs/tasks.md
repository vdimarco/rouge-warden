# Tasks

## Bake

- [x] Pin Ink Studio in `games/gloam-downs/package.json` and copy its WebGL renderer into `public/lab/gloam-downs/ink/` (`vendor.mjs`)
- [x] Shared kit in `games/gloam-downs/lib/`: palette with shared fire, wisp, cloak, iron and lamp colours; rolling hills; terrain rings; walk map; lamplighter with bones; props
- [x] Bake script with `--check`, `--preview` and `GLOAM_COUNT`, and the spec's budget and darkness rules in `lib/check.mjs`
- [x] Lamp light falls off as a warm ramp, on a material and on its `top`
- [x] The Gaol
- [x] The Ramparts
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

### Base
- [ ] Fixed 1/60 s step in `main.js`, up to 15 steps a frame, with the step count from a pure function in `run.js`
- [ ] Node test: the same string, roll and hook land on the same step at 30, 60, 120 and 144 Hz
- [ ] `run-save.js`: `fresh`, `clean`, `load` and `store` under `gloam-downs.run.v1`; Node tests with bad data, and with an old explorer page that stores its own save
- [ ] `run.js` with no DOM: run states, health, flasks, glim carried and banked, death, the entry snapshot for a reload
- [ ] `?seed=N`, and the seed draws the wicks and the foes' choices
- [ ] `?test` API: `tick` takes attack, roll, heal and look; `__gloam.run()` and `__gloam.foes()`; flags that turn each feel effect off

### Inputs
- [ ] Press edges with a 0.15 s buffer for attack, roll and heal; a latch for a mouse press
- [ ] Keys: J or Z, K or X, L or C; R faces the nearest awake foe; M, P or Escape pause
- [ ] Mouse: left press attacks at once, hold goes on until 6 px of movement, drag with either button looks
- [ ] Gamepad: X or RT attack, B or LT roll, Y heal, RB face the foe, Start or Back pause, one press across all pads
- [ ] Touch: Attack, Roll and Heal buttons beside Jump, at the sizes in design.md, small sizes at 660 px tall or less; the Heal flask count

### The lamplighter's moves
- [ ] The blade string: timings, damage, reach, arcs, lunge through the per-body `PARAMS` copy, the hold
- [ ] Soft aim with the sight test, the 75° turn and the stop 0.25 m short
- [ ] The roll: 0.36 s at 9.0 m/s, the end cut to 4.5 m/s, safe time, cooldown, cancels, the ledge guard
- [ ] The plunge
- [ ] The flask drink, its stop on a hit or a roll, and the fifth-wisp refill
- [ ] Hurt: the scripted push, 0.25 s without control, 0.9 s safe, the blink
- [ ] Falls below y −25: last firm ground, 10 health lost
- [ ] Node tests for each move against the spec's numbers

### Foes
- [ ] `foes` bake target: the Snuffer first, on 8 bones, with `foes.json` (ranges, bones, pivots, pose keyframes)
- [ ] Budget rules in `lib/check.mjs`: the foe file at most 200 KB, the boss file at most 100 KB, place and pool at most 275,000 splats
- [ ] `world.js` adds the pool: bone ids after the lamplighter's, every pool splat in `boned`, each slot at density 0
- [ ] `foes.js` with no DOM: bodies, the ledge probe, noticing, leash, going home, tokens, the wind-up rule, the rise
- [ ] The Snuffer's hook, tell bone, sound cue and glim
- [ ] Tell and ground marker poses from the keyframes; the hit flash rows, the flinch, the death into bone parts
- [ ] `ctx.zone()` in the biomes and zones in each `<id>.json`; a test that the `.bin.gz` and walk files keep their hashes
- [ ] Zone waking and sleep, the cap of 6, and the guard zones that keep each beacon dark
- [ ] The Pitchrook: bake, lob, ring, the one coal in the air
- [ ] The Mirelight: bake, flight over water and pits, pulse
- [ ] The Ironback: bake, charge that stops dead, the wall stun, slam
- [ ] Off-screen notches

### Feel
- [ ] Hit stop on game time with the 0.15 s cap in any 0.5 s, and the picture shake
- [ ] Camera kick with trauma² and smooth noise; zoom
- [ ] The spark pool, ported from `K.play.fx`; glim motes in the lamp colours
- [ ] Grade: hurt, low health with the heartbeat, the fade to ink
- [ ] Reduced motion: no kick, no zoom, the slow blink, no flash, no pulse

### The run's screens
- [ ] HUD: health bar, flask pips, glim; the toast at `sat + 150px` at 520 px wide or less
- [ ] The help card with the run's controls and Begin the run
- [ ] The beacon card: the wick choice, Spend glim, Walk on
- [ ] The six wicks
- [ ] The Lamp-room: bank, the five upgrades, Buy, Begin the run, Wander when open
- [ ] Death, the fade and the run summary; Ash pocket
- [ ] The pause panel: the run's places, time, Resume, the sound switch, End the run
- [ ] Wander: the explorer with no foes, `?wander`, the open rule, a reload back into Wander, the Lamp-room button in its Map

### The boss
- [ ] `boss.bin.gz`: the Barrow Reeve on 17 bones, its 12 candles; fetched during The Bell Knoll
- [ ] The intro: the stop, the bars, the zoom, the card, the boss bar on touch and with a fine pointer
- [ ] The phases and the stumble; leaving and coming back
- [ ] The attacks: sweep, cage slam, lamp-shards, stalking lunge, double sweep, and the choice by position
- [ ] The fall, the light that rides at the lantern, the beacon, the win card, the first win opening Wander
- [ ] The boss camera (cut order 2)
- [ ] The idle combat camera (cut order 1)

### Sound
- [ ] WebAudio cues made in code: tells, hits, hurt, glim, beacon, boss, heartbeat; start on the first press
- [ ] `/arcade/quiet.js` as the page's first script, and a `lab/gloam-downs` entry in `PAGES` of `qa/arcade/quiet.mjs`

### Checks
- [ ] `qa/lab/gloam-downs-run.test.mjs`: moves, foes, rules, saves, names, budget, the sort bench (1.40) and the foe step bench (0.5 ms)
- [ ] `qa/lab/gloam-downs-bot.mjs` on the real walk maps; tune against the pacing targets and write the results in design.md
- [ ] `qa/lab/gloam-downs-run.e2e.mjs`: every control, every state, the five layouts with the overlap check and screenshots
- [ ] The same e2e: the look in a fight, the tell and marker counts, reduced motion, the frame ratio (1.30)
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
- [ ] Frame time on a real phone at 46k art pixels with 6 foes awake, and on a real GPU (or report that it could not run)
