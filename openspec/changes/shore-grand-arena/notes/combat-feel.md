# Combat feel in Shore of the Ancients

What this branch (`claude/quirky-cerf-vwf0qw-combat`) adds against the ten rules in `docs/combat-fun-system.md`, using
`../research/combat-audit.md` as the plan. Bots, difficulty, the map, the towers and the 3D renderer are other sessions' work.
Every claim from the audit was checked in the code before it was used; where the code disagreed with the audit, this file says so.

## 1. Rule to mechanic to files

| Rule | Mechanic | Files |
|---|---|---|
| 10 Understandable failure | Death recap during respawn: killer, damage by source and by type over the last 8 s, which warned hits landed and whether they were dodgeable, control time, and one tip from the main cause. Dismissible. Carries the respawn countdown. | `combat-tells.js` (ring buffer), `death-recap.js` (build + view), `sim.js` (`recordHit`, `noteControl`, `withContext` at every damage source), `main.js`, `combat-feel.css` |
| 10 | Wisp kills no longer post a DEFEATED result label, so the four result slots carry hero events. | `sim.js` |
| 2 Readable threat | Audio cue when an enemy or neutral windup starts: a rising swell as long as the tell, panned to the caster, brighter when the shape covers you. | `audio.js` (`windup`), `announcer.js` |
| 2 | Windup pose data for both renderers (`windupState`): progress from the first cue to the hit, with a kind (cast, engage, ultimate, neutral, lock). The 2D renderer leans the unit back and grows a ring. | `combat-tells.js`, `combat-tells-draw.js`, `illustrated-render.js` |
| 2 | Engage tells: Jersey Devil's leap and Stone Golem's charge are no longer instant. They cast with a 0.3 s windup for players, 0.45 s for bots, and draw a path tell to the landing circle. The stun now lands after the tell. | `combat-state.js`, `combat-tells.js` (`ENGAGES`, `engageShape`), `combat-rules.js` (`insideWarning` for a path), `sim.js` |
| 2 | Kraken's ink arms 0.35 s before its first tick, so its first damage is warned. | `legend-rules.js` |
| 2 | Tower target lock: a tower holds fire 0.35 s after it picks a hero, draws a tether that turns solid, and beeps twice when the target is you. | `combat-tells.js` (`towerLock`), `sim.js`, `combat-tells-draw.js`, `audio.js` (`lockOn`), `announcer.js` |
| 4 Punish window | A committed cast that hits nothing is a miss: recovery grows to 0.5 s (0.7 s for an ultimate) and the caster is EXPOSED for that time. A cast that hits keeps the short recovery. An ultimate that hits is exposed for its own recovery. | `combat-tells.js` (`openCommit`/`closeCommit`/`judgeCommit`), `sim.js` |
| 4 | An interrupted cast staggers the caster: 0.4 s exposed, with no mana or cooldown spent (the spec's interrupt rule is unchanged). | `sim.js` |
| 4 | Hitting an exposed enemy hero deals x1.15 and shows OPENING HIT, the same cue camps and the boss already used. Killing one reads FINISHER. | `combat-tells.js` (`heroOpening`, `EXPOSED_BONUS`), `sim.js` |
| 5 Impact feedback | Presentation hitstop. The sim keeps stepping at 60 Hz; `ImpactFeel` freezes the drawn pose of the two units in the hit for 60/80/90 ms by weight, at most one per 0.3 s. | `impact-feel.js`, `illustrated-render.js`, `main.js` |
| 5 | Shake scaled by weight: 4/6/8 px, over the old flat 3x2 px. Reduced motion turns hitstop and shake off. | `impact-feel.js`, `illustrated-render.js` |
| 5 | Damage you take: a thud scaled by the share of health lost, a red screen-edge flash, and a heartbeat under 30% health. | `audio.js` (`hurt`, `heartbeat`), `main.js`, `combat-feel.css` |
| 5 | Damage numbers sized by amount and coloured by type; openings are gold. A gold chime on a last hit. A low impact thud at each hitstop. | `sim.js`, `audio.js` (`lastHit`, `impact`), `main.js` |
| 9 Skill expression | Visible input buffer: a press in the last 0.12 s of a cast or a recovery is kept and shown as QUEUED on the button, then cast on the first free step. | `combat-tells.js` (`bufferCast`, `lockRemaining`), `sim.js`, `main.js`, `combat-feel.css` |
| 9 | A quiet commit click when your own cast starts its windup. | `audio.js` (`commit`), `main.js` |
| 9 | Outplay for basic attacks: the third chain strike on a hero gets +0.08 s windup and a reach ring, and its slack past attack range drops from 90 to 35 units (scaled by map size). Stepping out of that reach makes it miss and shows DODGED over the hero who dodged. | `sim.js`, `combat-tells.js` (`DODGE_SLACK`), `combat-tells-draw.js`, `combat-feedback.js` |
| 6 Target priority | Camps fight like their art: the mage and the archer shoot a line, the ogre and the knight cleave, each with its own warning label. | `encounters.js` |
| 6 | Marks in the world: a gold diamond on a wisp your next basic attack can finish, a HEALER cross on a healing summon. | `combat-tells-draw.js`, `illustrated-render.js` |
| 8 Pressure rhythm | Objective clock under the score: a Wild Hunt countdown that turns gold and sounds a horn in the last 10 s, and a QUIET rest hint when you are out of combat with no peak within 20 s. | `objective-clock.js`, `main.js`, `combat-feel.css` |
| 7 Resource tension | Lane mana regeneration drops from `6 + 0.35 x level` to `3.5 + 0.25 x level`. Base court regeneration is unchanged. | `combat-tells.js` (`manaRegen`), `sim.js` |
| - | Bug found while testing: an obstacle beside the map edge could push a body past the edge clamp, so `resolveBody` clamps again at the end. | `world.js` |

No map geometry, tower stats, wave, economy, respawn or time-limit constants were changed. Distances this branch adds are written as
a multiple of `SIZE / 6400` (`combat-tells.js`), so they scale with the bigger map.

## 2. Data the 3D renderer draws

All of this is sim or presentation data. Both renderers draw it: the 2D one in `illustrated-render.js` and
`combat-tells-draw.js`, the 3D one in `three-render.js` and `render3d/tells.js`.

**What the 3D renderer draws, and where:**

| Tell | 3D drawing | Code |
|---|---|---|
| Cast, special and engage warnings | Ground disc, cone or path to a landing circle, with a progress ring | `three-render.js` `telegraph()` (the base branch's own code; it already handled `shape: 'path'`) |
| Windup | A ground ring that grows and brightens from the first cue to the hit | `render3d/tells.js` `drawTells3D` |
| Tower lock-on | A light beam from the crystal to the target that thickens over the lock, a closing ring on the target, and TOWER LOCK over the player | `drawTells3D`, `overlayTells` |
| Warned third strike | A dashed reach ring around the attacker and a line to its target | `drawTells3D` |
| EXPOSED and RECOVERY | Dashed ring and countdown label | `three-render.js` (base code) |
| Hitstop | The views of the units in the hit are not updated while it lasts, so their pose holds; a white ring flashes on them | `render3d/units.js` `sync()` (one line), `drawTells3D` |
| Weighted shake | The camera shake takes the larger of the old effect shake and `feel.shake`, converted from pixels to world units | `three-render.js` `follow()` |
| Finishable wisps, healing summons | The 2D marks, drawn on the 3D overlay canvas | `drawUnitMarks` from `combat-tells-draw.js` |
| Damage numbers | The overlay label takes `floater.size` | `three-render.js` `drawOverlay()` |

All new ground marks go into the existing instanced decal and ribbon meshes, so they add no draw calls (56 with the tells
against 57 on the base in the same SwiftShader scene). The pose lean during a windup is drawn in 2D only; the 3D rig has no
windup clip yet.

**Read from a unit (sim state):**

| Field | On | Meaning |
|---|---|---|
| `castIntent.shape.shape === 'path'` with `tx`, `ty`, `radius`, `engage` | hero | An engage tell. Draw the path from the caster to `tx,ty` and a circle of `radius` at the end. `insideWarning` (combat-rules.js) is the hit test. |
| `lockTarget`, `lockStart`, `lockAt` | tower, core | Tower target lock. Draw a tether to the unit with id `lockTarget`, dashed to solid over `lockStart..lockAt`, plus a ring on the target. |
| `pendingAttack.telegraph`, `pendingAttack.at` | hero | A warned third basic strike. Draw a ring at `e.range + target.radius + DODGE_SLACK` around the attacker, plus a line to the target. It is a ring, not a cone: the rule that makes the strike miss is range alone. |
| `exposedUntil`, `exposeReason` (`miss`, `ultimate`, `interrupt`) | hero, camp, boss | The punish window. Already drawn as the EXPOSED ring and label. |
| `recoveryUntil` | hero | The shorter lock after a cast that hit. |
| `queuedCast.slot` | player | A buffered press. The HUD shows QUEUED. |
| `deathRecap` | hero | The recap object (see `death-recap.js`). A 3D HUD can show the same fields. |
| `damageLog`, `controlLog` | hero | Bounded histories (8 s, 48 and 12 entries). Data only, no drawing. |
| `commit` | hero | Internal to the punish rule. Do not draw. |
| `healing > 0` | summon | Draw the HEALER mark. |
| `hp <= player.damage` | enemy minion | Draw the finishable diamond. |
| `s.impacts[]` `{id, time, x, y, weight 1..3, kind, source, target}` | match | Impact events. Bounded to 16. |

**Read from helpers (no new state):**

- `windupState(unit, time)` in `combat-tells.js` returns `{progress 0..1, kind, at, target}` for a cast, engage, ultimate, neutral
  special or tower lock. Use `progress` to drive a windup pose, a glow or an animation playback rate. It returns `null` when the
  unit has no tell.
- `ImpactFeel` in `impact-feel.js` is the presentation state. Call `update(state, playerId, frameSeconds, {reducedMotion})` once a
  frame. Then read `hitstop` (seconds left), `frozen` (a Set of unit ids), `poseTime(unit, time)` (the time to pose that unit at),
  `shake` (pixels) and `edge` (0..1 for the red screen flash). `update` returns `{impacts, hurt}` for sound. It never writes sim state.
- `objectiveClock(state, player)` in `objective-clock.js` returns the HUD timers.
- `buildRecap` is called by the sim at the moment of death. A renderer only reads `hero.deathRecap`.

**New element ids and CSS:** `#death-recap` (with `.recap-head`, `.recap-sub`, `.recap-timer`, `.recap-sources`, `.recap-types`,
`.recap-warned`, `.recap-control`, `.recap-tip`, `.recap-close`), `#hurt-edge`, `#objective-clock`, and the class `queued` on a
`[data-skill]` button. All of it is in the new `combat-feel.css`. No existing id or selector changed.

## 2b. Review fixes

An adversarial review of the diff inside this session found these, and each one is fixed with a test:

- A miss's punish window was cancelled by any later hit the exposed hero landed, including a bleed tick or a basic attack.
  The rollback is gone; a cast that places a zone, trap or missile already counts as a commitment when it is placed.
- Stone Golem's charge was judged by any damage during its flight (it is the only travelling cast with a windup, so the only
  one that opens a commit). A hit now counts only while the charge itself is touching that body. A second round found that
  resolving the ids at judge time lost a body the charge had killed, which read as a miss; the hit is recorded as it happens.
- The aim of a cast was judged when it resolved, so a hero who dodged out of the shape turned the cast into a non-hero cast and
  any wisp in the shape paid for the dodge. The aim is decided when the cast locks (`castIntent.heroAim`).
- A commit still waiting on a charge was discarded by the next cast. `openCommit` judges any open commit first.
- A pause held the low-health screen edge at zero. `ImpactFeel.idle` keeps it.
- A self-centred ultimate asked for a hero hit when the auto-target scan found a hero 500 units away that the burst could
  never reach. The commit now asks for a hero hit only when that hero is inside the locked shape.
- The third-strike tell drew a cone while the dodge rule was range alone. It now draws a ring at exactly the reach the rule
  uses, plus a line to the target.
- A stun on the attacker credited the defender with DODGED. The call now fires only when the target stepped out of reach, and
  the label is drawn over the hero who dodged.
- A press for a spell on cooldown or with too little mana was shown as QUEUED and then failed silently. It is no longer buffered.
- The realm entry never reached the HUD list. It stays in the returned object (the HUD has its own realm line) and the test
  says so, instead of asserting a feature that does not ship.
- Hitstop, shake and the red edge froze while the match was paused or the arcade switcher was open. `ImpactFeel.idle(dt)`
  keeps them fading without reading new impacts.
- The windup sound had a gain floor that defeated its own distance cutoff, so every visible windup played at near-full volume.

## 3. Measurements

Seeded autopilot matches, 3 seeds x 12 kits, dt 0.05, to the match limit, measured **after merging the map branch**
(script: `/tmp/claude-0/-home-user-rouge-warden/fc085bc9-d6ef-56de-b04e-e20284e4d207/scratchpad/telemetry.mjs`, not in the repo).

| Measure | Audit target | After |
|---|---|---|
| Hero exposures punished (any hero damage inside the window) | - | 29.3% of 3817 |
| Recovery after a **miss** punished | at least 30% | **35.1%** of 1770 |
| Death recap coverage | 100% | **100%** of 933 deaths |
| Recap source totals match the health and shield lost | - | 100% |
| Sources in a recap (median) | - | 2 |
| Share of a death from warned hits (median) | - | 37% |
| Shortest bot cast tell | 0.3 s minimum | **0.45 s** (median 0.5 s), 15877 casts |
| Wisp DEFEATED labels | 0% | 0% |
| Dodged warned basic strikes | - | 77 (bots do not yet try to dodge them, so this is a floor) |

Mana (two scripts, `mana.mjs` for the bot autopilot and `mana2.mjs` for a player who presses every ready spell near an enemy;
share of alive time below the cost of the cheapest learned spell, median over 24 matches):

| Case (on the merged map) | Before (`6 + .35 x level`) | After (`3.5 + .25 x level`) |
|---|---|---|
| Player on autopilot | 2.1% | 5.9% |
| Every hero, all matches | 4.1% | 6.1% |
| Player casting on cooldown in a fight | 8.7% (quartiles 3.6-21.8%) | **15.1%** (quartiles 7.4-31.5%) |

On the bigger map a player who casts on cooldown is now mana-starved 15.1% of their alive time, inside the audit's 10-20%
target. A player who spends more carefully stays near 6%. The audit's remaining proposals for rule 7
(a higher ultimate cost, gold sinks, shop position) touch economy constants the map branch owns, so they are not in this branch.
Bot kill counts per match are unchanged by it (mean 11.1 against 11.9 before the whole branch; the floor in `sim.test.mjs` moved
from "more than 4" to "at least 2 per match, at least 8 on average", because a longer punish window and slower towers mean fewer
one-sided trades).

## 4. Tests

- New: `qa/tidebreak/combat-feel.test.mjs`. It proves tell lengths per hero and slot, the engage path tell and its delayed stun, the
  armed ink zone, the tower lock delay, the windup and lock-on sounds, the miss/ultimate/interrupt exposure, the x1.15 opening
  bonus, impact weights and the 60/80/90 ms hitstop with its 0.3 s gap, reduced motion, that presentation writes no sim state,
  the hurt channel, damage number sizes, the input buffer window and its expiry, the dodgeable third strike, the recap contents
  and its tips, camp roles, objective timers and mana regeneration. `node qa/tidebreak/combat-feel.test.mjs` -> PASS.
- New: `qa/tidebreak/combat-feel.e2e.mjs`. Chromium at 1440x900, 390x844 and 844x390: the recap shows during respawn with its
  countdown, names the killer and the dodgeable hit, overlaps none of twelve controls, fits the screen and closes; the objective
  clock and QUEUED read correctly; the engage tell and tower lock draw with no page error. 24 checks passed at all three sizes.
- Changed, with the reason in each file: `combat-decisions.test.mjs` (a missed cast now exposes and locks for 0.5 s),
  `tactical-combat.test.mjs` (a tower locks on before its first shot), `sim.test.mjs` (the kill floor above).
- New: `qa/tidebreak/combat-feel-3d.e2e.mjs`. Chromium with SwiftShader and `?renderer=3d`: the windup, third-strike and lock-on
  tells add ground decals and a beam and clear with their state; the lock beam changes the screen pixels at its midpoint; TOWER
  LOCK shows over the player; hitstop holds the views of the units in the hit while the others update; shake follows the weight;
  damage numbers keep their size; no page or console errors. 6 checks passed.
- Whole suite on the merge of `claude/quirky-cerf-vwf0qw` at `103db12`: 20 of the 22 files in `qa/tidebreak/` pass.
  `sim.test.mjs` (line 19) and `towers.test.mjs` (line 61) fail with the same assertions on the base head itself, checked in a
  separate worktree: the base's latest map work in progress. (The base has moved several times during this work; at `4299c58`
  all 22 passed.)
- `qa/tidebreak/desktop.e2e.mjs`: 17 checks passed. `qa/tidebreak/combat-feel.e2e.mjs`: 24 checks passed.
- `qa/tidebreak/render3d.e2e.mjs` stops at its pick check ("pick finds the enemy hero under the cursor") on this branch and on
  the base branch alike, with the same result. With only that assert turned into a log, its other seven checks pass on both
  trees, with the same draw-call counts and the 2D/3D switch working.

## 5. Not checked, and open issues

- Audio was checked only through the code and the e2e output meter. Nobody listened to the new windup, lock-on, commit, hurt,
  heartbeat, impact or last-hit sounds. The mix levels are a first guess.
- No real GPU and no real phone. The browser checks ran in headless Chromium with software rendering.
- Hitstop was measured as data (`ImpactFeel` values in the Node test), not by eye at 60 Hz on a real screen.
- Bots do not use any of this yet: they never punish an exposed hero, never dodge a warned basic strike, and never read
  `exposedUntil` or `recoveryUntil`. That is the bot session's work. The hooks are `exposedUntil`, `exposeReason`, `recoveryUntil`
  and `pendingAttack.telegraph`.
- The audit's rule 6 proposals for wisp roles and tower roles, and its rule 8 match clock, belong to the map branch and are not here.
- The 3D tells were checked in SwiftShader only. Their colours pass through the 3D colour grade, so the reds read paler than in
  2D; that matches the existing 3D telegraphs, but it should be judged on a real screen.
- The 3D renderer has no windup lean; the 2D one does. A windup clip in the rig would close that gap.
- `qa/tidebreak/sim.test.mjs` had a per-match floor of more than 4 kills. Longer punish windows, less mana and a tighter basic
  attack reach lower the kill rate, so the floor is now 2 per match with an average of at least 8. The map branch owns match
  pacing, so the right floor should be set once its waves and timings settle.
- `DODGE_SLACK` is tuned at 35 units (times `SIZE / 6400`). On the bigger map it scales, but it was only measured on bot matches.

## 6. Draft OpenSpec requirements (delta format)

These are for the orchestrator to merge into `openspec/changes/shore-grand-arena/specs/`. This branch does not edit that folder.

### Requirement: Every heavy attack warns in two senses
Heavy attacks SHALL give the defender at least 0.3 s of warning in both sight and sound before they can hit.

#### Scenario: An enemy starts a committed cast
- WHEN an enemy hero or neutral guardian starts a cast that is not instant
- THEN a red shape appears over the ground it will hit, the caster leans into a windup, and a rising sound plays from that
  direction, at least 0.3 s before the hit
- AND the sound is brighter when the shape covers the player

#### Scenario: An engage that stuns
- WHEN an enemy begins a leap or a charge that stuns on contact
- THEN a path to its landing point is drawn for at least 0.3 s before the stun can land
- AND a player who leaves that path before the hit takes no stun and no damage from it

#### Scenario: A tower chooses a new hero target
- WHEN an enemy tower switches its fire to a hero
- THEN a lock-on line from the tower to that hero appears, and a warning tone plays when that hero is the player
- AND the tower's first shot at that hero lands no earlier than 0.35 s after the lock-on appears

### Requirement: A missed commitment can be punished
A committed cast that hits nothing SHALL leave its caster open for a window the enemy can see and use.

#### Scenario: A cast that hits nothing
- WHEN a hero resolves a committed cast and it hits no enemy
- THEN the caster cannot cast or attack for 0.5 s (0.7 s after an ultimate)
- AND an EXPOSED ring and countdown are drawn over the caster for that time

#### Scenario: Hitting an exposed enemy
- WHEN a hero hits an enemy hero who is exposed
- THEN the hit deals 15% more damage and shows OPENING HIT
- AND a hit that kills an exposed hero shows FINISHER

#### Scenario: A cast that lands
- WHEN a committed cast that is not an ultimate hits what it was aimed at
- THEN the caster keeps the short recovery and is not exposed
- AND an ultimate that lands is exposed for its own recovery, because it is the larger commitment

### Requirement: Heavy hits are felt
Important hits SHALL be reported through at least two channels beyond the health bar.

#### Scenario: A heavy hit on the player or by the player
- WHEN a heavy strike, an ambush, an opening hit, an ultimate or a hero kill involves the player
- THEN the picture holds for 60 to 90 ms by the weight of the event, the view shakes by 4 to 8 pixels, and a low impact sound plays
- AND the match simulation keeps its own fixed rate, so a seeded replay is unchanged

#### Scenario: The player takes damage
- WHEN the player loses health
- THEN a thud plays, scaled by the share of health lost, and the screen edge flashes red
- AND below 30% health a heartbeat plays until the player heals

#### Scenario: Reduced motion
- WHEN the player's system asks for reduced motion
- THEN no hitstop and no extra shake are applied, and the sounds and the edge flash remain

### Requirement: The player can read a death
After a death the player SHALL be able to explain it without replaying the match.

#### Scenario: A hero dies
- WHEN the player's hero dies
- THEN a recap appears during the respawn that names the killer, lists the damage by source and by type over the last 8 seconds,
  names the warned hits that landed and whether they were dodgeable, names the time spent stunned or feared, and gives one tip
  drawn from the main cause
- AND the recap totals match the health and shield the hero lost

#### Scenario: The recap never blocks play
- WHEN the recap is shown at 1440x900, 390x844 or 844x390
- THEN it covers no control, stays inside the screen, carries the respawn countdown, and closes with its own button

### Requirement: Skill is rewarded in the small moments
Timing and spacing SHALL change the result of ordinary exchanges.

#### Scenario: A press during a cast
- WHEN the player presses a spell in the last 0.12 s of a cast or a recovery
- THEN the button reads QUEUED and that spell is cast on the first step the hero is free
- AND a press earlier than that is dropped, as before

#### Scenario: Your own cast begins
- WHEN the player's cast starts its windup
- THEN a short click confirms the commitment

#### Scenario: The third basic strike
- WHEN a hero's third chain strike is aimed at another hero
- THEN an arc shows where it will reach, and a target who steps out of that reach before contact takes no damage and sees DODGED

### Requirement: Targets and timers guide the next decision
The player SHALL be able to see which enemy matters next and when the next peak comes.

#### Scenario: Marks on priority targets
- WHEN an enemy wisp can be finished by the player's next basic attack, or an enemy summon heals its team
- THEN that unit carries a visible mark

#### Scenario: Camps fight like their art
- WHEN a spirit camp uses its special
- THEN a mage or archer camp warns a line and an ogre or knight camp warns a cleave, each named after the creature

#### Scenario: The objective clock
- WHEN a match is running
- THEN the HUD shows the time to the next Wild Hunt, which turns gold and sounds a horn in its last 10 seconds
- AND when the player is out of combat with no peak within 20 seconds, the clock shows a quiet phase
