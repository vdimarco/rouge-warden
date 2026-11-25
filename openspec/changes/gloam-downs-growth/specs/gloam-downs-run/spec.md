## ADDED Requirements

### Requirement: Glim at risk
A lit beacon SHALL NOT bank the glim carried; it SHALL stay carried into the next place. The Lamp-room at a beacon SHALL spend the glim carried first and then the bank. A death or End the run SHALL keep 10% of the glim carried, rounded down, plus 8% for each Ash pocket level. A win SHALL bank all of it. The beacon card SHALL say in numbers what a death would keep and lose. The summary SHALL show the glim kept and lost.

#### Scenario: Carry glim past a beacon
- **WHEN** the lamplighter lights the Gaol's beacon with 40 glim carried and 0 banked, and walks on
- **THEN** the HUD shows 40 glim carried in The Crow Wall, and the bank is still 0. Check: Node test `gloam-downs-growth.test.mjs`, and e2e `gloam-downs-run.growth.e2e.mjs`.

#### Scenario: A death keeps 10%
- **WHEN** the lamplighter dies with 125 glim carried and no Ash pocket
- **THEN** the bank goes up by 12, and the summary shows "Glim kept 12 · lost 113". Check: Node test `gloam-downs-growth.test.mjs`.

#### Scenario: The beacon card warns in numbers
- **WHEN** the lamplighter lights the Gaol's beacon with 40 glim carried and no Ash pocket
- **THEN** the card says a death would keep only 4 of it (10%) and lose 36. Check: Node test `gloam-downs-growth.test.mjs`, and e2e `gloam-downs-run.cards.e2e.mjs`.

#### Scenario: Spend at the beacon
- **WHEN** the lamplighter lights a beacon with 50 glim carried and 30 banked, and buys Mantle 1 for 40 in the Lamp-room
- **THEN** 10 glim is carried and 30 is banked. Check: Node test `gloam-downs-growth.test.mjs`.

### Requirement: Patterns
A foe put out SHALL drop a pattern with a chance of 2%, plus 1% each Keen eye level, at most 2 a run; an elite 35%; a pattern cache always. Each SHALL be one not found and not kindled, from the seed's `pattern` stream. A touch SHALL take it with a toast. A death SHALL lose the patterns carried. A lit beacon or a win SHALL keep them as found, and the beacon card SHALL name them.

#### Scenario: Keep a pattern
- **WHEN** a test drops the Rime lamp pattern in the Gaol, the lamplighter takes it and lights the beacon
- **THEN** the beacon card shows "Kept: Rime lamp", and `__gloam.run().patterns` lists `rime`. Check: e2e `gloam-downs-run.growth.e2e.mjs`.

#### Scenario: Lose a pattern
- **WHEN** the lamplighter takes the Rime lamp pattern and dies before the next beacon
- **THEN** the save's `patterns` does not list `rime`, and the summary shows "Patterns kept 0 · lost 1". Check: Node test `gloam-downs-growth.test.mjs`.

#### Scenario: Same seed, same drops
- **WHEN** two runs with the same seed, wares and kindled list put out the same foes in the same order
- **THEN** they drop the same patterns. Check: Node test `gloam-downs-growth.test.mjs`.

### Requirement: Pattern lamps on the ground
A pattern lamp SHALL lie on the floor under the foe that dropped it, never in a wall or in the air, and the fight SHALL draw it as a small lamp. A lit beacon or a win SHALL also keep any pattern lamp still lying in the place.

#### Scenario: A lamp left lying at the beacon
- **WHEN** a pattern lamp lies in the Gaol and the lamplighter lights the beacon before touching it
- **THEN** the pattern is kept as found. Check: Node test `gloam-downs-growth.test.mjs`.

#### Scenario: On the floor
- **WHEN** an elite falls beside a wall, or a Mirelight is put out in the air
- **THEN** its pattern lamp, its relic and its glim lie on the floor, and the fight draws the lamp. Check: Node test `gloam-downs-growth.test.mjs`, and e2e `gloam-downs-run.abilities.e2e.mjs`.

### Requirement: Kindle a pattern
The Lamp-room SHALL list each found pattern as "<name> · <what it does> · <cost> glim" with a Kindle button, with the rules of a Buy button. A kindled pattern SHALL join the drops of the run's later places and of every later run. Lantern bomb, Smoke step, Thick glass and Hot glass SHALL be kindled from the first run.

#### Scenario: Kindle the Rime lamp
- **WHEN** the save has `rime` found and 150 glim banked, and the player presses Kindle on its row
- **THEN** 120 glim is spent, the row leaves the list, and the seed's `ability` stream may draw `rime` from then on. Check: Node test `gloam-downs-growth.test.mjs`, and e2e `gloam-downs-run.growth.e2e.mjs`.

### Requirement: The new wares
The Lamp-room SHALL also sell Belt (90, 220, 420: a choice of two start abilities; slot 2 filled; bright start abilities), Keen eye (70, 140, 230, 340, 480: 4% more bright drops and 1% more pattern and ability drops a level), Lantern panes (300, 700: one more pane slot a level) and First spark (120, 260, 450: one more spark pick at the start a level).

#### Scenario: Belt 2
- **WHEN** a player with Belt 2 and four kindled abilities begins a run
- **THEN** the start card offers two abilities for slot 1, and slot 2 holds one drawn by the seed. Check: Node test `gloam-downs-growth.test.mjs`.

#### Scenario: Costs grow
- **WHEN** the Node test reads every ware's costs
- **THEN** each level costs more than the one before, and the whole catalogue with the unlocks and the patterns costs between 10,000 and 13,000 glim. Check: Node test `gloam-downs-growth.test.mjs`.

### Requirement: Sparks
Each lit beacon before the win SHALL offer one spark pick on the beacon card after the wick: Flame +1, Ward +1 or Gloam +1. First spark SHALL add picks at the start, and a spark cache one pick. A level SHALL give its full value up to level 5, and half a level after that. The HUD SHALL show the three levels as words in the colours' hues ("Flame 2 Ward 1 Gloam 0"), so they share no mark with the wisps or the glim.

#### Scenario: Pick Ward
- **WHEN** at a beacon with 80 of 100 health and Ward 0, the player picks Ward +1
- **THEN** the health shows 90/110, and the HUD's colour row shows Ward 1. Check: e2e `gloam-downs-run.growth.e2e.mjs`.

#### Scenario: Half after five
- **WHEN** a run has Flame 7
- **THEN** Flame moves deal 60% more (5 × 10% + 2 × 5%). Check: Node test `gloam-downs-growth.test.mjs`.

### Requirement: Colours of the moves
The blade, the finisher, the plunge and relic hits SHALL be Flame; the roll and the near miss Gloam; the flask Ward. Each ability SHALL have the colour of its table. Flame SHALL raise Flame damage by its share; Ward SHALL raise maximum health by 10 a level and Ward abilities' power; Gloam SHALL raise Gloam abilities' power and cut every cooldown by 4% a level, never under 60%.

#### Scenario: Flame and Edge
- **WHEN** a run with Edge 1 and Flame 2 lands the first cut (10) on a post
- **THEN** it deals 13 (10 × 1.32, rounded once). Check: Node test `gloam-downs-growth.test.mjs`.

#### Scenario: Gloam cooldown
- **WHEN** a run with Gloam 3 uses Lantern bomb
- **THEN** its cooldown is 7.04 s (8 × 0.88). Check: Node test `gloam-downs-abilities.test.mjs`.

### Requirement: Lantern panes
A pane SHALL be a passive pick from `PANES`. There SHALL be 1 pane slot, and Lantern panes SHALL open up to 3. The Lamp-room SHALL show a row of kindled panes for each open slot, and a change SHALL be free in any Lamp-room. The panes set SHALL be kept in the save for later runs. A pane SHALL be set in one slot at most.

#### Scenario: Thick glass
- **WHEN** Thick glass is set and the lamplighter at 50 of 100 health puts out a Snuffer
- **THEN** the health shows 53/100. Check: Node test `gloam-downs-growth.test.mjs`.

#### Scenario: Two slots
- **WHEN** the player buys Lantern panes 1 in the Lamp-room
- **THEN** a second pane row shows, and the pane set in the first row is not offered in the second. Check: e2e `gloam-downs-run.growth.e2e.mjs`.

### Requirement: Ability slots
The lamplighter SHALL have two ability slots, each with its own cooldown on the play clock. A press SHALL be buffered 0.15 s and SHALL wait through hit stop. A press while the slot cools, drinks, rolls or is hurt SHALL do nothing but the `refuse` cue. Every run SHALL start with an ability in slot 1, drawn by the seed's `start` stream from the kindled abilities, or as Belt says.

#### Scenario: Cooldown
- **WHEN** the lamplighter uses Lantern bomb in slot 1 and presses slot 1 again 4 s later
- **THEN** no second bomb is thrown, the cue log has `refuse`, and the slot says ready once, 8 s after the throw. Check: Node test `gloam-downs-abilities.test.mjs`.

### Requirement: Ability inputs
In a run, F or U SHALL use slot 1, and G or I slot 2. The mouse's side buttons SHALL use slot 1 (button 3) and slot 2 (button 4), and SHALL not move the browser back or forward. On a pad LB (4) SHALL use slot 1 and LT (6) slot 2. On touch, `#bAb1` and `#bAb2` SHALL use them, at least 44 px on the shorter side, hidden while the slot is empty.

#### Scenario: Keys
- **WHEN** slot 1 holds Lantern bomb and slot 2 Flare, and the player presses F and then G
- **THEN** a bomb is thrown and Flare starts, and both slots cool. Check: e2e `gloam-downs-run.abilities.e2e.mjs`.

#### Scenario: Mouse side button
- **WHEN** the player presses button 3, then button 4, on the view
- **THEN** slot 1's ability starts, then slot 2's, and the page takes each press, release and auxclick, so the browser does not go back or forward. Check: e2e `gloam-downs-run.abilities.e2e.mjs`, and Node test `gloam-downs-mouse.test.mjs`.

#### Scenario: Pad
- **WHEN** a pad presses LB, then LT 1 s later
- **THEN** slot 1's ability starts, then slot 2's, and the lamplighter does not roll. Check: e2e `gloam-downs-run.abilities.e2e.mjs`.

#### Scenario: Touch layouts
- **WHEN** the run shows on touch at 320 by 640, 390 by 844, 360 by 640 and 844 by 390 with both slots full
- **THEN** `#bAb1` and `#bAb2` are each at least 44 px on the shorter side, inside the screen, and overlap no other button or the HUD, and a tap on `#bAb1` uses slot 1. Check: e2e `gloam-downs-run.abilities.e2e.mjs`.

### Requirement: The abilities
There SHALL be nine abilities, with the numbers of `ABILITIES` in `growth.js`: Lantern bomb, Smoke step, Ember snare, Moth wisp, Crook line, Rime lamp, Flare, Pitch pour and Bell guard. Each SHALL have a cooldown, a cue from its table, a drawn effect that never uses fire slot 37 (the brightest), and a tell before it hurts a foe, as design.md's table says.

#### Scenario: Every ability
- **WHEN** the Node test uses each ability beside Snuffers, and Ember snare beside an Ironback too
- **THEN** each does what its row says, and Lantern bomb logs its cue with `ability: bomb` and starts its cooldown. Check: Node test `gloam-downs-abilities.test.mjs`.

#### Scenario: Drawn under fire
- **WHEN** the Node test reads the growth colours and the fight's code that draws the abilities and the lamps
- **THEN** none of them uses slot 37. Check: Node test `gloam-downs-abilities.test.mjs`.

### Requirement: Lantern bomb
Lantern bomb SHALL throw a lantern to the soft-aim foe within 8 m, or 6 m ahead. A ring SHALL show where it lands for 0.6 s, and it SHALL then burst for 28 in 2.5 m and burn a foe it hits for 6 more over 2 s, each raised by Flame.

#### Scenario: Two Snuffers
- **WHEN** two Snuffers stand 1.6 m apart 5 m ahead and the lamplighter at Flame 0 throws a bomb
- **THEN** the ring shows for 0.6 s, and each Snuffer loses 28 and then 6 over 2 s. Check: Node test `gloam-downs-abilities.test.mjs`.

### Requirement: Foe states from abilities
Stun, hold and slow SHALL be foe states. A stunned or held foe SHALL stop, and its wind-up SHALL stop. A slowed foe SHALL walk and wind up at half speed. A heavy foe SHALL never be held, only slowed, and a stun on it SHALL last half as long. The Barrow Reeve SHALL take ability damage but no stun, hold or slow.

#### Scenario: Flare on a wind-up
- **WHEN** a Snuffer is 0.1 s into its hook's wind-up 2 m away and the lamplighter uses Flare
- **THEN** the hook does not land, and the Snuffer is stunned. Check: Node test `gloam-downs-abilities.test.mjs`.

#### Scenario: The Reeve
- **WHEN** an Ember snare catches the Barrow Reeve (a target with no zone), and a stun is put on it
- **THEN** it takes the snare's 10 and no state. Check: Node test `gloam-downs-abilities.test.mjs`.

### Requirement: Ability lamps
A foe put out SHALL drop an ability lamp with a chance of 3%, plus 1% each Keen eye level, at most 3 a run; an ability cache always. A lamp SHALL be bright with a chance of 10% plus 4% each Keen eye level: 25% more power and a gold edge. A touch SHALL fill an empty slot. With both full, a slot's input pressed on the lamp SHALL swap, and the old ability SHALL lie there.

#### Scenario: Swap
- **WHEN** both slots are full, the lamplighter stands on a Smoke step lamp and presses slot 1
- **THEN** slot 1 holds Smoke step, and its old ability lies there as a lamp. No card opens. Check: Node test `gloam-downs-abilities.test.mjs`.

#### Scenario: Fill an empty slot
- **WHEN** slot 2 is empty and the lamplighter walks onto a Moth wisp lamp in the Gaol
- **THEN** slot 2 holds Moth wisp. Check: e2e `gloam-downs-run.abilities.e2e.mjs`.

### Requirement: The ability HUD
With a mouse, keys or a pad the HUD SHALL show each filled slot as its key and name, with the seconds left while it cools, and a gold edge on a bright one. On touch the two buttons SHALL show the short name and the cooldown as a dark sweep instead, and the HUD row SHALL be hidden. Neither SHALL overlap the health line, the count line or a touch button.

#### Scenario: Cooldown shows
- **WHEN** both slots were used, at 1280 by 720; and slot 1 was tapped on touch at 390 by 844
- **THEN** the HUD row reads "F Lantern bomb 8 s G Flare 14 s" or less; on touch slot 1's sweep is nearly full and slot 2's empty. Check: e2e `gloam-downs-run.abilities.e2e.mjs`.

### Requirement: Keys
Two lasting keys SHALL come from a fixed elite's first fall in any run: Crow step from the Rookchief, Bell drop from the Bellwether. A toast SHALL name the key, and the save SHALL keep it at once. Crow step SHALL give a second jump in the air at 7.4 m/s, once until the feet land, from 0.1 s after the first. Bell drop SHALL crack a sealed stone with a plunge from 2 m or more.

#### Scenario: The Rookchief falls
- **WHEN** the Rookchief is put out for the first time
- **THEN** the save's `keys` lists `leap` at once, with a store and a toast, and a second fall gives nothing. Check: Node test `gloam-downs-keys.test.mjs`.

#### Scenario: Second jump
- **WHEN** a lamplighter with Crow step jumps on flat ground, holds the jump, and presses it again at the top
- **THEN** the feet rise 2.4 m or more over the ground, and a third press does nothing until the feet land. Check: Node test `gloam-downs-keys.test.mjs`.

### Requirement: Hidden ledges and sealed stones
Each place SHALL have at least one ledge that only Crow step reaches (two where the scan finds two) and one sealed stone, on the baked walk map, found by `qa/lab/gloam-downs-ledges.mjs`. No place SHALL be rebaked. Each SHALL hold a cache that opens once a run, with a prize of glim, a spark, a pattern, an ability or a flask, and SHALL be drawn. design.md SHALL say whether a shortcut was found.

#### Scenario: Ledges need the key
- **WHEN** the Node test plays the controller from each ledge's stand with the way the scan kept, with and without the second jump
- **THEN** each ledge is reached only with it, and a plunge from each stone's stand falls 2 m or more onto it. Check: Node test `gloam-downs-keys.test.mjs`, and e2e `gloam-downs-run.abilities.e2e.mjs` for the Gaol's first ledge.

#### Scenario: Open a stone
- **WHEN** a lamplighter with Crow step and Bell drop jumps twice and plunges onto a sealed stone
- **THEN** the stone opens and its prize is given; without Bell drop, or from one jump's height, nothing opens. Check: Node test `gloam-downs-keys.test.mjs`.

### Requirement: Page zones
Places SHALL get more zones from `EXTRA` in `mix.js`, at every Ember level, under the same zone rules as the baked zones: three in the Gaol, The Crow Wall and The Fen, two in Barrow Crown, none in The Bell Knoll (design.md says why). Each centre SHALL be on the walk map's floor, 8 m or more from a baked zone and the beacon (7 m in The Fen and Barrow Crown), 7 m from the start and 25 m from the arena. Their foes SHALL come from the place's pool.

#### Scenario: Zones fit
- **WHEN** `node qa/lab/gloam-downs-zones.mjs` runs
- **THEN** every page zone fits its place's pool, its centre is on the floor, and the spacing holds; and `gloam-downs-seed.test.mjs` finds every seed from 1 to 200 mixes with them and has an elite. Check: the zone check, and Node test `gloam-downs-seed.test.mjs`.

### Requirement: Harder Ember 0
At Ember 0, foes SHALL deal 30% more damage than before this change and have 15% more health, and the Barrow Reeve SHALL deal 20% more. The Ember 4 factor SHALL multiply these. The run SHALL start with 100 health, 2 flasks and 35% heals, as before.

#### Scenario: A Snuffer's hook
- **WHEN** at Ember 0 a Snuffer's hook lands on a lamplighter with no roll
- **THEN** it deals 21 (16 × 1.3, rounded). Check: Node test `gloam-downs-foes.test.mjs`.

### Requirement: Growth sounds
The run's sound SHALL play existing cues: the touch of a pattern `wisp` and then `glim` for `pattern-found`; `buy` for `pattern-kept` and `pattern-kindled`; `light` for `key-found`; the ability's own cue on its use; `focus` for `ability-ready`; `choice` for `spark-take`; and `cracks` or `wisp` with `glim` for `cache-open`. An ability that hits nothing SHALL not bring the strings in.

#### Scenario: Events heard
- **WHEN** the Node test sends each new event on the bus
- **THEN** run-sound logs its cue, which has a recipe, and its view lists the event. Check: Node test `gloam-downs-sound.test.mjs`.

#### Scenario: No strings from a bomb
- **WHEN** foes are awake and no foe has attacked, and the lamplighter throws a bomb that misses
- **THEN** `layers` has `drums` and not `strings`. Check: Node test `gloam-downs-sound.test.mjs`.

### Requirement: Test hooks for growth
`__gloam.set(fields)` SHALL take `sparks`, `patterns`, `kindled`, `panes`, `bank`, `abilities`, `cool` and `keys`. `__gloam.run()` SHALL give `sparks`, `patterns`, `carriedPatterns`, `panes`, `abilities` (each slot's `{ id, bright, left }`), `keys` and `caches`.

#### Scenario: Set and read
- **WHEN** the e2e sets `abilities` to Lantern bomb and Flare and `keys` to `['leap']`
- **THEN** `__gloam.run()` gives them back, and the HUD shows both slots. Check: e2e `gloam-downs-run.abilities.e2e.mjs`.

## MODIFIED Requirements

### Requirement: Beacons in a run
In each place before Barrow Crown, one guard zone SHALL keep the beacon dark until its foes and its second wave are put out. Other zones MAY be passed. A lit beacon SHALL keep the glim carried as carried, with every mote dropped and not taken counted, keep the patterns carried, and fill every flask, or one at Ember 5. It SHALL then save the run at the start of the next place, and show the beacon card.

#### Scenario: Guards still stand
- **WHEN** the lamplighter touches the Gaol's beacon while the keep's second wave stands
- **THEN** the beacon stays dark. A toast says "The beacon will not catch while its keepers stand in the keep." Check: e2e `gloam-downs-run.fight.e2e.mjs`.

#### Scenario: Run past a zone
- **WHEN** the lamplighter runs past the first two zones of The Crow Wall, puts out the guards and their second wave, and touches the beacon
- **THEN** the beacon lights, the glim carried stays carried, and the flasks are full. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Ash pocket at death
A death SHALL bank 10% of the glim carried, rounded down, plus 8% for each Ash pocket level, up to 50% at level 5. The summary SHALL show the rest as lost, and its glim banked SHALL include the part kept.

#### Scenario: Ash pocket 2
- **WHEN** the lamplighter dies with 100 glim carried and Ash pocket 2
- **THEN** the summary shows 26 glim kept and 74 lost. Check: Node test `gloam-downs-growth.test.mjs`.

### Requirement: The lasting upgrades
The Lamp-room SHALL sell, a level at a time:
- Mantle: +15 health, at 40, 80, 140, 210, 290, 380, 480 and 600 glim.
- Flask: +1 flask, at 60, 150, 260 and 420.
- Edge: +12% blade damage, at 50, 100, 170, 260 and 380.
- Draught: +10 points of heal, at 45, 110 and 200.
- Ash pocket: +8% glim kept, at 40, 80, 150, 240 and 360.

#### Scenario: All upgrades
- **WHEN** a player has bought every level and plays at Ember 0 with no sparks
- **THEN** a run starts with 220 health and 6 flasks. Each flask heals 65%, the blade deals 60% more, and a death keeps 50% of the glim carried. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The run in the save
The save SHALL hold the run in progress: seed, route, Ember level, place, time, health, flasks, glim carried and banked, foes put out, wicks, an offer not chosen, relics, elites put out, best combo, the boss's fall, sparks, spark picks left, abilities, patterns carried, caches opened, ability lamps on the ground, and the entry values. It SHALL hold the summary of an ended run until its card closes.

#### Scenario: A run in the save
- **WHEN** a run in Lantern Fen holds Ember trail, Flame 2, Lantern bomb in slot 1, the Rime lamp pattern carried and one cache opened, and the page stores it
- **THEN** a load of the save gives back each of them and the entry values. Check: Node test `gloam-downs-growth.test.mjs`.

### Requirement: Saved run
The run's save SHALL use the key `gloam-downs.run.v3`. With no v3 save, the page SHALL read v2 once, or with no v2 the v1 save once, and store v3 at once. Every field SHALL be checked on the way in: unknown ids dropped, levels clamped, and the starters always kindled. Ash pocket 1 in v2 SHALL become level 2. A save that cannot be read SHALL give a fresh save.

#### Scenario: From v2
- **WHEN** the page loads with only a v2 save that has Mantle 3, Ash pocket 1 and 70 glim banked
- **THEN** the run's save has Mantle 3, Ash pocket 2, 70 glim, the four starters kindled, and the v3 key is written. Check: Node test `gloam-downs-growth.test.mjs`.

#### Scenario: Rubbish in v3
- **WHEN** the v3 save has an unknown pattern, an unknown key, Flame 900 and a slot holding an ability not kindled
- **THEN** the unknown ids are dropped, Flame is 40, and the slot is empty. Check: Node test `gloam-downs-growth.test.mjs`.

### Requirement: Gamepad in a run
In a run, a held pad button SHALL count once across all pads:
- The left stick SHALL move, and a light tilt SHALL walk. The right stick SHALL turn the view.
- A (0) SHALL jump. X (2) or RT (7) SHALL attack. B (1) SHALL roll. Y (3) SHALL heal.
- LB (4) SHALL use slot 1 and LT (6) slot 2.
- RB (5) SHALL face a foe or the boss, as R does.
- Start (9) or Back (8) SHALL open and close the pause panel.

#### Scenario: Pad buttons
- **WHEN** the player tilts the left stick fully, presses B, then presses X three times
- **THEN** the lamplighter rolls in the tilt's direction, and then swings a full string. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Two pads
- **WHEN** two pads hold Start at the same time
- **THEN** the pause panel opens once and does not close again. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: LT does not roll
- **WHEN** slot 2 is empty and a pad presses LT
- **THEN** the lamplighter does not roll, and the cue log has `refuse`. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Pacing
A bot SHALL play the run with the page's rules on the real walk maps, keep one save across its runs, spend glim, kindle patterns, pick sparks, walk to pattern and ability lamps and to the caches its keys open, use abilities and step the boss with boss.js. Targets: a first run at skill 0.3 SHALL reach the second place in half the bots or more; at 0.5 the median first win SHALL be in run 6 to 12; at 0.9 in run 1 to 3, with a winning run of 15 to 25 minutes of game time.

#### Scenario: Bot runs
- **WHEN** `node qa/lab/gloam-downs-bot.mjs 60 0.3 1` runs, and the same at skill 0.5 and 0.9
- **THEN** each target holds, or design.md says which target misses and why, and the user is told. Check: the bot, `gloam-downs-bot.mjs`.

#### Scenario: Steady growth
- **WHEN** `MAXRUNS=30 AFTER=30 node qa/lab/gloam-downs-bot.mjs 10 0.5 1` runs
- **THEN** its "runs with a buy" line shows a buy in at least two of three runs, and design.md lists the run at which each quarter of the catalogue is bought. Check: the bot, `gloam-downs-bot.mjs`.
