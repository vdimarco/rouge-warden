## ADDED Requirements

### Requirement: Layers on the bar
Each place theme SHALL have the layers `amb`, `explore`, `drums`, `strings`, `guard` and `elite`. Every layer change SHALL start on a bar line of the playing theme, within 5 ms. A layer that leaves SHALL fade over one bar. `__gloam.music().layers` SHALL list the layers that play, by these names.

#### Scenario: A fight in the Gaol
- **WHEN** the e2e wakes G2 in the Gaol, lets a Snuffer start its hook, puts out G2's foes and waits 8 s
- **THEN** `changes` has `drums in`, then `strings in`, then `drums out` and `strings out`, and each `at` is on a bar line within 5 ms. Check: e2e `gloam-downs-run.sound.e2e.mjs`.

### Requirement: Drums when foes see you
When a zone wakes, the `drums` layer SHALL come in on the next bar line. When no foe is awake, or every awake foe is put out, the `drums`, `strings` and `guard` layers SHALL wait 2 s, then fade out over one bar from the next bar line. A wake in that wait SHALL keep them.

#### Scenario: Wake on the bar
- **WHEN** the Node test sends `foes-alert` 0.4 s after a bar line of the Gaol's theme (bar 2.61 s)
- **THEN** `drums in` is at the next bar line, 2.21 s later. Check: Node test `gloam-downs-sound.test.mjs`.

#### Scenario: No flapping
- **WHEN** the Node test sends `fight-calm` and then `foes-alert` 1.5 s later
- **THEN** the drums never fade out. Check: Node test `gloam-downs-sound.test.mjs`.

### Requirement: Strings when the fight starts
The `strings` layer SHALL come in on the next bar line after the first warning move or the first hit of a fight, read from the cue log. It SHALL play the place's combat strings, with a cello an octave down.

#### Scenario: A wake with no attack
- **WHEN** a zone wakes and its foes walk toward the lamplighter, but none has started an attack
- **THEN** `__gloam.music().layers` has `drums` and not `strings`. Check: e2e `gloam-downs-run.sound.e2e.mjs`.

### Requirement: The elite's drone
While an elite is awake, the `elite` layer SHALL play a hurdy-gurdy drone on the tonic and the fifth, with a buzz on each beat. It SHALL come in on the next bar line after `elite-alert`. It SHALL leave on the next bar line after `elite-fall` or `fight-calm`.

#### Scenario: The Wardmother wakes
- **WHEN** the e2e wakes the zone that holds the Wardmother
- **THEN** `layers` has `elite` from the next bar line, and it leaves on the first bar line after the Wardmother is put out. Check: e2e `gloam-downs-run.sound.e2e.mjs`.

### Requirement: The boss music builds
The boss theme SHALL have six levels. Level 1 SHALL play when the fight starts. Levels 2 to 6 SHALL start on the next bar line after the boss's health share falls to 85%, 61.5%, 45%, 26.9% and 12%. At Ember 5, level 5 SHALL start at 40%. A level SHALL never go back. `__gloam.music()` SHALL give the `level`.

#### Scenario: Six levels
- **WHEN** the e2e starts the boss fight and sets `bossHp` to 85%, 61%, 44%, 26% and 11% of its maximum, 3 s apart
- **THEN** `level` goes 1, 2, 3, 4, 5, 6, each change on a bar line, and `bpm` is higher from level 5. Check: e2e `gloam-downs-run.sound.e2e.mjs`.

### Requirement: The fall sting
When the boss falls, the score SHALL stop and the fall sting SHALL play at once: a low drum hit, a cello fall of an octave and an open fifth in the choir, 2.2 s long. The `light` theme SHALL start 2.5 s after the fall.

#### Scenario: The fall
- **WHEN** the e2e lands the boss's last hit
- **THEN** `changes` has `sting fall` within 20 ms of the fall, and `light` 2.5 s after it. Check: e2e `gloam-downs-run.sound.e2e.mjs`.

### Requirement: Instruments made offline
The bank SHALL add four instruments made by offline synthesis in Node: cello, hurdy-gurdy, low drum and frame drum. `qa/lab/gloam-downs-synth.mjs` SHALL render them, and no paid service SHALL be used. Each new instrument SHALL be 100 KB or less. Until the bank loads, or when it fails, a voice made in code SHALL play each new part.

#### Scenario: Render and size
- **WHEN** `node qa/lab/gloam-downs-synth.mjs` and then `node qa/lab/gloam-downs-bank.mjs --check` run
- **THEN** both exit with 0, and the bank lists cello, gurdy, drum-lo and drum-mid, each 100 KB or less. Check: the two scripts.

### Requirement: The event bus
`bus.js` SHALL carry these events to the run's sound: `place-enter`, `foes-alert`, `fight-calm`, `elite-alert`, `elite-fall`, `relic-take`, `boss-intro`, `boss-health`, `boss-phase`, `boss-fall`, `beacon-lit`, `run-death`, `run-win`, `lamp-room` and `combo-tier`. A listener that throws SHALL not stop the other listeners or the game.

#### Scenario: A listener throws
- **WHEN** the Node test adds a listener that throws and a second one, and emits `foes-alert`
- **THEN** the second listener runs. Check: Node test `gloam-downs-sound.test.mjs`.

### Requirement: Elites
Each place SHALL have one elite: its baked foe type at 1.25 times the size, with an ember crown of spark dabs in slot 34. When its zone wakes, a toast SHALL name it. It SHALL drop 15 glim and a relic. Its special move SHALL have a warning move of at least 0.5 s. A guard zone SHALL never hold the elite.

#### Scenario: The elite shows
- **WHEN** the e2e wakes the zone that holds a place's elite, in each of the five places
- **THEN** a toast names it, `__gloam.foes()` lists it with `elite: true` and size 1.25, and the crown's dabs use slot 34. Check: e2e `gloam-downs-run.builds.e2e.mjs`.

### Requirement: The Wardmother
The Gaol's elite SHALL be the Wardmother, a Snuffer with 120 health. Its special move SHALL be a double hook: a second hook 0.35 s after the first lands, with a second cup glow of 0.35 s, so the whole move warns for 0.9 s.

#### Scenario: Roll the second hook
- **WHEN** the bot rolls 0.2 s after the first hook of a double hook lands
- **THEN** the second hook passes in the roll's safe time. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: The Rookchief
The Crow Wall's elite SHALL be the Rookchief, a Pitchrook with 70 health. Its special move SHALL throw three coals at once, with rings of 1.2 m, 2.5 m apart, after a wind-up of 1.0 s that shows the three ring markers.

#### Scenario: Three rings
- **WHEN** the Rookchief starts its special move
- **THEN** three ring markers show on the ground for 1.0 s before the coals land. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: The Fen-wick
Lantern Fen's elite SHALL be the Fen-wick, a Mirelight with 40 health. At half health it SHALL split into two Mirelights of 14 health when two Mirelight slots are free. Otherwise it SHALL pulse twice. Each pulse SHALL warn with a white core flash of 0.5 s.

#### Scenario: A split
- **WHEN** the Fen-wick falls to 20 health with two Mirelight slots free
- **THEN** it goes out, and two Mirelights with 14 health stand in its place. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: The Bellwether
The Bell Knoll's elite SHALL be the Bellwether, an Ironback with 220 health and 90 poise. Its special move SHALL be a charge that bends once, by up to 40°, at its middle. The lane SHALL show the bend for 0.4 s before the run.

#### Scenario: The bend shows first
- **WHEN** the Bellwether starts its bent charge
- **THEN** the lane's marker shows both parts at least 0.4 s before the Bellwether moves. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: The Cairnwarden
Barrow Crown's elite SHALL be the Cairnwarden, a Snuffer with 140 health. Its special move SHALL be a sweep in a full turn, with a ring marker of 2.6 m and a wind-up of 0.8 s. A jump or a roll SHALL pass it.

#### Scenario: Jump the sweep
- **WHEN** the bot jumps 0.6 s into the sweep's wind-up, 2 m from the Cairnwarden
- **THEN** the sweep does not hit. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Relics
An elite put out SHALL drop its relic where it fell, as a small lamp in slots 46 and 47. A touch SHALL take it, with a toast "<name> · <effect>". The seed's `relic` stream SHALL draw it from the relics the run does not hold. A run SHALL hold up to 5 relics, until it ends. Relic damage SHALL take Edge and Keen edge, and SHALL round once.

#### Scenario: Take a relic
- **WHEN** the lamplighter puts out the Wardmother and walks over the lamp it drops
- **THEN** a toast names the relic, the HUD shows its mark, and `__gloam.run().relics` lists it. Check: e2e `gloam-downs-run.builds.e2e.mjs`.

### Requirement: Relics for the roll, the plunge and the flask
- Ember trail: the roll SHALL leave a 4 m line of fire for 1.5 s; a foe in it SHALL take 4 each 0.25 s, at most 12 a roll.
- Coal heel: the plunge's landing SHALL leave a burning ring of 2 m for 2 s, 5 each 0.5 s.
- Moth lamp: a drink SHALL send a 3 m pulse of 10 damage and a 2 m push.
- Tinder guard: after a near miss, the next attack within 1 s SHALL start at the finisher.

#### Scenario: Ember trail
- **WHEN** the run holds Ember trail and the lamplighter rolls through a Snuffer that stands still
- **THEN** the Snuffer takes 12 from the fire. Check: Node test `gloam-downs-builds.test.mjs`.

#### Scenario: Tinder guard
- **WHEN** the run holds Tinder guard, a hook passes in the roll's safe time, and Attack is pressed 0.5 s later
- **THEN** the finisher plays, not the first cut. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Relics for the blade
- Spark third: the finisher SHALL throw a spark 6 m ahead that deals 12 to the first foe it touches.
- Hooked cut: the first cut SHALL pull a light foe within 4 m to 1.2 m in front.
- Bellows cut: the second cut SHALL push foes 2.5 m back, and SHALL stop a light foe's wind-up.
- Echo blade: the finisher SHALL hit again 0.3 s later, in the same arc, for half damage.

#### Scenario: Echo blade
- **WHEN** the run holds Echo blade and no damage bonus, and the finisher hits a post
- **THEN** the post takes 22, and then 11 again 18 steps later. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Kindlings
When a run holds a wick and a relic of a pair, the pair SHALL kindle, and the toast and the beacon card SHALL show "Kindled". The pairs:
- Quick heels and Ember trail: the trail SHALL last 2.5 s.
- Heavy fall and Coal heel: the ring SHALL be 2.5 m and last 3 s.
- Keen edge and Spark third: the spark SHALL hit a second foe.
- Spare oil and Moth lamp: the pulse SHALL be 4.5 m.

#### Scenario: Two runs play apart
- **WHEN** one run holds Quick heels and Ember trail, and another holds Heavy fall and Coal heel
- **THEN** the first's trail lasts 150 steps, and the second's ring is 2.5 m for 180 steps. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Unlocks
The Lamp-room SHALL show an Unlocks list under the upgrades. Each unlock SHALL be bought once, with the same Buy rules as an upgrade: Ember tongue 90, Glim heart 100, Last ember 220, Wick shelf 160, Kindled flask 80, Rising cut 140 and Ember parry 200 glim. A row SHALL read "<name> · <what it gives> · <cost> glim", and "bought" once bought.

#### Scenario: Buy an unlock
- **WHEN** the bank holds 150 glim and the player buys Rising cut
- **THEN** the bank shows 10, the row reads "Rising cut · bought", and the run's help card has a line for it. Check: e2e `gloam-downs-run.builds.e2e.mjs`.

### Requirement: Wicks from unlocks
Ember tongue, Glim heart and Last ember SHALL join the wicks that a beacon can offer once bought. Ember tongue: each blade hit SHALL burn for 6 more over 2 s. Glim heart: each glim mote SHALL heal 1, up to 20 a place. Last ember: once a run, at 0 health, the lamplighter SHALL stand again with 25% health.

#### Scenario: Last ember
- **WHEN** the run has Last ember and a hit takes the lamplighter to 0 of 100 health
- **THEN** the run goes on with 25 health, and the next hit to 0 ends it. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Wick shelf
With Wick shelf, Begin the run SHALL show a card that offers two wicks, drawn by the seed's `start` stream from the wicks the run can be offered. The chosen wick SHALL burn as a beacon's wick does. The card SHALL work with keys alone, a pad alone, the mouse and touch.

#### Scenario: A starting wick
- **WHEN** the player has Wick shelf, begins a run and chooses Keen edge
- **THEN** the run starts in the Gaol with Keen edge, and no beacon card in the run offers it. Check: e2e `gloam-downs-run.builds.e2e.mjs`.

### Requirement: Kindled flask
With Kindled flask, an elite's fall SHALL fill one flask, up to the run's maximum.

#### Scenario: An elite fills a flask
- **WHEN** the run has 0 of 2 flasks and the Wardmother is put out
- **THEN** the HUD shows 1 of 2 flasks. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Rising cut
With Rising cut, Attack in the last 0.12 s of a roll, or in the 0.1 s after it, SHALL start an upward cut. It SHALL deal 14 and knock a light foe down for 0.6 s. Without the unlock, the same press SHALL start the first cut, as now. It SHALL use the Attack input of every device.

#### Scenario: Roll into a rising cut
- **WHEN** the run has Rising cut and the player presses Attack 0.05 s before a roll ends, next to a Snuffer
- **THEN** the Snuffer takes 14 and is knocked down for 36 steps. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Ember parry
With Ember parry, a melee hit that lands in the first 0.1 s of the first cut's wind-up, from a foe within 60° in front, SHALL deal no damage and stagger the foe for 1 s. The window SHALL be 6 steps, and it SHALL not open in a string. It SHALL use the Attack input of every device.

#### Scenario: A parry
- **WHEN** the run has Ember parry and the player presses Attack 3 steps before a Snuffer's hook lands, facing it
- **THEN** the lamplighter takes no damage, and the Snuffer staggers for 60 steps. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Ember levels
A win at Ember n SHALL open Ember n + 1, up to Ember 5. The Lamp-room SHALL show an Ember row with a button for each open level, and Begin the run SHALL start at the chosen level. Each level SHALL keep the rules of the levels under it and add 15% to the glim of foes and wisps, rounded down. The win card SHALL show the level and that level's best time.

#### Scenario: The first win opens Ember 1
- **WHEN** a player wins at Ember 0 and opens the Lamp-room
- **THEN** the Ember row shows Ember 0 and Ember 1, with Ember 0 chosen. Check: e2e `gloam-downs-run.builds.e2e.mjs`.

### Requirement: Ember 1 and 2
- Ember 1: the seed SHALL order places II to IV, and elites SHALL have 30% more health.
- Ember 2: foe cooldowns SHALL be 15% shorter, with every warning move kept at its length, and a run SHALL start with one flask fewer, at least 1.

#### Scenario: Ember 2 keeps the warnings
- **WHEN** the Node test runs a Snuffer at Ember 0 and at Ember 2
- **THEN** its hook's wind-up is 33 steps at both, and its cooldown is 15% shorter at Ember 2. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Ember 3 to 5
- Ember 3: each zone but a guard zone SHALL have one foe more where the pool and the cap allow, and flasks SHALL heal 10 points less.
- Ember 4: elites SHALL use their special move twice as often, and foes SHALL deal 20% more.
- Ember 5: the boss SHALL have 25% more health, and its phase 3 SHALL start at 40%.

#### Scenario: Ember 3 in the Gaol
- **WHEN** the Node test mixes the Gaol at Ember 3 for seeds 1 to 50
- **THEN** no zone has fewer foes than baked, G2 or G3 has one foe more in at least one seed, G5 keeps its 3, and every zone fits the pool. Check: Node test `gloam-downs-seed.test.mjs`.

### Requirement: Gentle shake
The camera SHALL shake only on heavy hits: the finisher, the plunge, a hit taken, a stagger, the boss slam and a phase change. A cut SHALL not shake it. The shake's offset SHALL never pass 0.15 m. It SHALL go through `world.anim.kick`, and `play.js` SHALL not change for it.

#### Scenario: The cap
- **WHEN** the Node test lands 10 boss slams in one second on the feel
- **THEN** the length of every `kick()` offset is 0.15 m or less, and a string of cuts alone gives [0, 0, 0]. Check: Node test `gloam-downs-feel.test.mjs`, and `gloam-downs-camera.test.mjs` still passes.

### Requirement: The Shake switch
The pause panel SHALL have a Shake switch that reads "Shake on" or "Shake off". Until the player presses it, Shake SHALL be off under reduced motion and on otherwise. The choice SHALL be stored at once and kept over a reload. The switch SHALL change only the shake.

#### Scenario: Reduced motion
- **WHEN** reduced motion is on and a player opens the pause panel for the first time
- **THEN** it reads "Shake off". After a press it reads "Shake on", a finisher kicks the camera, and the zoom still stays 1. Check: e2e `gloam-downs-run.feel.e2e.mjs`.

### Requirement: Poise and stagger
The Ironback SHALL have 60 poise, an elite 50, and the Bellwether 90. Each hit SHALL take its damage from the poise too. At 0 the foe SHALL stagger for 1.2 s: it stops, its wind-up ends, its crack glows in slot 33, and it takes 25% more damage. Poise SHALL fill 3 s after the last hit. A stagger SHALL not start again within 4 s of its end.

#### Scenario: Break an Ironback
- **WHEN** the lamplighter lands two strings of three hits (86 damage) on an Ironback in its wind-up
- **THEN** the Ironback staggers, its charge does not run, and `__gloam.foes()` shows `stagger` for 72 steps. Check: Node test `gloam-downs-feel.test.mjs`.

### Requirement: The combo
Each hit that lands on a foe or the boss SHALL add 1 to the combo, up to 3 for one swing. Relic hits SHALL add at most 1 each 0.25 s. The combo SHALL end on damage taken, after 3.0 s with no hit, or when the place ends. A near miss SHALL not end it. Tiers: 5 hits SHALL be tier I, 10 tier II and 20 tier III.

#### Scenario: Taken hit ends it
- **WHEN** the combo is at 12 and a hook hits the lamplighter
- **THEN** `__gloam.run().combo` is `{ n: 0, tier: 0 }`, and the summary keeps 12 as the best of the run. Check: Node test `gloam-downs-feel.test.mjs`.

### Requirement: Combo glim
A foe put out SHALL drop its glim times 1.2 at tier I, 1.5 at tier II and 2 at tier III, rounded down. Wisps and the boss's 30 SHALL not change.

#### Scenario: A Snuffer at tier III
- **WHEN** the combo is at 20 and the next hit puts out a Snuffer at Ember 0
- **THEN** 6 motes drop. Check: Node test `gloam-downs-feel.test.mjs`.

### Requirement: Combo light
At tiers I, II and III the lantern's halo SHALL show 6, 12 and 18 dabs in lamp slots 46 and 47, and `fx.lamp` SHALL be 1.15, 1.3 and 1.5. No dab SHALL use fire slot 37, so fire stays the brightest colour. Under reduced motion the halo SHALL be steady.

#### Scenario: The lamp at tier II
- **WHEN** the combo reaches 10
- **THEN** `__gloam.run().fx.lamp` is 1.3, and the halo has 12 dabs, none of slot 37. Check: e2e `gloam-downs-run.feel.e2e.mjs`.

### Requirement: The combo meter
At 2 hits or more, the HUD SHALL show the combo: "×N" in a 12 px number, a tier pip and a bar for the time left. It SHALL fade 0.4 s after the combo ends. It SHALL not overlap the HUD's other rows, the toast, the Lab bar, the tools or a touch button at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720.

#### Scenario: The meter in each layout
- **WHEN** the e2e sets the combo to 23 in each of the five layouts
- **THEN** the meter reads "×23" and overlaps nothing it must not. Check: e2e `gloam-downs-run.feel.e2e.mjs`.

### Requirement: The seed code
The pause panel and the run summary SHALL show the run's seed as a 6-letter code in Crockford base 32. `?seed=` SHALL take the code or the number. Each choice SHALL use its own stream of the seed, so one choice never moves another.

#### Scenario: Share a seed
- **WHEN** a player opens `?seed=` with the code from another run's summary, at the same Ember level and with the same unlocks
- **THEN** the foe mix, the elite's zones, the relics, the route and the offers are the same as that run's. Check: Node test `gloam-downs-seed.test.mjs`.

### Requirement: The seeded foe mix
For each zone that is not a guard zone, the arena or the Gaol's first zone, the seed SHALL redraw the foe string from the place's pool types, with its baked count. The draw SHALL be kept only when the zone fits the pool, every two zones within 20 m fit together, and the place's newest type is in a zone. Else it SHALL draw again, up to 20 times, then keep the baked string.

#### Scenario: Every seed fits
- **WHEN** the Node test mixes the five places for seeds 1 to 200 and runs the zone rules on each
- **THEN** every zone fits its pool, the cap of 6 holds, and every place has its newest type. Check: Node test `gloam-downs-seed.test.mjs` and `node qa/lab/gloam-downs-zones.mjs`.

### Requirement: The elite's zone
The seed SHALL pick the elite's zone among the zones that are not the first zone or a guard zone and can take a foe of the elite's type. The elite SHALL take the place of one foe of its type, or be added when the zone has room under the cap.

#### Scenario: Elites move
- **WHEN** the Node test picks the Gaol's elite zone for seeds 1 to 50
- **THEN** it is never G1 or G5, and both G2 and G3 are picked. Check: Node test `gloam-downs-seed.test.mjs`.

### Requirement: The seeded route
From Ember 1 the seed SHALL order places II to IV. The Gaol SHALL be first and Barrow Crown last. Below Ember 1 the order SHALL be as now. The boss files SHALL start to load in the fourth place of the route.

#### Scenario: A route at Ember 1
- **WHEN** the Node test starts runs at Ember 1 for seeds 1 to 30
- **THEN** each route starts with the Gaol and ends with Barrow Crown, and more than one order of the middle three shows. Check: Node test `gloam-downs-seed.test.mjs`.

### Requirement: The guard's second wave
When every foe of a guard zone is put out, a second wave SHALL rise 1.5 s later at the same spots, with the ember cracks first. It SHALL have the guard's baked foes less the first one, at least one. The arena SHALL have no second wave.

#### Scenario: The Gaol's keep
- **WHEN** the lamplighter puts out G5's three Snuffers
- **THEN** two Snuffers rise 1.5 s later, and the beacon stays dark until they are put out. Check: Node test `gloam-downs-foes.test.mjs`.

### Requirement: Test hooks for builds and feel
With `?test`, `__gloam.run()` SHALL also give `relics`, `unlocks`, `ember`, `route`, `seedCode`, `combo` (`{ n, tier, left }`) and `fx.lamp`. `__gloam.set(fields)` SHALL also set `relics`, `unlocks`, `ember` and `combo`. `__gloam.foes()` SHALL give `elite`, `size`, `poise` and `stagger` for each foe. `__gloam.music()` SHALL give `level`.

#### Scenario: Set a build
- **WHEN** a test sets the relics to Ember trail and the wicks to Quick heels
- **THEN** `__gloam.run()` shows both, and the HUD shows the relic's mark with "Kindled". Check: e2e `gloam-downs-run.builds.e2e.mjs`.

## MODIFIED Requirements

### Requirement: A run through the five places
Gloam Downs SHALL open in a combat run through the five places. Below Ember 1 the order SHALL be The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown; from Ember 1 "The seeded route" applies. A run SHALL start with 100 health plus 15 for each Mantle level, and 2 flasks plus 1 for each Flask level, less Ember 2's flask. Both SHALL be full, and no glim SHALL be carried. The Map SHALL not travel in a run.

#### Scenario: First visit
- **WHEN** a visitor opens `/lab/gloam-downs/` for the first time
- **THEN** the help card shows the run's controls. After Begin the run, the lamplighter stands at the start of The Sunken Gaol with 100 health and 2 flasks. Check: e2e `gloam-downs-run.screens.e2e.mjs`, and `gloam-downs-clicks.e2e.mjs fight` with no mode in the address.

#### Scenario: Later visit
- **WHEN** a visitor who was not in Wander, and has no run in progress, opens the page
- **THEN** the Lamp-room shows over the start view of The Sunken Gaol, with Begin the run focused and Explore beside it until Wander opens. Check: e2e `gloam-downs-run.screens.e2e.mjs`, and `gloam-downs-clicks.e2e.mjs fight`.

#### Scenario: The order holds
- **WHEN** at Ember 0 the lamplighter lights the beacon of The Crow Wall and chooses Walk on
- **THEN** Lantern Fen loads next. The pause panel shows the Gaol and The Crow Wall as passed, and Lantern Fen as the current place. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Glim
Foes and wisps SHALL drop glim as motes in the lamp colours that fly to the lamplighter from within 6 m after 0.4 s. A Snuffer SHALL drop 3, a Pitchrook 4, a Mirelight 2, an Ironback 8, an elite 15, a wisp 4 and the boss 30, before the combo and Ember factors. In a run, a wisp SHALL go out when touched, and count for that run only. The HUD SHALL show the glim carried.

#### Scenario: Pick up glim
- **WHEN** at Ember 0, with no combo, the lamplighter puts out a Snuffer and stands 3 m away
- **THEN** three motes fly to it, and the glim carried goes up by 3. Check: Node test `gloam-downs-foes-ai.test.mjs`, and e2e `gloam-downs-run.fight.e2e.mjs`.

#### Scenario: Take a wisp
- **WHEN** the lamplighter touches its fifth wisp of The Sunken Gaol in a run, with 1 of 2 flasks
- **THEN** the wisp goes out, the glim carried goes up by 4, and the flasks show 2 of 2. The explorer's save does not change. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Beacons in a run
In each place before Barrow Crown, one guard zone SHALL keep the beacon dark until its foes and its second wave are put out. Other zones MAY be passed. A lit beacon SHALL bank the glim carried, with every mote dropped and not taken counted as carried, and fill every flask, or one flask at Ember 5. It SHALL then save the run at the start of the next place, and show the beacon card.

#### Scenario: Guards still stand
- **WHEN** the lamplighter touches the Gaol's beacon while the keep's second wave stands
- **THEN** the beacon stays dark. A toast says "The beacon will not catch while its keepers stand in the keep." Check: e2e `gloam-downs-run.fight.e2e.mjs`.

#### Scenario: Run past a zone
- **WHEN** the lamplighter runs past the first two zones of The Crow Wall, puts out the guards and their second wave, and touches the beacon
- **THEN** the beacon lights, the glim carried is banked, and the flasks are full. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Ash pocket at death
A death SHALL bank 25% of the glim carried, rounded down, or 55% with Ash pocket. The summary SHALL show the rest as lost, and its glim banked SHALL include the part kept.

#### Scenario: Cinders keep 25%
- **WHEN** the lamplighter dies in the Gaol with 20 glim carried, no Ash pocket and no glim banked before in this run
- **THEN** the summary shows 5 glim banked and 15 lost, and the bank goes up by 5. Check: Node test `gloam-downs-builds.test.mjs`.

#### Scenario: Ash pocket keeps 55%
- **WHEN** the same death has Ash pocket
- **THEN** the summary shows 11 glim banked and 9 lost. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: The Lamp-room
The Lamp-room SHALL show the glim banked, the five lasting upgrades, the Unlocks list and, after a first win, the Ember row. Each row SHALL show its level or "bought" and the next cost. Buy SHALL spend the cost. Buy SHALL be off when the bank holds less, say how much more is needed, and stay focusable (`aria-disabled="true"`). Begin the run SHALL start a new run at the chosen Ember level. Wander SHALL show once open, and Explore until then.

#### Scenario: Buy an upgrade
- **WHEN** the bank holds 50 glim and the player buys Mantle
- **THEN** the bank shows 10 and Mantle shows level 1. The next run starts with 115 health. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

#### Scenario: Not enough glim
- **WHEN** the bank holds 30 glim
- **THEN** the Flask upgrade's Buy button and every unlock's Buy button are off, and each says how much more glim is needed. Check: Node test `gloam-downs-run.test.mjs` and e2e `gloam-downs-run.cards.e2e.mjs`.

#### Scenario: The Lamp-room fits
- **WHEN** the Lamp-room shows every row and the Ember row at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720
- **THEN** every button is reachable by scroll inside the card, with keys alone and with a pad alone, and the card does not cover the Lab bar. Check: e2e `gloam-downs-run.builds.e2e.mjs`.

### Requirement: The upgrade rows
Each upgrade row SHALL read "<name> <next level> · <what it gives> · <cost> glim", as "Mantle 1 · +15 health · 40 glim". An upgrade of one level SHALL have no level number. Each row SHALL show its level as filled pips. Mantle SHALL give "+15 health", Flask "+1 flask", Edge "+12% blade damage", Draught "heal 45%" and then "heal 55%", and Ash pocket "keep 55% of glim".

#### Scenario: The rows of a new bank
- **WHEN** the Lamp-room shows with no upgrade bought
- **THEN** the rows read "Mantle 1 · +15 health · 40 glim", "Flask 1 · +1 flask · 60 glim", "Edge 1 · +12% blade damage · 50 glim", "Draught 1 · heal 45% · 45 glim" and "Ash pocket · keep 55% of glim · 120 glim". Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The lasting upgrades
The Lamp-room SHALL sell five upgrades:
- Mantle: 15 more maximum health a level, at 40, 80 and 140 glim.
- Flask: one more flask a level, at 60, 150 and 260 glim.
- Edge: 12% more blade damage a level, at 50, 100 and 170 glim.
- Draught: each flask heals 10 more points of the maximum health a level (35%, then 45% and 55%), at 45 and 110 glim.
- Ash pocket: a death keeps 55% of the glim carried, not 25%, at 120 glim.

#### Scenario: All upgrades
- **WHEN** a player has bought every level and plays at Ember 0
- **THEN** a run starts with 145 health and 5 flasks. Each flask heals 55%, the blade deals 36% more, and a death keeps 55% of the glim carried. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Names of wicks and upgrades
The names SHALL be these, all original:
- wicks: Long wick, Keen edge, Quick heels, Heavy fall, Spare oil, Close shave, Ember tongue, Glim heart, Last ember;
- upgrades: Mantle, Flask, Edge, Draught, Ash pocket;
- unlocks: the last three wicks, Wick shelf, Kindled flask, Rising cut, Ember parry;
- relics: Ember trail, Spark third, Coal heel, Hooked cut, Bellows cut, Moth lamp, Tinder guard, Echo blade;
- elites: the Wardmother, the Rookchief, the Fen-wick, the Bellwether, the Cairnwarden.

#### Scenario: Names
- **WHEN** the Node test reads the wicks, upgrades, unlocks, relics and elites in the run's data
- **THEN** there are nine wicks, five upgrades, seven unlocks, eight relics and five elites, with these names and no others. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Hit feel
The game SHALL stop for a short hit stop on each hit, while the picture goes on: 3 steps for a cut, 2 for a relic hit, 5 for the finisher, the plunge and a hurt lamplighter, 6 for the boss slam, and 9 for a phase change and death. Hit stop SHALL not exceed 9 steps in any 30 steps. A hit foe SHALL flash for 3 steps and shake in the picture only. The camera SHALL shake as "Gentle shake" says.

#### Scenario: A cut lands
- **WHEN** a test ticks one step at a time, and draws after each step, while the first cut hits a Snuffer
- **THEN** `__gloam.run().stop` shows the game held for 3 steps. The Snuffer is fire-bright on the 3 steps from the hit and not on the 4th, as its `flash` in `__gloam.foes()` shows, and `fx.kick` stays [0, 0, 0]. Check: e2e `gloam-downs-run.look.e2e.mjs`.

#### Scenario: Effects off
- **WHEN** the e2e turns off every feel effect with `__gloam.fx`, and plays 30 s of the Gaol
- **THEN** the run plays, and the lamplighter puts out a Snuffer. Check: e2e `gloam-downs-run.look.e2e.mjs`.

### Requirement: Reduced motion
When the system asks for reduced motion, the camera SHALL not zoom or turn by itself, and it SHALL not shake until the player turns Shake on. The hurt blink SHALL change every 8 steps. The flash at the boss's fall SHALL not show. A hit foe SHALL not shake. The low health tint SHALL stay at 15% with no pulse. The health bar SHALL show a steady fire edge. The lamp halo SHALL be steady.

#### Scenario: Reduced motion
- **WHEN** the e2e turns reduced motion on and runs a hit, a boss slam and the boss intro, then 3 s with an awake foe at 60° to the side and no look input
- **THEN** `fx.kick` stays [0, 0, 0] and `fx.zoom` stays 1 all through, and the view does not turn by itself. The blink changes every 8 steps, and the hit foe does not shake. Check: e2e `gloam-downs-run.look.e2e.mjs`.

### Requirement: Pause
The pause panel SHALL stop the game. It SHALL show the five places of the run in its route with the current one marked, the run time, the seed code, Resume, Sound, Music, Shake, Back to the start and End the run, in that focus order. End the run SHALL ask again, and then end the run as a death does. M, P, Escape, Resume, Start, the pad's Back button and B SHALL close it.

#### Scenario: Pause and resume
- **WHEN** the player presses P in a fight and then Escape
- **THEN** no foe moves while the panel shows. After Escape, the fight goes on from where it stopped. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: The panel fits
- **WHEN** the pause panel shows at 320 by 640 and 800 by 600
- **THEN** every switch and button is inside the screen with no scroll. Check: e2e `gloam-downs-run.feel.e2e.mjs`.

### Requirement: Saved run
The run SHALL save under `gloam-downs.run.v2`. When no v2 save exists, the page SHALL read `gloam-downs.run.v1` once. The save SHALL hold the bank, the upgrade levels, the unlocks, `ember`, `emberTop`, the best time for each level, the best combo, runs, wins, deaths, the furthest place, and the Sound, Music and Shake settings. The page SHALL check each field. A run SHALL not change the explorer's save. No store SHALL throw.

#### Scenario: Bad run save
- **WHEN** the run save holds wrong types, unknown upgrades, unknown unlocks, or an Ember level over `emberTop`
- **THEN** the page drops the bad fields and starts as normal. Check: Node test `gloam-downs-builds.test.mjs`.

#### Scenario: From v1
- **WHEN** only a v1 save exists, with 300 glim and Mantle at level 2
- **THEN** the page starts with 300 glim and Mantle 2, and stores v2. A later v1 write by a cached page does not change v2. Check: Node test `gloam-downs-builds.test.mjs`.

#### Scenario: Site data blocked
- **WHEN** the browser blocks site data, and the player begins a run and takes a hit
- **THEN** the run plays on with the hit's damage taken, and the page shows no error. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: The run in the save
The save SHALL also hold the run in progress: its seed, route, Ember level, place, time, health and flasks, the glim carried and banked in this run, the foes put out, the wicks, any wick offer not yet chosen, the relics, the elites put out, the best combo, whether the boss is down, and the entry values. It SHALL hold the summary of an ended run, or of a win, until its card closes.

#### Scenario: A run in the save
- **WHEN** a run at Ember 1 in Lantern Fen holds Ember trail, has banked 30 glim and put out 7 foes, and the page stores it
- **THEN** a load of the save gives back the route, the place, Ember trail, 30 glim banked, 7 foes and the entry values. Check: Node test `gloam-downs-builds.test.mjs`.

### Requirement: Pacing
A bot SHALL check the run with the page's own rules on the real walk maps, against these targets:
- Skill 0.3: the first run SHALL reach The Crow Wall in half the bots or more, and the median first win SHALL be in run 5 to 10.
- Skill 0.5: the median first win SHALL be in run 3 to 6, and the median boss fight SHALL last 50 to 110 s.
- Skill 0.9: the median first win SHALL be in run 1 or 2, and an Ember 0 win that takes every wisp and fights every zone SHALL last 20 to 30 minutes of game time.

#### Scenario: Bot runs
- **WHEN** `node qa/lab/gloam-downs-bot.mjs 60 0.3 1` runs, and the same command at skill 0.5 and at skill 0.9
- **THEN** each pacing target holds, or design.md says which target misses and why, and the user is told. Check: the bot, `gloam-downs-bot.mjs`.

### Requirement: Music for each place
Each of the five places and the Lamp-room SHALL have its own theme in the dark dusk mood. A cello SHALL carry each place's explore melody. The Crow Wall and Barrow Crown SHALL have a hurdy-gurdy. The Bell Knoll SHALL lead with bells, and Lantern Fen SHALL have water and a reed. Each theme's bar SHALL be 1.9 to 3.0 s. No melody, motif or sound SHALL come from another game.

#### Scenario: A theme in each place
- **WHEN** the e2e begins a run in The Sunken Gaol and the arrival card closes, and the Node test plays each place's theme
- **THEN** `__gloam.music()` gives `state: 'place'`, the place's id, and `layers: ['explore']`. Each theme has a bar of 1.9 to 3.0 s, and its explore layer has a `cello` part. Check: e2e `gloam-downs-run.sound.e2e.mjs` and Node test `gloam-downs-sound.test.mjs`.

### Requirement: The combat layer
A place's fight music SHALL be the `drums`, `strings` and `guard` layers, as "Drums when foes see you" and "Strings when the fight starts" say. A guard zone SHALL add the `guard` part on the next bar line after it wakes. The old name `combat` SHALL not show in `__gloam.music().layers`.

#### Scenario: A guard wakes
- **WHEN** the e2e wakes G5 in the Gaol
- **THEN** `layers` has `drums` and `guard` from the next bar line, and not `combat`. Check: e2e `gloam-downs-run.sound.e2e.mjs`.

### Requirement: The boss's music
The boss intro SHALL stop the place's theme, give one bar of silence and then the boss's drone. The boss theme SHALL start on the next bar line after the boss bar shows, and build as "The boss music builds" says. A phase change SHALL play its hit at once. At the boss's fall the score SHALL stop and the fall sting SHALL play, as "The fall sting" says.

#### Scenario: Three phases
- **WHEN** the e2e runs the boss intro, sets `bossHp` to 700, waits 3 s, sets it to 300, waits 3 s, then lands the last hit
- **THEN** `__gloam.music()` gives `boss` with phase 1, then 2, then 3, each change on a bar line within the 120 steps of its stumble, and a higher `bpm` in phase 3. After the fall, `changes` has `sting fall`. Check: e2e `gloam-downs-run.sound.e2e.mjs`.

### Requirement: The sampled bank
The music's samples SHALL be FluidR3_GM notes (harp, strings, contrabass, flute, choir and timpani), copied with their license note, and the four instruments made offline. The bank SHALL be 800 KB or less. It SHALL load only after the press that starts the sound, and it SHALL not count toward a place's 1.5 MB or the 1.7 MB before play. Until it loads, or when it fails, voices made in code SHALL play each part.

#### Scenario: The bank's size and load
- **WHEN** the e2e opens `?run` and records the requests before and after the first press
- **THEN** no file of `audio/` loads before the press, the files of `audio/` come to 800 KB or less, and `audio/README.md` holds the license note and says how the four new instruments were made. Check: e2e `gloam-downs-run.sound.e2e.mjs` and Node test `gloam-downs-run.test.mjs` (the budget).

#### Scenario: The bank fails
- **WHEN** the e2e makes every `audio/` request fail and wakes a zone
- **THEN** the score plays with its voices made in code, `__gloam.music().state` is `place` with the `drums` layer, and the page shows no error. Check: e2e `gloam-downs-run.sound.e2e.mjs`.
