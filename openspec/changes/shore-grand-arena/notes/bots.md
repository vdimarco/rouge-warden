# Bots: harder but fair, with a difficulty setting

Branch `claude/quirky-cerf-vwf0qw-bots`. The base is the 6400-unit map. Every new distance is a multiple of `SIZE / 6400`, so it scales with the bigger map.

## What I added

| Behaviour | Files |
|---|---|
| Difficulty profiles: Apprentice, Veteran (default), Mythic for the enemy team. Allied bots use a fixed `ally` profile, a copy of Veteran. A `legacy` profile keeps the old bots for comparisons. | `public/tidebreak/bot-difficulty.js` (`PROFILES`, `setDifficulty`, `botProfile`) |
| Difficulty control beside Play (a radio group with arrow keys). The choice is saved in `localStorage` under `tidebreak.difficulty`. A badge "Enemy · Mythic" shows in the match. | `difficulty-ui.js`, `difficulty.css`, 2 lines in `index.html` (`#difficulty-picker`, `#difficulty-badge`), 3 lines in `main.js` |
| Reaction delay per profile, from a seeded hash. It is never below the profile floor. A bot in a basic-attack windup reacts later ("busy hands"). | `reactionDelay`; hook at `combat-ai.js` warning timer |
| Dodge roll: a failed dodge steps 120 units, not 320, so a careless bot can still be hit. Active damaging ground is always escaped. Veteran and Mythic do not dodge into a tower that nothing tanks. | `evadePoint` |
| Wave-gated lane walking: with no allied minion, Wild Hunt or summon in front, the bot waits outside tower range. | `laneHold`; `sim.js` `bot()` skips `followLane` when the decision has a hold point |
| Tower-dive guard that counts tower damage: the bot estimates the time to kill and the tower damage it takes in that time. Mythic also has a kill check. Veteran dives only a hero below 15%. | `diveSafe`; hook on the target candidates |
| Trade-aware retreat: compares effective health × damage of both sides within 900 units, counts covering towers, and leaves when hurt and behind. It also leaves when a tower targets it below 60% health. | `tradeRetreat`; hook on the retreat line |
| Sprint parity in the bot movement path only: sprint 1.35 out of combat, frenzy, hunt and Nessie in water, the same as the player. | `botStride`; hook on the bot `move()` call |
| Ganks and rotations through rift gates when the bot's lane is pushed (it is holding). One ganker per team, with a cooldown per profile. The target must be visible to the team. | `strategy` (gank), `routeTo`; `sim.js` calls `portal()` when the decision says so |
| Defend calls: the closest healthy bot answers a `defend` ping, so the chat line "I'll go" is true for allied bots. | `strategy` (defend) |
| Spirit camps when safe: no visible enemy hero near, after 30 s, while holding or hurt. Camp state comes only from the team's own vision. | `strategy` (camp), `campKnown` |
| Focus fire: a team focus on the visible enemy hero with the least effective health per allied damage, renewed every 2 s. It counts only in reach. A bonus also goes to the lowest effective-health hero in range. | `teamFocus`, `lowestInRange`, `targetBonus` |
| Objective timing: healthy bots gather on their side of the boss pit 6 s (Veteran) or 12 s (Mythic) before it wakes, and one bot calls a rally. After a won fight (2 enemies down for Veteran, 1 for Mythic), a healthy pair pushes an open ward, and wards beat farming in the target score. | `strategy` (objective, push), `siegeOpen`, `wardOpen` |
| Punish windows: a hero in cast recovery, EXPOSED (`exposedUntil`), stunned or casting gets a target bonus. Veteran and Mythic dash in and skip the mana reserve against it. This reads the combat session's fields if they exist. | `punishable`, hooks on engage and mana reserve |
| Spells for heroes: below full mana, Veteran and Mythic do not spend normal spells on the wave. A shorter cast lock (0.7 s / 0.6 s) and a short lock after a cast that did not start. Bot windups and warnings do not change. | `combat-ai.js` one line; `castLock` |
| Aim lead with a seeded error: the bot aims at where the target moves in half the windup, capped at 220 units. | `leadAim` |

The hooks in `combat-ai.js` and `sim.js` are one-line changes. `sim.js` has 4 changed lines in `bot()` and 1 import.

## Difficulty table

| Knob | Apprentice | Veteran (default) | Mythic | Ally |
|---|---|---|---|---|
| Reaction to a new warning | 0.45–0.65 s (+0.12 busy) | 0.30–0.42 s (+0.08) | 0.24–0.32 s (+0.06) | as Veteran |
| Dodge clears the shape | 50% | 75% | 90% | 75% |
| Aim lead / spread | 0 / ±70 | 0.5 / ±35 | 0.6 / ±18 | as Veteran |
| Cast lock (cast / no cast) | 1.8 / 1.8 s | 0.7 / 0.25 s | 0.6 / 0.2 s | as Veteran |
| Spells on the wave | any time | only at full mana | only at full mana | as Veteran |
| Always go home below | 20% health | 28% | 28% | 28% |
| Dash in on a weak target | no | yes | yes | yes |
| Trade-aware retreat | no | yes, margin 0.75 | yes, margin 0.85 | yes |
| Wave-gated lane walking | yes | yes | yes | yes |
| Tower-dive guard | no | yes (only a hero below 15%) | yes, with a kill check | yes |
| Sprint parity | no | yes | yes | yes |
| Focus / lowest / punish bonus | 0 / 0 / 0 | 160 / 90 / 140 | 320 / 140 / 220 | as Veteran |
| Ganks | never | every 80 s | every 45 s | every 80 s |
| Camps, defend calls | no | yes | yes | yes |
| Gather before the boss | no | 6 s | 12 s | 6 s |
| Push without a wave after a won fight | no | 2 enemies down | 1 enemy down | 2 down |

No profile changes health, damage, speed, range, armor, mana or gold. A test checks this field by field.

## Measurements

Seeded matches, all six heroes on autopilot, 20 Hz steps, the full 360 s limit. Each pairing uses seeds 1–30 with sides swapped on every seed (60 matches). "A" is the first profile. `node qa/tidebreak/bot-ab.mjs <A> <B> 30`. The script copies the game to a temp folder and adds one damage hook there, so the game files have no measurement code.

| A against B | Matches | A win rate | Kills A–B per match | Towers taken A / B | Length (min) | Time-limit ends | Dive deaths A / B per match | Bot spell share of hero damage A / B |
|---|---|---|---|---|---|---|---|---|
| old against old | 60 | 0.50 | 6.6 – 6.6 | 3.27 / 3.27 | 5.29 | 24 | 2.13 / 2.13 | 28.7% / 28.7% |
| Apprentice against old | 60 | **0.33** | 4.6 – 7.7 | 2.50 / 3.93 | 4.60 | 10 | 1.88 / 1.30 | 25.3% / 30.6% |
| Veteran against old | 60 | **0.75** | 10.5 – 1.8 | 3.67 / 2.40 | 4.54 | 15 | 0.17 / 1.92 | 36.0% / 30.4% |
| Mythic against old | 60 | **0.78** | 10.8 – 1.9 | 3.53 / 2.63 | 4.37 | 15 | 0.23 / 2.38 | 35.2% / 29.9% |
| Mythic against Veteran | 60 | 0.52 | 5.5 – 5.5 | 2.97 / 3.07 | 5.19 | 27 | 0.35 / 0.37 | 36.6% / 37.8% |

With 60 matches the standard error of a win rate is about 0.065.
- Mythic beats the old bots clearly (about 4 standard errors above even). Veteran does too.
- Apprentice is gentler than the old bots (about 2.6 standard errors below even). It dies more and takes fewer towers.
- Dive deaths (a hero dies within 2.5 s of a tower hit) fall from about 2 per match to 0.2.
- **Mythic is not measurably stronger than Veteran in bot-against-bot play.** Both run the same strategy. Mythic's faster reactions, better dodges and tighter aim mostly cancel against a team that also plays well. Against a human, those are the knobs that matter, so I expect the gap to show in playtests. I did not measure it.
- **Spell share.** I count damage by heroes to enemy heroes, split by the `kind` that `damage()` gets (`spell` includes zone and bleed ticks; `item` includes reflect). By this count the old bots deal 28.7% with spells, not the 19% that `research/bots.md` reports. That report used a different counter. On the same counter, Veteran and Mythic raise the share to 35–36% and lower the basic-attack share from 64.7% to 57–58%. Every bot spell still has its 0.5 s (0.7 s ult) warning.

Tuning notes (32-match runs against Veteran, so treat them as weak signals): a strong unbounded focus bonus and an aim lead of 0.85 made Mythic worse. Faster reactions and pushing after one kill helped. A cast lock of 0.6 s raised the spell share from 33% to 40% in one run.

## Tests run

- `node qa/tidebreak/bot-difficulty.test.mjs` (new): profile ids, Veteran default, fixed allies, equal stats, faster reactions and better dodges at higher profiles, reaction floor (40 warnings per profile, none answered before the floor), dodge share within 8% of the profile, wave gate (≤ 0.5 s in tower range over 60 s for every difficulty; the old bots spend more than 2 s), dive guard (Veteran stays out; a Mythic dive only with a kill and the bot above 30%; the old bots dive), trade retreat within 1.5 s at 40% health (the old bots stay), sprint parity, cast lock, fog (no gank or focus on an unseen hero; a gank after the hero is seen), one ganker, rift-gate routing and cooldown, punish target choice, camps only when no enemy hero is near, deterministic Mythic replay. Pass.
- `qa/tidebreak/encounters.test.mjs`: the fixed 0.18–0.30 s reaction bounds now read the profile window. Pass.
- All `qa/tidebreak/*.test.mjs`: pass, including the 36 full matches in `sim.test.mjs`.
- `NODE_PATH=qa/browser/node_modules node qa/tidebreak/desktop.e2e.mjs`: 17 checks pass.
- Browser (Chromium, software rendering) at 1440×900, 390×844 and 844×390: the picker shows, saves to `localStorage`, survives a reload, moves with the arrow keys, and does not cover Play or the menu links. On 390×844 it sits above Play; the roster gets 48 px of bottom padding so its last row scrolls clear. In a started match the badge shows "Enemy · Mythic" beside the score on desktop and under it on phones. No page errors.

Not checked: a real GPU, a real phone, audio by ear, and play against a human (readability and fun need a playtest).

## Open issues

- When the main branch adds sprint for all movement, remove `botStride`'s sprint factor or keep it only in one place, or bots get sprint twice.
- Allied chat has no "X is missing" call when an enemy bot ganks. `team-chat.js` belongs to the main-branch work. The ganker leaves its lane in view, and a gate use shows the gate burst.
- There is no "Hunted" mark when the enemy focus is the player. The focus is stored in `s.botFocus[team]` for the HUD session to use.
- Recall parity (stand still, cancel on a hit) is not in this change.
- Interrupts (a bot stuns an ult in its windup) are not in this change.
- Bots still walk in straight lines. On the 9600-unit map with more cover they need `route()`.
- Defend and push choose wards through `s.units` generically, so three tiers and new guardians work, but the defend priority does not weigh higher tiers yet.

## Draft requirements (delta)

### Requirement: Enemy difficulty setting
The game SHALL offer three enemy difficulties, Apprentice, Veteran and Mythic, chosen on the selection screen before a match. Veteran SHALL be the default. The choice SHALL be saved on the device and shown during the match. Difficulty SHALL change only how enemy bots perceive and decide, never health, damage, speed, range, armor, mana or gold. Allied bots SHALL play at one fixed level for every difficulty.

#### Scenario: Choose and keep a difficulty
- WHEN the player selects Mythic beside Play and reloads the page
- THEN Mythic is still selected
- AND the next match shows "Enemy · Mythic" in the HUD

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
A bot SHALL NOT walk into an enemy tower's range when no allied minion, Wild Hunt or summon is in that range. Before attacking a hero under a tower, a bot SHALL estimate the tower damage it takes during the kill. It SHALL stay out unless the hero is almost dead and the bot can take the shots, or, on Mythic, the kill check passes.

#### Scenario: A bot with no wave waits
- WHEN an enemy bot reaches the player's outer tower and its wave is dead
- THEN the bot stops outside the tower range and waits for the next wave

#### Scenario: Bait under the tower
- WHEN the player stands under their own tower at 45% health and a Veteran bot is near
- THEN the bot does not enter the tower range

### Requirement: Bots judge trades
A bot SHALL leave a fight when its side's health and damage are clearly lower than the visible enemy side's, counting enemy towers, or when it is below half health and the enemy is at least 25 points healthier.

#### Scenario: A hurt bot leaves
- WHEN a Veteran bot at 40% health faces the player at full health
- THEN the bot retreats within 1.5 s

### Requirement: Bots play the map with information they can see
Veteran and Mythic bots SHALL gank from a pushed lane, use rift gates when a gate saves time, answer their team's defend calls, take spirit camps when no enemy hero is near, gather before the Wild Hunt wakes, and push an open ward after a won fight. They SHALL use only what their team can see or their team's own calls. A bot SHALL NOT pick a gank or focus target that its team cannot see.

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

### Requirement: Difficulty strength is measured
Seeded six-bot matches with sides swapped SHALL show that Mythic and Veteran enemies win clearly more than half of their matches against the previous bots, and that Apprentice enemies win fewer than half.

#### Scenario: Measured win rates
- WHEN `node qa/tidebreak/bot-ab.mjs <profile> legacy 30` runs for each difficulty
- THEN Mythic and Veteran win at least 65% of the 60 matches, and Apprentice wins at most 45%
