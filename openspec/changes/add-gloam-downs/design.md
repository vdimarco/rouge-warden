# Design

## The idea in the user's words
"Environments inspired by dead cells but give it a 3d supermarket 64 vibe with rolling hills", then "make it look gritty and dark". We read "supermarket 64" as Super Mario 64.

- **From Dead Cells (mood only):** a run through a chain of different places, ruined stone, torch light, and color that is saturated but never welcoming. Warm light falls on the hero, and cold shadow falls on the place.
- **From N64-era platformers (form only):** chunky round forms, rolling hills, a low resolution, flat shading in a few steps, fog that hides the far edge, and a summit goal that you can see from the start.
- **From the user's second note:** dusk and night only, dark ground and sky, and fire as the brightest color.

All five places, the lamplighter and the names are original.

## Sources
- **Dead Cells color:** Gwenaël Massé, "Art Design Deep Dive: Giving back colors to cryptic worlds in Dead Cells", Game Developer. We read it through the repost at https://www.jikguard.com/news/art-design-deep-dive-giving-back-colors-to-cryptic-worlds-in-dead-cells, because gamedeveloper.com was not reachable from this session. We take three rules from it:
  - the palette is saturated but not welcoming;
  - outdoor places use analogous hues;
  - warm light falls on the hero and cold shadow on the place.
- **Dead Cells 3D-to-pixel pipeline:** Thomas Vasseur, "Art Design Deep Dive: Using a 3D pipeline for 2D animation in Dead Cells". We read it through the repost at https://www.jikguard.com/news/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-dead-cells. Its lesson is to model in 3D and judge the result at the final pixel size. Ink Studio works the same way: solids are baked into pixel-art splats.
- **N64 look:** Rodrigo Copetti, "Nintendo 64 Architecture" (https://www.copetti.org/writings/consoles/nintendo-64) covers the low output resolution, Gouraud shading, and fog done as a blend. Ink Studio has no textures, so we do not copy the 3-point texture filter. Its splats carry flat palette ramps, which give the same smooth, few-step look.
- **Level shape:** the first course of Super Mario 64, as described at https://goombastomp.com/super-mario-64-level-bob-omb-battlefield/, has terraced plateaus, a spiral path, and a summit goal that can be seen across the map. We use only that structure: each place has its beacon on a summit that you can see from the start, and a path that climbs to it. No layout is copied.
- **Hills:** Inigo Quilez, "fBm" (https://iquilezles.org/articles/fbm) and "Domain warping" (https://iquilezles.org/articles/warp). The height is a sum of compact smooth bumps `h·(1−r²/R²)³`, plus 2–3 octaves of fBm with gain 0.5, plus one warp of the input point. We keep the bump height under 0.35 of its radius, so slopes stay walkable.
- **Fog:** Inigo Quilez, "Fog" (https://iquilezles.org/articles/fog/). The fog color is the horizon color. Ink Studio's renderer applies the fog as a smoothstep over view depth. We set the depth range for each frame, so the fog stays at the same distance as the camera moves in and out.
- **Far terrain:** geometry clipmaps (Losasso and Hoppe, SIGGRAPH 2004). The terrain is three square rings, and the splat spacing doubles in each ring away from the play area.
- **Pixel outlines:** David Holland, "3D Pixel Art Rendering" (https://davidholland.netlify.app/articles/3d-pixel-art-rendering). Outlines go at depth breaks. Ink Studio's `outline: { c, edge }` does this in its own resolve pass.
- **Splat pixel art:** Ink Studio itself (https://github.com/siliconjungle/shapeshift-labs-ink-studio, commit 6a8c622, MIT). We use its sculptor, bake, palette resolve, codec and WebGL renderer as they are. No other splat-stylization method fit: the papers we found are about style transfer, not pixel art.

## Bake offline, draw in the page
- `games/gloam-downs/` installs Ink Studio from GitHub, pinned to commit 6a8c622.
- `bake.mjs` builds each place with the full toolkit (about 2.7 MB of source) and writes three files:
  - `worlds/<id>.bin.gz`: the splat rows, as `SplatCodec` bytes, gzipped;
  - `worlds/<id>.walk.bin.gz`: the walk map;
  - `worlds/<id>.json`: the settings and the gameplay points.
- The page loads only the renderer:
  - `pixel-look.js`, `splat-codec.js` and seven `webgl/*.mjs` files, about 48 KB gzipped, copied into `public/lab/gloam-downs/ink/` with Ink Studio's license;
  - the page decompresses with `DecompressionStream`.
- Baking in the page would need the 770 KB toolkit and about one second of CPU time for each place, so we do not do it.

## A place
`biomes/<id>.mjs` exports `{ id, name, sub, palette, light, sky, fog, build(ctx) }`. The shared helpers in `lib/common.mjs` give:
- **Palette slots:** the colors for the lamplighter, the wisps, the fire and the beacon are the same in every palette. Only the place's own colors change.
- **Hills:** bumps, fBm and a warp, cached on a grid with `K.tab2`.
- **Terrain:** a near tile, then rings whose spacing about doubles. `terrain()` uses 0.24, 0.5 and 1.0 by default, and each place sets its own spacing with `tile()`. Each tile is bounded, so it keeps its own material.
- **Paths:** a polyline distance gives the dirt color and a slight dip in the ground.
- **Props:** rocks, trees, torches, braziers, stone blocks and fences.
- **Points:** the start point, five wisps, and the beacon on the summit.

## The walk map
- Before the bake, `S.ready()` lets `S.sdf` answer for the whole scenery. On a grid of 0.25 units, the bake marches down from above and stores the top surface; a column beside a wall's face follows it down to the foot. Where a gap of at least 1.8 units opens under that surface, it also stores the gap's underside and the floor below. Players can then walk under arches and tree crowns.
- Water, hanging cloth and chains (`later`) are added after the walk map, so they never block the feet. They are baked with the scenery in one bake, so its shadows fall on them and what of them is buried in it is dropped.
- At run time the controller asks for the highest floor at or below its feet plus a step. A floor more than 0.45 above the feet is a wall. The camera uses the top surface to come closer in front of hills.
- The map is two `Int16` layers, in centimeters, gzipped.

## The lamplighter
- The figure is sculpted in each world after the scenery bake, high above the map, so the place's shadows do not fall on it. It is baked with that place's light.
- `K.bones.tag` puts its splats on seven GPU bones: body, head, two legs, two arms with the lantern, and the shadow disc. The page writes 12 numbers for each bone every frame, and no splat rows are uploaded.
- The controller, camera and pose live in `play.js` with no DOM, so Node can test them.

## Wisps and the beacon
- **Wisps:** emissive splats that bob in the shader.
- **Beacon flames:** emissive splats that start with zero density.
- **Changes:** to put out a wisp or light the beacon, the page sets the density of those rows, and the renderer uploads only the changed 512-splat rows.

## Speed
- The renderer sorts all splats on the CPU when the view changes. That costs about 3 ms for 100k splats and 7.5 ms for 300k. Each place is kept under 250k splats.
- The art size is about 64,000 pixels (320×200), or 46,000 on a touch screen, scaled up by a whole number. The page keeps the last 40 frame times. If their median is over 45 ms for two seconds, the page steps the art size down to 72% of its pixels. It stops when the art size is 24,000 pixels or less.
- The game moves in steps of at most 1/30 s, as many as the frame took, up to 0.25 s for each frame. So a slow phone does not play in slow motion, and a long pause does not move the lamplighter far.

## Not done
- Sound, enemies and combat.
- Runtime point lights: the renderer has no path for them, so all light is baked.
- A check on a real phone or a real graphics card. This session has only software WebGL.

## The combat run
The user asked: "beautiful now can we turn this into a playable game?" The user's decisions: a combat run in the spirit of Dead Cells, with a blade, a dodge roll, foes with clear warning moves, health and flasks, a restart at the Gaol on death, a currency that buys lasting upgrades, and a boss at Barrow Crown. The five places and their look stay. Everything is original. Keys, mouse, touch and gamepad work, at 320x640, 390x844, 1280x720, 360x640 and 800x600.

### The choice
Two designs were made: A (player feel first) and B (ship-safe first). Both texts in the brief stop part way (A in its section 5, B in its section 6). We judge what they give.

| | A | B |
|---|---|---|
| Fun | 5 | 4 |
| Fairness | 4 | 5 |
| Feasibility in the measured budgets | 3 | 5 |
| Testability | 4 | 5 |
| Phone fit | 4 | 5 |
| Originality | 4 | 4 |
| Keeps the user's decisions | 5 | 5 |
| Total | 29 | 33 |

- **Fun.** A has six foe types, wicks at the beacons, a light carried to the last beacon and a richer boss. B has four types and no choice inside a run.
- **Fairness.** In B every wind-up has a pose, a fire glow and a sound, and every ring or lane also has a ground marker. B's shortest wind-up is 0.55 s and its largest hit is 24. A answers its wave attacks with jump windows of 0.27 to 0.32 s, and touch delay makes those hard on a phone.
- **Feasibility.** B totalled each place with its pool of foes: 256,668 to 263,498 splats, under 275,000. B needs four foe sculpts and one boss. A needs six foe sculpts, 57 foes, a poise meter, a combat camera and burning ground, and it did not total its pools.
- **Testability.** B has a run seed, `?wander`, an entry snapshot for reloads and a sim with knobs. A has a pacing model and a list of assists.
- **Phone fit.** B places the health line, the toast and the boss bar from measured failures. A keeps the string going while Attack is held, but its jump windows are tight on touch.
- **Originality.** Both have original names and looks. Both use genre devices, such as a ring to roll out of or a charge into a wall, and copy no game.
- **The user's decisions.** Both keep all of them and the look.

**B is the base.** We take these parts of A:
1. Holding Attack goes on with the string. On a phone this saves taps.
2. The roll stops at a drop of more than 3 m unless the stick pushes over it. The Bells' spire terrace is a ring about 3 m wide at y 4.5, and a 3.5 m roll would leave it.
3. A fall below y −25 does not end the run. The lamplighter comes back on the last firm ground and loses 10 health.
4. Wicks: at each of the first four beacons the player chooses one of two boons for the rest of the run. This gives each run its own shape.
5. The light carried to the last beacon. B's light rose to the beacon by itself. A ends the run on the game's own verb: light the beacon. The path from the arena to the beacon is 15.9 m on the real walk map (`run/flamewalk.mjs`).
6. The currency is glim, motes in the lamp colours, so fire stays the colour of danger. B's amounts stay.
7. Foes rise from the ground when their zone wakes. This hides a pool slot that comes on in view.
8. A ring of grave candles marks the edge of the boss arena.
9. The push of a hit on the lamplighter is a scripted move. A measured that a plain velocity brakes at once: 5 m/s slides 0.31 m.
10. A combat camera: while a zone is awake and the view has had no look input for 0.8 s, the yaw turns at no more than 0.9 rad/s until the nearest awake foe is within 20° of ahead. Look input takes control back on the same step. It is the spec's "Combat camera", and the first thing to cut.

We do not take A's poise meter, because B's wind-up rule is simpler and its sim showed the stun-lock that the rule stops. We do not take A's six types, its bell foe with its wave, its burning ground or its tier multipliers, because of the budgets and the jump windows on touch. A's beacon heal stays a tuning lever, off at first.

### Numbers we checked
We ran the design scripts again at commit 6c66c210 (scratch folder `design/`) and read the code they rely on.
- `run/feel.mjs` on the real `play.js`: a full jump peaks at 1.33 m after 0.33 s, stays 0.60 s in the air, and keeps the feet over 0.5 m for 0.47 s. A tap jump peaks at 1.07 m. `JUMP` is 1.401.
- `ss/roll.mjs`: a roll of 0.36 s at 9.0 m/s moves 3.26 m on flat ground and on the Gaol, the Bells and the Barrows in 8 directions. With no clamp it then coasts 1.05 m. With the speed cut to 4.5 m/s at the end it coasts 0.25 m, so 3.51 m in all. Lunges by the per-body `PARAMS` copy: 0.46 m and 0.81 m. An Ironback charge of 0.7 s at 10 m/s: 6.94 m, and 2.11 m into a wall 3 m away. It must stop dead at the end, or it coasts 2.67 m.
- `ss/plan2.mjs`: the place and its pool, in splats, are Gaol 256,969, Ramparts 260,410, Fen 256,668, Bells 263,498 and Barrows 262,907. B's brief gave 264,110 as the top; the rerun gives 263,498. Walking each route without a fight wakes at most 5 (Gaol, Ramparts) or 6 foes at once. A full run holds 254 glim: 124 from foes, 100 from wisps and 30 from the boss.
- `ss/sim.mjs`, B's flat-ground sim. Its defaults are a Snuffer hook of 14, a boss of 960 and a heal of 40%, which are not the design's numbers. With the design's numbers (`SDMG=16 PDMG=18 MDMG=18 IDMG=20 BHP=1300 HEAL=0.35`, 300 bots, 12 runs) the median first win is run 3 at skill 0.3, run 2 at 0.5 and run 1 at 0.7 and 0.9. The boss fight takes a median of 72 to 75 s, a winning run 5.7 to 5.8 minutes of game time, and the 90th percentile of boss tries is 4, 3, 2 and 2.
- `run/pacing.mjs`, A's model with its own roster (a design aid, not used for numbers): without a beacon heal, the Ramparts ends 60% and 42% of a new player's first two runs. With a heal of 25% it ends 41% and 21%. A's brief said 62 to 73%; the rerun does not give that.
- The code: `main.js` steps the game by at most 1/30 s and `?test` steps it by 1/60 s. The toast sits at `sat + 116px` and the hint hides at 520 px wide or less. Gamepad button 0 jumps, 2 walks, 5 looks ahead and 9 opens the Map. The walk files and place files add up to 1.320 MB (Gaol) to 1.480 MB (Barrows) of the 1.5 MB budget.

After review, we measured two more things (scratch folder `run-rev/`).

**The sort with each place's pool** (`sortmix.mjs`, the review's `sortpool.mjs` with parked slots added). The base is the place with the lamplighter's bones and no pool. Each figure is the best median of 3 rounds of 60 frames, and each row is 3 runs.

| Place | On bones | Parked | Ratio |
|---|---|---|---|
| Gaol | 16,500 (5 S) | 0 | 1.27 to 1.31 |
| Ramparts | 16,900 | 0 | 1.28 to 1.36 |
| Fen, every slot on bones | 20,800 | 0 | 1.38 to 1.54 |
| Fen, the largest awake set (6 of 8 slots) | 18,200 | 2,600 | 1.33 to 1.38 |
| Bells | 19,500 | 0 | 1.31 to 1.38 (6 runs) |
| Barrows, every slot and the boss on bones | 31,500 | 0 | 1.56 to 1.65 |
| Barrows before the boss, the boss parked | 19,500 | 12,000 | 1.37 to 1.39 |
| Barrows in the boss fight, the boss alone on bones | 12,000 | 19,500 | 1.32 |

With every slot on bones, Barrow Crown fails a pass of 1.40, and the Fen's worst run does too. So a parked slot leaves the bones (see Rendering). Then the worst place is 1.39, and the spec's pass is 1.45 in each place. The review measured 1.302 for the Bells and 1.528 for the Barrows with every slot on bones. Our runs are a little higher, which shows the spread on this machine.

**The brightest 1% today, with no foes** (`bright2.mjs`, the review's `bright.mjs` at two sizes). This is the share of the brightest 1% of art pixels that is within 12 of a fire, wisp, lamp or moon colour. It is the baseline for the look in a fight.

| Place | Desktop, 320×180 | Phone, 130×282 | Pixels that miss |
|---|---|---|---|
| Gaol | 72% | 100% | the Gaol's moonlit stone 4f5c8a |
| Ramparts | 40% | 38% | 737c36 and 987456 |
| Fen | 79% | 33% | the sick green lanterns e2ec86 and 9cae34; on the phone, 48502f and 5a4f2a |
| Bells | 48% | 94% | the dusk ramp 9e6224, 9c3b29 and cc9238 |
| Barrows | 99% | 100% | a6f27e |

The pixels that miss are each place's own colours in slots 1 to 31: lit stone, lanterns and the dusk ramp. Foes cannot change that, and the explorer's rule already lets lanterns and the moon be bright. So a fixed share of 90% fails before any foe is added. The share also swings with the art size (Fen 79% and 33%). A rule that compares the share with foes to the share without them can fail when a foe hides a torch: at the phone size the Gaol and the Barrows are already at 100%. The spec's check therefore looks only at the pixels that the foes change. Of those that are at least as bright as the dimmest of the brightest 1% without foes, at least 95% must be fire, lamp or wisp. The 5% allows for outline and dither pixels at a foe's edge (an estimate, to be checked in the first build).

### The run
- **Order.** Gaol, Ramparts, Fen, Bells, Barrow Crown (`ORDER` in `save.js`). No Map travel in a run.
- **Start.** First visit: the help card, then run 1 in the Gaol. A player with a finished explorer walk goes from the help card to the Lamp-room, where Wander is open. Later visits: the Lamp-room over the Gaol's start view. Each run has a seed, `hash(runs, Date.now())`, or `?seed=N`. The seed draws the wick offers and the foes' choices of move and cooldown.
- **Guards.** The beacon lights only when its guard zone is clear: G5, R4, F4 and B4. At Barrow Crown the boss holds the light. All other zones can be passed.
- **A lit beacon** before Barrow Crown banks the glim carried, fills the flasks, saves the run at the start of the next place, and shows the beacon card: choose a wick, then Spend glim or Walk on.
- **Reload.** The run goes on at the start of the current place. The place restarts, so its foes, its guard foes and its wisps are all back. Health and flasks are the lower of the entry values and the last stored values. Glim carried goes back to its entry value. So a reload cannot heal or farm glim, and the foes that come back give no glim that the reload did not take away.
- **When the run is stored.** At once on each hit taken, each drink, each lit beacon and at 0 health, and otherwise every 120 steps (2 s), when the tab is hidden and on pagehide. Today's page stores every 120 frames only, so a reload in the death fade could keep a run alive. A store is one small `localStorage` write.
- **Death.** Hit stop 0.15 s, a fade to ink over 1.2 s, then the run summary. At 0 health the page stores the ended run at once: runs and deaths go up, the glim carried is lost (Ash pocket keeps 30%), `run` becomes null, and `ended` holds the summary. A reload in the fade therefore shows the summary. Closing the summary clears `ended`. The Lamp-room follows, and the next run starts in the Gaol with every foe back.
- **Run time.** It runs in play and stops in cards, in the pause panel and at the win.
- **Test hooks.** Software WebGL draws about one frame a second, so the e2e sets up each picture with hooks under `?test`: `wake(zone)`; `spawn(type, x, z, yaw)`, which uses a free pool slot and reports when there is none; `hold(foe, move, t)`, which keeps a foe at time t of a move while the rest of the game steps; `fx({ stop, flash, kick, zoom, grade, shake })`; `set({ hp, flasks, carried, bank, up })`; and `go(id)`, which moves the run to the start of a place. The explorer's `teleport`, `draw` and `stats` stay.
- **Length.** A winning run should take 8 to 15 minutes for a person. That is an estimate only, and no test checks it. The spec checks a bot measure instead: at skill 0.5, the median winning run that takes every wisp lasts 6 to 12 minutes of game time. B's flat-ground sim takes 5.7 minutes. It walks each route at 55% of run speed and takes only the wisps less than 15 m off the route. The nine wisps that it leaves are 177 m off the route in all, so going there and back at the same speed adds about 1.7 minutes, and a run that takes every wisp comes to about 7.4 minutes. That is inside 6 to 12.

### The step
The page steps the game at a fixed 1/60 s, as many steps as the frame took, up to 15 steps (0.25 s) a frame, like `public/lab/kit/loop.js`. A safe time of 0.28 s cannot be kept with steps of up to 1/30 s. The step count comes from a pure function in `run.js`, so Node tests it at 30, 60, 120 and 144 Hz. This replaces the step rule in "Speed" above, for the run and for Wander.

### The lamplighter's moves
| Hit | Wind-up | Active | Recovery | Damage | Reach | Arc | Lunge | Push on the foe |
|---|---|---|---|---|---|---|---|---|
| 1, cut | 0.10 s | 0.08 s | 0.24 s | 10 | 1.8 m | ±45° | 0.45 m | 0.4 m |
| 2, cut | 0.10 s | 0.08 s | 0.26 s | 11 | 1.8 m | ±50° | 0.45 m | 0.4 m |
| 3, finisher | 0.20 s | 0.10 s | 0.40 s | 22 | 2.1 m | ±70° | 0.8 m | 1.2 m; a light foe is knocked down for 0.6 s |

- **The string.** A press is kept for 0.15 s. The next hit can start 0.10 s into the recovery. The string starts again after 0.35 s with no hit. A full string is 43 damage in 1.26 s, about 34 a second. Holding Attack goes on with the string.
- **Reach** is from the lamplighter's centre to the foe's edge. The lunge runs through the per-body `PARAMS` copy (run = walk = v, accel 400, turnRate 0), so walls still stop it. It stops 0.25 m short of the target.
- **Time to kill, swinging only (sim):** Snuffer 4 hits, 1.54 s; Pitchrook 3 hits, 1.26 s; Mirelight 2 hits, 0.56 s; Ironback 9 hits, 3.78 s. That keeps a normal foe under the 3 s that we read from Bénard's two-second rule, scaled for our fewer kills.
- **Roll.** 0.36 s at 9.0 m/s, then the speed is cut to 4.5 m/s: 3.51 m in all. Safe from 0.02 to 0.30 s. The next roll 0.25 s after one ends. The direction is fixed at the start: the stick or keys, or straight back from the facing. It passes through foes, slides along walls, and stops at a drop of more than 3 m unless the stick pushes over. It cancels a wind-up (the hit is lost) or a recovery, never active time.
- **Plunge.** Attack with the feet 0.8 m or more over the floor: a hang of 0.08 s, then 16 m/s straight down. The landing hits within 1.6 m for 16, plus 3 a metre over 1 m, up to 28, pushes 1.5 m out, and knocks light foes down. Recovery 0.30 s. Lower, Attack does the first cut with no lunge.
- **Flask.** 2 at the start. A drink takes 0.8 s at 1.5 m/s and heals 35% of the maximum at its end. A hit or a roll stops it and keeps the flask. Every lit beacon fills all flasks, and the fifth wisp of a place fills one. Foes never drop health.
- **Hurt.** 0.25 s with no control and a push of 1.2 m (the dash method at 4.8 m/s, so walls stop it), 0.9 s safe from the moment of the hit, and a blink every 0.06 s (0.125 s with reduced motion). No damage by touch. Bodies push apart as a velocity before each step, but not during a roll.
- **Fall.** Below y −25: back on the last firm ground, the last point where the feet stood at least 1 m from a ledge, and 10 health lost, never below 1.
- **Soft aim.** Candidates are foes within 4.5 m to their edge, inside ±70° of the held direction, or ±100° of the facing with no direction, that the camera can see (the walk map's sight test from eye height 1.2 to chest height 0.9: 10,000 tests take 16 to 18 ms). The score is the distance plus 2 × the angle in radians. The current target stays while its score is within 0.75 of the best. Each hit turns up to 75° toward it. The mouse aims as the keys do.
- **No guard and no parry.** A parry needs a fifth phone button and a window that touch delay and 1 fps tests both harm. The roll answers every attack.

### The foes
Each foe is `makeBody(walk, …, {...PARAMS, radius, walk, run, accel: 18, jumpV: 0, stepUp: 0.35, turnRate: 6})`. Six bodies stepped 1,000 times take 9.5 to 15.3 ms here. A probe 0.7 m ahead (`walk.support`) stops a foe 0.62 m before a pit. A foe notices the lamplighter within 8 m with sight, or 3 m without. It chases within its leash L plus 8 m, walks home after 4 s outside, and does not heal at home. It never leaves L.

| | Snuffer (light) | Pitchrook (light, thrower) | Mirelight (light, floats) | Ironback (heavy) |
|---|---|---|---|---|
| Look | hunched, soot rags, 1.4 m, ember eyes under a hood, a 1.8 m iron snuffer pole whose cup holds the tell glow | tall and thin, 1.7 m, a beaked mask, a ragged feather cape, a pot of burning pitch, a coal in hand | a pale flame the size of a head, a fire-red core, three soot tails, 1.3 m up | broad, 1.9 m, a cracked bronze bell as a shell, fire in the crack, small head, thick arms |
| Bones | 8: body, head, legL, legR, armL, armR with the pole, shadow, tell | 10: the 8, plus the flying coal and its ring | 5: body, core (tell), tails, ring, shadow | 10: the 8, plus a lane and a ring |
| Splats (target) | 3,300 | 3,700 | 1,300 | 4,600 |
| Radius, health | 0.40 m, 50 | 0.40 m, 30 | 0.35 m, 14 | 0.70 m, 120 |
| Speed | 1.6 m/s, closes at 3.4 | 1.6, keeps 5 to 9 m, backs off under 3.5 | 2.6, flies over water and pits | 1.2 |
| Attack | hook within 3.2 m: wind-up 0.55 s (tracks at 1.2 m/s), active 0.15 s with a 1.0 m step, reach 2.2 m plus the step, ±60°, 16; recovery 0.7 s | lob from 3 to 11 m: wind-up 0.80 s, flight 0.65 s onto a ring fixed where you stood at the start, 0.2 to 1.4 m, 18; recovery 0.4 s | pulse within 2.0 m: wind-up 0.70 s, a 2.2 m ring (±1.8 m of height), 18; drifts back 3 m, again after 1.6 s; it does not die | charge from 3 to 9 m: wind-up 0.90 s, 10 m/s for 0.7 s, 24 and a 3 m push, stops dead; recovery 1.4 s. Slam within 2.8 m: wind-up 0.75 s, a 3.0 m ring, 20; recovery 1.1 s |
| Tell | the pole swings back, the cup glows, the body leans back 15°, a metal scrape | the coal arm rises, the coal glows, an ember ring grows, a rising whistle | it swells to 1.6×, the core turns white-hot, a pale ring grows, a hum from 220 to 440 Hz | two scrapes with the head low, the crack glows, an ember lane grows; for the slam, it rears up and a ring grows |
| Cooldown | 0.8 to 1.4 s | 1.6 to 2.2 s | 1.6 s | 1.0 to 1.6 s |
| Weakness | the recovery; the finisher or a plunge stops its wind-up | 30 health, cannot jump, turns slowly | two cuts or a plunge | a charge into a wall stuns it for 2.0 s and it takes +50% |
| Glim | 3 | 4 | 2 | 8 |
| From | the Gaol (alone there) | the Ramparts | the Fen | the Bells |

- **The wind-up rule.** A plain hit never stops a wind-up. The finisher and the plunge stop the wind-up of a light foe. Outside a wind-up a light foe flinches for 0.4 s, at most once every 1.5 s. Heavy foes and the boss never flinch. When every hit stopped a wind-up, B's sim showed a pack of Snuffers that never landed a hit, even on a bot that never rolled.
- **Tokens.** At most 2 melee attacks at once and 1 coal in the air. A foe without a token holds at 3.5 m and spreads round the lamplighter.
- **Off the edge.** A foe knocked more than 6 m below its zone, or under y −25, is put out and drops its glim.
- **Zones.** A zone wakes within 10 m of its centre when its foes and the awake foes together are no more than 6, and the pool has a free slot for each of its foes. "Fewer than 6 awake" alone would let a zone of 3 bring the count to 8 in the Fen, whose pool has 8 slots. Its foes rise: 0.6 s of ember cracks, then a rise of 0.9 s in which they cannot hurt or be hurt. It sleeps beyond 16 m when its foes are home, which frees its slots; a living foe keeps its health. Home spots are 1.2 m apart within 1.5 m of the centre.
- **Ember cracks.** The spark pool draws them: 24 splats for each foe, in short lines on the ground in fire slots 34 and 35 that flicker and fade. The Snuffer has no ring bone, so the cracks cannot be a bone of the foe. A zone of 3 uses 72 of the pool's 256 splats for 0.6 s.
- **Put out.** A foe put out stays out until the run ends or a reload restarts the place. The run keeps a set of foes put out for the current place only, and the save does not hold it, because a reload restarts the place.

| Place | Zones (S Snuffer, P Pitchrook, M Mirelight, I Ironback), centre and leash L | Ground in the leash | Pool |
|---|---|---|---|
| Gaol | G1 yard south (0.3, −2.29, 11.8) L 3.8 S · G2 by the cells (−5.5, −2.29, 4.5) L 4.3 SS · G3 lower lane (−3, 0.31, −6.5) L 4 SS · G5 keep, guard (2.3, 4.21, −23.8) L 3 SSS | 45 · 58 · 38 · 28 m² | 5 S |
| Ramparts | R1 (−4.3, −0.7, 11.3) L 5 SS · R2 (−1.5, −1.01, −3.8) L 5 SS · R3 west flank (−14.3, 0.18, −4.8) L 4.4 P · R4 west of the drum, guard (−18.8, 0.15, −15.3) L 5 SSP | 79 · 78 · 61 · 79 | 4 S, 1 P |
| Fen | F1 wading (4.5, −0.49, 7.6) L 3 MM · F2 east pool (7, −0.49, −3.8) L 3 SM · F3 north shore (−8.3, 1.59, −8) L 3 S · F4 mill, guard (8.3, 1.86, −18.3) L 3.5 SSP | 26 · 27 · 28 · 39 | 4 S, 3 M, 1 P |
| Bells | B1 vale (−0.5, −0.04, 12) L 4.5 I · B2 side path (9.5, 0.56, 9.5) L 3.5 SSM · B3 under the clock hill (−11.3, 0.59, 12) L 3.3 PM · B4 terrace, guard (3, 4.5, −12) L 3 SP | 63 · 38 · 34 · 17 | 3 S, 1 M, 1 P, 1 I |
| Barrows | W1 (0, 1.06, 14.3) L 5 SS · W2 hollow (1, 0.18, 3.5) L 5.5 IS · W4 before the gate (−0.5, 1.52, −4.8) L 3 PM · the arena (18, 0.68, −22) L 6.5, the boss | 78 · 95 · 28 · 133 | 3 S, 1 I, 1 P, 1 M, the boss |

The zones come from the page survey's `check-zones.mjs`. Every zone is reached from the start. The worst point in a place has 6 to 8 foes in range, but all such points are off the route, and there the cap of 6 keeps a zone asleep. The bake writes zones into `<id>.json` through a new `ctx.zone()`. So of each place's three files, `<id>.bin.gz` and `<id>.walk.bin.gz` do not change, and `<id>.json` gains `zones`. The bake is deterministic, so a test bakes a place with its zones and again without them, and checks that the two `.bin.gz` files and the two walk files are the same and that the two `<id>.json` files differ only in `zones`. This test does not depend on old hashes, so the controller fixes may still rebake the walk maps.

### The boss: the Barrow Reeve
- **Look.** 3.4 m, gaunt, a long cloak of barrow earth and roots in the place's own darks, a crown of six iron spikes that echoes the summit's six stones, a rib-cage lantern in its chest that holds a pale-green caged light (wisp slots), and a long iron crook whose hook glows fire in a wind-up. It is never brighter than the beacon fire. 12,000 splats on 17 bones: body, cloak (second-bone weights), head and crown, cage, armL, handL, armR, crook, crook tip, legL, legR, shadow, ring, lane and three shards.
- **Arena.** The east foot of the crown at (18, 0.68, −22): open radius 6.6 m, 133 m² inside a leash of 6.5 m, heights 0.22 to 1.32. It is 14.9 m from the beacon across the ground, 10.5 m below it, and it can be seen from the start. No other zone is within 25 m. There is no wall. Twelve grave candles at r 7.0 m light at the intro.
- **Intro.** The first time in a visit within 11 m: the game stops for 2.4 s, bars ease to 0.12, zoom to 1.15, and the arrival card reads "V · The keeper of the crown", "The Barrow Reeve", "It holds the light of the downs in a cage." Then the bars ease out over 0.5 s and the boss bar shows.
- **Phases.** 1,300 health: phase 1 to 800, phase 2 to 350, phase 3 to 0. At each change it stumbles for 2.0 s, takes no damage, the cage flares, and the camera kicks 0.2.

| Attack | From | When | Wind-up and tell | Hit | Recovery |
|---|---|---|---|---|---|
| Crook sweep | phase 1 | within 4.0 m and ±100° in front | 0.80 s: the crook goes back over the shoulder, the tip glows | 0.20 s, ±90°, 4.0 m, 18 | 1.0 s |
| Cage slam | phase 1 | within 3.5 m; always when you are behind it | 1.00 s: it rears up, lifts the cage, a ring grows to 3.4 m | 22, kick 0.25 | 1.5 s on one knee, ×1.5 damage |
| Lamp-shards | phase 2 | 3.5 to 9 m | 0.90 s: the cage pulses; three rings of 1.3 m, at you and 2.5 m to each side | flight 0.6 s, 14 each | 0.8 s |
| Stalking lunge | phase 2 | over 6 m | 0.70 s: it crouches with the crook forward; a lane of 1.6 × 9 m grows | 13 m/s for 0.69 s, 20, stops at the leash | 1.0 s |
| Double sweep | phase 3 | as the sweep | the sweep, then a second wind-up of 0.6 s the other way | 16 | 1.2 s |

- It picks from where the lamplighter is, which reads better than a planned pattern (Team Cherry on Silksong), and never the same attack three times in a row. Gaps: 1.0, 0.75 and 0.55 s. Walk: 1.8 m/s, 2.4 in phase 3. Largest hit 22.
- It is a test of the four tells learned on the way: the sweep is the Snuffer's hook, the shards are the Pitchrook's rings, the lunge is the Ironback's lane, and the slam is the Mirelight's ring.
- If the lamplighter leaves, the boss walks back and keeps its damage.
- **The fall and the light.** The last hit has the full hit stop of 0.15 s, the bars come in, and one white grade flash of 0.1 s shows (none with reduced motion). The boss breaks into its bone parts. The caged light, emissive boned splats on its own bone, rises and then rides at the lantern. A toast says to carry the light to the beacon. The 15.9 m walk wakes no zone: the nearest, W4, is 13.0 m from the beacon, beyond its 10 m. Touching the beacon lights it, stops the run clock, banks all glim, and shows the win card 1.8 s later.

### Glim, wicks and upgrades
- **Glim** drops as motes in the lamp colours, from the spark pool. They fly to the lamplighter from within 6 m after 0.4 s. A run holds 254: Snuffer 3, Pitchrook 4, Mirelight 2, Ironback 8, wisp 4, boss 30.
- **Wicks.** At each of the first four beacons, the seed draws two from the wicks that the run has not chosen: from 6, 5, 4 and then 3. A wick offered but not chosen can come back. So the Gaol's offer depends on the seed alone, and each later offer on the seed and the wicks chosen before it. The draw uses its own stream of the seed, so the foes' choices do not move it.

| Wick | Effect for the rest of the run |
|---|---|
| Long wick | +20 maximum health, and heal 20 now |
| Keen edge | +15% blade damage |
| Quick heels | the roll's cooldown falls from 0.25 to 0.12 s |
| Heavy fall | plunge damage ×1.5, and its ring grows from 1.6 to 2.0 m |
| Spare oil | one more flask, full |
| Close shave | an attack that passes in the roll's safe time makes the next hit within 1 s deal +50% |

- **Upgrades** in the Lamp-room, before each run and from each beacon card. A buy at a beacon works at once.

| Upgrade | Effect | Costs |
|---|---|---|
| Mantle | +15 maximum health (100 to 145) | 40 · 80 · 140 |
| Flask | +1 flask (2 to 4) | 60 · 150 |
| Edge | +12% blade damage (to +36%) | 50 · 100 · 170 |
| Draught | +10% heal for each flask (35% to 55%) | 45 · 110 |
| Ash pocket | keep 30% of the glim carried at death | 120 |

All of them cost 1,065 glim, about 4.2 full runs. The first levers to tune, in this order: Snuffer damage (14 to 17), the flask heal (35% to 50%), boss health (960 to 1,300), and a beacon heal (0% to 25%). The real-map bot decides, against the pacing targets in the spec.

### Saves and modes
- **The run's save** is its own key, `gloam-downs.run.v1`, with its own `clean()` in `run-save.js`: `{ v, bank, up: {mantle, flask, edge, draught, ash}, runs, wins, deaths, furthest, bestWin, sound, seen, wander, run, ended }`. `run` is null, or `{ seed, place, time, hp, flasks, carried, wicks, entry: {hp, flasks, carried, wicks} }`. `ended` is null, or the summary of a run that ended and whose card has not closed: `{ place, time, foes, lost, banked }`. Unknown upgrades are dropped, and levels are clamped. The save holds no foe state: a reload restarts the place, with every foe back.
- **The explorer's save**, `gloam-downs.save.v1`, and its `clean()` stay as they are. The page survey suggested we add the run to that key, but its `clean()` drops unknown fields, so a cached old page would wipe the bank and the upgrades. Two keys stop that.
- **Wander** is the explorer of today with no foes. It opens from the Lamp-room after the first win, or when the explorer's save has `done ≥ 1`, and with `?wander`. `wander: true` in the run's save opens it again after a reload. Its Map has a Lamp-room button.

### Inputs
| | Keys | Mouse | Touch | Gamepad |
|---|---|---|---|---|
| Move, walk | WASD or arrows, Shift | | stick on the left half | left stick, light tilt |
| Look | Q, E | drag with either button | drag on the right half | right stick |
| Jump | Space | | Jump | A (0) |
| Attack | J or Z | left press, at once; hold for the string until the pointer moves 6 px | Attack: tap aims, hold for the string | X (2) or RT (7) |
| Roll | K or X | | Roll | B (1) or LT (6) |
| Heal | L or C | | Heal, with the flask count | Y (3) |
| Face the foe | R | | Look | RB (5) |
| Pause | M, P or Escape | | Map | Start (9) or Back (8) |

- Attack, roll and heal take press edges from the held state, as `s.held` and `padStart` do, with a buffer of 0.15 s. A mouse press sets a latch, so a press between frames is not lost. `?test` `tick` passes held names, and an edge is a tick with the name held after one without.
- Shift still walks and gamepad button 2 now attacks. A light tilt walks, because `step` reads the stick's size.
- The mouse attacks on the press. A short-click rule (under 250 ms and 6 px) would add up to 250 ms before each swing. A left drag still turns the view, so the explorer's "a mouse drag turns the camera" holds. A left drag in a run starts with one swing; the right button looks with no swing.
- R, Look and RB face the nearest awake foe within 10 m, or look ahead as today when there is none.
- The Map and Look tools act on a tap and on a mouse click the same way: Map opens the pause panel, and Look faces the foe. A press on a tool stops there, so it does not swing the blade or start the stick or the look drag.

### Cameras in a run
- **The explorer's camera** (`makeCamera` in `play.js`) swings behind a running lamplighter after 0.8 s with no look input. Its Look requirement stays as it is. The run adds two cameras that turn the view by themselves, and in both the player's look input wins on the same step.
- **The combat camera.** While a zone is awake, the swing behind the lamplighter is replaced: after 0.8 s with no look input, the yaw turns at no more than 0.9 rad/s toward the nearest awake foe, and stops when that foe is within 20° of the view's centre. With no zone awake, the explorer's swing comes back.
- **The boss camera.** In the boss fight, the aim point is 0.35 of the way from the lamplighter to the boss, and the distance eases to 10.5 m over 1 s. After 0.6 s with no look input, the yaw turns at no more than 1.5 rad/s until the boss is within 20° of the centre. When the boss falls or the lamplighter leaves the arena, the camera eases back over 1 s.
- **Walls and hills.** Both cameras still come closer in front of a hill or a wall, as the explorer's does.
- **Reduced motion.** Neither camera turns by itself. The boss camera still aims and pulls back over 1 s, because that does not turn the view.
- Both cameras are pure functions of the camera state in `play.js`, so the Node test checks the turn rates, the 20° stop and the hand-back to look input.

### HUD and layouts
- The HUD gets a line under the place: a health bar of 120 × 10 px in ember with its number ("74/100"), and a CSS pip for each flask. The count line reads "◆ 2/5 wisps · ● 18 glim". On phones the HUD grows from 57 to 88 px tall. Above 520 px wide the hint line stays, so the HUD is taller still, and a long centred toast at `sat + 116px` would overlap it at 800×600. So the page places the toast 8 px under the HUD's measured bottom (`getBoundingClientRect`) at every width, and again when the HUD changes size. The HUD's bottom is lower than the tools' bottom in every layout, so the toast also clears the tools. The page survey measured the overlap without this move.
- The boss bar is a name and a bar. On touch it is in the Lab bar row, from x 85 to 8 px left of Games, at most 360 px wide, 44 px tall; at 320 that is about 144 px. With a fine pointer it is at the bottom centre, 520 × 44 px (at most 100vw − 32), 24 px up.
- No third button joins the tools row: at 320 it would meet the HUD, whose right edge is at 188 px. The sound switch is in the pause panel.
- Off-screen notches are small HTML shapes of our own at the screen edge, placed with the camera maths of `view.mjs` (38° field of view). At most 3.
- Touch buttons, a right-thumb group at the bottom right, measured by the page survey (x,y w×h in px). Windows 660 px tall or less use the small sizes.

| Layout | Attack | Roll | Jump | Heal |
|---|---|---|---|---|
| 320×640 | 228,480 76×76 | 160,562 60×60 | 240,564 64×64 | 168,498 48×48 |
| 360×640 | 268,480 76×76 | 200,562 60×60 | 280,564 64×64 | 208,498 48×48 |
| 390×844 | 290,664 84×84 | 214,750 64×64 | 302,756 72×72 | 226,682 52×52 |
| 800×600 touch | 708,440 76×76 | 640,522 60×60 | 720,524 64×64 | 648,458 48×48 |
| 1280×720 touch | 1180,540 84×84 | the same rules | | |

The stick keeps the left half below the HUD: 160 × 492 px at 320×640. The overlap check found no overlap with the Lab bar, the HUD, the tools, the toast or each other.

### Rendering
The run changes no renderer file and no place file. It uses the paths that the lamplighter already uses.
- **A foe file and a boss file.** A new `foes` target in `bake.mjs` sculpts each foe type once, with its own sculptor and a neutral moonlight, on its own bones. It writes `worlds/foes.bin.gz` (about 90 KB at 6.98 B a splat, an estimate) and `foes.json`: the types, splat ranges, bone names, pivots, and pose keyframes sampled from `K.acts.frames('windup' | 'attack' | 'hurt' | 'dodge')`. The boss goes in `worlds/boss.bin.gz` (about 84 KB), loaded for Barrow Crown and fetched while The Bell Knoll plays.
- **Download.** The explorer gives each place 1.5 MB, and the foe and boss files do not count toward it. Before play starts in a place, the page loads only the place's three files and, when the cache does not have it, the foe file. Today's places are 1.324 MB (Gaol) to 1.485 MB (Barrows) with their JSON, so with a foe file at its 200 KB limit no load before play is more than 1.69 MB, and the spec's limit is 1.7 MB. With the estimated 90 KB foe file, the first load of a run is about 1.41 MB. The boss file always loads after play starts: during The Bell Knoll, or after a reload in Barrow Crown while the lamplighter walks to the arena, about 51 m from the start in a straight line. The arena stays asleep until the file is in.
- **A pool in each place.** When a place loads, `world.js` adds the place's pool to `world.data`, moves the pool's bone ids after the lamplighter's 7, and parks each slot at density 0. Adding 8 copies took 10.5 ms in Node.
- **Only awake slots ride bones in the sort.** The sorter projects every splat, at density 0 too, and a boned splat costs about four times a plain one. So `world.anim.boned` holds the lamplighter and the awake slots only. A kind-12 splat that is not in `boned` sorts by its rest position. That order is wrong for a splat that draws, but a parked slot is at density 0, and the shader culls it before the bone fetch, so its order does not matter. A slot joins `boned` before its density comes back, and leaves it after its density goes to 0. Rebuilding the list is a short `Int32Array` copy. The boss slot is parked like the others until the intro, and in the boss fight the other slots are parked. Measured in "Numbers we checked": 1.39 at worst, against 1.65 with every slot on bones.
- **Colour.** Foe bodies use dark tones that are in no palette, so the resolve snaps them to each place's own darks. The renderer survey checked this in the Gaol and in Barrow Crown. Eyes and tells use the fire slots, blades the iron slots, and the Mirelight and the cage light the wisp slots. Nothing uses the cloak slots, which are the lamplighter's. The run adds no palette colour: all five places use 48 of 48. The foes pass through the same resolve, so they get the same dither, pixel snap and outlines as the places.
- **Tells and ground markers.** A tell bone carries emissive boned splats in the fire steps inside the weapon, and grows from nothing over the wind-up. Two tell bones give a flicker, because flames cannot ride bones. A ground marker is a flat boned ring or lane in fire slot 34, with its rim in slot 35, scaled from 0 to 1 over the wind-up. Slots 32 and 33 (0x3a0f0c, 0x8a2814) are not used for markers, because they are close to the dark ground. Slot 35 is brighter than 0.55, so a rim adds to the bright share. We estimate a full Ironback rim 4 m away at a few hundred art pixels, well under the 12% cap (6,900 art pixels at 320×180); the fight check measures it. Both are poses, with no upload.
- **Waking and death.** Waking sets the slot's density back: one upload of about 7 to 10 rows of 32 KB. Death breaks the foe into its bone parts, which tumble with gravity and shrink, then the slot goes to density 0. A hidden bone is scaled to 0 and moved to y −500, because a bone at scale 0 still draws a dot (`u_dilate`).
- **Hit flash.** For 0.05 s of game time (3 steps) the foe's packed colour is fire step 5, then the saved colour comes back: two uploads of its rows. A flash timed in frames would last 14 ms at 144 Hz and up to 133 ms at 30 Hz. The timing follows `K.acts.hitFlash`, and the flinch is a squash and spring on its bones after the hit recipe in Ink Studio's `k1-stage.js`.
- **Hit stop.** The simulation stops and the picture goes on. The hit foe's picture shakes ±0.04 m at 30 Hz, but its hit shape does not move. All of it runs on game time, so `?test` plays it the same. The game clock counts steps during hit stop too, and every effect (flash, tint, blink, kick, zoom, bars, grade) counts those steps.
- **Camera kick.** `world.anim.kick` along the camera's right and up vectors. Hits add trauma that falls over time, and the kick is trauma² times smooth noise: 0.03 to 0.05 on a hit landed, 0.1 when hurt, 0.2 to 0.3 for a boss slam. The renderer moves the camera, not its angle, so the kick stays small to keep the eye out of the scenery.
- **Zoom and bars.** `world.anim.zoom` 1.05 for 0.12 s on a heavy hit, 1.15 for the boss intro. `world.anim.bars` 0 to 0.12 for the intro and the last beacon.
- **Grade.** `world.anim.grade`, ported from the blends of `K.anim.show`. Low health: slots 1 to 31 pulled up to 25% toward dark red at each beat of 1.1 Hz, slots 32 to 47 untouched. Hurt: 0.05 s of game time (3 steps) of red on the slots that are not fire. The review suggested 0.04 s; that is not a whole step at 1/60 s, so we use 3 steps. Death: a fade to ink. The grade output is not snapped back to the palette, so its colours stay near palette colours.
- **Sparks and glim.** A port of `K.play.fx` (sparks, flash, ring, drops) keeps about 256 splats at the end of the data and uploads one row of 32 KB a frame.
- **Candles.** The boss file holds 12 flames of 5 splats. The page writes their base positions at the arena once and sets their density at the intro, as `setLit` does for the beacon.
- **Effects in layers.** Each effect has its own flag. The game must play with all of them off.
- **In reserve.** A draw order made by the page (`fast-sort.mjs`: 2.23 ms against 3.77 ms with no foes, 3.00 ms against 5.74 ms with 40k foe splats), if phones turn out short of CPU. A `frame.uniforms` hook proposed upstream for flashes, moving lights and burnt ground with no upload. Neither is in the first version.

**Cost.** The renderer survey measured, in SwiftShader at the phone art size (147×317): 6.9 s a frame today, 8.8 s (+27%) with 6 untrimmed foes on screen (32.6k boned splats), +10% with them hidden by bones, +15% at density 0, and +25% with a boss at 3 times its size. Our largest awake set is The Bell Knoll's 6 slots, 19.5k splats, so the picture check uses that place with all 6 slots awake on screen, and its pass is 1.30. Its base is the same view in Wander, which loads no pool, so the ratio also pays for the parked slots. In Node the sort of each place's largest awake set, with the other slots parked off the bones, is 1.27 to 1.39 times the place alone (the table in "Numbers we checked"), so the pass is 1.45 in each place. "The place alone" is the place with the lamplighter's bones and no pool, in both checks. A phone runs JavaScript perhaps 3 to 5 times slower (an estimate). A phone already near 45 ms a frame would likely drop one art size step in a fight.

### Sources
Most pages below were read through search extracts, because gamedeveloper.com, 80.lv and deepnight.net did not resolve in this session.
- **Foes on bones, pose keyframes, hit flash, flinch, sparks, grade blends:** Ink Studio, siliconjungle, https://github.com/siliconjungle/shapeshift-labs-ink-studio (commit 6a8c622): `K.bones.tag`, `K.acts.frames`, `K.acts.hitFlash`, the hit reaction in `k1-stage.js`, `K.play.fx`, `K.anim.show`.
- **Hit stop:** Masahiro Sakurai, "Thoughts on Hitstop", Famitsu column vol. 490, translated by Source Gaming, https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/. We take: longer for heavier hits up to a cap, and shake the picture, not the hit shape.
- **Camera kick:** Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math", GDC 2016, https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing. We take trauma² and smooth noise. The talk prefers a turn of the camera; our renderer has only a move, so we keep it small.
- **Effects in layers, marks that stay:** Jan Willem Nijman, "The Art of Screenshake", INDIGO 2013, https://www.gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games.
- **Squash on every event, an off switch for each effect:** Martin Jonasson and Petri Purho, "Juice It or Lose It", GDC Europe 2012, https://gdcvault.com/play/1016487/.
- **Wind-up, active and recovery; a wind-up of at least reaction time plus the answer's start:** GD Keys, "Keys to Combat Design #1: Anatomy of an Attack", 2020, https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/.
- **A ground marker and a sound for each area attack, a ring of space round the player:** "Enemy Attacks and Telegraphing", Game Developer, https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing (no author in the extract).
- **Attack tokens:** Kurt Loudy and Jake Campbell, "Embracing Push Forward Combat in DOOM", GDC 2018, https://gdcvault.com/play/1024940/Embracing-Push-Forward-Combat-in (from summaries).
- **Off-screen warnings, spacing of foes that wait:** Mihir Sheth, "Evolving Combat in 'God of War' for a New Perspective", GDC 2019, https://gdcvault.com/play/1026085/Evolving-Combat-in-God-of (from summaries). Our notch shape and colours are our own.
- **Soft aim:** Ravenwhisp, "Implementing Directional Target Selection for Player Combat", https://ravenwhisp.github.io/Ravenwhisp/blog/implementing-directional-target-selection-for-player-combat. Tap to aim on touch: Brawl Stars controls, Deconstructor of Fun, 2018, https://deconstructoroffun.com/blog/2018/5/11/bs.
- **Quiet help for the player:** Sébastien Bénard, "'Dead Cells': What the F*n!?", GDC 2019, https://www.gdcvault.com/play/1025788/-Dead-Cells-What-the; Maddy Thorson, "Celeste & Forgiveness", https://maddymakesgames.com/articles/celeste_and_forgiveness/.
- **Time to kill:** "Designing each of the 50 weapons in Dead Cells to feel distinctive", Game Developer, interview with Sébastien Bénard, https://www.gamedeveloper.com/design/designing-each-of-the-50-weapons-in-i-dead-cells-i-to-feel-distinctive.
- **One verb for each foe:** Garret Bright, "Build a Bad Guy Workshop", https://www.gamedeveloper.com/design/build-a-bad-guy-workshop-designing-enemies-for-retro-games.
- **The boss:** Mike Birkhead, "Tips from a combat designer: The art of boss design", https://www.gamedeveloper.com/design/tips-from-a-combat-designer-the-art-of-boss-design; Tom Allins, "Rule of 3 deaths in a boss fight", https://gamedeveloper.com/design/rule-of-3-deaths-in-a-boss-fight; Team Cherry on how the Silksong bosses pick attacks, GamesRadar, https://www.gamesradar.com/games/platformer/compared-to-hollow-knight-silksong-reworked-how-the-bosses-pick-their-attacks-and-suddenly-i-realize-why-i-got-crushed-so-often.
- **The boss camera:** Yoshiaki Koizumi, MIGS 2007, https://www.gamedeveloper.com/game-platforms/migs-2007-nintendo-s-koizumi-on-the-path-from-garden-to-i-galaxy-i-. We take only the idea of a camera that suits the arena: aim at the lamplighter plus 0.35 of the way to the boss, pulled back to 10.5 m, and turn at no more than 1.5 rad/s after 0.6 s with no look input.
- **The combat camera:** none fit. It is the explorer's own swing behind the lamplighter (`makeCamera` in `play.js`: after 0.8 s with no look input), pointed at the nearest awake foe.
- **Ember cracks when a zone wakes:** none fit. They are sparks from the ported `K.play.fx` pool, laid in lines on the ground.
- **Round shadows and the ground marker shape:** none fit. We keep our own boned shadow disc. The marker colours (fire slots 34 and 35) come from the review's measure of what reads on the dark ground.
- **Death into bone parts:** none fit beyond Nijman's marks that stay. It is our own.
- **A page-made draw order:** none fit. It is our own test.
- **Sound:** none fit. A few oscillator and noise envelopes in WebAudio, made in code.

### The names and the order of the places
The user asked that no name be copied from Dead Cells. The review found two things that come close, and we record them here.
- **"Crow Ramparts".** Dead Cells has a biome named Ramparts. Our name has the same word, and our run puts it second, after a prison.
- **The order.** Our first four places are a prison, a wall on the ridges, a stilt hamlet over water and a bell tower. The review compares this to a Dead Cells route through Prisoners' Quarters, Ramparts, Stilt Village and Clock Tower. The forms and the looks of our places are our own, but the chain is similar.

The five places, their names and the order are the user's decisions, so we do not change them here. We ask the user whether to keep "Crow Ramparts". A new display name only, such as "Crow Wall", keeps the id `ramparts`, the bake, the place and the look. It changes the `name` in `biomes/ramparts.mjs` and in `<id>.json`, the explorer's spec, the run's "Original names" list, and the text in the arcade. The spec's "Original names" now lists the five place names too, and its test reads them from the run's data.

### Checks
- `node qa/lab/gloam-downs-run.test.mjs`: the step at 30, 60, 120 and 144 Hz; effects in steps at 30 and 144 Hz; the string, the roll (3.3 to 3.7 m), the plunge, the drink; foe tells, tokens, leash and ledge; the wake rule with the cap and the free slots; the combat camera and the boss camera; glim, banking, death, wicks that never come back once chosen, and upgrades; the run's save with bad data, with an old explorer page, at once on a hit and at 0 health; the names list with the places; the budget (file sizes, 275,000 splats, 1.7 MB before play); the sort bench in all five places (1.45) and the foe step bench (0.5 ms).
- `node games/gloam-downs/bake.mjs <place>` with and without the zones: the `.bin.gz` and walk files are the same, and `<id>.json` differs only in `zones`.
- `node qa/lab/gloam-downs-bot.mjs <bots> <skill> <seed>`: the page's own rules on the real walk maps, 12 runs for each bot, against the pacing targets, with the run length at skill 0.5.
- `node qa/lab/gloam-downs-run.e2e.mjs`, with `?test` and the hooks `wake`, `spawn`, `hold`, `fx`, `set` and `go`, in SwiftShader: every control on keys, mouse, touch and gamepad, and the Map and Look tools; each state (play, hit, death, a reload in the death fade, run summary, Lamp-room, beacon card, pause, boss, win, Wander); the five layouts with the overlap check, the toast and screenshots; the look in a fight (luminance, bright share, the colours of the bright pixels that the foes change); the tell and marker counts in fire slots 34 to 37; reduced motion; the frame ratio in The Bell Knoll against Wander (1.30); the boss file after a reload in Barrow Crown.
- `node qa/lab/gloam-downs.e2e.mjs` checks the explorer through `?wander`.
- `node qa/arcade/quiet.mjs --only=lab/gloam-downs`: the sound starts on Begin the run and stops while hidden.

### Cut order
If time runs short, cut from the top, and change the spec to match:
1. The combat camera (remove the spec's "Combat camera" and its part of "Reduced motion").
2. The boss camera (remove "Boss camera").
3. One wick, Close shave. Five wicks stay, so the fourth beacon offers the last two. Cut no second wick. If a build ever keeps only four, the fourth beacon offers the last wick and a fixed second choice: heal to full health. A full flask refill is no choice there, because every lit beacon fills the flasks.
4. The grave candles.
5. The wicks.
6. Sound (the scrape, whistle and hum cues go; the visual tells stay).

### What this replaces
- "Speed" above: the step is now a fixed 1/60 s (see The step).
- "Not done" above: enemies, combat and sound are now in scope. Runtime point lights are still not done.
- `save.js` stays the explorer's save. The run's state is in `run-save.js`.
- The toast at `sat + 116px`: in a run and in Wander it sits 8 px under the HUD's measured bottom.

### Not checked
Nothing ran on a real phone, a real graphics card or real speakers. The frame costs are ratios in SwiftShader and Node on this machine. The pacing comes from bots, not from players. The first build must check the frame time on a real phone at 46k art pixels with 6 foes awake.
