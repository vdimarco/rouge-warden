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
- **The rules on the ground.** A ledge's cache opens to feet on the ground within 1 m of it and 0.35 m of its height (`KEY_RULES.rise`), so it opens on the ledge, not from the floor under it. A jump the controller takes in its coyote time (0.12 s after walking off an edge) is not the second jump, so Crow step stays for a second press.
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
- The cooldowns carry over to the next place: the runner of each place copies them to `rs.run.abilityLive`, and the next runner (Walk on, Back to the start) starts from them, with a Moth wisp still flying. A snare, a pool of pitch and a bomb in flight stay in the place they were laid in. A page reload starts them ready (`abilityLive` is not saved).
- Inputs (new; the old ones do not change but one):
  - Keys: F or U for slot 1, G or I for slot 2.
  - Mouse: side buttons 3 (back) for slot 1 and 4 (forward) for slot 2, while the mouse is taken or free. They are read from `pointerdown`, `pointermove` (a side button pressed while another is down) and `pointerup`, whose default the page cancels, so the browser does not go back a page. Chromium sends no `mousedown` after a cancelled `pointerdown`, so the page never reads them from `mousedown`; it still cancels `mousedown`, `mouseup` and `auxclick` of these buttons. The keys stay for a mouse that has no side buttons. The run's help card adds "Mouse buttons 4 and 5 use the abilities too. On an ability lamp, an ability's key swaps it." The pause panel keeps the short "F G abilities", so it still fits at 800 by 600 with no scroll.
  - Pad: LB (4) for slot 1, LT (6) for slot 2. **LT no longer rolls**; B still does. This is the one change to an old input: the pad has no other free shoulder button, and a shoulder can be pressed with the thumb on the right stick.
  - Touch: two round buttons, `#bAb1` and `#bAb2`, 56 px, above and left of Attack in the right-thumb group, each with the ability's short name. While a slot cools its button goes grey and near black, its label is the seconds left in 20 px figures, and the time left is a pale sweep that shrinks. They are hidden while the slot is empty.
  - The HUD's key labels follow the input in use: a pad press shows LB and LT, and a key or a mouse press in play shows F and G again.
- A press is buffered 0.15 s, as the moves are, and waits for the next play step in hit stop.
- An ability does not start while the lamplighter drinks, rolls, is hurt or plunges: the press gives the `refuse` cue and is spent. It can start in the air (but Smoke step and Bell guard, which also refuse there) and after a cut's strike.

### The abilities
`ABILITIES` in `growth.js` holds the numbers. Two are kindled from the first run (Lantern bomb, Smoke step); the other seven are patterns. Each power value grows by its colour.

| Ability | Colour | Cooldown | What it does | Its tell (seen before it hurts) | Cue | Drawn as |
|---|---|---|---|---|---|---|
| Lantern bomb | Flame | 8 s | throws a lantern 6 m ahead (to the soft-aim foe within 8 m); it bursts 0.6 s later for 28 in 2.5 m, and burns for 6 over 2 s | a ring marker on the ground for the 0.6 s | `coal` on the throw, `slam` on the burst | an arc of dabs, then a ring and a flash in fire slots under 37 |
| Smoke step | Gloam | 6 s | moves 4 m in the stick's way (or ahead) over 0.12 s (a share each play step, so a blow in it is judged where the lamplighter is on the way), safe for 0.3 s; a near miss in it counts as the roll's | none needed; it hurts nothing | `roll` | a puff at both ends, grey dabs |
| Ember snare | Gloam | 10 s | sets a snare at the feet; the first foe that steps in springs it (a light foe before a heavy one): a light foe is held 2 s, a heavy foe slowed 50%, and either takes 10 | the snare's ring glows on the ground | `cracks` | a ring of 14 dabs 0.07 m across, 0.15 m up, with a blinking centre |
| Moth wisp | Gloam | 18 s | a wisp flies at the lamplighter's shoulder for 12 s and hits the nearest awake foe within 6 m for 5 each 0.8 s | the wisp's line to its foe shows 0.2 s before each hit | `wisp` | a lamp-colour wisp of 6 dabs |
| Crook line | Flame | 7 s | a line to the soft-aim foe within 7 m: pulls a light foe to 1.2 m in front (centre to centre, over 0.2 s) and deals 8; pulls the lamplighter to a heavy foe | the line shows for 0.15 s before the pull | `charge` | a line of dabs |
| Rime lamp | Ward | 12 s | a cone of 4 m and 70° ahead; foes in it move and wind up 50% slower for 3 s | a pale cone on the ground for 0.2 s | `shards` | a fan of pale dabs, frost on the foes |
| Flare | Ward | 14 s | every foe within 4 m that sees the lamplighter is stunned 1.2 s; a wind-up under way stops | a white core grows for 0.25 s | `light` | a burst of dabs, bright but under fire 37 |
| Pitch pour | Flame | 12 s | a pool of 2 m at the feet for 4 s; a foe in it burns for 4 each 0.5 s; a burn from the blade or a bomb doubles it once | the pool shows at once; it burns from 0.3 s | `pulse` | three rings of dark and ember dabs (5, 9 and 13) that fill the 2 m |
| Bell guard | Ward | 9 s | for 0.8 s the next hit from in front is turned aside (no damage) and a coal is thrown back at its Pitchrook for 12 | a ring at the lamp for the 0.8 s | `clang` | a ring of dabs round the lamplighter |

- Damage counts as Flame, Ward or Gloam damage by the ability's colour. It is not blade damage, so Edge and Keen edge do not raise it; Flame does, for Flame abilities. It rounds once.
- An ability hit adds to the combo as a relic hit does (at most 1 each 0.25 s) and takes hit stop of 2 steps, inside the cap.
- Stun, hold and slow are new foe states (`status` on the foe): a stunned or held foe stops, and its wind-up stops; a slowed foe walks, winds up and charges at half speed (the Ironback's charge and the hook's step too). Each state shows while it lasts (`stateDabs` in `fight.js`): a stunned or held foe stands in a stagger's pose (`poseOf`), with 5 pale dabs circling over its head (stun) or 6 warm lamp dabs at its feet (hold); a slowed foe has 4 frost dabs (Ward's 38) at its chest; a burning foe 3 dark embers rising. None is a fire slot but the snare's ember 34, so a state never reads as a tell. A heavy foe (an Ironback, an elite that is not light) is never held, only slowed; a stun on it lasts half as long. The Barrow Reeve takes damage from abilities, but no stun, hold or slow, so its fight keeps its rules.
- **Bright abilities.** A drop is bright with a chance of 10% plus 4% for each Keen eye level. A bright ability has 25% more power and its button has a gold edge.

### Ability lamps
- An ability drops as a lamp of its colour: from a foe put out, 3% (plus 1% each Keen eye level), at most 3 a run; from a cache with the prize `ability`; and at the start (Belt). The seed's `ability` stream draws it from the kindled abilities.
- A touch fills an empty slot. With both slots full, a toast says "Lantern bomb · press an ability to swap" as the feet touch the lamp (the runner sends an `ability` event, and the page shows its toasts on it). Pressing a slot's input while standing on the lamp swaps it: the old ability lies there as a lamp. No card opens, so a fight does not stop.
- A swap keeps the cooldowns: the lamp of the ability put down holds the cooldown it had (`cool`, `full` in play steps) and goes on cooling where it lies; an ability taken from a lamp starts with what its lamp holds. A new lamp from a drop or a cache holds none. The save keeps a lamp's cooldown.

### Abilities with the moves
- The panes and relics that name a move do not change. Hot glass and the other panes name abilities (see `PANES`).
- The help card and the run's help add one line each for the two slots, with the keys of the device in use.

## 3. Difficulty and pacing

### Ember 0 is harder
- Foes deal 30% more damage at Ember 0 than now (`FOE_HARD.dmg` in `foes.js`, 1.3; the Ember 4 factor multiplies it). Foe health goes up 15% (`FOE_HARD.hp`, 1.15). The Barrow Reeve deals 20% more (`boss.js`, `REEVE.hard`), and its health stays 1,300.
- Builder P may move these within: damage 1.15 to 1.5, foe health 1.0 to 1.3, boss damage 1.0 to 1.4. Nothing else gets slower: no walk speed, no longer wind-ups.
- The starting kit: 100 health, 1 flask (2 before the pacing pass; see "Pacing results"), 35% heals. So the first runs die, and Mantle, Flask, Draught and the sparks carry the player on.
- The run's later places are harder: foe damage ×(1 + 0.35 d^1.5) and health ×(1 + 0.4 d^1.5) at place depth d, and the Reeve has 5% more health for each spark the run holds ("Pacing results").

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
- **As built (branch `gloam-grow-g`)**:
  - The page parts live at the end of `cards.js` (`bindGrowth`, `updateGrowth`, `fillGrowthLamp`, `sparkButtons`, `abilityButtons`, `growthView`, `setGrowth`), since no new file was in G's list. The one import line in `main.js` also binds them with getters for the page's state (`rs`, `runner`, `mode`, `toast` and the rest).
  - `updateRunHud()` writes `#count` again after `updateGrowth()`, so `#patternsN` is set in a microtask, as the last child of `#count`.
  - Two texts no longer held and were changed outside the hooks: the beacon toast in `runEvent` ("The beacon burns, and the flasks are full. Spend the glim you carry, or carry it on.") and the run help's line in `index.html`.
  - Lead glass: a fight starts again once no target is awake. Tallow glass: a flask heals 1.1 times as much. Clear glass: the runner opens its 2 s on an event `{ type: 'ability-use' }` in its step's events, which `abilities.js` should push. Ember glass: `paneHit(rs, target)` gives +0.2 for a target with `status.burn > 0`; the hit code (K) adds it.
  - The pattern rolls count in `run.patternRolls`, which the save and the entry keep, so a reload draws the same patterns again.
  - A run from v2 gets slot 1 from `startAbilities(seed, rs)` with Belt 0.
  - A cache's spark sets `run.sparkNow`; `updateGrowth()` opens the beacon card for that one pick while the run plays.
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

## Merge pass
Run on `ccr-43aa269a-y8yo7l` from the design commit `afc6aa70`, on 2026-11-25.

### What was merged
- **G** (`gloam-grow-g`, `4dc0dc89`): merged with no conflict.
- **K** (abilities) and **P** (pacing and keys): **not merged**. Neither builder came back: there is no branch and no report. So the game has no abilities to use, no `abilities.js`, no new inputs, no keys, no hidden ledges or caches, no `FOE_HARD`, no page zones, and no rewritten bot. G's hooks for them (`abilities` and `keys` in `makeRunner`, the pend list, the step lines, `R.keys?.eliteOut`) are in place and do nothing while those options are null.
- What a player sees of K's part without K: Belt is sold in the Lamp-room and asks for a start ability that does nothing yet; Gloam sparks raise a colour no move uses; the patterns of the seven abilities can drop and be kindled; Hot, Smoked, Storm and Clear glass have no effect. These wait for K. (The fix pass below built K's and P's parts; this line is the state at the merge pass.)

### What the merge pass changed
- `main.js`: G's import line, which also held a destructure and a `bindGrowth` call, is now two import lines and a bind after the imports. No change in what it does.
- `index.html`: the run's count line does not wrap (so "◇ 1" stays on its line at 320 px), and on a narrow upright screen (520 px wide or less, 560 px tall or more) the place's name card starts 220 px down, under the HUD at its tallest. Before, at 320 by 640, the name card's "II · The second place" lay over the count line, which the colour row and the pattern mark had pushed down.
- `index.html`: the Lamp-room's foot (`#lampRow`) is 99.5% opaque, not 97%. With the taller Lamp-room the rows under it showed through, faintly, below Back to the beacon at 1280 by 800. Fully opaque made Chromium draw a grey band over the top of the card, so it is 99.5%.
- `screens.js`: `growthText` keeps a number and its unit together ("1 s", "4 m"), so a pane's text no longer breaks before its "s" at 320 px.
- Tests updated for G's rules (the files are K's and P's and others, changed here because the rules changed): the v3 save key, the beacon that carries glim on, the beacon's spark pick before Walk on, the 23 bus events, the new run help, the 10% and 18% kept shares, the nine wares and the summary's rows. See tasks.md 4.2 and 4.3 for the list.
- `qa/lab/gloam-downs-bot.mjs`: the least change that lets the bot play by G's rules (P's rewrite is still to come): one save across runs (up to 40, or 5 after the first win), the Lamp-room at every lit beacon with the glim carried spent first, spark picks (Ward under 50% health, else Flame), the panes that work without abilities (Thick, then Lead and Tallow when kindled), and new lines for the catalogue share bought and the glim kept and lost. No abilities, keys or caches; the boss fight is still drawn from the old boss-bot results.

### Fix pass after the checkers
Run on `ccr-43aa269a-y8yo7l` after the merge pass, on 2026-11-25. Builders K and P never came back, so this pass built their parts on G's hooks, and fixed what the checkers found. Each problem was confirmed on the tree first (by `ls`, `grep`, a Node script or the browser), and each fix has a test that failed before it.

### What the checkers found, and what was done
| Problem | Confirmed | Done |
|---|---|---|
| No abilities: no `abilities.js`, no input, no HUD | yes: no file, `makeRunner` got `abilities: null`, F/G/LB did nothing | built (below) |
| No keys, no second jump, no ledges or stones | yes: no `keys.js`, no `rs.keys` writer | built (below) |
| Pacing misses its targets | yes, and still: see "Pacing results" | page zones and harder Ember 0 built and tuned; two targets still miss |
| The bot drew the Reeve's fight | yes: the header said so | the bot steps `boss.js` with the boss bot's own mind, moved to `qa/lab/gloam-downs-bossbot.mjs` and shared |
| Nudges: about 18 a run, not 7 | yes | a foe it cannot reach that is not a guard's or the elite is now left behind; the header gives the measured numbers (12 to 18 a run) |
| Glim spent on things that do nothing (Belt, Gloam, panes, ability patterns, Keen eye's ability share) | yes: `colourPower` and `coolShare` had no caller | all work now: the abilities use Belt, Gloam, Keen eye, Hot, Smoked, Storm, Tallow and Clear glass |
| Losing 90% at a death is harsh, and the beacon warned in one line | yes | the 10% rule stays (design); the beacon card now says in numbers what a death would keep and lose |
| Pattern lamps never drawn | yes: nothing read `groundPatterns` | `fight.js` draws pattern lamps, ability lamps, caches and stones as steady dabs |
| `R.floorAt` never set | yes | set in `makeRunner`; the elite's pattern lamp and relic lie on the floor, past no wall |
| A beacon wiped pattern lamps on the ground | yes | a lit beacon or a win takes them as carried, as it takes the glim motes |
| The bot never walked to lamps, never bought Belt or Keen eye | yes | it walks to lamps within 12 m and to caches its keys open, kindles every found pattern, buys Belt and Keen eye |
| Low: colour row marks shared the wisps' and glim's shapes | yes | the row is words: "Flame 2 Ward 1 Gloam 0" |
| Low: the summary said the glim twice | yes | "Glim banked" shows only when it differs from "Glim kept" |
| Low: Rookchief logged an elite check for every foe after it | yes | `foeOut` gets the foe; only the elite itself skips the 2% roll |
| Low: Lead glass re-armed per place, and any hurt used it up | yes | a fight ends once no target sees the lamplighter; only a set Lead glass is spent |
| Low: an old summary showed "kept 0" | yes | `kept` is null when the save had none; the summary then shows only what was banked |
| Low: a Mirelight's drops hung in the air | yes | a flier's drops fall to the floor or water under it |

### What was built, and where it differs from the plan above
- `abilities.js`: the two slots, the nine abilities with the numbers of `ABILITIES`, cooldowns on the play clock with Gloam (`coolShare`) and Smoked glass, power by colour (`colourPower`) and bright (25%), the 0.15 s buffer, the `refuse` cue, ability lamps (3% from a foe and 1% a Keen eye level, 3 a run; bright 10% and 4% a Keen eye level), the touch and the swap, Hot, Storm and Tallow glass, Bell guard's turn in `R.hurt`, and `ability-use` and `ability-ready`. An ability's hit is a relic hit for the combo, with 2 steps of hit stop.
- `status.js` (new, not in the plan): `statusHit` and `statusStep`. They are not in `abilities.js` so that `foes.js` can import them with no loop through `run.js`.
- `foes.js`: the status hook in `stepFoe` (a stun or hold stops the foe and its wind-up; a slow halves its walk and its wind-up), `FOE_HARD` (damage 1.3, health 1.15), the coal's `coal` flag for Bell guard, and the foe passed to `runner.foeOut`. `boss.js`: `REEVE.hard` 1.2.
- `input.js`: F or U, G or I; the side buttons 3 and 4 in a run (the page takes their down, up and auxclick); LB and LT on a pad, and LT no longer rolls; `#bAb1` and `#bAb2`. `moves.js`: Smoke step's safe time counts as the roll's, and Ember glass adds to a blade hit on a burning foe.
- The HUD: with a mouse, keys or a pad, `#abilities` shows "F Lantern bomb 8 s" for each slot; on touch the two round buttons over Attack and Heal show the short name and a dark sweep, and the HUD row is hidden, so the HUD is no taller at 320 px. The pause panel's `#keysLine` shows only once a key is held, so the panel still fits at 1280 by 720.
- `fight.js`: ability effects as dabs (throw, ring, burst, puffs, cone, core, flash, snap) and steady dabs for lamps, caches, stones, a snare, a pool, a moth and Bell guard. The spark pool keeps 64 steady dabs (was 40). Pattern and ability lamps use no fire slot (34 to 37) and not the lamp's warm 46: Flame lamps the dark ember 33, Ward 38, Gloam 39 (and a pattern's core 39); caches and stones use the lamp's 46 and 47, as relics do. Fire is the colour of a foe's tell: three ability lamps in fire 35 lying by a Snuffer made the phone's tell check count 27 fire pixels at rest and fail, and in 46 still 22 (the grade brings 46 near the fire slots); in 33, 38 and 39 it counts 11. A bright lamp has a larger core.
- `keys.js`: `leap` (the second jump, 7.4 m/s, from 0.1 s, once until the feet land, through `body.s.vy`; `play.js` unchanged), the stone rule on the plunge's `land` cue (a fall of 2 m or more), caches once a run with their prizes (`R.prize` in `run.js`), `keyDrop` on the first fall of the Rookchief and the Bellwether, saved at once, and `key-found` and `cache-open`.
- `qa/lab/gloam-downs-ledges.mjs`: the two reach searches (`PARAMS`, and `jumpV` 10.94), ledge cells grouped into patches of 1.5 m² or more, and then a test the plan did not have: it plays the real controller from a stand under each patch with a few timings, keeps a ledge only when the second jump lands on it and the same inputs with no second jump do not, and checks again with the rounded numbers it writes. A stone is flat floor that a plunge from floor 0.7 m or more higher lands on after a fall of 2 m or more. Found: the Gaol 5 patches (3 opened), The Crow Wall 6 (4), The Fen 6 (2), The Bell Knoll 3 (3), Barrow Crown 2 (2); kept: two ledges and a stone in each place but Barrow Crown, which keeps one ledge (its second failed with the rounded numbers). **The scan does not look for shortcuts**, so whether a ledge shortens a route is not known (task 3.3 stays open).
- `mix.js` `EXTRA`: three page zones in the Gaol (G6, G7, G8), The Crow Wall (R5, R6, R7) and The Fen (F5, F6, F7), two in Barrow Crown (W5, W6), and **none in The Bell Knoll**: with its pool's one Ironback and three Snuffers, every page zone tried there left 3 to 72 of 200 seeds with no zone for the elite. The Fen and Barrow Crown keep 7 m from the baked zones, not 8 (no room at 8). A zone near the arena (W7) broke the 25 m rule and was dropped. With more zones sharing each pool, Ember 3's foe more fits in 28% of zones (was 40%; the seed test's floor is now 25%).
- Sound: the bus handlers use cues that exist: `glim` for `pattern-found` (the runner logs the touch's `wisp`), `buy` for `pattern-kept` and `pattern-kindled` (no harp figure), `light` for `key-found` (not the beacon sting and bells), `focus` for `ability-ready`, `choice` for `spark-take`, and `glim` with the runner's `cracks` or `wisp` for `cache-open`.
- The bot: one save across runs; the Reeve stepped with `boss.js` and the shared boss mind; abilities (an attack ability with 2 foes near or an elite up, Smoke step or Bell guard for 4 rolls in 10, Flare or Rime lamp on a wind-up it reads near it); lamps and caches; Belt's start ability; sparks (Ward, Gloam once both slots hold one, else Flame); `HARD_DMG`, `HARD_HP` and `REEVE_HARD` to try a lever.

### Pacing results
The pacing pass (branch `gloam-grow-pace`, 2026-11-25) fixed the early win the way the player asked: the lamplighter starts weak, the places ahead grow harder, and lasting growth gives the strength back.

**What changed** (all in `run.js` `BASE` and `PACE`, read by `foes.js`, `fight.js` and the bot):
- The run starts with **1 flask**, not 2 (`BASE.flasks`). The first Flask level (60 glim) gives the second back, and every Flask level adds one, up to 5 with every level (was 6).
- Foes in the run's later places hit harder and have more health (`foeScale`). At place depth d (the run's first place is 0, Barrow Crown 4), damage ×(1 + 0.35 d^1.5) and health ×(1 + 0.4 d^1.5): ×1.35 and ×1.4 in the second place, ×2.0 and ×2.1 in the third, ×2.8 and ×3.1 in the fourth, ×3.8 and ×4.2 in Barrow Crown. They multiply `FOE_HARD` (1.3 and 1.15, as before). The Gaol is as it was, so a first run's start is the same fight. Elites keep their own health.
- The Barrow Reeve has 5% more health for each spark the run holds when it reaches Barrow Crown (`bossScale`, with Ember 5's 1.25): 1,820 with 8 sparks. A run that grew more meets a larger Reeve.
- The bot takes the levers as `START_HP`, `START_FL`, `HEAL`, `BLADE`, `DEPTH_DMG`, `DEPTH_HP`, `DEPTH_POW`, `BOSS_SPARK`, `REEVE_HP` and `THICK`, and prints the time nudges add to a run.

**What was tried.** Each line is `node qa/lab/gloam-downs-bot.mjs <bots> <skill> 1` with only the named levers changed from the game as it was at `1da574d1` (foes ×1.3 damage and ×1.15 health, the Reeve ×1.2, 100 health, 2 flasks). "Reach" is the share of first runs at 0.3 that reach The Crow Wall; "won" is the median first-win run; "min" the median winning run at 0.9. A depth lever written "a/b" is damage/health per place, linear unless a power is given.

| Step | Levers | Bots | 0.3 reach | 0.3 won | 0.5 won | 0.9 won | 0.9 min |
|---|---|---|---|---|---|---|---|
| base | none | 20 | 75% | run 2 | run 1 | run 1 | 8.9 |
| A | depth 0.25/0.25 | 20 | 75% | 7 | 1 | 1 | 9.4 |
| B | depth 0.4/0.3, Reeve +5% a spark | 20 | 75% | 9 | 2 | 1 | 9.5 |
| C | 70 health, blade ×0.75, depth 0.25/0.25 | 20 | **10%** | 27 | 2 | 1 | 10.1 |
| D | 1 flask, depth 0.3/0.3, Reeve +5% | 20 | 65% | 11 | 2 | 1 | 9.9 |
| E | depth 0.6/0.5, Reeve +5% | 20 | not run | | 5 | 1 | 10.0 |
| F | depth 0.9/0.5, Reeve +8% | 20 | not run | | 12 | 3 | 10.5 |
| G | depth 0.6/0.8, Reeve +5% | 20 | 75% | 35 (11 of 20 won) | 6 | 2 | 10.9 |
| H | depth 1.2/0.6, Reeve +10% | 20 | not run | | 24 | 13 | 10.1 |
| I | G and 1 flask | 20 | 65% | 37 (3 of 20) | 8 | 2 | 10.6 |
| J | G, 85 health, blade ×0.85 | 20 | **25%** | 26 (1 of 20) | 8 | 2 | 11.2 |
| K | G, 1 flask, blade ×0.85 | 20 | **25%** | 33 (1 of 20) | 9 | 2 | 12.0 |
| L | depth 0.5/0.7, Reeve +5%, 1 flask, 85 health, blade ×0.85 | 20 | **20%** | 27 (1 of 20) | 7 | 2 | 11.0 |
| M | depth 0.5/0.8, Reeve +5%, 1 flask | 20 | 65% | 26 (8 of 20) | 5 | 2 | 11.0 |
| I | as I | 60 | 60% | 37 (10 of 60) | 6 | 2 | 10.5 |
| N | depth 0.75/0.8, Reeve +5%, 1 flask | 60 | not run | | 11 | 3 | 10.5 |
| linear 0.7/0.8 | depth 0.7/0.8, Reeve +5%, 1 flask | 60 | 60% | 39 (2 of 60) | 10 | 2 | 10.6 |
| **chosen** | depth 0.35/0.4 at power 1.5, Reeve +5%, 1 flask | 60 | **60%** | **35 (34 of 60)** | **7** | **1** | **10.3** |

What the steps showed:
- A lower start health or blade (C, J, K, L) breaks the 0.3 target at once: the Gaol's fights get longer, and a 0.3 bot dies there. One flask fewer costs less (65% and 60%), so it is the start weakness kept. Mantle and Edge stay as they were; they give strength on top of the start, as before.
- Foes that grow with the place index move the 0.5 bot's first win from run 1 to run 5 to 24 (E to H) without touching the Gaol, so the 0.3 target holds. The 0.9 bot needs fewer runs than the 0.5 bot because it reads more wind-ups and takes less damage a run (389 against 540).
- A linear step (I, N, the linear line) left the 0.3 bots stuck at The Crow Wall: only 2 to 10 of 60 won within 40 runs, though their glim bought a quarter of the catalogue. A step that is small at the second place and grows after it (power 1.5) keeps the later places as hard and lets growth carry a weak player on: 34 of 60 won within 40 runs.
- Fewer free heals were not needed: Thick glass, the fifth wisp's flask and the beacon's full flasks are as they were.

**The game as committed**, 60 bots at each skill:

| Skill | First run reaches place 2 | Median first win | Winning run | Runs (won) | Glim at a death, kept / lost | The Reeve's fight | Catalogue 25% bought | Abilities a run | Caches a run | Nudges a run (time) |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.3 | 36 of 60 (60%) | run 35 (34 of 60 won within 40 runs) | 5.6 min | 2,283 (51) | 21 / 75 | 29 s | run 32 (50 of 60) | 16 | 2.5 | 6.0 (0.4 min) |
| 0.5 | 57 of 60 | run 7 (60 of 60) | 6.1 min | 728 (145) | 12 / 43 | 32 s | run 12 (33 of 60) | 38 | 4.1 | 10.1 (0.6 min) |
| 0.9 | 59 of 60 | run 1 (60 of 60) | 10.3 min | 414 (228) | 11 / 42 | 43 s | run 8 (9 of 60) | 86 | 4.6 | 17.3 (1.2 min) |

Minutes a place (median) at 0.9: the Gaol 2.2, The Crow Wall 1.9, The Fen 2.4, The Bell Knoll 1.6, Barrow Crown 2.0. Where 0.5 runs end: Barrow Crown 503 (145 of them wins), The Fen 145, The Bell Knoll 39, The Crow Wall 37, the Gaol 4.

Against the targets:
- A first run at 0.3 reaches place 2 in half the bots or more: **met** (60%).
- At 0.5 the median first win in run 6 to 12: **met** (run 7).
- At 0.9 the first win in run 1 to 3: **met** (run 1).
- At 0.9 a winning run of 15 to 25 minutes: **missed** (10.3 min). No lever measured here moves it far: foes with 4.2 times the health in Barrow Crown add about 1.5 minutes to a 0.9 run (8.9 to 10.3), because a skilled bot's run is mostly walking, wisps and side trips, and its abilities end fights fast. Nudges add 1.2 minutes of that. Reaching 15 minutes needs more ground to cover (longer routes or more places), which is new content and the user's call, not a number to tune. Slower moves were ruled out by the design.

**After the second fix pass** (same levers; the abilities' fixes, the rescanned spots and the cache rules changed), 60 bots at each skill:

| Skill | First run reaches place 2 | Median first win | Winning run | Runs (won) | Glim at a death, kept / lost | The Reeve's fight | Catalogue 25% bought | Abilities a run | Caches a run | Nudges a run (time) |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.3 | 36 of 60 (60%) | run 30 (11 of 60 won within 40 runs) | 5.7 min | 2,344 (12) | 15 / 61 | 31 s | run 36 (16 of 60) | 16.5 | 2.0 | 5.2 (0.3 min) |
| 0.5 | 58 of 60 | run 9 (60 of 60) | 6.5 min | 835 (124) | 10 / 39 | 33 s | run 14 (32 of 60) | 40.9 | 4.2 | 9.6 (0.6 min) |
| 0.9 | 59 of 60 | run 2 (60 of 60) | 10.1 min | 440 (206) | 12 / 45 | 45 s | run 9 (14 of 60) | 87.9 | 4.8 | 17.2 (1.2 min) |

The three targets met before are still met (60%, run 9, run 2), and the 15 to 25 minute run still misses (10.1). The 0.3 bots win less often than before this pass: 11 of 60 within 40 runs (was 34), and 1,076 of their 2,344 runs end at The Crow Wall. The likely causes are the cooldowns that no longer come back ready at each place and a cache that opens only on its ledge; this was not split by lever. It is not one of the four targets, but it is the slow player's way through, so it is the next thing to look at.

Players are not bots: a person reads wind-ups less well than the 0.9 bot and walks less straight, so a real run is longer. These numbers say how the levers move the bots, not how long a person plays.

### Checks after the fix pass
- Node: all pass. abilities 19 (new), boss 28, builds 34, camera 49, feel 11, foes-ai 44, foes 31, growth 28, keys 6 (new), lattice 16, mouse 11, run 68, seed 9, sound 29, stairs 1, uniform-blocks 10, gloam-downs 33. `gloam-downs-zones.mjs`: 177 ok lines, none bad. `gloam-downs-ledges.mjs` as above.
- Each fix in the table has a test that failed on the tree before it: the five new blocks at the end of `gloam-downs-growth.test.mjs` were run against `HEAD`'s game files and each failed; `abilities.js` and `keys.js` did not exist, so their tests could not pass before.
- Browser (Chromium on SwiftShader, site served on 8765): run.abilities 9 (new), run.boss 24, run.builds 7, run.cards 12, run.feel 5, run.fight 8, run.growth 4, run.input 15, run.lineup 15, run.sound 20, run.swing 2, camera 8, mouse 8, clicks 46, cutaway 1, gloam-downs.e2e 16. Tests changed for the new rules: the hook's 21 and the coal's 23 (×1.3), LT no longer rolls, the colour row in words, the beacon card's warning, and the summary's glim said once. `gloam-downs-run.keys.e2e.mjs` was not written: its ledge cache and keys line are in `run.abilities`, and the Rookchief's key and the stone are checked in Node.
- `quiet.mjs --only=lab/gloam-downs`: 35 of 35. Music demo: passes, 164 files, every group in its targets.
- Pacing: the tables above; and `MAXRUNS=30 AFTER=30 node qa/lab/gloam-downs-bot.mjs 10 0.5 1`: a buy in 281 of 300 runs, and the catalogue bought to 25% by run 9, 50% by run 16, 75% by run 24 and all of it by run 30 (5 of 10 bots).
- `openspec validate gloam-downs-growth --strict`: valid.
- Not checked: a real phone, a real gamepad, real mouse side buttons on hardware (the e2e sends the events), and listening on speakers. No run was played by hand.

### Second fix pass after the checkers
Run on `ccr-43aa269a-y8yo7l` after the pacing pass was merged (7760ad79), on 2026-11-25. Each problem was confirmed first, and each fix has a test that fails on 7760ad79: the new Node blocks were run there with each block caught on its own, and the new browser checks were run against 7760ad79 served on its own port with soft asserts. Every one failed there and passes now.

| Problem | Seen | Done | Test |
|---|---|---|---|
| A swap on a lamp reset the cooldown, so two presses made an ability ready again (high) | yes: `A.cool[i] = 0` and the old ability dropped as a plain lamp | the lamp holds the cooldown of the ability put down and keeps cooling; an ability taken from a lamp starts with it | abilities: "the swap" |
| A place change reset both cooldowns and dropped a Moth wisp | yes: each place's runner made new cooldowns | `rs.run.abilityLive` carries the cooldowns and a Moth wisp; a snare, a pool and a bomb stay in their place | abilities: "a new place" |
| The swap hint came only with the swap | yes: notes became toasts only on other events | the runner sends an `ability` event on the lamp; the page shows toasts on `ability`, `cache` and `key` events | abilities: "the swap hint"; e2e run.abilities |
| The touch cooldown could not be seen | yes | a cooling button goes grey and near black, its label is the seconds in 20 px figures, and the sweep is pale | e2e run.abilities (4 touch layouts) |
| Foe states had no look; no frost for Rime | yes | `stateDabs` (stun, hold, slow as frost, burn) and the stagger pose for a stunned or held foe | abilities: "foe states drawn" |
| The snare and the pool could not be read | yes | `effectDabs`: a ring of 14 dabs and a centre, three rings for the pool, 0.065 to 0.07 m, 0.15 m up | abilities: "snare and pitch drawn" |
| Real side buttons never used an ability in Chromium (high) | yes: no `mousedown` after a cancelled `pointerdown` | read from `pointerdown`, `pointermove` and `pointerup` | e2e run.abilities, with real input through the DevTools protocol |
| One normal jump reached 6 of 9 ledges, and a cache opened from 1.3 m under it (high) | yes: `noLeap` found a stand for each of the 6 | the scan keeps only ledges no single jump reaches from any floor within 4 m (`noLeap`, 24 bearings, 8 radii, every layer, runs and short hops); a ledge cache opens only within 0.35 m of its height; rescanned | keys: "hidden ground", "ledge caches" |
| A v2 run lost slot 1 on the first reload | yes | slot 1 is set before the entry is copied | run: "a v2 run" |
| A reload lost a cache's prize, but the cache stayed open | yes | the prize (glim, flask, lamp, the rolls) goes into the entry with the cache | keys: "caches after a reload" |
| The ability stream did not rewind on Back to the start | yes: no `abilityRolls` at the start | the run starts with `abilityRolls: 0` | run: "the ability stream" |
| Low: two stones opened only on a knife-edge approach | yes | the scan keeps a stone only when a plunge with the stick let go 0.3, 0.4 or 0.5 m early and Attack at 0.22 or 0.34 s all open it; the Gaol and Bell Knoll stones moved | keys: "hidden ground" |
| Low: a press while busy gave no cue | yes | `refuse` with `busy`, and the press is spent (the spec's rule) | abilities: "busy" |
| Low: a snare and Rime did not slow a charging Ironback; a snare on a heavy foe was never spent | yes: 10 m/s through it | a slow scales a hard drive too (the charge, the hook's step); a heavy foe springs a snare and takes its 10 (a light foe first in the same step) | abilities: "the Ironback's charge" |
| Low: Crook line pulled to 2.0 m | yes | the push speed is set for the walker's 400 m/s², over 0.2 s, to 1.2 m centre to centre | abilities: "Crook line" (1.2 m) |
| Low: the HUD kept LB/LT after the keys; no help for the side buttons or the swap | yes | a key or mouse press in play gives the labels back; the help lines name mouse 4 and 5 and the swap | e2e run.abilities |
| Low: after Kindle the focus went to a Buy | yes | it goes to the pane just kindled, else the next Kindle, else a pane button | e2e run.growth |
| Low: Bell guard spent on a blow in the roll's safe time | yes | `R.hurt` checks the safe time before the guard | abilities: "Bell guard" |
| Low: Smoke step was a teleport | yes | it moves a share each play step over 0.12 s | abilities: "Smoke step" |
| Low: a coyote jump used up Crow step | yes | `leap` skips a press the controller jumped on in that step | keys: "Crow step and the coyote jump" |

The spots after the rescan (`node qa/lab/gloam-downs-ledges.mjs --write`; patches of 1 m² or more, up to 10 cells of each tried as the cache):

| Place | Ledges | Stone |
|---|---|---|
| The Sunken Gaol | (2, 7.33, -16.5) glim; (7, 9.38, 25) spark | (-1.3, 4.13, -24) glim |
| The Crow Wall | (-22, 1.78, -28) pattern; (-29.5, 1.92, -29) glim | (-9, 1.49, -25.2) flask |
| Lantern Fen | (-12, 1.67, 11) ability; (-16, 1.73, 2.5) glim | (-3.8, -0.5, -3) spark |
| The Bell Knoll | (4, 5.4, 0.5) pattern | (-1.01, 6.78, 27.99) spark |
| Barrow Crown | (18.5, 4.01, 14) flask | (2.49, 1.15, 18.51) glim |

The Bell Knoll has one ledge now: its other two patches that Crow step opens are within 6 m of the first. The spark caches are still three (Gaol, Fen, Bell Knoll). The scan still does not look for shortcuts.

Screenshots of the new look (1280 by 720, the Gaol, software WebGL): the snare's ring and the pool's three rings read from the follow camera; a stunned Snuffer shows its pale ring and a slowed one its frost. They were looked at, not compared by a test.

What is still not fixed:
- The snare and the pool are laid at the feet, so the lamplighter's body still hides part of them for the first moment; they read once the lamplighter moves.
- No real phone, gamepad, mouse side buttons on hardware or speakers. The side buttons were sent as real mouse input through the DevTools protocol; the pad was a mock.

### Checks after the second fix pass
- Node: all pass. abilities 28 (9 new), boss 28, builds 34, camera 49, feel 11, foes-ai 44, foes 32, growth 28, keys 9 (3 new), lattice 16, mouse 11, run 70 (2 new), seed 9, sound 29, stairs 1, uniform-blocks 10, gloam-downs 33. `gloam-downs-zones.mjs`: 177 ok lines, none bad.
- Browser (Chromium on SwiftShader, the site served on 8765): run.abilities 9, run.growth 4, run.boss 24, run.fight 8, run.input 15, run.builds 7, run.sound 20, run.cards 12, run.lineup 15, run.swing 2, run.feel 5, camera 8, mouse 8, clicks 46, cutaway 1, gloam-downs.e2e 16. run.cards failed once (the pause panel scrolled 4 px at 800 by 600 with a longer help line); the mouse line moved to the run's help card, and run.cards and run.abilities passed again.
- `quiet.mjs --only=lab/gloam-downs`: 35 of 35. Music demo: passes, 164 files.
- Pacing: the table "After the second fix pass" above.
- `openspec validate --strict`: `gloam-downs-growth` and `gloam-downs-real-game` are valid.
- Not checked: a real phone, a real gamepad, mouse side buttons on hardware, and listening on speakers. No run was played by hand.

## Checks
- Node: all pass. boss 28, builds 34, camera 49, feel 11, foes-ai 44, foes 30, growth 23, lattice 16, mouse 11, run 68, seed 9, sound 28, stairs 1, uniform-blocks 10, gloam-downs 33. `gloam-downs-zones.mjs`: 142 ok lines, none bad.
- Browser (Chromium on SwiftShader, site served on 8765 and 8822): all pass after the fixes. run.boss 24, run.fight 8, run.input 15, run.builds 7, run.sound 20, run.cards 12, run.lineup 15, run.swing 2, run.feel 5, run.growth 4, camera 8, mouse 8, clicks 46, cutaway 1, gloam-downs.e2e 16. run.abilities and run.keys do not exist yet (K and P).
- `quiet.mjs --only=lab/gloam-downs`: 35 of 35.
- Music demo: passes, 164 files, every group in its targets.
- `openspec validate --strict`: `gloam-downs-growth` and `gloam-downs-real-game` are valid.
- Screenshots looked at: the beacon card's sparks, the Lamp-room (top and foot) and the HUD with the colour row and pattern mark, at 320 by 640, 390 by 844 and 1280 by 800. No overlap and no cut text after the fixes above. The ability HUD could not be shot: it is K's and was not built.
- Not checked here: a real phone, a real gamepad, real mouse side buttons, and listening on speakers. No run was played by hand (no display).

### Pacing, after the merge
`node qa/lab/gloam-downs-bot.mjs 60 <skill> 1`, with the bot as changed above.

| Skill | First run reaches place 2 | Median first win | Winning run | Runs (won) | Glim at a death, kept / lost | Catalogue 25% bought |
|---|---|---|---|---|---|---|
| 0.3 | 60 of 60 | run 2 | 4.5 min | 433 (180) | 15 / 73 | never, in any bot |
| 0.5 | 60 of 60 | run 1 | 4.8 min | 371 (329) | 14 / 56 | never |
| 0.9 | 60 of 60 | run 1 | 8.5 min | 361 (356) | 24 / 75 | never |

Against the targets: a 0.5 bot should first win in run 6 to 12 (it wins in run 1: **miss**); a 0.9 bot should win in run 1 to 3 (it does) with a winning run of 15 to 25 minutes (8.5: **miss**); a 0.3 first run should reach place 2 in half the bots (all do: met). The game is still too short and too easy, as before this change. That is expected: every lever for it (harder Ember 0, page zones, caches and side trips, a third wave) is P's, and P was not built. G's glim at risk does not slow a bot that wins its first run; it only makes the catalogue slower to buy (no bot reaches 25% of 11,725 glim within its first win plus 5 runs). The 0.3 and 0.5 runs are shorter than 0.9 because a skilled bot also takes every wisp and fights every zone. The next step is P's tuning, in the order of "Targets".

## Checks
- Node: `gloam-downs-growth.test.mjs` (glim at risk, wares, patterns, kindle, sparks, panes, save v3 and the v2 read), `gloam-downs-abilities.test.mjs` (each ability's numbers, cooldowns, status, the swap, the colours), `gloam-downs-keys.test.mjs` (the second jump's height, the stone rule, each spot on the walk map and reachable only with its key, the caches), `gloam-downs-run.test.mjs`, `gloam-downs-builds.test.mjs`, `gloam-downs-feel.test.mjs`, `gloam-downs-seed.test.mjs`, `gloam-downs-foes.test.mjs`, `gloam-downs-foes-ai.test.mjs`, `gloam-downs-boss.test.mjs`, `gloam-downs-sound.test.mjs`, `gloam-downs-mouse.test.mjs`, `gloam-downs-camera.test.mjs` (must still pass), and `node qa/lab/gloam-downs-zones.mjs` with the page zones.
- Browser, with the site served: `gloam-downs-run.growth.e2e.mjs`, `gloam-downs-run.abilities.e2e.mjs`, `gloam-downs-run.keys.e2e.mjs`, and every existing Gloam Downs e2e file. Each new HUD and card part at 320 by 640, 390 by 844, 360 by 640, 800 by 600, 1280 by 720 and 844 by 390.
- Sound: `CHROMIUM_PATH=/opt/pw-browsers/chromium QUIET_URL=http://127.0.0.1:8765 node qa/arcade/quiet.mjs --only=lab/gloam-downs`, and the music demo's existing groups still meet their targets.
- Pacing: `node qa/lab/gloam-downs-bot.mjs 60 <skill> 1` at 0.3, 0.5 and 0.9.
- What cannot run here must be said: a real phone, a real gamepad, the mouse's side buttons on real hardware, and listening on speakers.
