# Bots: harder but fair, with a difficulty setting

Branch `claude/quirky-cerf-vwf0qw-bots`. The work started on the 6400-unit map and is now merged with the 9600-unit grand arena (9 wards per team in three tiers, 2 guardians, sudden death at 14:00, time limit at 17:00). Every new distance is a multiple of `SIZE / 6400`. Sections below say which map a number comes from.

**Current state in short.** Bots of every level fight better and die far less under towers. On the grand arena the drafted lineup decides most matches, so Mythic drafts by measured kit strength. Spirit camps are off for every level, because camps cost ward damage in measured matches. See Measurements.

## What I added

| Behaviour | Files |
|---|---|
| Difficulty profiles: Apprentice, Veteran (default), Mythic for the enemy team. Allied bots use a fixed `ally` profile, a copy of Veteran. A `legacy` profile keeps the old bots for comparisons. | `public/tidebreak/bot-difficulty.js` (`PROFILES`, `setDifficulty`, `botProfile`) |
| Difficulty control beside Play (a radio group with arrow keys). The choice is saved in `localStorage` under `tidebreak.difficulty`. A small label with the difficulty name (for example "Mythic", read out as "Enemy difficulty: Mythic") shows next to the minimap in the match. | `difficulty-ui.js`, `difficulty.css`, 2 lines in `index.html` (`#difficulty-picker`, `#difficulty-badge`), 3 lines in `main.js` |
| Reaction delay per profile, from a seeded hash. It is never below the profile floor. A bot in a basic-attack windup reacts later ("busy hands"). | `reactionDelay`; hook at `combat-ai.js` warning timer |
| Dodge roll: a failed dodge steps 120 units, not 320, so a careless bot can still be hit. The bot keeps one dodge point for each warning and then goes back to its fight. (Before this, the game loop picked a new point on each tick, so a failed dodge still walked out of the zone. `bot-hooks.test.mjs` found this through `step()`.) Active damaging ground is always escaped. Veteran and Mythic do not dodge into a tower that nothing tanks. | `evadePoint` |
| Wave-gated lane walking. On the grand arena the base branch's `followLane` does this for every bot. `laneHold` now only marks a pushed lane, which frees a bot to gank or take a camp. A wave unit in range or within 20 units of its edge counts as an escort. | `laneHold`; `followLane` in `sim.js` (base branch) |
| Move guard: no fight, assist, gank, camp, push or objective move steps into, or walks a path through, the range of an enemy ward or rift that no allied wave unit tanks. A bot already inside steps out, also while it attacks without moving. Approved dives, retreat, evade and sudden death are the exceptions. Every player-facing profile has it, allies and Apprentice included. | `guardMove`; 2 lines in `sim.js` `bot()` |
| Tower-dive guard that counts tower damage: the bot estimates the time to kill and the tower damage it takes in that time. Every profile with the guard dives only a hero below 15%. | `diveSafe`; hook on the target candidates |
| Trade-aware retreat (Mythic and allies): compares effective health × damage of both sides within 900 units, counts covering towers, and leaves when hurt and behind. Below half health it also leaves a healthier enemy when its side is not larger. It also leaves when a tower targets it below 60% health. Veteran uses fixed health floors only. | `tradeRetreat`; hook on the retreat line |
| Sprint parity. The base branch's `heroSpeed()` now gives every hero, bots included, sprint, frenzy, hunt and water speed, so bots need no speed code of their own. | `heroSpeed` in `sim.js` (base branch) |
| Ganks and rotations through rift gates when the bot's lane is pushed (it is holding). One ganker per team, with a cooldown per profile. The target must be visible to the team and stand in another lane by its seen position. A gank ends on time or when its bot falls. | `strategy` (gank), `routeTo`; `sim.js` calls `portal()` when the decision says so |
| Defend calls: the closest healthy bot that is not fighting a hero answers a `defend` ping, so the chat line "I'll go" is true for allied bots. | `strategy` (defend) |
| Spirit camps when safe: no visible enemy hero near, after 30 s, only while the lane is holding. Camp state comes only from the team's own vision (a hero with line of sight to the camp). The knob is off for every level: with camps on, Mythic won 0.60 against the old bots, and 0.70–0.75 with each other map play alone. | `strategy` (camp), `campKnown` |
| Focus fire: a team focus on the visible enemy hero with the least effective health per allied damage, renewed every 2 s. It counts only in reach. A bonus also goes to the lowest effective-health hero in range. | `teamFocus`, `lowestInRange`, `targetBonus` |
| Objective timing: healthy bots gather on their side of the boss pit 6 s before it wakes, and one bot calls a rally. After a won fight (2 enemies down), a healthy pair pushes an open ward, and wards beat farming in the target score. "Down" comes from the public kill feed and the hero's level (respawn is 5 s plus the level), never from hidden timers. | `strategy` (objective, push), `wardOpen`, `targetBonus` |
| Punish windows: a hero in cast recovery, EXPOSED (`exposedUntil`), stunned or casting gets a target bonus. Veteran and Mythic dash in and skip the mana reserve against it. The bot sees a window only after its reaction floor. This reads the combat session's fields if they exist. | `punishable`, `punishes`, hooks on engage and mana reserve |
| Spells for heroes: below full mana, Veteran and Mythic do not spend normal spells on the wave. A shorter cast lock (0.7 s / 0.6 s) and a short lock after a cast that did not start. Bot windups and warnings do not change. | `combat-ai.js` one line; `castLock` |
| Aim lead with a seeded error: the bot aims at where the target moves in half the windup, capped at 220 units. | `leadAim` |
| Draft skill (Mythic): a profile can weigh measured kit strength by lane in its draft picks. `KIT_POWER` comes from 600 seeded matches (`qa/tidebreak/kit-strength.mjs`). The pool and the board are the same for everyone, and the player sees every pick. | `KIT_POWER`, `draftValue`; 2 lines in `draft.js`; `main.js` passes the difficulty |

The hooks in `combat-ai.js` and `sim.js` are one-line changes. `sim.js` has 4 changed lines in `bot()` and 1 import.

## Difficulty table

`node qa/tidebreak/profile-table.mjs` prints this table from `PROFILES`. A test fails when the table here differs from the code.

| Knob | Apprentice | Veteran (default) | Mythic | Ally |
|---|---|---|---|---|
| Reaction to a new warning (+ while attacking) | 0.45–0.65 s (+0.12) | 0.3–0.42 s (+0.08) | 0.24–0.32 s (+0.06) | 0.3–0.42 s (+0.08) |
| Dodge clears the shape | 50% | 75% | 90% | 75% |
| Aim lead / spread (units) | 0 / ±70 | 0.5 / ±35 | 0.6 / ±18 | 0.5 / ±35 |
| Cast lock after a cast / a failed cast | 1.8 s / 1.8 s | 0.7 s / 0.25 s | 0.6 s / 0.2 s | 0.7 s / 0.25 s |
| Spells on the wave | any time | only at full mana | only at full mana | only at full mana |
| Always go home below | 20% health | 28% health | 28% health | 28% health |
| Dash in on a weak target | no | yes | yes | yes |
| Trade-aware retreat and tower exit | no | no | yes, margin 0.75 | yes, margin 0.75 |
| Move guard at untanked wards | yes | yes | yes | yes |
| Marks a pushed lane (frees ganks) | yes | yes | yes | yes |
| Tower-dive guard | no | yes | yes | yes |
| Focus / lowest / punish bonus | 0 / 0 / 0 | 160 / 90 / 140 | 160 / 90 / 140 | 160 / 90 / 140 |
| Open ward target bonus | 0 | 260 | 260 | 260 |
| Ganks | never | every 80 s | every 80 s | every 80 s |
| Spirit camps | no | no | no | no |
| Defend calls | no | yes | yes | yes |
| Gather before the boss | no | 6 s early | 6 s early | 6 s early |
| Push without a wave after a won fight | no | 2 enemies down | 2 enemies down | 2 enemies down |
| Draft weight of kit strength | no | no | 3 | no |

No profile changes health, damage, speed, range, armor, mana or gold. A test checks this field by field.

Mythic uses Veteran's map plays. Its own ganks every 45 s, gathering 12 s early and pushing after one kill cost it levels and towers. Mythic differs from Veteran by faster reactions, better dodges and aim, a shorter cast lock, the trade-aware retreat and its draft.

## Measurements

### Grand arena (9600 units, final code)

`AB_DRAFT=1 node qa/tidebreak/bot-ab.mjs <A> <B> 30` on main after #259 (short failed dodges, recall parity, defend priority, routes around cover): 60 seeded matches per row, sides swapped on every seed, lineups drafted as in the game (Mythic drafts by kit strength, the other profiles do not). Matches last about 11–12 minutes. The standard error of a win rate is about 0.065. "Lineup splits" counts seeds where A won both sides, B won both sides, or each side won once.

| A against B | A wins | Lineup splits (A both / B both / split) | Kills A–B | Wards taken A / B | Bosses A / B | Dive deaths A / B | Spell share A / B |
|---|---|---|---|---|---|---|---|
| Mythic vs Veteran | **0.63** | 10 / 2 / 18 | 16.2 – 7.6 | 5.58 / 4.73 | 2.42 / 1.87 | 0.45 / 0.72 | 34.7% / 34.9% |
| Mythic vs old | **0.87** | 22 / 0 / 8 | 20.0 – 3.4 | 6.05 / 4.37 | 3.50 / 0.43 | 0.20 / 2.95 | 33.0% / 29.4% |
| Veteran vs old | 0.47 | 5 / 7 / 18 | 14.7 – 9.1 | 5.03 / 5.48 | 3.20 / 0.72 | 0.47 / 2.48 | 28.8% / 26.9% |
| Apprentice vs old | **0.35** | 2 / 11 / 17 | 8.0 – 14.6 | 4.63 / 5.98 | 1.40 / 1.75 | 0.68 / 1.67 | 22.1% / 25.5% |

- **Mythic is clearly stronger than Veteran:** 0.63, about 2 standard errors above even. Mythic won both sides of 10 seeds and Veteran of 2.
- Before #256–#259 (on main after #229) the same runs gave Mythic vs Veteran 0.67, Mythic vs old 0.68, Veteran vs old 0.52 and Apprentice vs old 0.35. Bots that fail a dodge are now hit, and bots stand still to recall. Mythic dodges more often, so it gained the most against the old bots, which still dodge every warning in full and recall while they walk.
- The order is Apprentice < old ≈ Veteran < Mythic. Veteran wins fights, bosses and kills against the old bots and dies far less under wards, but it is even on wins.
- Earlier rows (before drafting and with camps on): Mythic vs Veteran 0.48, Veteran vs old 0.50 and Mythic vs old 0.40. A single-play ablation of drafted Mythic against the old bots gave 0.75 with gathering only, 0.72 with defend only, 0.70 with ganks only and 0.60 with camps only, so camps were turned off.

- The base branch gave every bot, the old ones included, the wave-gated lane walk and sprint. That removed most of the old-map gap.
- **The lineup decides most matches.** Each seed is played twice with sides swapped. In 18–19 of 30 seeds, the same lineup side won both games whatever profile played it. Only about 12 seeds were decided by the bots' play.
- Structures fall only with a wave: a hero does 25% damage to a structure without its wave at it, and the rift regenerates when no wisp is at it. Kills turn into wins only through waves.
- These Mythic changes did not move Mythic against Veteran (60 matches each): a strong ward priority (45%, 38%), joining any lane where its wave is at a ward (47%, 52% without trade retreat), grouping in sudden death (52%), every bot defending the base (47%), falling back to a ward after a lost trade (43%), spending spells on waves. They were removed again.

**Fight time inside untanked enemy ward range** (seeds 2 and 3, up to 14:00, default profiles; `ward-guard` measure):

| Bots | Fight seconds, seed 2 / seed 3 |
|---|---|
| Old bots (base branch behaviour) | 93 / 83 |
| Apprentice, with the move guard | 5 / 12 |
| Veteran, with the move guard | 1 / 4 |
| Mythic, with the move guard | 3 / 4 |

### First map (6400 units, before the merge)

Seeded matches, all six heroes on autopilot, 20 Hz steps, the full 360 s limit. Each pairing uses seeds 1–30 with sides swapped on every seed (60 matches). "A" is the first profile. `node qa/tidebreak/bot-ab.mjs <A> <B> 30`. The script copies the game to a temp folder and adds one damage hook there, so the game files have no measurement code.

| A against B | Matches | A win rate | Kills A–B per match | Towers taken A / B | Length (min) | Time-limit ends | Dive deaths A / B per match | Bot spell share of hero damage A / B |
|---|---|---|---|---|---|---|---|---|
| old against old | 60 | 0.50 | 6.6 – 6.6 | 3.27 / 3.27 | 5.29 | 24 | 2.13 / 2.13 | 28.7% / 28.7% |
| Apprentice against old | 60 | **0.33** | 4.6 – 7.7 | 2.50 / 3.93 | 4.60 | 10 | 1.88 / 1.30 | 25.3% / 30.6% |
| Veteran against old | 60 | **0.80** | 10.8 – 1.7 | 3.85 / 2.28 | 4.78 | 22 | 0.23 / 2.08 | 35.4% / 31.5% |
| Mythic against old | 60 | **0.82** | 11.1 – 1.7 | 3.58 / 2.48 | 4.44 | 13 | 0.20 / 2.22 | 35.2% / 31.3% |
| Mythic against Veteran | 60 | 0.50 | 6.1 – 5.6 | 2.75 / 2.90 | 4.93 | 20 | 0.42 / 0.12 | 36.7% / 39.7% |

With 60 matches the standard error of a win rate is about 0.065.
- Mythic beats the old bots clearly (about 5 standard errors above even). Veteran does too.
- Apprentice is gentler than the old bots (about 2.6 standard errors below even). It dies more and takes fewer towers.
- Dive deaths (a hero dies within 2.5 s of a tower hit) fall from about 2 per match to 0.2.
- Mythic against Veteran was even on this map with the profiles of that time. After that, Veteran lost the trade-aware retreat, and Mythic won 60–65% of 60-match runs against it on this map. The grand arena merge then evened the levels out again.
- **Spell share.** I count damage by heroes to enemy heroes, split by the `kind` that `damage()` gets (`spell` includes zone and bleed ticks; `item` includes reflect). By this count the old bots deal 28.7% with spells, not the 19% that `research/bots.md` reports. That report used a different counter. On the same counter, Veteran and Mythic raise the share to 35–40% and lower the basic-attack share from 64.7% to 53–58%. Every bot spell still has its 0.5 s (0.7 s ult) warning.

The `legacy` profile replays the old bots exactly: for seeds 1–4, every unit's position and health match the code before this change for 200 s.

Tuning notes. A code review found nine problems (legacy float grouping, sticky retreat in a 3v1, push reading hidden respawn timers, instant punish, defend leaving a fight, a stale gank, camp and escort details). The fixes first dropped Veteran to 47%. Two of them were too strict: a 5 s push window after a kill, and an escort that had to be fully inside tower range. A respawn estimate from the kill feed and a 20-unit edge margin brought it back. Other notes come from 32-match runs against Veteran, so treat them as weak signals: a strong unbounded focus bonus and an aim lead of 0.85 made Mythic worse. Faster reactions and pushing after one kill helped. A cast lock of 0.6 s raised the spell share from 33% to 40% in one run.

## Tests run

- `node qa/tidebreak/bot-hooks.test.mjs` (new): through `step()`, a failed dodge moves less than 160 units and leaves the bot in the zone, a good dodge leaves it, for every difficulty; a bot in a held lane starts a gank and closes from about 3200 to under 1000 units.
- `node qa/tidebreak/bot-difficulty.test.mjs` (new): profile ids, Veteran default, fixed allies, equal stats, faster reactions and better dodges at higher profiles, reaction floor (40 warnings per profile, none answered before the floor), dodge share within 8% of the profile, wave gate (≤ 0.5 s in tower range over 60 s for every difficulty; the old bots spend more than 2 s), dive guard (Veteran and Mythic stay out; the old bots dive), trade retreat within 1.5 s at 40% health (the old bots stay), sprint parity, cast lock, fog (no gank or focus on an unseen hero; a gank after the hero is seen), one ganker, rift-gate routing and cooldown, punish target choice, no level takes camps, and with the knob on camps only when no enemy hero is near, the notes table matches `PROFILES`, the move guard at wards, drafting by kit strength, deterministic Mythic replay. Pass.
- `qa/tidebreak/encounters.test.mjs`: the fixed 0.18–0.30 s reaction bounds now read the profile window. Pass.
- All `qa/tidebreak/*.test.mjs`: pass, including the full matches in `sim.test.mjs` with its original "more than 4 kills" check per match.
- `NODE_PATH=qa/browser/node_modules node qa/tidebreak/desktop.e2e.mjs`: 17 checks pass.
- `NODE_PATH=qa/browser/node_modules node qa/tidebreak/difficulty.e2e.mjs` (new): at 1440×900, 390×844, 844×390, 320×568 and 568×320 the saved choice shows after a reload, every picker button is on screen and takes the tap, the picker covers no menu control, and in a match the label shows the choice, is on top and covers no HUD part. A sixth check blocks `localStorage`: the picker and the arrow keys still work. 6 checks pass, no page errors.

Not checked: a real GPU, a real phone, audio by ear, and play against a human (readability and fun need a playtest).

## Follow-up results

- Missing calls are done. When an enemy hero that the player's team saw in a lane stays out of their sight for 4 s, the nearest allied bot says so in chat ("Hydra missing West!"). A violet "?" ping marks the last seen spot on the minimap. One call per hero every 25 s at most. Only the team's own vision counts.
- The "Hunted" mark is done. It shows under the health bar while the enemy bots' team focus is the player. That focus needs the enemy team to see the player, so the mark gives away nothing hidden. Apprentice bots have no focus, so it never shows on Apprentice.
- Recall parity is done: bots stand still for 2.5 s, a hit cancels the recall, and the player sees their recall ring.
- Interrupts are not built, on purpose. A bot's control spell winds up for 0.45–0.5 s, and its reaction floor is at least 0.24 s. The player's ults land 0.4 s after the cast starts. A bot could stop one only with a reaction under the floor, and the fairness rules forbid that. Bot ults (0.7 s windup) are only barely in reach for Mythic, so allies and enemy bots do not interrupt each other either.
- Bots walk around cover with `route()`, the A* that the player's click orders use. Time that a roaming bot spends blocked fell from 2.3 s to 0.7 s per hero per match (4 seeds, 400 s, Veteran, recalls excluded). A step costs 3% more on average. Both realm graphs are built when a match is created. The old bots still walk straight.
- Defend calls go to the structure nearest the base first: the core, then guardians, then the inner, middle and outer wards. Among equals, the latest call.

## Draft requirements (delta)

### Requirement: Enemy difficulty setting
The game SHALL offer three enemy difficulties, Apprentice, Veteran and Mythic, chosen on the selection screen before a match. Veteran SHALL be the default. The choice SHALL be saved on the device and shown during the match. Difficulty SHALL change only how enemy bots perceive and decide, never health, damage, speed, range, armor, mana or gold. Allied bots SHALL play at one fixed level for every difficulty.

#### Scenario: Choose and keep a difficulty
- WHEN the player selects Mythic beside Play and reloads the page
- THEN Mythic is still selected
- AND the next match shows "Mythic" next to the minimap

#### Scenario: Difficulty does not change stats
- WHEN the same lineup starts on Apprentice and on Mythic
- THEN every hero has the same health, damage, speed, range, armor, mana and gold in both matches

#### Scenario: Allies stay the same
- WHEN the player changes the difficulty
- THEN the two allied bots behave the same as before

### Requirement: Bots react at human speed
A bot SHALL NOT answer a new cast warning or pending ground before the reaction floor of its difficulty (Apprentice 0.45 s, Veteran 0.30 s, Mythic 0.24 s). A bot SHALL sometimes fail a dodge with a short step, more often at lower difficulty. Bot spell warnings SHALL keep their length at every difficulty.

#### Scenario: A quick cast lands on a slow bot
- WHEN the player starts a spell whose warning covers an Apprentice bot and the spell resolves 0.4 s later
- THEN the bot has not started to dodge

#### Scenario: Bot spells stay readable
- WHEN a Mythic bot casts an offensive spell
- THEN the warning shape shows for at least 0.5 s before the damage

### Requirement: Bots respect towers
A bot SHALL NOT walk into, or stand in, the range of an enemy ward or rift when no allied minion, Wild Hunt or summon is in that range, in any mode except retreat, evade and sudden death. Before attacking a hero under a tower, a bot SHALL estimate the tower damage it takes during the kill. It SHALL stay out unless the hero is below 15% health and the bot can take the shots.

#### Scenario: A bot with no wave waits
- WHEN an enemy bot reaches the player's outer tower and its wave is dead
- THEN the bot stops outside the tower range and waits for the next wave

#### Scenario: A wisp under the ward
- WHEN an enemy wisp stands under the player's outer ward and the bot's own wave is dead
- THEN the bot does not walk into the ward's range to hit the wisp

#### Scenario: Bait under the tower
- WHEN the player stands under their own tower at 45% health and a Veteran bot is near
- THEN the bot does not enter the tower range

### Requirement: Bots judge trades
A Mythic or allied bot SHALL leave a fight when its side's health and damage are clearly lower than the visible enemy side's, counting enemy towers, or when it is below half health and the enemy is at least 25 points healthier.

#### Scenario: A hurt bot leaves
- WHEN a Mythic bot at 40% health faces the player at full health
- THEN the bot retreats within 1.5 s

### Requirement: Bots play the map with information they can see
Veteran and Mythic bots SHALL gank from a pushed lane, use rift gates when a gate saves time, answer their team's defend calls, gather before the Wild Hunt wakes, and push an open ward after a won fight. They SHALL use only what their team can see or their team's own calls. A bot SHALL NOT pick a gank or focus target that its team cannot see.

#### Scenario: A gank from a pushed lane
- WHEN the player is seen at low health in another lane and an enemy bot's lane has no wave in front
- THEN that bot moves toward the player, through a rift gate when that is faster

#### Scenario: Fog hides the player
- WHEN no enemy unit can see the player
- THEN no enemy bot starts a gank toward the player

### Requirement: Bots focus and punish
Veteran and Mythic bots SHALL prefer, among heroes in reach, the one with the least effective health and the team focus target. They SHALL prefer a hero that is in cast recovery, EXPOSED, stunned or casting. They SHALL keep normal spells for heroes instead of the wave unless their mana is full.

#### Scenario: A missed cast is punished
- WHEN the player misses a spell and is in its recovery near a Veteran bot
- THEN the bot attacks the player before a healthier, closer hero

### Requirement: Mythic drafts strong heroes
A Mythic enemy team SHALL weigh measured kit strength by lane when it drafts. Every team SHALL draft from the same pool, and the player SHALL see every pick.

#### Scenario: A Mythic draft
- WHEN the same seed is drafted against Veteran and against Mythic
- THEN the Mythic team's picks have at least the same summed kit strength

### Requirement: Difficulty strength is measured
Seeded six-bot matches with drafted lineups and sides swapped SHALL show that Mythic beats Veteran, and that Veteran and Mythic enemies die less under towers than the previous bots. Win rates SHALL be reported with the share of seeds that the lineup decided.

#### Scenario: Measured fights
- WHEN `AB_DRAFT=1 node qa/tidebreak/bot-ab.mjs <A> <B> 30` runs for Veteran and Mythic against `legacy`, and for Mythic against Veteran
- THEN Mythic wins more than half of its matches against Veteran
- AND the profile's team has fewer dive deaths per match than the previous bots
- AND the report lists win rate and lineup splits
