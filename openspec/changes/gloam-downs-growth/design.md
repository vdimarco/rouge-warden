# Design: Gloam Downs, growth and abilities

## The request
The player asked: "make the game more like deadcells mechanics the more you play the stronger you get an opther abilities". So there are two asks: growth across runs (the main one), and more abilities. The last check (gloam-downs-real-game design.md, "Pacing, after the merge") found a skill 0.9 bot wins its first run in 8.7 minutes, and a 0.3 bot wins by run 3. This design fits the code on `0a96a5fb`.

## What is there now
- **The run** (`run.js`). `WICKS` (9 wicks, 3 behind unlocks), `UPGRADES` (Mantle 3, Flask 3, Edge 3, Draught 2, Ash pocket 1), `UNLOCKS` (7, each bought once, 990 glim in all), `EMBER` (levels 0 to 5) and the rules `startRun`, `lightBeacon`, `die`, `win`, `buy`, `buyUnlock`. A lit beacon banks the glim carried (`rs.bank += run.carried`). A death keeps 25%, or 55% with Ash pocket (`keepShare`). `makeRunner` steps a place: the fighter (`moves.js`), wisps, relics (`relics.js`), the beacon, falls, and `eliteOut`.
- **The save** (`run-save.js`). Key `gloam-downs.run.v2`, read from v1 once. `clean()` checks every field.
- **Screens** (`screens.js`, `cards.js`, `main.js`). The beacon card (`#beaconCard`: two wicks, then Spend glim or Walk on), the Lamp-room (`#lamp`: `#ups`, `#unlocks`, the Ember row), the pause panel, the summary, the win card. `cards.js` keeps the focus in the open card and scrolls a long card inside itself.
- **Inputs** (`input.js`). `KEYS = { attack: ['j','z'], roll: ['k','x'], heal: ['l','c'] }`; mouse left attacks, right rolls while the mouse is taken; pad X or RT attack, B or LT roll, Y heals, RB faces; touch buttons `#bAttack`, `#bRoll`, `#bHeal`, `#bJump`.
- **Foes** (`foes.js`, `elites.js`, `mix.js`, `boss.js`). Baked zones per place (4 each, 16 fights and 4 guards), the seed's mix, one elite a place, the guard's second wave. Foes: Snuffer 50 health, hook 16; Pitchrook 30, coal 18; Mirelight 14, pulse 18; Ironback 120, charge 24 and slam 20. The Barrow Reeve 1,300.
- **Feel and drawing** (`fight.js`, `sparks.js`). Spark dabs in the place's palette slots, fire 37 the brightest; relic lamps, fire lines and rings come as `relicFx` events.
- **Sound** (`run-sound.js`, `music.js`, `sound.js`, `bus.js`). The bus has 15 events. Cue recipes include `coal`, `roll`, `cracks`, `wisp`, `clang`, `pulse`, `light`, `shards`, `charge`, `slam`, `drop`, `heal`, `glim`, `buy`, `choice`.
- **The bot** (`qa/lab/gloam-downs-bot.mjs`). Plays whole runs on the real walk maps with the page's rules, buys from a fixed list between runs, and draws the boss fight from old boss-bot results (it does not step `boss.js`).
- **Reach** (`play.js` `reachable(walk, start, bounds, P)`). A search over the walk grid with the controller's own rules, with the jump speed taken from `P`. Normal jump top: `JUMP` = 8.2² / 48 = 1.40 m.

## Sources
The session could not fetch pages: `deadcells.wiki.gg` and `deadcells.fandom.com` do not resolve here (the network allowlist), so no wiki page was read in full. Web search worked, and its result extracts were read on 2026-11-25. Each source says which.
- **Dead Cells** (Motion Twin, 2018). Search extracts read (searches on cells, blueprints, scrolls and runes; results from `deadcells.fandom.com/wiki/Stats`, `deadcells.fandom.com/wiki/Runes_and_upgrades`, `primagames.com/tips/how-get-upgrades-dead-cells`, `pocketgamer.com/dead-cells/runes/`, `blog.hyperx.com` rune guide, `gamepressure.com` rune guide): foes drop cells, spent with the Collector on blueprints; three stats of power (red, purple, green), each scroll raising health and the damage of items of its colour by about 15%; runes are dropped by fixed elites and open vines, teleporters and breakable floors. From memory: blueprints are kept only if you reach the Collector between biomes, cells not spent there are lost, mutations are passive slots, and the Collector's wares have many levels with rising costs. We took the shapes: a find that is kept only at the next safe room, a currency spent or lost, three colours that scale your kit, keys from fixed elites that open hidden ground, and passive slots. No name, item, number or layout is copied.
- **Hades** (Supergiant Games, 2020). Search extracts read (`segmentnext.com` and `primagames.com` Mirror of Night guides, `inverse.com`): the Mirror of Night sells talents with ranks whose cost rises (one example goes 30, 500, 1000), and spent currency can be refunded. We took growing costs a level. No refund, by choice: a buy is final, as the Lamp-room is now.
- **Rogue Legacy** (Cellar Door Games, 2013). From memory (the search returned nothing on it): the manor's upgrades bought with gold between runs, with the gold not spent taken at the door. That is our "spend it or lose most of it".
- **Enter the Gungeon** (Dodge Roll, 2016). Search extracts read (`enterthegungeon.wiki.gg/wiki/Hegemony_Credit`, `.../Ox_and_Cadence`): a second currency from bosses unlocks items into the drop pool for later runs, about 1,800 credits for all. We took "a buy puts it in the drop pool", and the size check: our whole catalogue costs about 11,700 glim, about 30 good runs.
- **Squirrel Eiserloh, Jan Willem Nijman, Sakurai** (as gloam-downs-real-game cites, from memory): the tells and hit feel of the new abilities follow the same rules as the moves.
- **Drawing the abilities**: no outside technique was adapted. Each effect is made of the spark dabs, rings and lines that `fight.js` and `sparks.js` already draw for relics and foe markers.

## 1. Growth across runs

### Glim at risk
- A lit beacon no longer banks the glim carried. It stays carried into the next place. The beacon card's Spend glim opens the Lamp-room, which spends the glim carried first and then the bank.
- A death, or End the run, keeps 10% of the glim carried, rounded down, plus 8% for each Ash pocket level: 10, 18, 26, 34, 42 or 50%. The rest is lost. A win banks all of it.
- This **replaces** the 25% rule of gloam-downs-real-game ("Cinders"). The old rule kept a quarter of one place's glim; now a whole run's glim is at risk, so 10% of it is worth about as much, and the choice "spend it now or carry it" is real.
- The summary shows the glim kept and lost. The HUD keeps "● n glim" as the glim carried.

### Patterns
- A pattern is the plan of an ability or a pane that is not kindled yet (`PATTERNS` in `growth.js`). It drops as a small lamp of spark dabs in the colour of its ability, with a toast "A pattern: <name>. Light a beacon to keep it."
- Drops: each foe put out drops one with a chance of 2%, plus 1% for each Keen eye level; an elite 35%; a cache with the prize `pattern` always, when one is left. At most 2 patterns from foes in a run. The seed's `pattern` stream decides each drop and which one, from the patterns not found and not kindled.
- A pattern carried is lost with a death. When the run lights a beacon (or wins), each carried pattern becomes found and is saved (`rs.patterns`). The beacon card says "Kept: <names>".
- In the Lamp-room each found pattern has a row: "<name> · <what it does> · <cost> glim" and a Kindle button. A kindled pattern joins the drops of this run's later places and of every later run. Kindling is final.
- Patterns found and not kindled stay in the save, so a pattern can be kindled in any later Lamp-room.

### Lasting wares
`UPGRADES` in `run.js` becomes this table. Each level costs more. The first levels of Mantle, Flask, Edge and Draught keep their costs and their gifts, so a v2 save keeps its power.

| Ware | Gives a level | Levels and costs (glim) | All |
|---|---|---|---|
| Mantle | +15 maximum health | 40, 80, 140, 210, 290, 380, 480, 600 | 2,220 |
| Flask | +1 flask | 60, 150, 260, 420 | 890 |
| Edge | +12% blade damage | 50, 100, 170, 260, 380 | 960 |
| Draught | each flask heals 10 points of the maximum more | 45, 110, 200 | 355 |
| Ash pocket | +8% of the glim carried kept at a death | 40, 80, 150, 240, 360 | 870 |
| Belt | 1: start with a choice of two abilities for slot 1; 2: slot 2 also starts filled; 3: the start abilities are bright | 90, 220, 420 | 730 |
| Keen eye | +4% bright drops (from 10%), +1% pattern chance from foes, +1% ability lamps from foes | 70, 140, 230, 340, 480 | 1,260 |
| Lantern panes | +1 pane slot (1 at first, up to 3) | 300, 700 | 1,000 |
| First spark | each run starts with one more spark pick | 120, 260, 450 | 830 |

- With the unlocks (990) and the patterns (1,620), the whole catalogue is about 11,700 glim. A first run that dies in place 2 spends 60 to 120; a winning run at Ember 0 holds 400 to 600 with the extra zones and caches. So the wares last 15 to 30 runs. The bot reports the run at which each quarter of the catalogue is bought (task 3.7).
- Without Belt, every run starts with one ability in slot 1, drawn by the seed's `start` stream from the kindled abilities.

### Keys and hidden ground
Two lasting keys (`LAMP_KEYS` in `growth.js`; the name keeps it apart from `input.js` `KEYS`), each given the first time a fixed elite falls, in any run. A toast names the key; the key is saved at once (not only at a beacon), because it is the elite's reward.

| Key | From | What it does | Opens |
|---|---|---|---|
| Crow step | The Rookchief, The Crow Wall | a second jump in the air, once until the feet land, from 0.1 s after the first; speed 7.4 m/s, so the feet rise 1.14 m more | ledges that only the second jump reaches |
| Bell drop | The Bellwether, The Bell Knoll | a plunge that falls 2 m or more onto a sealed stone cracks it open | sealed stones |

- **No rebake.** The second jump sets `body.s.vy` from `keys.js` on a fresh jump press while the body is in the air. `play.js` integrates `vy` as it does now, so the controller does not change. A sealed stone is a ring of spark dabs with a crack glow (slot 33) on flat walk-map floor; it is drawn, and the stone opens by a rule, so it needs no mesh.
- **Finding the ledges.** `qa/lab/gloam-downs-ledges.mjs` (new, builder P) runs `reachable(walk, start, bounds, P)` twice for each place: with `PARAMS`, and with the jump speed whose top is the two jumps together (`jumpV` = 10.94 m/s, top 2.49 m, about the 1.40 + 1.14 m that the two jumps reach at best). Cells the second search reaches and the first does not are ledge cells. It groups them into patches of 1.5 m² or more, and prints each patch's centre, height and nearest route point. Builder P picks at least 2 ledges in each place from this list and writes them into `SPOTS` in `keys.js`. Where a ledge joins two route points with a walk 10 m or more shorter than the route between them, it is a **shortcut**: at least two places must have one, or design.md says the scan found none.
- **Sealed stones.** At least 1 in each place, on flat floor (slope under 0.1, open 1.8 m over), 2 m or more under a ledge or a roof edge the lamplighter can stand on, found by the same script.
- **Caches.** Each ledge and stone holds a cache. Its prize, fixed in `SPOTS`: `glim` (20 to 40, before the Ember factor), `spark` (one spark pick), `pattern`, `ability` (an ability lamp) or `flask` (fills one flask). A cache opens once a run. The bot takes the caches it can reach, so the side trips count in the pacing.
- The pause panel lists the keys held, and the help card adds "Jump again in the air: Crow step" and "Plunge onto a sealed stone: Bell drop" once held.

### Sparks and the three colours
- Three colours (`COLOURS` in `growth.js`): **Flame** (damage), **Ward** (health) and **Gloam** (abilities and tricks).
- A spark raises one colour by 1 for the rest of the run. Each lit beacon offers one spark pick on the beacon card, after the wick: three buttons, "Flame +1", "Ward +1", "Gloam +1". First spark adds picks at the start of a run (on the start's beacon card, as the Wick shelf does). A cache with the prize `spark` offers one pick at once, on the same small card.
- What a level gives (`SPARK` in `growth.js`), up to 5 levels at the full value, and half of it a level after that:
  - Flame: +10% damage of Flame moves and abilities.
  - Ward: +10 maximum health (and +10 health at once), and +10% power of Ward abilities.
  - Gloam: +10% power of Gloam abilities, and every ability's cooldown 4% shorter, never under 60%.
- Every move has a colour (`MOVE_COLOUR`): the blade, the finisher, the plunge and relic hits are Flame; the roll and the near miss are Gloam; the flask is Ward. Today's bonuses (Edge, Keen edge) add to Flame's, and damage rounds once at the end, as now.
- The HUD shows the three levels in a short row under the health line: "▲ 2 ◆ 1 ● 3" in the colours' hues.
- A beacon card that was going to show "Choose a wick" first shows the wick buttons, then the spark buttons in their place, then Spend glim and Walk on. The spark pick is on the beacon card because the beacon is the run's door to the Lamp-room, and the card already has the run's picks. The Lamp-room shows the run's colours on its top line.

### Lantern panes
- A pane is a passive pick (`PANES` in `growth.js`). Two are kindled from the first run; six more come as patterns.
- Slots: 1 at first, and Lantern panes opens a second and a third. The Lamp-room shows a row for each slot with the kindled panes as buttons. A change is free in any Lamp-room, at a beacon or before a run. The panes set are kept in the save (`rs.panes`) for the next runs.

## 2. Abilities

### Slots and inputs
- Two slots. Each holds one ability or nothing, and each has its own cooldown on the play clock. A press while the slot cools does nothing but the `refuse` cue.
- Inputs (new; the old ones do not change but one):
  - Keys: F or U for slot 1, G or I for slot 2.
  - Mouse: side buttons 3 (back) for slot 1 and 4 (forward) for slot 2, while the mouse is taken or free. The view takes `pointerdown`, `mouseup` and `auxclick` of these buttons with `preventDefault`, so the browser does not go back a page. The keys stay for a mouse that has no side buttons.
  - Pad: LB (4) for slot 1, LT (6) for slot 2. **LT no longer rolls**; B still does. This is the one change to an old input: the pad has no other free shoulder button, and a shoulder can be pressed with the thumb on the right stick.
  - Touch: two round buttons, `#bAb1` and `#bAb2`, 56 px, above and left of Attack in the right-thumb group, each with its cooldown as a dark sweep and the ability's glyph. They are hidden while the slot is empty.
- A press is buffered 0.15 s, as the moves are, and waits for the next play step in hit stop.
- An ability does not start while the lamplighter drinks, rolls or is hurt. It can start in the air (but Smoke step and Bell guard) and after a cut's strike.

### The abilities
`ABILITIES` in `growth.js` holds the numbers. Two are kindled from the first run (Lantern bomb, Smoke step); the other seven are patterns. Each power value grows by its colour.

| Ability | Colour | Cooldown | What it does | Its tell (seen before it hurts) | Cue | Drawn as |
|---|---|---|---|---|---|---|
| Lantern bomb | Flame | 8 s | throws a lantern 6 m ahead (to the soft-aim foe within 8 m); it bursts 0.6 s later for 28 in 2.5 m, and burns for 6 over 2 s | a ring marker on the ground for the 0.6 s | `coal` on the throw, `slam` on the burst | an arc of dabs, then a ring and a flash in fire slots under 37 |
| Smoke step | Gloam | 6 s | moves 4 m in the stick's way (or ahead) in 0.12 s, safe for 0.3 s; a near miss in it counts as the roll's | none needed; it hurts nothing | `roll` | a puff at both ends, grey dabs |
| Ember snare | Gloam | 10 s | sets a snare at the feet; the first light foe that steps in is held 2 s and takes 10; heavy foes are slowed 50% | the snare's ring glows on the ground | `cracks` | a ring of 8 dabs |
| Moth wisp | Gloam | 18 s | a wisp flies at the lamplighter's shoulder for 12 s and hits the nearest awake foe within 6 m for 5 each 0.8 s | the wisp's line to its foe shows 0.2 s before each hit | `wisp` | a lamp-colour wisp of 6 dabs |
| Crook line | Flame | 7 s | a line to the soft-aim foe within 7 m: pulls a light foe to 1.2 m in front and deals 8; pulls the lamplighter to a heavy foe | the line shows for 0.15 s before the pull | `charge` | a line of dabs |
| Rime lamp | Ward | 12 s | a cone of 4 m and 70° ahead; foes in it move and wind up 50% slower for 3 s | a pale cone on the ground for 0.2 s | `shards` | a fan of pale dabs, frost on the foes |
| Flare | Ward | 14 s | every foe within 4 m that sees the lamplighter is stunned 1.2 s; a wind-up under way stops | a white core grows for 0.25 s | `light` | a burst of dabs, bright but under fire 37 |
| Pitch pour | Flame | 12 s | a pool of 2 m at the feet for 4 s; a foe in it burns for 4 each 0.5 s; a burn from the blade or a bomb doubles it once | the pool shows at once; it burns from 0.3 s | `pulse` | a dark ring with ember dabs |
| Bell guard | Ward | 9 s | for 0.8 s the next hit from in front is turned aside (no damage) and a coal is thrown back at its Pitchrook for 12 | a ring at the lamp for the 0.8 s | `clang` | a ring of dabs round the lamplighter |

- Damage counts as Flame, Ward or Gloam damage by the ability's colour. It is not blade damage, so Edge and Keen edge do not raise it; Flame does, for Flame abilities. It rounds once.
- An ability hit adds to the combo as a relic hit does (at most 1 each 0.25 s) and takes hit stop of 2 steps, inside the cap.
- Stun, hold and slow are new foe states (`status` on the foe): a stunned or held foe stops, and its wind-up stops; a slowed foe walks and winds up at half speed. A heavy foe (an Ironback, an elite that is not light) is never held, only slowed; a stun on it lasts half as long. The Barrow Reeve takes damage from abilities, but no stun, hold or slow, so its fight keeps its rules.
- **Bright abilities.** A drop is bright with a chance of 10% plus 4% for each Keen eye level. A bright ability has 25% more power and its button has a gold edge.

### Ability lamps
- An ability drops as a lamp of its colour: from a foe put out, 3% (plus 1% each Keen eye level), at most 3 a run; from a cache with the prize `ability`; and at the start (Belt). The seed's `ability` stream draws it from the kindled abilities.
- A touch fills an empty slot. With both slots full, a toast says "Lantern bomb · press an ability to swap". Pressing a slot's input while standing on the lamp swaps it: the old ability lies there as a lamp. No card opens, so a fight does not stop.

### Abilities with the moves
- The panes and relics that name a move do not change. Hot glass and the other panes name abilities (see `PANES`).
- The help card and the run's help add one line each for the two slots, with the keys of the device in use.

## 3. Difficulty and pacing

### Ember 0 is harder
- Foes deal 30% more damage at Ember 0 than now (`FOE_HARD.dmg` in `foes.js`, 1.3; the Ember 4 factor multiplies it). Foe health goes up 15% (`FOE_HARD.hp`, 1.15). The Barrow Reeve deals 20% more (`boss.js`, `REEVE.hard`), and its health stays 1,300.
- Builder P may move these within: damage 1.15 to 1.5, foe health 1.0 to 1.3, boss damage 1.0 to 1.4. Nothing else gets slower: no walk speed, no longer wind-ups.
- The starting kit is as now: 100 health, 2 flasks, 35% heals. So the first runs die, and Mantle, Flask, Draught and the sparks carry the player on.

### More to do in each place
- **Page zones.** `mix.js` gets `EXTRA`, a table of 2 or 3 more zones a place, each `{ id, c, leash, foes }` as in `games/gloam-downs/lib/zones.mjs`, at Ember 0 and up. They are not baked: `mixZones` adds them to `meta.zones` before the mix, and the same zone rules (`fits`, the cap of 6, pool slots, 20 m pairs) hold. Their centres are on the walk map's floor (checked by `qa/lab/gloam-downs-zones.mjs`, which builder P extends to read `EXTRA`), and none is within 8 m of a baked zone or the beacon. Their foes come from the place's pool, so no new baked foe is needed: a zone takes the pool's slots when it wakes and gives them back when it sleeps or is put out, as now.
- **A third wave** at each guard is the next lever, if the targets still miss.
- **Caches** add side trips (section 1).

### Targets
- A skill 0.5 bot with growth first wins in run 6 to 12 (median).
- A skill 0.9 bot first wins in run 1 to 3 (median), and its winning run lasts 15 to 25 minutes of game time.
- A first run at skill 0.3 reaches the second place in at least half the bots.
- Levers in this order: (1) the page zones; (2) the caches and their side trips; (3) the Ember 0 damage within its range; (4) foe health within its range; (5) a third wave at the guards. If the targets miss with all five, builder P reports which and why, and the user is told. The run is not padded with slower moves.
- Today's 0.9 run is 8.7 min with about 35 foes. The page zones add about 25 foes and the caches 5 to 8 side trips of 20 to 40 s, so about 15 to 18 minutes is the estimate before tuning. Abilities make fights shorter, which pulls the other way; the bot measures both.

### The bot with growth
`qa/lab/gloam-downs-bot.mjs` is rewritten (builder P):
- Each bot keeps one save (`run-save.js` `clean` and `store` on a Map) across its runs, up to 40 runs or its first win plus 5.
- In each Lamp-room (at a beacon and before a run) it spends: first a found pattern it can kindle, then the cheapest ware of its list (Mantle, Flask, Draught, Belt, Ash pocket, Edge, Keen eye, Lantern panes, First spark, then the unlocks), keeping 0 glim carried before it walks on when skill is 0.5 or more; a 0.3 bot carries on half the time.
- It picks sparks by a rule (Ward while its health share was under 50% at the last beacon, else Flame, Gloam once both abilities are held) and sets panes by a fixed order.
- It uses abilities: an attack ability when 2 or more foes are within its range or an elite is awake, Smoke step and Bell guard in place of a roll 40% of the time, Flare and Rime lamp on a wind-up it reads. The read uses the skill model it has now.
- It takes the caches it can reach with the keys it holds, and walks the ledges with the second jump.
- It steps the Barrow Reeve with `boss.js` (`makeBoss`), as `qa/lab/gloam-downs-boss.sim.mjs` does, in place of the drawn results.
- It writes, for each skill: the first run that reaches place 2 (share), the median first win, the winning run's game time, the minutes a place, the run at which 25%, 50%, 75% and 100% of the catalogue is bought, and the nudges a run.

## 4. The save, v3
- The key moves to `gloam-downs.run.v3`. A page that finds no v3 save reads v2 once (or, with no v2, v1 once), stores v3 at once, and from then on writes v3 only.
- v3 adds, each cleaned on the way in:
  - `patterns`: found and not kindled, known pattern ids, each once.
  - `kindled`: known ids; the starters (Lantern bomb, Smoke step, Thick glass, Hot glass) are always in it.
  - `keys`: known key ids.
  - `panes`: kindled pane ids, each once, at most the open slots.
  - `up`: the new wares `belt`, `keen`, `panes`, `first`, each clamped to its levels.
  - In `run`: `sparks` `{ flame, ward, gloam }` (0 to 40 each), `abilities` (two entries, each `{ id, bright }` of a kindled ability, or `null`), `carriedPatterns` (known ids not found or kindled, at most 2 from foes plus the caches), `caches` (spot ids of this run's places), `sparkPicks` (0 to 9), `abilityLamps` (dropped and not taken, with their place and spot, cleared on a new place), and in `entry` the same fields, so a reload restarts the place with them as they were.
  - In `ended`: `kept` and `lost` glim (as now), `patternsKept` and `patternsLost` (counts).
- From v2: every level of Mantle, Flask, Edge and Draught is kept; `up.ash` 1 becomes Ash pocket level 2 (40 + 80 = the 120 paid); `kindled` is the starters; a run in progress keeps its place and gets `sparks` 0 and slot 1 from the seed's `start` stream.

## 5. Screens
- **The Lamp-room** (`#lamp`) gets, in this order under `#lampLine`: `#colours` (the run's three levels, in a run only), `#ups` (the wares, with the new ones), `#patternsT` with `#patterns` (the found patterns, each with Kindle), `#unlocks`, `#panesT` with `#paneRow` (a row of buttons for each open slot), the Ember row, and `#lampRow`. The card scrolls inside itself, as now; the buttons stand at its foot.
- **The beacon card**: `#wicks` shows the wicks, then the spark picks (`#sparks`), then the kept patterns line `#beaconKept`, then Spend glim (now "Lamp-room") and Walk on.
- **The HUD**: `#colourRow` under the health line (builder G); `#patternsN` on the count line, "◇ 1" while a pattern is carried (builder G); `#abilities` (two slots with cooldown sweeps, glyph and name, bottom left over the stick on touch, beside the health line on desktop) (builder K).
- **The summary**: "Patterns kept 1 · lost 1", "Glim kept 12 · lost 108".
- Every new part is checked at 320 by 640, 390 by 844, 360 by 640, 800 by 600, 1280 by 720, and 844 by 390 (a phone held sideways). At 320 the HUD's colour row and the ability slots never overlap the health line, the count line, the combo meter or the touch buttons, and every touch button is at least 44 px on its shorter side.

## 6. Sound and music
`run-sound.js` gets a handler for each new event (builder K). They use cues that exist, so `sound.js` needs no recipe:

| Event | Detail | Sound |
|---|---|---|
| `pattern-found` | `{ id, place }` | `wisp`, then `glim` 0.1 s later |
| `pattern-kept` | `{ ids }` | after the beacon sting, `buy` |
| `pattern-kindled` | `{ id }` | `buy`, and a two-note harp figure from the Lamp-room theme on the next beat (`M.note`) |
| `key-found` | `{ id }` | `beacon`'s sting at half level, and the bell part of the win sting's first two notes (`M.note`) |
| `ability-use` | `{ id, slot }` | the ability's cue from its table |
| `ability-ready` | `{ slot }` | `focus`, at a low level |
| `spark-take` | `{ colour }` | `choice` |
| `cache-open` | `{ spot, prize }` | `cracks` for a stone, `wisp` for a ledge |

Ability hits and tells use their cue with `ability: <id>` in the cue log, so a later round can give them sounds of their own. A tell (Lantern bomb's ring, Flare's core) is not a foe's tell, so it does not bring the strings in.

## The shared modules

### `growth.js` (new)
Every builder that needs it first creates `public/lab/gloam-downs/growth.js` with exactly this text, so branches that add it merge with no conflict. A change goes through the merge pass.

```js
// Gloam Downs: the growth tables. The colours, the abilities, the panes, the patterns and the keys. Data only, no DOM, so the page,
// the Node tests and the bot read the same numbers. A change goes through the merge pass (gloam-downs-growth design.md).
export const COLOURS = [
  { id: 'flame', name: 'Flame', text: 'damage', hue: '#ff9a4a' },
  { id: 'ward', name: 'Ward', text: 'health', hue: '#8fd6a0' },
  { id: 'gloam', name: 'Gloam', text: 'abilities', hue: '#a99cff' }
];
export const COLOUR_IDS = COLOURS.map(c => c.id);
// what one level of a colour gives: full up to level 5, half a level after that
export const SPARK = { full: 5, flame: { power: 0.1 }, ward: { hp: 10, power: 0.1 }, gloam: { power: 0.1, cool: 0.04, coolMin: 0.6 } };
export const levelGain = n => Math.min(n, SPARK.full) + Math.max(0, n - SPARK.full) * 0.5;
export const MOVE_COLOUR = { blade: 'flame', plunge: 'flame', relic: 'flame', roll: 'gloam', miss: 'gloam', flask: 'ward' };
export const BRIGHT = { base: 0.1, perKeen: 0.04, power: 1.25 };
// the abilities: cooldown s, cue, the numbers of what it does; start: kindled from the first run, else a pattern with its cost
export const ABILITIES = [
  { id: 'bomb', name: 'Lantern bomb', colour: 'flame', cool: 8, cue: 'coal', start: true, text: 'a thrown lantern bursts', dmg: 28, r: 2.5, range: 6, fuse: 0.6, burn: 6 },
  { id: 'step', name: 'Smoke step', colour: 'gloam', cool: 6, cue: 'roll', start: true, text: 'a quick safe step', dist: 4, time: 0.12, safe: 0.3 },
  { id: 'snare', name: 'Ember snare', colour: 'gloam', cool: 10, cue: 'cracks', cost: 80, text: 'a snare holds a foe', dmg: 10, r: 1.2, hold: 2, slow: 0.5 },
  { id: 'moth', name: 'Moth wisp', colour: 'gloam', cool: 18, cue: 'wisp', cost: 160, text: 'a wisp fights beside you', dmg: 5, every: 0.8, life: 12, range: 6 },
  { id: 'crook', name: 'Crook line', colour: 'flame', cool: 7, cue: 'charge', cost: 100, text: 'a line pulls a foe', dmg: 8, range: 7, to: 1.2 },
  { id: 'rime', name: 'Rime lamp', colour: 'ward', cool: 12, cue: 'shards', cost: 120, text: 'a cone slows foes', r: 4, arc: 70, slow: 0.5, hold: 3 },
  { id: 'flare', name: 'Flare', colour: 'ward', cool: 14, cue: 'light', cost: 140, text: 'a flash stuns foes', r: 4, stun: 1.2, grow: 0.25 },
  { id: 'pitch', name: 'Pitch pour', colour: 'flame', cool: 12, cue: 'pulse', cost: 110, text: 'a pool of burning pitch', r: 2, life: 4, dmg: 4, every: 0.5 },
  { id: 'guard', name: 'Bell guard', colour: 'ward', cool: 9, cue: 'clang', cost: 130, text: 'turn the next blow aside', time: 0.8, back: 12 }
];
export const ABILITY_IDS = ABILITIES.map(a => a.id);
// the panes: passive picks set in the Lamp-room
export const PANES = [
  { id: 'thick', name: 'Thick glass', colour: 'ward', start: true, text: 'a foe put out heals 3% of your health' },
  { id: 'hot', name: 'Hot glass', colour: 'flame', start: true, text: 'a foe put out within 3 s of an ability cools the other by 2 s' },
  { id: 'smoked', name: 'Smoked glass', colour: 'gloam', cost: 120, text: 'ability cooldowns 15% shorter' },
  { id: 'ember', name: 'Ember glass', colour: 'flame', cost: 90, text: '+20% damage to a burning foe' },
  { id: 'lead', name: 'Lead glass', colour: 'ward', cost: 110, text: 'the first hit in each fight deals half' },
  { id: 'storm', name: 'Storm glass', colour: 'gloam', cost: 150, text: 'a near miss cools both abilities by 1 s' },
  { id: 'tallow', name: 'Tallow glass', colour: 'ward', cost: 130, text: 'a flask heals 10% more and cools both abilities by 3 s' },
  { id: 'clear', name: 'Clear glass', colour: 'gloam', cost: 180, text: 'an ability use makes the next blade hit within 2 s deal 40% more' }
];
export const PANE_IDS = PANES.map(p => p.id);
export const PANE_SLOTS = { base: 1, max: 3 };
// the patterns: every ability and pane that is not kindled from the first run, with its cost
export const PATTERNS = [...ABILITIES, ...PANES].filter(x => !x.start).map(x => ({ id: x.id, kind: ABILITY_IDS.includes(x.id) ? 'ability' : 'pane', cost: x.cost }));
export const PATTERN_IDS = PATTERNS.map(p => p.id);
export const STARTERS = [...ABILITIES, ...PANES].filter(x => x.start).map(x => x.id);
export const DROPS = { pattern: 0.02, patternElite: 0.35, patternPerKeen: 0.01, patternMax: 2, ability: 0.03, abilityPerKeen: 0.01, abilityMax: 3 };
// the keys: lasting, from a fixed elite's first fall
export const LAMP_KEYS = [
  { id: 'leap', name: 'Crow step', from: 'ramparts', text: 'jump again in the air', v: 7.4, after: 0.1 },
  { id: 'drop', name: 'Bell drop', from: 'bells', text: 'a plunge cracks a sealed stone', fall: 2 }
];
export const LAMP_KEY_IDS = LAMP_KEYS.map(k => k.id);
export const PRIZES = ['glim', 'spark', 'pattern', 'ability', 'flask'];
```

### `bus.js`
Every builder that adds an event first sets `public/lab/gloam-downs/bus.js` to exactly this text (only the `EVENTS` line changes):

```js
// Gloam Downs: the run's small event bus. The page and the fight emit; the run's sound listens. No DOM, so Node tests use it.
const subs = new Map();
export const EVENTS = ['place-enter', 'foes-alert', 'fight-calm', 'elite-alert', 'elite-fall', 'relic-take', 'boss-intro', 'boss-health', 'boss-phase', 'boss-fall', 'beacon-lit', 'run-death', 'run-win', 'lamp-room', 'combo-tier', 'pattern-found', 'pattern-kept', 'pattern-kindled', 'key-found', 'ability-use', 'ability-ready', 'spark-take', 'cache-open'];
export function on(name, fn) { if (!subs.has(name)) subs.set(name, new Set()); subs.get(name).add(fn); return () => subs.get(name).delete(fn); }
export function emit(name, detail = {}) { for (const fn of [...(subs.get(name) || [])]) { try { fn(detail); } catch (e) { console.error(e); } } }
```

| Event | Emitted by | Where |
|---|---|---|
| `pattern-found` | G | `run.js`, when a pattern lamp is touched |
| `pattern-kept` | G | `run.js` `lightBeacon` and `win`, when patterns were carried |
| `pattern-kindled` | G | `run.js` `kindle` |
| `key-found` | P | `keys.js` `keyDrop` |
| `ability-use` | K | `abilities.js`, when an ability starts |
| `ability-ready` | K | `abilities.js`, when a cooldown ends |
| `spark-take` | G | `run.js` `takeSpark` |
| `cache-open` | P | `keys.js`, when a cache opens |

## Who builds what
Three builders work in parallel worktrees. Each owns its files, and each may add only the hooks named here in files it does not own. A builder that needs another change in a file it does not own asks its owner, and the merge pass makes it.

### Builder G, growth
- **Owns**: `run.js`, `run-save.js`, `screens.js`, `cards.js`, `growth.js` (the shared text above), `qa/lab/gloam-downs-run.test.mjs`, `qa/lab/gloam-downs-builds.test.mjs`, `qa/lab/gloam-downs-growth.test.mjs` (new), `qa/lab/gloam-downs-run.growth.e2e.mjs` (new).
- **Builds**: glim at risk (no bank at the beacon, the kept share at death, the spend order), the new `UPGRADES` table, `kindle(rs, id)`, patterns (drops on `foeOut` and `eliteOut` in `run.js`, carried, kept at a beacon), `takeSpark(rs, colour)`, the colour factors (`colourPower(run, colour)` and the Flame term in `bladeBonus`), the Ward health, panes (`setPane(rs, slot, id)` and each pane's rule in `run.js`, with `paneOf(rs, id)` for K's cooldown panes), save v3, the Lamp-room rows, the beacon card's spark buttons and kept line, the summary lines, `#colourRow` and `#patternsN` on the HUD.
- **Hooks for others** that G puts in `run.js` (so the others do not edit it): in `makeRunner`, the options `abilities = null, keys = null` at the end of its destructured options, and after `R.relics = makeRelics(R);` the two lines `R.abilities = abilities ? abilities(R) : null;` and `R.keys = keys ? keys(R) : null;`; in `step`, the pend list becomes `['attack', 'roll', 'heal', 'ab1', 'ab2']`; after `fighter.step(a, camYaw, R.targets(), ev);` the two lines `R.abilities?.step(a, camYaw, ev);` and `R.keys?.step(a, ev);`; in `eliteOut`, after the `emit('elite-fall', ...)` line, `R.keys?.eliteOut(run.place, ev);`. The page and the bot pass `abilities: makeAbilities` and `keys: makeKeys` in the `makeRunner({...})` options.
- **`main.js` hooks**: the bodies of `fillLamp()`, `buyUp()`, `openBeacon()` but its `audio` and `emit` lines, `openSummary()`'s glim and pattern lines, `beginRun()`'s start picks; one line `updateGrowth();` at the start of `updateRunHud()`; one spread `...growthView(),` in the object `__gloam.run()` returns; one call `setGrowth(o);` in `__gloam.set`; and one import line after the `screens.js` imports.
- **`index.html`**: in `#lamp`, `<p class="colours" id="colours" hidden></p>` after `#lampLine`, `<h3 id="patternsT">Patterns</h3><ul class="ups" id="patterns" aria-labelledby="patternsT"></ul>` after `#ups`, and `<h3 id="panesT">Lantern panes</h3><div class="panes" id="paneRow" role="group" aria-labelledby="panesT"></div>` after `#unlocks`; in `#beaconCard`, `<div class="wicks" id="sparks" hidden></div>` after `#wicks` and `<p id="beaconKept" hidden></p>` after `#sparks`; in `#hud`, `<p class="colourRow" id="colourRow" hidden></p>` after `#life`, and `<i id="patternsN" hidden></i>` as the last child of `#count`; their CSS in the run's style block after the `.ups` rules.

### Builder K, abilities
- **Owns**: `abilities.js` (new: the slots, cooldowns, each ability's rule, the ability lamps on the ground, the swap, `abilityView()`), `input.js`, `moves.js`, `fight.js`, `sparks.js`, `run-sound.js`, `qa/lab/gloam-downs-abilities.test.mjs` (new), `qa/lab/gloam-downs-run.abilities.e2e.mjs` (new), `qa/lab/gloam-downs-mouse.test.mjs`, `qa/lab/gloam-downs-sound.test.mjs`, and the input lines of `qa/lab/gloam-downs-run.input.e2e.mjs`.
- **Builds**: `KEYS.ab1 = ['f', 'u']`, `KEYS.ab2 = ['g', 'i']`; mouse buttons 3 and 4 (`mouseAct` returns `'ab1'` and `'ab2'`); pad LB and LT (LT stops rolling); `ab1` and `ab2` in the held input and the latch; the touch buttons; the nine abilities; foe `status` (stun, hold, slow, burn); the drawing of every ability, the ability lamps, the pattern lamps (from G's `groundPatterns(runner)`), the sealed stones and caches (from P's `groundSpots(runner)`); the HUD's `#abilities` and `updateAbilities()`; the run-sound handlers.
- **`foes.js` hooks**: one import line for `abilities.js`; in the hit function, one line `statusHit(f, o);` after the damage is taken; in `stepFoe`, one line at the top `const st = statusStep(f); if (st.stop) return;` and the factor `st.speed` on the walk and the wind-up count (one edit to each of those two lines); in the boss, nothing.
- **`main.js` hooks**: the `makeInput({...})` call (add `ab1: $('bAb1'), ab2: $('bAb2')`); one line `updateAbilities();` at the end of `updateRunHud()`; `abilities: makeAbilities` in the `makeRunner({...})` call and `groundAbilities`, `groundPatterns`, `groundSpots` in the `makeFight({...})` call of `newRunner()`; one spread `...abilityView(),` in `__gloam.run()`; `showControls`'s two help lines; one import line after the `input.js` import.
- **`index.html`**: `<button type="button" class="act ab ab1" id="bAb1" hidden aria-label="Ability 1"><i></i><b></b></button>` and the same for `bAb2` after `#bHeal`; `<div class="abilities" id="abilities" hidden></div>` in `#hud` after `#combo`; their CSS after the `.act` rules; the two help lines in `#helpKeys`.

### Builder P, pacing and keys
- **Owns**: `foes.js` (but K's hooks), `boss.js`, `mix.js`, `elites.js`, `keys.js` (new: `makeKeys`, the second jump, the stone rule, `SPOTS`, `groundSpots`, `keyDrop`, the caches), `qa/lab/gloam-downs-ledges.mjs` (new), `qa/lab/gloam-downs-zones.mjs`, `qa/lab/gloam-downs-bot.mjs`, `qa/lab/gloam-downs-keys.test.mjs` (new), `qa/lab/gloam-downs-run.keys.e2e.mjs` (new), `qa/lab/gloam-downs-foes.test.mjs`, `qa/lab/gloam-downs-foes-ai.test.mjs`, `qa/lab/gloam-downs-seed.test.mjs`, `qa/lab/gloam-downs-boss.test.mjs`, `qa/lab/gloam-downs-boss.sim.mjs`, and the pacing results in this design.md (section "Pacing results", added by P).
- **Builds**: `FOE_HARD` and `REEVE.hard`; `EXTRA` zones in `mix.js`; the ledge scan and `SPOTS`; the two keys; the caches and their prizes (a `spark` or `pattern` prize calls G's `takeSparkPick(rs)` or `dropPattern(R, at)`; an `ability` prize calls K's `dropAbility(R, at)`); the bot with growth; the pacing tune.
- **`main.js` hooks**: `keys: makeKeys` in the `makeRunner({...})` call; one line `keysLine();` in `openPause()` and `<p id="keysLine"></p>` after `#seedLine` in `index.html`; the help card's two key lines in `showControls`; one import line after the `mix.js` import.
- **`play.js`**: no change. If the second jump cannot be done through `body.s.vy`, P stops and asks first, with the failing test.

### Shared
- `growth.js` and `bus.js` as above.
- `__gloam.set(fields)` gains `sparks`, `patterns`, `kindled`, `panes`, `bank` (G), `abilities` and `cool` (K), `keys` (P). `__gloam.run()` gains `sparks`, `patterns`, `carriedPatterns`, `panes` (G), `abilities` with `{ id, bright, left }` for each slot (K), `keys` and `caches` (P). Each builder adds its fields in its own spread function.
- The merge pass goes in the order G, K, P, because K and P call G's functions, and P's bot reads all of it. It runs every Gloam Downs check, the bot and the pacing tune.

## Checks
- Node: `gloam-downs-growth.test.mjs` (glim at risk, wares, patterns, kindle, sparks, panes, save v3 and the v2 read), `gloam-downs-abilities.test.mjs` (each ability's numbers, cooldowns, status, the swap, the colours), `gloam-downs-keys.test.mjs` (the second jump's height, the stone rule, each spot on the walk map and reachable only with its key, the caches), `gloam-downs-run.test.mjs`, `gloam-downs-builds.test.mjs`, `gloam-downs-feel.test.mjs`, `gloam-downs-seed.test.mjs`, `gloam-downs-foes.test.mjs`, `gloam-downs-foes-ai.test.mjs`, `gloam-downs-boss.test.mjs`, `gloam-downs-sound.test.mjs`, `gloam-downs-mouse.test.mjs`, `gloam-downs-camera.test.mjs` (must still pass), and `node qa/lab/gloam-downs-zones.mjs` with the page zones.
- Browser, with the site served: `gloam-downs-run.growth.e2e.mjs`, `gloam-downs-run.abilities.e2e.mjs`, `gloam-downs-run.keys.e2e.mjs`, and every existing Gloam Downs e2e file. Each new HUD and card part at 320 by 640, 390 by 844, 360 by 640, 800 by 600, 1280 by 720 and 844 by 390.
- Sound: `CHROMIUM_PATH=/opt/pw-browsers/chromium QUIET_URL=http://127.0.0.1:8765 node qa/arcade/quiet.mjs --only=lab/gloam-downs`, and the music demo's existing groups still meet their targets.
- Pacing: `node qa/lab/gloam-downs-bot.mjs 60 <skill> 1` at 0.3, 0.5 and 0.9.
- What cannot run here must be said: a real phone, a real gamepad, the mouse's side buttons on real hardware, and listening on speakers.
