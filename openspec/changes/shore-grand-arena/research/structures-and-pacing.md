# Shore of the Ancients: towers, objectives and match pacing

I edited no repository files. All prototypes are copies under `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/` (listed in section 12). Line numbers are for the current checkout.

---

## 1. Key findings

1. **The map is 6400 units wide, not 4800.** `SIZE = 6400` and `MAP_SCALE = SIZE / 4800` (`public/tidebreak/arena.js:2-3`), added in commit `ea4a34d`. The anchors are written in 4800-space and scaled by 4/3 through `arenaPoint` (`arena.js:5`).
   - Doubling width and height means **12800**. 9600 is 1.5× width (2.25× area). Exactly 2× area would be about 9051.
   - `docs/tidebreak.md:7` still says 4800, and `docs/tidebreak.md:20` still says "break any wardstone". Both are out of date.
2. **There are two tower tiers per lane, and tier 1 sits very close to the base.**
   - Outer: 2700 hp, range 360, damage 180. Inner: 3400 hp, range 390, damage 195. Both fire every 1.05 s (`sim.js:43-46`).
   - The middle inner tower is only **412 units** from its core, which has range 350.
3. **There is no base defense layer.**
   - The core unlocks the moment one lane loses both towers (`objectives.js:3-9`).
   - Measured median gap from the first inner-tower kill to the first core hit: **3 s**.
   - The two towers drawn beside each core are decoration only (`bases.js:33-36`).
4. **Baseline pacing (36 bot matches, current code):**

   | Beat | Median |
   | --- | --- |
   | First hero-vs-hero damage | 6 s |
   | First blood | 18 s |
   | First outer tower falls | 79 s |
   | First inner tower falls | 194 s |
   | Core first hit | 208 s |
   | Match end | 344 s |

   15 of 36 matches end at the 6-minute limit. All other matches end by core kill. With no limit and no damage ramp, all 36 end by core, median 320 s, maximum 725 s.
5. **Bigger map plus three tiers (prototypes):**
   - 12800 with three tiers and no other change: median end **657 s** (no ramp) or 558 s (with ramp).
   - 9600 with three tiers: median **419 s**.
   - A prototype with my proposed slow-downs reached median **1038 s**, interquartile range 749–1239 s, 5/36 timeouts at 25 minutes. That is a bit too long. Section 9 tunes it down.
6. **A bigger map cannot come from raising `SIZE` alone.**
   - `MAP_SCALE` also scales obstacle size, brush radius and river width (`world.js:60,66`, `river.js:20-24`).
   - Several art routines use unscaled numbers (`paint-ground.js:78,83-84`). Even at 6400, rows of the river with y > 3000 miss the water fill.
   - The ground canvas has a fixed 3072 px size (`paint-ground.js:30`).
   - Bot distance thresholds are absolute numbers (`combat-ai.js:8,51-52`, `team-events.js:9-10`).
7. **The economy saturates at about 7 minutes and levels reach about 14 at 6 minutes.**
   - Measured income is about 830 embers per minute per hero.
   - A full six-slot build costs 5830–5930 embers.
   - Level 18 needs 4845 total XP (`abilities.js:23-24`).
   - A 15-minute match needs a slower economy, or the last half has no progression.

---

## 2. Scale facts and what "double the size" means

| Constant | Value | Where |
| --- | --- | --- |
| `SIZE` | 6400 | `arena.js:2` |
| `MAP_SCALE` | 1.3333 (`SIZE/4800`) | `arena.js:3` |
| `CENTER` | (3200, 3200) | `arena.js:4` |
| `arenaPoint(x,y)` | multiplies 4800-space anchors | `arena.js:5` |
| `LIMIT` | 360 s | `world.js:5` |
| `SHIFT` | 40 s (realm flip) | `world.js:6`, `world.js:114-120` |
| `BASES` | (3200, 5333) ally, (3200, 1067) enemy | `world.js:7` |
| `LANES` | five anchors per lane; anchor [1]/[3] = outer tower | `world.js:9-13` |
| `PATHS` | Catmull-Rom samples every ~55 units | `world.js:15-27` |
| `TOWER_POSITIONS` | `[outer, path[round(index*.48)]]` | `world.js:33-37` |
| `PORTALS` | 4, paired | `world.js:38` |
| `CAMPS` | 4 | `world.js:39` |
| `COVER` / `OBSTACLES` | 13 blocks; size × `MAP_SCALE`; ×0.58 in the woods realm | `world.js:45-61` |
| `BRUSH` | 12 patches, radius `150*MAP_SCALE` | `world.js:62-66` |
| Sight | hero 950 (town) / 620 (woods); other units 500 | `world.js:83` |
| Playable bounds | x 200…SIZE−200, y 180…SIZE−180 | `world.js:95`, `navigation.js:17,23` |
| River | knots in 4800-space × `MAP_SCALE`, sampled every 12 units over `SIZE` | `river.js:2,19-24` |

Measured lane lengths:

| Size | West | Middle | East |
| --- | --- | --- | --- |
| 6400 | 7019 | 4619 | 6953 |
| 9600 | 10529 | 6930 | 10430 |
| 12800 | 14039 | 9241 | 13907 |

**Travel at the 240 u/s minion speed (`sim.js:331`):**
- Base to base: 29 s on side lanes and 19 s on the middle lane today. At 12800: 58 s and 38 s.
- A 300 u/s hero needs about 11.7 s from base to the middle of a side lane today, and about 23 s at 12800.

**Recommendation.** Treat "double" as **12800** (twice the width and height of what the player sees now). The prototypes show it is feasible:
- Every tower footprint stays on clear lane in both realms.
- The simulation stays under 85 units.
- Three tiers fit with comfortable spacing.

If 12800 is too large, 9600 is the fallback; figures for it are included below. In both cases, split layout scale from feature scale (section 8).

---

## 3. Structures today

### 3.1 How towers and cores are created
- **Core.** `sim.js:42`: `kind:'core'`, hp 6200, radius 130, sprite 7, range 350, damage 145, rate 1.1, at `BASES[team]`. Name and art come from `BASE_STYLES` (`bases.js:2-5`).
- **Towers.** `sim.js:43-46` loops `lane 0..2 × tier 0..1`:
  - `hp = tier ? 3400 : 2700`
  - `range: tier ? 390 : 360`, `damage: tier ? 195 : 180`, `rate: 1.05`, `radius: 42`, `sprite: 6`
  - name `` `${tier?'Inner':'Outer'} ward · ${LANE_NAMES[lane]}` ``
  - position `TOWER_POSITIONS[team][lane][tier]`
- **Count.** `s.towers = [6,6]` (`sim.js:40`). `objectiveText` shows "/6" (`objectives.js:18`).
- **Hero spawn.** Each hero starts at its lane's **outer** tower, 180 units toward its own base (`sim.js:35-36`). The player takes the middle lane, allies the side lanes (`sim.js:48-51`).
- **Placement rule.** `world.js:33-37`. Outer = lane anchor `LANES[lane][1]` (ally) or `[3]` (enemy). Inner = the sample at 48% of the outer tower's path index, counted from the base.

### 3.2 Current layout (computed with `scratchpad/understand/layout.mjs`)

| Team | Lane | Tier | x, y | HP | Range | Damage | Path distance to own base | Straight-line distance to core |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | West | Outer | 1413, 4707 | 2700 | 360 | 180 | 1908 | 1893 |
| 0 | West | Inner | 2368, 5122 | 3400 | 390 | 195 | 858 | 858 |
| 0 | Middle | Outer | 3200, 4347 | 2700 | 360 | 180 | 1119 | 987 |
| 0 | Middle | Inner | 3025, 4960 | 3400 | 390 | 195 | 480 | **412** |
| 0 | East | Outer | 4840, 4667 | 2700 | 360 | 180 | 1779 | 1770 |
| 0 | East | Inner | 3954, 5087 | 3400 | 390 | 195 | 794 | 793 |
| 1 | West | Outer | 1480, 1707 | 2700 | 360 | 180 | 1849 | 1835 |
| 1 | West | Inner | 2436, 1275 | 3400 | 390 | 195 | 792 | 792 |
| 1 | Middle | Outer | 3200, 2053 | 2700 | 360 | 180 | 1065 | 987 |
| 1 | Middle | Inner | 3357, 1507 | 3400 | 390 | 195 | 497 | 468 |
| 1 | East | Outer | 5000, 1667 | 2700 | 360 | 180 | 1920 | 1897 |
| 1 | East | Inner | 4043, 1248 | 3400 | 390 | 195 | 862 | 862 |
| 0/1 | Core | – | 3200, 5333 / 3200, 1067 | 6200 | 350 | 145 | 0 | 0 |

Path distances between towers:
- **West:** base → inner 858, inner → outer 1050, outer → enemy outer 3262.
- **Middle:** 480, 638, 2435.
- **East:** 794, 985, 3255.

The middle lane is about 34% shorter than the side lanes, so its towers crowd the base.

### 3.3 How protection between tiers works (`objectives.js`)
- `wards(s, team, lane)` (`objectives.js:2`) collects tower units. **Dead towers stay in `s.units`** (`sim.js:518` keeps `hero`, `tower` and `core` at hp 0), so the count stays fixed.
- `laneOpen` (`objectives.js:3-6`): `towers.length === 2 && towers.every(hp <= 0)`. **The number 2 is hard-coded.**
- `structureProtected` (`objectives.js:7-10`):
  - A core is protected unless one lane is open.
  - A tower is protected if it is tier 1 and its same-lane tier 0 is alive. **Hard-coded to tiers 0 and 1.**
- `nextObjective` (`objectives.js:11-14`) and `objectiveText` (`objectives.js:15-19`) assume outer/inner wording and "/6".
- Every check that uses the gate:
  - `damage()` returns early and shows a "Rift protected" / "Inner ward protected" tip (`sim.js:73`).
  - `hostile()` treats protected structures as not attackable (`sim.js:143`). Targeting, area damage, cones and casts all use it.
  - The bot enemy list skips them (`combat-ai.js:8`).
  - A click on a protected structure shows a tip (`main.js:355`).
  - The renderer greys their rings, bars and labels (`illustrated-render.js:204-205,222,224,331`).
  - Attack orders are refused (`sim.js:150` through `hostile`).

### 3.4 How towers and cores fight (shared branch `sim.js:480-485`)
- **Targeting.** A tracked target is dropped when it dies, leaves range or is no longer visible (`sim.js:481-482`). The current aggro target comes first (`sim.js:483`). Otherwise the tower picks the nearest enemy that is not neutral and not a structure, **heroes last** (`sim.js:484`).
- **Aggro.** When a hero damages an enemy hero inside an allied *tower's* range, that tower targets the attacker for 3 s (`sim.js:98`). **Cores never get aggro.**
- **Shot.** Structures use the shared `attack()`: windup 0.12 s, duration 0.46 s for non-heroes (`sim.js:182-183`). Range and line of sight are checked again on impact (`sim.js:196`).
- **Tower pressure.** Each consecutive hit on the same hero within 2 s adds 22%, up to 4 stacks, so +88% (`sim.js:189-190`, tracked at `sim.js:198`). It resets when the hero leaves range or sight (`sim.js:482`). The HUD shows "Tower fire is growing. Leave its range." (`main.js:288-289`). The test is `tactical-combat.test.mjs:38`.
- **Global damage ramp.** `multiplier = s.time > 240 ? 1 + (s.time-240)/110 : 1` multiplies *every* basic attack: heroes, minions, towers, cores (`sim.js:188`). At 360 s it is 2.09×; at 720 s it would be 5.36×.
- **Sight.** Structures see 500 units (`world.js:83`). Their ranges of 350–390 fit inside that; ranges above 500 would also need more sight. Structures are always visible on the map (`world.js:90`).
- **Spells hit structures** through `area` and `cone`, which use `hostile`. Status effects are not applied to structures (`sim.js:226`, `legend-rules.js:4`, `skill-events.js:2`). Quickthorn's 3% max-health hit, capped at 160, also works on towers (`sim.js:212`).
- **Bot sieging.** A tower or core is a bot target only when an allied minion is inside its range (`combat-ai.js:36-37`). The player has no such rule, so solo split-pushing is possible.

### 3.5 Win, stalemate and the limit
- Core death calls `finish(1 - team, 'The enemy elder rift was destroyed.')` (`sim.js:127`, `sim.js:68`).
- At `s.time >= LIMIT` the summed hp of each team's cores and towers decides the winner, or a draw (−1) if equal (`sim.js:519-522`). The reason text "Six minutes…" is hard-coded at `sim.js:521`, `main.js:212`, and `index.html:35` ("Break the outer ward, then the inner ward.").
- The clock shows `LIMIT - time` (`main.js:236-237`). The simulation test runs `(LIMIT+1)*20` ticks (`sim.test.mjs:59`).

### 3.6 Structure rewards
- Tower death: `s.towers[team]--`, then `reward(team, 150 xp, 180 gold)` to **every** hero on the team (no distance limit, `sim.js:59-60,125`). It also sets `stats.towers` and announces either "inner ward is now vulnerable" or "the elder rift is vulnerable" (`sim.js:126`).
- First hit on a structure pings the team ("defend") with `lane` and `tier`, with a 14 s cooldown (`team-events.js:6,34-39`).

### 3.7 Presentation that assumes two tiers
- **Renderer**
  - Tower height: tier 1 = 315, else 245 (`illustrated-render.js:184`).
  - Tier-1 ring (`:204`), range ring that turns red when the tower targets the player (`:205`).
  - Labels "INNER · PROTECTED" / "INNER WARD" / "OUTER WARD" (`:224`).
  - Minimap ring radius by tier, 10 or 7 (`:331`). Alarm pulse (`:335`).
  - **One tower sprite per team** (`'tower-ally'` / `'tower-enemy'`, `:21,183`). Tiers differ only in scale and a ring.
- **Announcer:** `defendCall` uses `ping.tier ? 'inner' : 'outer'` (`announcer.js:30-34`). Ward-break and ward-fall calls are keyed on message titles (`announcer.js:36-40`).
- **Team chat:** defend line (`team-chat.js:21`), message lines (`team-chat.js:39`). `laneAt` uses SIZE fractions and scales on its own (`team-chat.js:5`).
- **HUD:** help text (`main.js:212`), "Next tower" map destination (`main.js:220-223`), protected-structure tip (`main.js:355`).
- **Scenery** keeps clear of tower footprints through `TOWER_POSITIONS.flat(2)` (`scenery.js:36`). This works for any number of tiers.

---

## 4. Other match systems (all constants)

| System | Current rule | Where |
| --- | --- | --- |
| **Waves** | First at t = 1 (`nextWave: 1`), then every **14 s** | `sim.js:40,404` |
| Wave content | 3 per lane per team. Slot 2 is siege on every 3rd wave | `sim.js:329-331` |
| Wave 1 spawn | At the lane midpoint `LANES[lane][2]` ± 370; later waves at `BASES` | `sim.js:330` |
| Minion | hp 390, damage 45, rate 1, range 95, speed 240, radius 16 | `sim.js:331` |
| Siege | hp 780, damage 88, range 270 | `sim.js:331` |
| Minion movement | `followLane` re-finds the nearest path sample every tick (cost grows with path length) | `sim.js:334-339`, `world.js:28-32` |
| Minion fighting | Nearest target within range + 140, else follow lane | `sim.js:507-509` |
| Minion rewards | 18 XP to team heroes within 1200. Last hit: +40 embers (siege +65) | `sim.js:139-140` |
| **Wild Hunt boss** | First spawn at **26 s**. hp 3300, damage 95, range 200, speed 125, rate 1.2, radius 55, at `CENTER` | `sim.js:40,405-408` |
| Boss rules | Leash 390 (`sim.js:502`), attacks nearest within 330, special attacks every 6.2 s (4.8 s in fury below 50% hp), 185/235 damage, 0.8 s tell, 1.4 s recovery | `encounters.js:5-15,19-48` |
| Boss kill | 190 XP / 160 embers to the whole team. Next boss **65 s** later | `sim.js:129` |
| Siege beast (`kind 'leviathan'`) | Spawns for the killer's team at `path[2]` of the killer's lane. hp 4400, damage 350, range 190, rate 1.2, speed 180. Kill: 120 XP / 100 embers | `sim.js:130-131,139` |
| **Camps** | 4. hp 960, damage 55, range 170, speed 120, rate 1.1. Spawn at t = 0 with position jitter | `world.js:39`, `sim.js:409-415` |
| Camp kill | 90 XP / 110 embers to the team. Respawn **32 s**. Killer heals 430 and gets haste for 18 s (×1.2, player only `sim.js:451`) | `sim.js:135-137` |
| Camp special attacks | Cleave 320 / thorn line 500, 125/145 damage, 0.7–0.8 s tell, 1.15 s recovery, 6.5 s cooldown. Leash 430 | `encounters.js:9-13,22` |
| **Gold** | Start 360. Passive **3.2/s**. Hero kill 100 to every team hero. Tower 180. Boss 160. Camp 110 | `sim.js:36,427,120,125,129,135` |
| **XP** | `xpForLevel = 60 + 25·L`. Max level 18 (4845 total). Level-up heals 230 | `abilities.js:23-24`, `sim.js:59-66` |
| Level scaling | +110 max hp and +13 attack per level | `items.js:66,69` |
| Skill gates | Normal skills at 1/3/5/7, ultimate at 6/12/18 | `abilities.js:25` |
| **Items** | Components 180. Finished 620–900. Relics 1800–1980, one per build. 6 slots | `items.js:5-35,58` |
| Full build cost (computed) | ambush 5860, bulwark 5930, hex 5830, frenzy 5870 | `items.js:37-42` |
| Bot shopping | Every 2 s | `sim.js:429` |
| **Respawn** | `5 + level` s, at `BASES`, with 140 shield | `sim.js:119,430-433` |
| Base court | Heal 24% max hp/s and mana 30%/s inside `BASE_HEAL_RADIUS` 420. No damage to enemies | `bases.js:1`, `sim.js:435-437` |
| Recall | Player channels 2.5 s (`sim.js:456-459`). Bots teleport after 2.5 s of retreat with no hit for 3 s | `sim.js:349` |
| Out-of-combat sprint | ×1.35, **player only** | `sim.js:450` |
| Portals | 4, range 150, cooldown 10 | `sim.js:301-306`, `world.js:38` |
| Realm shift | Every 40 s. Obstacles shrink to 58%; sight 620 | `world.js:6,61,83,114-120`, `sim.js:403` |
| Bot awareness distances | Enemies within 850, allies within 650 | `combat-ai.js:8-9` |
| Bot retreat | hp < 28%, or outnumbered and < 65% | `combat-ai.js:31` |
| Bot boss rally | Within 1600/1700/1900 | `combat-ai.js:49-53` |
| Team calls | Assist range 1900, rally range 3200, rally lasts 12 s | `team-events.js:7-10,71-78` |

---

## 5. Measured pacing today

Method: every hero on autopilot, dt = 0.05, the same loop as `qa/tidebreak/sim.test.mjs:57-65`. Seeds 1–3, all 12 kits, 36 matches. `node qa/tidebreak/sim.test.mjs` passed. Peak unit count was 58–62, against the test's limit of 150.

| Metric (median; min–max) | Value |
| --- | --- |
| First hero-vs-hero damage | **6 s** (4–7) |
| First blood | **18 s** (15–112) |
| First minion reaches an enemy tower | 14 s (10–54) |
| First outer tower destroyed | **79 s** (56–156) |
| First inner tower destroyed | **194 s** (69–296) |
| First core damage | **208 s** (71–309) |
| Gap from inner kill to core hit | **3 s** (0–78) |
| Tower life from first hit to death | 80 s |
| Match end | **344 s** (190–360). 21 by core, 15 at the limit |
| Towers destroyed per match | 6 of 12 |
| Hero kills per match | 11 (6–24); about 7% of hero time spent dead |
| Boss kills per match | 3.6 |
| Wins | Allies 19, enemies 17 |

Per-minute economy (average per hero, from `economy.mjs`):

| Time | Level | Embers earned | Items | Total deaths | Towers down |
| --- | --- | --- | --- | --- | --- |
| 1:00 | 3.4 | 927 | 1.7 | 2.3 | 0.2 |
| 2:00 | 6.4 | 1720 | 3.0 | 4.3 | 1.7 |
| 3:00 | 8.6 | 2562 | 3.7 | 6.6 | 3.1 |
| 4:00 | 10.4 | 3333 | 4.1 | 8.2 | 4.4 |
| 5:00 | 12.2 | 4244 | 4.8 | 10.9 | 6.0 |
| 6:00 | 13.8 | 5097 | 5.4 | 14.0 | 7.1 |

**One typical match (seed 1, player Kraken):**
- Fight at 0:06, first blood at 0:15, first tower hit at 0:17.
- Enemy West and East outer towers fall at 0:56 and 0:57; enemy Middle outer at 1:59.
- Enemy West inner falls at 3:29, and the core takes damage at 3:31.
- Allies win by core at 4:29.

**What this shows:**
- **No early phase:** heroes clash 6 s in.
- **Tiers fall about every 110 s.**
- **The core has no separate beat:** it takes damage about 3 s after the inner tower.
- **The ramp after 4:00 ends matches** more than the objectives do.

---

## 6. Scaling experiments (scratch copies only)

The variants:
- **Base:** current code.
- **s9600 / s12800:** only `SIZE` changed.
- **t3:** three tiers added in the copy. Changes: `TOWER_POSITIONS` returns `[outer, path[index*.64], path[index*.3]]`; `laneOpen` needs 3; protection is "any lower tier alive"; hp [2700, 3400, 4100], range [360, 390, 410], damage [180, 195, 210]; `towers:[9,9]`.
- **t3p:** t3 plus trial pacing changes.

The limit was raised with an environment variable. "No ramp" disables `sim.js:188`. All medians are over 36 matches.

| Variant | Limit | Ramp | End (p25 / median / p75) | By core | First tower | Last-tier kill | Core hit | First fight | Kills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6400, 2 tiers (current) | 360 | on | 275 / 344 / 360 | 21/36 | 79 | 194 | 208 | 6 | 11 |
| 6400, 2 tiers | 1500 | off | 277 / 320 / 399 | 36/36 | 79 | 194 | 208 | 6 | 11 |
| 9600, 2 tiers | 360 | on | 288 / 360 / 360 | 18/36 | 97 | 201 | 217 | 8 | 12 |
| 12800, 2 tiers | 360 | on | 353 / 360 / 360 | **10/36** | 123 | 199 | 250 | 10 | 12 |
| 12800, 2 tiers | 1500 | on | 353 / 416 / 601 | 36/36 | 123 | 200 | 268 | 10 | 15 |
| 9600, **3 tiers** | 1500 | off | 358 / **419** / 701 | 35/36 | 99 | 345 | 359 | 8 | 17 |
| 12800, **3 tiers** | 1500 | on | 375 / 558 / 885 | 33/36 | 114 | 364 | 408 | 10 | 24 |
| 12800, **3 tiers** | 1500 | off | 440 / **657** / 903 | 33/36 | 114 | 390 | 412 | 10 | 22 |
| **t3p** 12800, 3 tiers plus trial pacing | 1500 | from 900 s, /200 | 749 / **1038** / 1239 | 31/36 | **272** | 617 | 704 | 10 | 30 |

t3p trial changes:
- Waves every 20 s.
- Tower hp [3200, 4000, 4800].
- Outer towers take 50% damage before 300 s.
- Boss first at 120 s, respawn 150 s.
- Ramp from 900 s with slope /200.
- Passive gold 2.4/s.
- Camp respawn 45 s.
- `xpForLevel = 96 + 40·L`.

t3p economy: level 7.1, 3560 embers and 4.2 items at 6:00; level 12.4 and 6 items at 15:00. **XP is too slow** (12.4 at 15:00). Builds finish at about 12 minutes, which is right.

Simulation cost (`cost.mjs`, 60 Hz, Node, three processes in parallel):

| Variant | Peak units | Peak minions | Time per step |
| --- | --- | --- | --- |
| Current | 61 | 36 | 0.75–1.15 ms |
| 12800, 3 tiers, 14 s waves | 83 | 52 | 1.33–1.47 ms |
| 12800, 3 tiers, 20 s waves | 73 | 42 | 0.95–1.12 ms |

**Takeaways:**
1. The size alone barely changes match length while the 6-minute limit and the 4-minute ramp stay. They end the match.
2. Three tiers matter more than size: about 2× the median length at both sizes.
3. Early towers still fall at about 2 minutes unless outer towers are protected early.
4. The core siege in t3p takes about 5.5 minutes (core hit 704 s → end 1038 s), and 5/36 matches stall to 25 minutes. A base layer with a closing mechanic is needed, not just more hp.

---

## 7. What must change for three tiers plus base defenses

### 7.1 Simulation
1. **`world.js:33-37` `TOWER_POSITIONS`.** Return three positions per lane, plus new `GATE_POSITIONS[team][lane]` and `GUARDIAN_POSITIONS[team]`.
   - Place them by **path distance from the base**, not as a fraction of the outer tower's index. With fractions, the middle-lane towers crowd together: gate and inner end up 45 units apart at 12800.
   - Proposed placements were checked: all are clear of obstacles in both realms and at least 500 units from portals, camps and the centre. See the table below.
2. **`sim.js:40`.** Replace `towers: [6,6]` with a count derived from units, or a per-kind count (`[9,9]` towers plus gates and guardians).
3. **`sim.js:43-46`.** Drive tower creation from a `TIERS` table (name, hp, range, damage, rate, reward, art key). Add gate and guardian units.
4. **`sim.js:42`.** Retune the core and decide whether it gets aggro. `sim.js:98` covers towers only.
5. **`sim.js:73` and `main.js:355`.** Protection tip text for each layer.
6. **`sim.js:124-126`.** Rewards and messages for each tier and kind. Today one message is chosen by `tier===0`.
7. **`sim.js:480-485`.** Guardian behaviour. Proposed: a telegraphed slam that reuses the `encounters.js` pattern, so a tell and a recovery window come for free.
8. **`sim.js:518`.** Keep dead gates and guardians in `s.units` (as towers are), or `laneOpen` will miscount. Gate respawn needs a timer.
9. **`sim.js:519-522`.** Replace the summed-hp tiebreak and the "Six minutes" text (section 9).
10. **`sim.js:188`.** Retime the global ramp.
11. **`sim.js:327-333`.** Spawn stronger waves in lanes where the enemy gate is down (the closing mechanic).
12. **`objectives.js:3-19`.** Generalise the protection chain:
    - Tier t > 0 is protected while any same-lane tier below t is alive (prototype: `t.tier < e.tier && t.hp > 0`).
    - A gate is protected while its lane's inner tower stands.
    - Guardians are protected until any gate is down.
    - The core is protected until both guardians are down.
    - `nextObjective` follows that chain. `objectiveText` drops "outer/inner" and "/6".
13. **`combat-ai.js:36-37`.** Bots siege only with minions in range. Add the same rule for players as a backdoor damage reduction on structures (section 9).

### 7.2 Interface, art, audio and chat
- **Renderer**
  - Height and label per tier (`illustrated-render.js:184,204,224`). Minimap marker per tier and kind (`:331`).
  - Distinct art for each tier, the gate and the guardians. Today there is one sprite per team (`:21,183`).
  - Make the decorative base towers real, or remove them (`bases.js:33-36`).
- **HUD:** `main.js:212` (help), `main.js:220-223` (map "Next tower"), `index.html:35` (objective subtitle), result sheet `main.js:232` (no structure stats today).
- **Announcer:** `announcer.js:30-34` (a name table per tier and kind), `announcer.js:36-40` (new titles: gate broken, guardian down, rift exposed).
- **Chat:** `team-events.js:38` already sends `tier`. Update the lines at `team-chat.js:21,39`.

### 7.3 Tests, specs and docs that assume two tiers or the current size
- `qa/tidebreak/towers.test.mjs:5-20`: 12 towers, `[6,6]`, outer/inner gate, `/outer/`, `/inner/`, distance > 400. `:22-24`: `SIZE === 6400`. `:28`: message.
- `qa/tidebreak/sim.test.mjs:7-8`: `SIZE === 6400`, area 16×. `:10-18`: two-step gate, `s.towers[1] === 5/4`. `:59`: `LIMIT` loop. `:63`: `t < 6`.
- `qa/tidebreak/team-presence.test.mjs:63-68`: "East outer ward under attack".
- `qa/tidebreak/tactical-combat.test.mjs:38`: tower pressure 100 → 122.
- `qa/tidebreak/river.test.mjs:8,14`: extent written in `MAP_SCALE`.
- `qa/tidebreak/scenery.test.mjs:40-42`: lanes start and end at the bases.
- Unscaled coordinates `{x:2400,y:2800}` at `combat-decisions.test.mjs:7`, `hero-classes.test.mjs:7`, `legends.test.mjs:8`, `skills.test.mjs:4`, `tactical-combat.test.mjs:6`, `sim.test.mjs:6,38`. These are still clear at 9600 and 12800 (checked), but only by luck.
- OpenSpec `openspec/specs/moba-combat/spec.md`: purpose line 4, "Expanded two-stage arena" 56-63 (6400 and two towers), "Clear match flow" 65-70, "Lane and tower pressure" 90-95.
- Active changes `moba-combat-decisions` (tasks 8-10 open) and `moba-team-presence` (tasks 35-38 open) touch the same capability. A new `moba-*` change must take them into account.
- Docs: `docs/tidebreak.md:7,20,22,57` are out of date.

### 7.4 Proposed tier and gate placement (path distance from own base; all clear in both realms)

**12800** (gate 800, inner 1700 / 1500, middle 3000 / 2300, outer 4300 / 3100 for side / middle lanes):

| Team | Lane | Gate | Inner | Middle | Outer | Gap between opposing outer towers |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | West | 5626, 10465 | 4753, 10248 | 3521, 9835 | 2510, 9048 | 5439 |
| 0 | Middle | 6018, 10080 | 6187, 9401 | 6418, 8635 | 6724, 7897 | 3041 |
| 0 | East | 7159, 10416 | 8015, 10137 | 9214, 9638 | 10186, 8793 | 5307 |
| 1 | West | 5630, 2348 | 4761, 2582 | 3543, 3032 | 2575, 3873 | 5439 |
| 1 | Middle | 6743, 2823 | 6586, 3504 | 6346, 4267 | 6053, 5010 | 3041 |
| 1 | East | 7180, 2307 | 8061, 2491 | 9300, 2879 | 10269, 3705 | 5307 |

**9600 fallback:** gate 650, inner 1300 / 1150, middle 2200 / 1700, outer 3200 / 2300. Checked the same way. Gaps between opposing outer towers: 4129 / 2330 / 4030.

Guardians: two per base, flanking the court beside the core and inside the court. These positions have not been run through the terrain check yet.

---

## 8. What must change for a bigger map

1. **Split the two scales.** Use `LAYOUT_SCALE` for positions (`arenaPoint`) and a separate `FEATURE_SCALE` for sizes.
   - Today `MAP_SCALE` multiplies obstacle size (`world.js:60`), brush radius (`world.js:66`), river width (`river.js:20`), pools (`river.js:24`), scenery districts (`scenery.js:28,60`) and the river formula (`world.js:67`).
   - At 12800 that makes `COVER[0]` 1253 wide and brush radius 400 (measured), against concealment at 125 and sight at 620.
2. **Add content instead of zooming it.**
   - Today there are 4 camps (`world.js:39`), 4 portals (`world.js:38`), 12 brush patches and 13 cover blocks.
   - Plant count is fixed at 2600 attempts (`scenery.js:70`) and patches at 220 (`paint-ground.js` via `scenery.js:90`), so density drops 4× at 12800.
3. **Unscaled art numbers.** `paint-ground.js:78,84` (`fillRect(0,1300,SIZE,1700)`) and `:83` (gradient `0,1700 → 4000,2600`). The river already spans y 2295–3318 (measured), so rows below 3000 miss the water fill at 6400 today. The same applies to `world-art.js:39`, but that file only feeds the unused `render.js`.
4. **Ground resolution.** The canvas is 3072 px per realm (`paint-ground.js:30`), so 0.48 px per unit today and 0.24 at 12800. The camera draws about 0.5 px per unit at 1440×900 (`illustrated-render.js:53`). The full canvas is drawn every frame (`:131`). A larger single canvas (6144² × 2 realms ≈ 300 MB) cannot work on phones. **Draw the ground in chunks.**
5. **Map-relative bot distances.** `combat-ai.js:8-9` (850/650), `:40` (700), `:51-52` (1600/1700/1900), `team-events.js:9-10` (1900/3200), minion XP radius 1200 (`sim.js:60,139`). Scale the ones that are about rotation (assist, rally, boss) by `SIZE/6400`. Keep the ones tied to sight and the screen.
6. **Travel aids.**
   - Sprint is player-only (`sim.js:450`). Give it to bots too, or add a speed current near each base.
   - Bots teleport home on retreat (`sim.js:349`). The walk back to lane doubles at 12800.
7. **Hero spawn** stays at the outer tower (`sim.js:35`), so the start is not a long walk. **Wave 1 spawns at the lane midpoint** (`sim.js:330`), which makes the first fight happen at 6–10 s. Move wave 1 to the bases at about 0:15 to get an early phase.
8. **Paths:** `followLane` searches every path sample per minion per tick (`sim.js:337`, `world.js:28-32`). Path length doubles at 12800. The measured cost is acceptable (section 6), but a cached waypoint index would be cheaper.

---

## 9. Proposed pacing numbers (12800, three tiers plus base layer)

**Target timeline** (median bot match; the player should feel the same beats):

| Beat | Now | Target |
| --- | --- | --- |
| Wave contact or first skirmish | 0:06 | 0:30–0:45 |
| First blood | 0:18 | 1:30–3:00 |
| First outer tower | 1:19 | 4:00–5:30 |
| First middle tower | – | 6:30–8:30 |
| First inner tower | 3:14 | 9:00–11:00 |
| First gate | – | 10:30–12:30 |
| Guardians and core exposed | 3:28 | 12:00–14:00 |
| End (median; p25–p75) | 5:44 (cap) | **14:00 (12–17)**, sudden death at 18:00, hard stop at 22:00 |

**Constants (start values for the next simulation sweep; t3p is the calibration point):**

| Constant | Now (file:line) | Proposed | Why |
| --- | --- | --- | --- |
| `SIZE` | 6400 (`arena.js:2`) | 12800 layout scale; features keep the 6400 scale | Section 2 and 8.1 |
| `LIMIT` | 360 (`world.js:5`) | 1080 s soft limit → sudden death; hard stop 1320 s | t3 median 657 s, t3p p75 1239 s |
| Damage ramp | from 240 s, /110, every basic attack (`sim.js:188`) | Only during sudden death (from 1080 s, /150). Structures do not ramp | The ramp now decides matches instead of the objectives |
| Limit tiebreak | summed structure hp (`sim.js:519-522`) | At 1080 s: all protection lifted, respawn +50%. At 1320 s: tiebreak by structures destroyed, then hp | Stalemates seen in t3p |
| `SHIFT` | 40 (`world.js:6`, text `main.js:329`, `index.html:35`) | 60 | 18 flips in 18 minutes instead of 27; a clearer rhythm |
| Wave interval | 14 (`sim.js:404`) | 18–20 | Fewer units (73 vs 83) and fewer XP pulses |
| Wave content | 3 melee-type (`sim.js:329-331`) | 2 melee, 1 caster (hp 300, damage 55, range 320), siege every 3rd wave | Target priority (rule 6) |
| Minion speed | 240 (`sim.js:331`) | 280 | Keeps side-lane travel at about 50 s |
| Wave 1 | t = 1 at lane midpoint (`sim.js:40,330`) | t = 15 from the bases | Early phase |
| Outer tower | 2700 / 360 / 180 | 3000 / 360 / 175. Takes 50% damage before **4:00** (t3p used 5:00 and 3200 hp: too slow) | Hits the first-tower target |
| Middle tower | – | 3800 / 385 / 195 | – |
| Inner tower | 3400 / 390 / 195 | 4500 / 410 / 215 | – |
| Gate (one per lane, new) | – | 3600 hp, no attack, protected while its inner tower stands. Death: the attacker's waves in that lane add an **elder wisp** (1400 hp, 120 damage, armor 30). Respawns after 150 s | Ends stalled sieges |
| Guardians (two, new) | decorative (`bases.js:35`) | 4200 / 420 / 230, rate 1.2. Every 6 s a slam with a 0.8 s tell and 1.2 s recovery. Vulnerable after any gate | A defense layer with counterplay |
| Core | 6200 / 350 / 145 (`sim.js:42`) | 7000 / 380 / 160. Gets hero aggro like towers (`sim.js:98`). Protected until both guardians fall | – |
| Backdoor protection | none (bots only, `combat-ai.js:37`) | Structures take 60% less damage from heroes when no attacking minion is in range | Rewards wave play (rule 9) |
| Court defense | heal only (`sim.js:435`) | Enemy heroes inside `BASE_HEAL_RADIUS` take 25% max hp/s after a 0.5 s warning ring | No spawn camping (rules 2, 10) |
| Tower rewards | 150 XP / 180 embers to all (`sim.js:125`) | Outer 120/150, middle 150/180, inner 180/220, gate 150/150, guardian 200/250 | – |
| Boss first / respawn | 26 / 65 (`sim.js:40,129`) | 120 / 150 (as tested). From 12:00 the respawn becomes an **elder** version with a stronger siege beast | Peaks at fixed times (rule 8) |
| Camps | 4, respawn 32 (`world.js:39`, `sim.js:135`) | 8 (two per jungle quarter), respawn 45–60 | Area is 4× larger |
| Portals | 4, cooldown 10 (`world.js:38`, `sim.js:304`) | 6, cooldown 15 | Rotations |
| Passive gold | 3.2/s (`sim.js:427`) | 2.4/s (as tested) | Builds finish at about 12 minutes |
| XP curve | 60 + 25L (`abilities.js:24`) | 80 + 32L (t3p's 96 + 40L reached only 12.4 by 15:00) | About level 16–18 near the end |
| Respawn | 5 + level (`sim.js:119`) | 6 + 1.2·level, maximum 28, plus 30% speed for 8 s on leaving the court | Walk back doubles |
| Sprint | player only (`sim.js:450`) | Bots too | Fairness |
| Bot rotation ranges | absolute (`combat-ai.js:51-52`, `team-events.js:9-10`) | × `SIZE/6400` | Rotations still happen |

**Expected effect.** t3p gave median 1038 s. The changes above aim at about 14 minutes:
- Fortification ends 1 minute sooner.
- Outer and inner towers have less hp.
- Elder wisps and sudden death shorten the core siege, which took about 330 s in t3p.

Validation: sweep 36 matches. Check the median and IQR, and that no more than 2/36 matches reach the 1320 s hard stop.

---

## 10. The ten combat-fun rules applied to objectives and pacing (`docs/combat-fun-system.md:7-16`)

| Rule | State today in structure and pacing systems | Proposal |
| --- | --- | --- |
| 1. Immediate control | Only the player sprints; bots do not (`sim.js:450`) | Same travel rules for all; travel aids on the bigger map |
| 2. Readable threat | Range ring appears within range + 250 and turns red when targeting the player (`illustrated-render.js:205`). Tower shots have only a 0.12 s windup (`sim.js:182`). Hero-damage aggro is invisible (`sim.js:98`) | A tether line when a tower switches to a hero. Guardian slam and court defense show warnings first |
| 3. Real counterplay | Minions draw tower fire (`sim.js:484`). Leaving range resets pressure (`sim.js:482`) | Backdoor rule and caster minions to tank behind. Elder wisps can be cleared |
| 4. Punish window | Neutral special attacks have recovery (`encounters.js:30-31`); structures have none | Guardian slam with 1.2 s recovery. Gate falls → 150 s window before respawn |
| 5. Impact feedback | Tower death: burst, message, banner, synthesized voice (`sim.js:116,126`, `announcer.js:37-38`). No tower clips in `audio/announcer/` | Lines and sounds per tier, a distinct break for gate and guardian, camera nudge on core exposure |
| 6. Target priority | Tiers differ only in hp. Minions are all melee except siege (`sim.js:331`) | Different tier roles; caster minions; guardians as an area threat |
| 7. Resource tension | Gold has nothing to buy after about 7 minutes (section 5); no consumables (`items.js`) | Slower income; a gold sink (consumables or buybacks) |
| 8. Pressure rhythm | First fight at 6 s; constant 14 s waves; ramp keeps rising after 4:00 (`sim.js:188`) | Early phase, boss and elder at fixed times, gate respawn windows, ramp only in sudden death |
| 9. Skill expression | Last-hit gold (`sim.js:140`); towers can be dived using the aggro rules | Backdoor rule rewards wave timing; slam dodges |
| 10. Understandable failure | The kill feed says "The wards" (`announcer.js:17`) | "Killed by Inner ward ×4 (+88%)"; tips when a protected structure is clicked are already there (`main.js:355`) |

---

## 11. Risks and open questions
- **Size reading.** If the user meant "double the area", use 9600 (three tiers: median 419 s without other changes). Confirm with the user. The orchestrator's assumption (4800 → 9600) started from a stale size.
- **Bot behaviour is a large part of the pacing.**
  - Bots fight at 6–10 s because they enter `fight` mode at 850 units (`combat-ai.js:8`).
  - A laning period needs combat-ai changes, not just constants.
- **Art scope.** Three tiers, the gate and the guardians need new silhouettes (only `tower-ally`/`tower-enemy` exist). The ground needs chunked rendering at 12800.
- **Not run:** browser, phone, audio, rendering or frame-rate checks. All numbers come from Node simulation. `desktop.e2e.mjs` and `qa/creatures/browser.mjs` were not run.
- **OpenSpec:** the new change must replace "Expanded two-stage arena" (`openspec/specs/moba-combat/spec.md:56-63`) and work alongside the two active `moba-*` changes.

---

## 12. Scratch artefacts
Directory: `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/`
- `sim-test.out`: passing output of `qa/tidebreak/sim.test.mjs` (36 matches).
- `layout.mjs`, `layout2.mjs`: current tower coordinates and path distances. `propose-layout.mjs`, `propose-abs.mjs`: checked placements.
- `pacing.mjs`, `pacing2.mjs`: timeline instruments. `economy.mjs`: per-minute economy. `cost.mjs`: unit counts and step cost.
- `game-base`, `game-s9600`, `game-s12800`, `game-t3_12800`, `game-t3_9600`, `game-t3p_12800`: patched copies. `LIMIT` and `RAMP` are read from the environment.
- Results: `out-base-360.txt`, `out-base-1500-noramp.txt`, `out-9600-360.txt`, `out-12800-360.txt`, `out-12800-1500.txt`, `out-t3-12800-1500.txt`, `out-t3-12800-1500-noramp.txt`, `out-t3-9600-1500-noramp.txt`, `out-t3p-12800-1500.txt`, `econ-t3p.txt`.