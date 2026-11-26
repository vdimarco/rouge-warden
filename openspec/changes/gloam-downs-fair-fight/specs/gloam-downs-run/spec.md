## ADDED Requirements

### Requirement: Foe weights
Each foe SHALL have a weight. The Pitchrook and the Mirelight SHALL be light, the Snuffer medium, and the Ironback heavy. Every elite SHALL count as heavy for hits, whatever its type. The Barrow Reeve SHALL have its own rule. A light or medium foe SHALL have a hit stun: the Snuffer 0.35 s, the Pitchrook 0.45 s and the Mirelight 0.5 s. Its knock back SHALL be 0.4 m, 0.6 m and 0.8 m.

#### Scenario: The weights in the table
- **WHEN** the Node test reads `TYPES` and the elites in `foes.js` and `elites.js`
- **THEN** S is medium with 21 steps of stun, P light with 27, M light with 30, I heavy, and each elite heavy. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: A hit interrupts
A blade hit, a plunge and a hit of Lantern bomb, Moth wisp, Crook line or Ember snare SHALL make a light or medium foe flinch for its hit stun. In its wind-up, the attack SHALL be cancelled: no blow, no ring, no coal. The foe SHALL give back its token and wait 0.6 s after the stun before a new wind-up. Burn and pitch ticks SHALL not interrupt. The Ember parry and knock-downs SHALL work as before.

#### Scenario: Cut into a hook
- **WHEN** a Snuffer in the Gaol starts its hook 1.6 m in front of the lamplighter, and the player presses Attack 0.2 s later, with keys, mouse, pad or touch
- **THEN** the first cut lands in the wind-up, the hook does not land, `__gloam.foes()` shows the Snuffer with no move and 21 steps of stun, and the lamplighter's health does not change in the next 1.0 s. Check: Node test `gloam-downs-fair.test.mjs`, and e2e `gloam-downs-run.interrupt.e2e.mjs`.

#### Scenario: The wait after a cancel
- **WHEN** a Snuffer's hook is cancelled and no further hit lands
- **THEN** its next wind-up starts no sooner than 57 steps (0.35 s stun and 0.6 s wait) after the cancel. Check: Node test `gloam-downs-fair.test.mjs`.

#### Scenario: A coal never thrown
- **WHEN** a cut lands on a Pitchrook 0.5 s into its lob
- **THEN** no coal flies, its ring goes from the ground, and the coal token is free for another Pitchrook. Check: Node test `gloam-downs-fair.test.mjs`.

#### Scenario: Ticks do not interrupt
- **WHEN** a Snuffer stands in Pitch pour and winds up its hook
- **THEN** the pool's ticks hurt it, and the hook still lands unless a hit interrupts it. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: Hits in every state
A hit on a light or medium foe outside its wind-up SHALL flinch it too. While it chases or circles, it SHALL stop for its hit stun and take its knock back. In its active time the blow SHALL go on and may land, and the hit SHALL add 0.2 s to the recovery. In its recovery, each hit SHALL add 0.2 s to the recovery, at most 0.4 s a move.

#### Scenario: A blow already falling
- **WHEN** a cut lands on a Snuffer in the active time of its hook, with the lamplighter in reach
- **THEN** the hook can still hit, and the Snuffer's recovery is 0.9 s, not 0.7 s. Check: Node test `gloam-downs-fair.test.mjs`.

#### Scenario: Hits in recovery
- **WHEN** three cuts land on a Snuffer in its recovery
- **THEN** its recovery is 1.1 s (0.7 s and at most 0.4 s more). Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: The brace
A light or medium foe that flinches three times within 3 s SHALL be braced for 1.0 s, counted while it stands. A cancel and a knock-down SHALL each count as a flinch. A braced foe SHALL take damage and its knock back, but SHALL not flinch, and a wind-up it starts braced SHALL not be cancelled by a plain hit. The finisher and the plunge SHALL still knock it down. A braced foe SHALL show the armor glow.

#### Scenario: No endless flinch
- **WHEN** a bot with seed 7 turns to the nearest of three Snuffers with 500 health each and swings for 10 s, with no pause and no roll
- **THEN** at least 2 hooks hit the lamplighter, and each came from a braced Snuffer or one the bot had not hit in the second before. Check: Node test `gloam-downs-fair.test.mjs`.

#### Scenario: The third flinch
- **WHEN** cut1, cut2 and the finisher land on a Snuffer within 1 s
- **THEN** after the knock-down, `__gloam.foes()` shows it braced for its 1.0 s, and it glows. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: Armor that shows
A heavy foe SHALL show a rim of cold dabs in palette slot 39 round its body, one dab for each 10 poise left, rounded up, so the rim thins as the poise drains. In an armored wind-up the rim SHALL double and brighten over the wind-up. No armor dab SHALL use a fire slot (34 to 37) or the lamp's slots (46 and 47). With reduced motion the rim SHALL not pulse.

#### Scenario: The rim drains
- **WHEN** an Ironback with 40 poise takes 21 damage
- **THEN** its rim goes from 4 dabs to 2, in slot 39. Check: Node test `gloam-downs-fair.test.mjs`.

#### Scenario: The armor in every layout
- **WHEN** an Ironback winds up its charge in view at 320 by 640, 390 by 844, 360 by 640, 800 by 600, 1280 by 720 and 844 by 390
- **THEN** the draw holds 8 armor dabs in slot 39 round it, and none in slots 34 to 37. Check: e2e `gloam-downs-run.interrupt.e2e.mjs`.

### Requirement: Armored attacks
The Ironback's charge, the Bellwether's bent charge, the Cairnwarden's sweep and the Wardmother's second hook SHALL be armored. In an armored wind-up a hit SHALL not cancel the attack. Its poise SHALL still wear, and a poise break SHALL still cancel it. A braced light or medium foe's wind-up SHALL also be armored.

#### Scenario: Cut into a charge
- **WHEN** one cut lands on an Ironback in its charge wind-up
- **THEN** the charge runs, and the Ironback's poise is 20 lower. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: The Reeve's poise
The Barrow Reeve SHALL have 150 poise. Every hit SHALL wear it. At 0 the Reeve SHALL flinch for 1.0 s: a wind-up is cancelled, and a move in its active time ends when that time does. A break SHALL come at most once every 8 s, never in a stumble or the intro. Poise SHALL fill 4 s after the last hit. The boss bar SHALL show the poise as a thin line under the health.

#### Scenario: Break the Reeve
- **WHEN** a test lands hits of 150 in all on the Reeve in the wind-up of its cage slam, 9 s after its last break
- **THEN** the slam does not land, `__gloam.foes()` shows the Reeve's flinch for 60 steps, and its poise line is full again 4 s after the last hit. Check: Node test `gloam-downs-boss.test.mjs`.

#### Scenario: The poise line fits
- **WHEN** the boss bar shows at 320 by 640, 390 by 844, 360 by 640, 800 by 600, 1280 by 720 and 844 by 390
- **THEN** the poise line sits under the health inside the bar and overlaps no control. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: Interrupt feel
A cancel or a poise break SHALL give a hit stop of 5 steps, inside the cap of 9 steps in any 30. It SHALL play the new cue `snap`, a dry knock with a short crackle, once a step at most. It SHALL throw a burst of sparks in slot 35 at the foe's chest, and add 0.06 to the camera kick. A plain flinch outside a wind-up SHALL keep the cut's own feel.

#### Scenario: The snap
- **WHEN** a cut cancels a Snuffer's hook
- **THEN** `__gloam.run().stop` holds the game for 5 steps, and the cue log has `snap` with the foe's type. Check: e2e `gloam-downs-run.interrupt.e2e.mjs`, and Node test `gloam-downs-sound.test.mjs`.

#### Scenario: Snap in the demo
- **WHEN** `qa/lab/gloam-downs-music-demo.mjs cues` runs
- **THEN** it renders `snap`, and its loudness is in the targets of the other hit cues. Check: the music demo.

### Requirement: Interrupts with reduced motion
With reduced motion, an interrupt SHALL add no camera kick and the stunned foe SHALL not shake. The hit stop, the knock back, the flinch pose, the sparks and the `snap` SHALL stay, and the armor rim SHALL hold still.

#### Scenario: Reduced motion
- **WHEN** the e2e turns reduced motion on and cancels a Snuffer's hook, then watches an Ironback wind up its charge
- **THEN** `fx.kick` stays [0, 0, 0], the Snuffer's `shake` is [0, 0, 0], the flinch pose is drawn, and the rim's dabs keep their size over the wind-up. Check: e2e `gloam-downs-run.interrupt.e2e.mjs`.

### Requirement: Blow spacing
The hits of any two foe attacks on the lamplighter SHALL be at least 0.6 s apart: a melee blow's first active step, or a coal's landing. A foe whose blow would come sooner SHALL wait to start its wind-up. After a foe hurts the lamplighter, no foe SHALL start a wind-up for 1.0 s.

#### Scenario: Two Snuffers
- **WHEN** at depth 2 two Snuffers and a Pitchrook fight a lamplighter who stands still for 30 s
- **THEN** no two blows' first active steps or landings are under 36 steps apart, and no wind-up starts in the 60 steps after a hurt. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: Backing off
A foe that hurts the lamplighter SHALL step back 1.0 m over 0.4 s, and SHALL wait at least 1.2 s before its next wind-up. Foes that wait for a token SHALL circle the lamplighter at 0.8 m/s, 3.2 to 3.8 m away, and keep their spread.

#### Scenario: A hook lands
- **WHEN** a Snuffer's hook hurts the lamplighter
- **THEN** in the next 24 steps the Snuffer moves 1.0 m away, ±0.2 m, and its next wind-up starts no sooner than 72 steps after the hit. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: Tells from off screen
A foe whose chest is outside the view SHALL start a wind-up only with its tell cue played at its start, panned to its side and never dropped by the cue limit. Its wind-up SHALL be 0.25 s longer, and its notch SHALL show. A foe that cannot play its tell SHALL wait. With the sound off, the notch and the longer wind-up SHALL stay.

#### Scenario: A Snuffer behind the camera
- **WHEN** a test at 390 by 844 narrows the view and spawns a Snuffer 2.4 m to the right of the lamplighter, outside it
- **THEN** its hook's wind-up lasts 48 steps, the cue log has `scrape` marked off screen at its first step, a notch shows at the right edge, and with the voice limit full of hit cues the tell still gets a voice. Check: e2e `gloam-downs-run.interrupt.e2e.mjs`, Node tests `gloam-downs-fair.test.mjs` and `gloam-downs-sound.test.mjs`.

### Requirement: Foe growth with sparks
At load, each foe's health SHALL be ×(1 + 0.03 s) and its damage ×(1 + 0.015 s), where s is the sparks the run holds, counted up to 12. The Barrow Reeve SHALL keep its own 5% a spark. A spark SHALL give the lamplighter more than the foes gain from it.

#### Scenario: Eight sparks
- **WHEN** a run with 8 sparks loads The Fen at Ember 0, depth 2
- **THEN** a Snuffer has 100 health (50 × 1.15 × 1.4 × 1.24, rounded) and its hook deals 24 (16 × 1.1 × 1.2 × 1.12, rounded). Check: Node test `gloam-downs-fair.test.mjs`.

#### Scenario: A spark is worth it
- **WHEN** the Node test compares a run before and after one Flame spark, and one Ward spark, at each depth
- **THEN** the hits a Snuffer takes to go out do not rise after Flame, and the hooks the lamplighter takes to go down do not fall after Ward. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: More foes before more damage
From depth 2, each zone the mix may change SHALL get one foe more when the pool and the cap of 6 allow, and a zone of 3 or more foes SHALL hold two kinds or more when the pool has them. Ember 3's extra foe SHALL apply from depth 0, at most one extra foe a zone. The Gaol's first zone SHALL keep its one Snuffer.

#### Scenario: The mix grows
- **WHEN** `gloam-downs-seed.test.mjs` mixes seeds 1 to 200 at Ember 0
- **THEN** zones at depth 2 to 4 hold on average more foes than as baked, every zone of 3 or more foes at those depths holds two kinds when its pool does, and every mix still fits. Check: Node test `gloam-downs-seed.test.mjs`, and `qa/lab/gloam-downs-zones.mjs`.

### Requirement: Test hooks for interrupts
With `?test`, `__gloam.foes()` SHALL also give each foe's `weight`, `stun` (steps left), `braced` (steps left), `poise`, `armor` (true in an armored wind-up) and `cancels`. `__gloam.run().tokens` SHALL give `{ melee, max, coal, wait }`, where `wait` is the steps before any foe may start a wind-up.

#### Scenario: Read the tokens
- **WHEN** a test in The Crow Wall spawns two Snuffers 2 m away and ticks until one winds up
- **THEN** `tokens` shows `melee` 1 of `max` 1, and the other Snuffer circles with no move. Check: e2e `gloam-downs-run.interrupt.e2e.mjs`.

## MODIFIED Requirements

### Requirement: Hits on foes
A hit SHALL follow the foe's weight ("Foe weights"): a light or medium foe flinches and its wind-up is cancelled ("A hit interrupts"), unless it is braced; a heavy foe and an elite lose poise and do not flinch until it breaks; the Reeve flinches only at a poise break. The finisher and the plunge SHALL knock a light or medium foe down. Heavy foes SHALL take no knock back.

#### Scenario: Finisher stops a hook
- **WHEN** the finisher lands on a Snuffer that is not braced, during its hook's wind-up
- **THEN** the Snuffer is knocked down for 0.6 s, and the hook does not land. Check: Node test `gloam-downs-foes-ai.test.mjs`.

#### Scenario: An elite holds
- **WHEN** one cut lands on the Wardmother as it chases
- **THEN** it does not flinch and its poise is 10 lower. Check: Node test `gloam-downs-fair.test.mjs`.

### Requirement: Poise and stagger
The Ironback SHALL have 40 poise, an elite 40, and the Bellwether 70. Each hit SHALL take its damage from the poise, twice over in a wind-up. At 0 the foe SHALL stagger for 1.2 s: it stops, its wind-up ends, its crack glows in slot 33, and it takes 25% more damage. Poise SHALL fill 3 s after the last hit. A stagger SHALL not start again within 4 s of its end.

#### Scenario: Break an Ironback
- **WHEN** cut1 and cut2 land on an Ironback in its charge wind-up
- **THEN** the Ironback staggers on cut2 (20 and then 22 off its 40 poise), its charge does not run, and `__gloam.foes()` shows `stagger` for 72 steps. Check: Node test `gloam-downs-feel.test.mjs`.

#### Scenario: One string outside a wind-up
- **WHEN** cut1, cut2 and the finisher land on a walking Ironback
- **THEN** it staggers on the finisher (43 damage against 40 poise). Check: Node test `gloam-downs-feel.test.mjs`.

### Requirement: Fair crowds
At most one melee attack SHALL be under way at once at depth 0 and 1, and two from depth 2. At most one coal SHALL be in the air. A melee token SHALL be held from the start of the wind-up to the end of the recovery; a cancelled attack SHALL give it back at once. Foes that wait SHALL circle 3.2 to 3.8 m away ("Backing off").

#### Scenario: A group in the Gaol
- **WHEN** three Snuffers fight the lamplighter in the Gaol for 30 s
- **THEN** no two hooks are in a wind-up, active time or recovery at the same step. Check: Node test `gloam-downs-foes-ai.test.mjs`.

#### Scenario: A group in The Fen
- **WHEN** at depth 2 three Snuffers and a Pitchrook fight the lamplighter
- **THEN** no more than two hooks are under way at the same step, and only one coal is in the air. Check: Node test `gloam-downs-foes-ai.test.mjs`.

### Requirement: Health and hits
With no Mantle level and no wick, the lamplighter SHALL have 100 health at the start of a run. A hit SHALL take its damage and push the lamplighter away from the source: 1.2 m, or 3 m for the Ironback's charge. It SHALL have no control for 0.25 s after a hit. For 1.0 s after a hit, no damage SHALL hurt it, and the figure SHALL blink. Touch alone SHALL not hurt. An attack SHALL hit at most once.

#### Scenario: Hit by a hook
- **WHEN** a Snuffer's hook lands on the lamplighter with 100 health in the Gaol at Ember 0
- **THEN** health shows 82, and the lamplighter slides back 1.2 m, ±0.15 m, and blinks. A second blow within 1.0 s does no damage. Check: Node test `gloam-downs-run.test.mjs` (the push, the blink and the 1.0 s), and e2e `gloam-downs-run.fight.e2e.mjs` (82).

#### Scenario: Walk into a foe
- **WHEN** the lamplighter walks into a Snuffer that is not attacking
- **THEN** it takes no damage, and the two push apart. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Harder Ember 0
At Ember 0, foes SHALL deal 10% more damage than their base numbers and have 15% more health, and the Barrow Reeve SHALL deal 20% more. The Ember 4 factor SHALL multiply these. The run SHALL start with 100 health, 1 flask and 35% heals; each Flask level SHALL add a flask.

#### Scenario: A first run
- **WHEN** a run starts with no ware bought
- **THEN** it has 100 health and 1 flask, and a drink heals 35. Check: Node test `gloam-downs-run.test.mjs`, and e2e `gloam-downs-run.cards.e2e.mjs`.

#### Scenario: A Snuffer's hook
- **WHEN** at Ember 0 a Snuffer's hook lands on a lamplighter with no roll in the run's first place
- **THEN** it deals 18 (16 × 1.1, rounded). Check: Node test `gloam-downs-foes.test.mjs`.

### Requirement: Harder later places
At place depth d (the run's first place 0, Barrow Crown 4), foes SHALL deal ×(1 + 0.1 d) damage and have ×(1 + 0.2 d) health, on top of the Ember 0 factors and "Foe growth with sparks". Later places SHALL bring new foe kinds from their pools, more foes ("More foes before more damage") and a second melee token before more damage. The Reeve SHALL have 5% more health a spark.

#### Scenario: The Crow Wall
- **WHEN** at Ember 0 with no spark, a Snuffer in The Crow Wall hooks a lamplighter with no roll
- **THEN** it has 69 health and the hook deals 19 (16 × 1.1 × 1.1, rounded). Check: Node test `gloam-downs-foes.test.mjs`.

#### Scenario: Barrow Crown
- **WHEN** a run with no spark reaches Barrow Crown at Ember 0
- **THEN** a hook deals 25 (16 × 1.1 × 1.4), so a lamplighter with 100 health takes 4 hooks or more to go down, and a Snuffer has 103 health (50 × 1.15 × 1.8). Check: Node test `gloam-downs-foes.test.mjs`.

#### Scenario: The table
- **WHEN** `node qa/lab/gloam-downs-bot.mjs` starts
- **THEN** it prints, for each depth, the hook, the coal, the slam and the charge with no spark and with 8, the hits each takes to bring 100 and 160 health down, and the strings a Snuffer and an Ironback take. Check: the bot, `gloam-downs-bot.mjs`, and the table in design.md.

### Requirement: Pacing
A bot SHALL play the run with the page's foe rules (interrupts, braces, armor, tokens and spacing from `foes.js`), keep one save, grow and use abilities. Targets for 60 bots: at skill 0.3 the first run SHALL reach place 2 in 80% of bots and place 3 in 40%, and the median first win SHALL be in run 8 to 20; at 0.5 in run 3 to 8; at 0.9 in run 1 to 2. Deaths SHALL not spike at a place.

#### Scenario: Bot runs
- **WHEN** `node qa/lab/gloam-downs-bot.mjs 60 0.3 1` runs, and the same at skill 0.5 and 0.9
- **THEN** each target holds, or design.md says which misses and why, and the user is told. Check: the bot, `gloam-downs-bot.mjs`.

#### Scenario: No death spike
- **WHEN** the bot prints each place's death rate (deaths there over runs that reached it) and its median damage taken per foe put out, at each skill
- **THEN** no place before Barrow Crown has a death rate above 1.5 times the mean of those four places, Barrow Crown's is under 2 times, and each place's damage per foe is 0.9 to 1.6 times the place's before it. Check: the bot, `gloam-downs-bot.mjs`.

#### Scenario: The bot interrupts
- **WHEN** the bot reads a wind-up of a foe in reach that is not armored
- **THEN** it cuts into it with a chance of 0.3 + 0.6 × skill, and rolls from armored ones; the bot's line "interrupts a run" is above 3 at skill 0.5. Check: the bot, `gloam-downs-bot.mjs`.

#### Scenario: Steady growth
- **WHEN** `MAXRUNS=30 AFTER=30 node qa/lab/gloam-downs-bot.mjs 10 0.5 1` runs
- **THEN** its "runs with a buy" line shows a buy in at least two of three runs, and design.md lists the run at which each quarter of the catalogue is bought. Check: the bot, `gloam-downs-bot.mjs`.
