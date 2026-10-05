# Shore of the Ancients: implementation map

I edited no repository files. My scratch scripts and results are in `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/impl/`:
- `geo.mjs`: measures the layout
- `pace.mjs` and `pace.jsonl`: a 36-match pacing run
- `*.log`: test output
- `pub/`: the copy of the game the pacing run used

## 0. Current state (read this first)

**Snapshot.** HEAD is `ae423f7`, plus uncommitted work:
- 23 tracked files modified
- `toon.css` deleted
- untracked: `public/tidebreak/three-render.js`, `render3d/effects.js`, `render3d/units.js`

Other agents are editing the same tree right now. `three-render.js` appeared while I was reading. Every line number below is for this snapshot, so re-grep before you edit.

**Decisions already on record.**
- `openspec/changes/shore-grand-arena/proposal.md:3-4`: the user chose mythic realism, "a map twice as wide and high" and new art for all heroes. They then asked for real 3D made with Meshy.
- `proposal.md:7-16` sets the scope:
  - three.js 3D as the default view, with the 2D renderer as fallback
  - a 9600 map
  - three tower tiers plus two guardians per base
  - combat-fun mechanics
  - a bot difficulty setting
  - portraits rendered from the 3D models

**Size conflict (still open).**
- `proposal.md:3` says "twice as wide and high". `proposal.md:12` and the code (`public/tidebreak/arena.js:3`, `SIZE = 9600`) say 9600.
- The map was already 6400 before this work, not 4800. `docs/tidebreak.md:7` is out of date.
- So 9600 is 1.5× the old width and 2.25× the old area. Doubling the width would be 12800.
- **Recommendation: keep 9600.** Say in the spec and in the reply to the user that "double" was read as about twice the playable area (2.25×). Reasons:
  - Wisps already need 34-41 s to walk a lane.
  - Bot matches already have 76-80 units alive at peak.
  - It is already built.
- If the user wants 12800, change `arena.js:3`, re-tune `TOWER_ARC` (`layout.js:16`, absolute distances), and fix the 9600 hard-coded in `render3d/materials.js:6`. The 2D ground tiles go from 10×10 to 13×13, and test run times grow (section 7).

**What is done in the working tree, and what is open**

| Area | Done | Open |
|---|---|---|
| Map | Scale split (`arena.js:3-16`); team 0's half written as fractions and mirrored (`layout.js:1-69`, `world.js:10-15,50-65`); stations placed by distance along the lane (`world.js:35-49`); river paint bounds now come from the river samples (`paint-ground.js:69,81,86`); scenery counts follow map area and river length (`scenery.js:86,95,106`, `river.js:25`); a spacing grid for scenery (`scenery.js:41-42,88`) | `ROTATION_SCALE` is not used yet; lane names come from x fractions; fog size is hard-coded in 3D; 2D ground resolution and memory; 2D props are not culled; bots walk in straight lines |
| Towers | `TIERS`, `CORE`, `SLAM` (`sim.js:30-38`); 9+2 structures per team (`sim.js:65-73`); protection chain (`objectives.js:13-19`); messages and rewards (`sim.js:157-161,180-182`); heroes deal 25% to structures without an escort (`sim.js:109-111`); guardian slam (`sim.js:601-619`); cores answer hero-on-hero aggro (`sim.js:130`) | One breached lane opens both guardians; no early fortification; no way to close a stalled siege; no tower lock-on tell; 2D renderer, announcer, chat and help text still assume two tiers |
| Pacing | `PACE` (`sim.js:40`); respawn time (`sim.js:47`); `SUDDEN_DEATH 960`, `LIMIT 1200` (`world.js:8`); damage ramp in sudden death only, not for structures (`sim.js:232`); waves leave the bases (`sim.js:373-380`); tiebreak (`sim.js:590-597`) | XP curve, realm interval 40 s, escalation, designed rest, elder Wild Hunt, HUD sudden-death clock |
| Combat fun | All movement uses `heroSpeed` (`sim.js:49-52,416,522,541`); caster wisps (`sim.js:42-46,376`) | Most of the ten rules (section 4) |
| Bots | Heroes walk with their wave and stay out of untanked tower range (`sim.js:382-399`); sprint parity (`sim.js:416,398`); side-lane bots use the base gate (`sim.js:421-430`) | Tower-dive guard, trade-aware retreat, recall parity, camps, river gates, interrupts, punishing, difficulty profiles |
| Art | 16 hero GLBs (`models/heroes/`); 9 world GLBs (`models/world/`); `models/clips.json`; portraits rendered from the models (`art/portraits/*-bust/-full.webp`); 3D modules (`render3d/*.js`, `three-render.js`, `render3d/choice.js`); 2D hero sprites now use the `-full` portraits (`illustrated-render.js:24-25`); HUD CSS restyle in progress | `main.js:6` still imports only `illustrated-render.js`; one tower mesh serves every tier; one beast mesh serves every camp; one minion mesh serves every role; the 2D fallback still uses cartoon and pixel art |

**Fast Node suites at this snapshot: 14 of 20 pass, 6 fail.**

| Failing line | Cause |
|---|---|
| `qa/tidebreak/towers.test.mjs:8` | 22 structures (18 wards + 4 guardians), test expects 12 |
| `qa/tidebreak/targeting.test.mjs:30` | 8 camps, test expects 4 sprite names |
| `qa/tidebreak/creatures.test.mjs:31` | Camps respawn after 50 s, test waits 32 s |
| `qa/tidebreak/skills.test.mjs:14` and `tactical-combat.test.mjs:14` | Respawn is now `6+1.2·level`, tests expect `5+level` |
| `qa/tidebreak/hero-identities.test.mjs:42` | Spellbook art moved to `art/portraits/` |

- I did not run `sim.test.mjs`. It asserts `SIZE===6400` at `:7`, so it fails at once.
- I did not run `team-presence.test.mjs` (slow).
- `encounters`, `combat-decisions`, `hero-classes`, `skill-aim`, `river` and `scenery` pass on the new layout.

**Pacing at this snapshot** (`pace.mjs`: 36 autopilot matches, seeds 1-3 × 12 kits, dt 0.05, on a frozen copy):

| Beat | p25 | Median | p75 | Range |
|---|---|---|---|---|
| Match end | 448 s | **702 s** | 1034 s | 271-1200 s |
| First blood | 38 s | 45 s | 52 s | 33-88 s |
| First tower falls | 93 s | **100 s** | 134 s | 71-175 s |
| First inner ward falls | 245 s | 278 s | 327 s | 163-868 s |
| First guardian falls | 287 s | 387 s | 505 s | 207-1067 s |

- 7 of 36 matches end before 7:00. 14 of 36 reach sudden death. 2 of 36 hit the 1200 s hard stop.
- Median time from first inner ward to first guardian: 101 s. From first guardian to the end: 172 s.
- Peak units: 76-80 (the test limit is 150).
- Wall time per match: 14-90 s, with 4 processes running in parallel.
- **Team 0 won 26 of 36.** The 6400 baseline was 19 to 17. Treat this as a fairness bug until a run with sides swapped explains it (section 9).

---

## 1. Map

### 1.1 How it scales (done)
`arena.js` holds the scales:

| Scale | Where | Applies to |
|---|---|---|
| `at(fx, fy)` | `arena.js:11` | Positions written as fractions of `SIZE` |
| `FEATURE_SCALE = 4/3` | `arena.js:6` | Cover footprints, brush radius, river width. These keep their 6400 size |
| `AREA_SCALE`, `LENGTH_SCALE` | `arena.js:8` | Counts of scattered things and of things along the river |
| `ROTATION_SCALE` | `arena.js:10` | Defined but not used yet |
| `mirror()` | `arena.js:13` | Team 1's half |
| `arenaPoint` | `arena.js:15-16` | Kept only for old tools |

Speeds, ranges, sight, body sizes and art heights stay in absolute units.

### 1.2 Measured layout (`geo.mjs`)

| | West | Middle | East |
|---|---|---|---|
| Lane length | 11517 | 9488 | 11452 |
| Wisp, base to base at 280 u/s | 41 s | 34 s | 41 s |
| Hero at 300 u/s, base to river | 19 s | 16 s | 19 s |
| Gaps: outer to middle / middle to inner / inner to base | 1242 / 1196 / 1249 | 1057 / 1040 / 1060 | 1243 / 1196 / 1249 |
| Outer ward to enemy outer ward | 3969 | 2298 | 3883 |

- Base to base: 7584.
- Each guardian stands 603 from its core.
- Counts: 6 portals, 8 camps, 26 cover blocks, 24 brush patches (radius 200).
- Every tier gap is at least 2.5 tower ranges (range 360-410).

### 1.3 Remaining map work

| Item | Where | Change |
|---|---|---|
| Rotation distances | `team-events.js:9-10` (1900 / 3200), `combat-ai.js:50-52` (1600 / 1700 / 1900), XP share radius `sim.js:87` (1200) | Multiply by `ROTATION_SCALE`. Keep `combat-ai.js:8` (850 / 650) tied to sight |
| Lane names | `team-chat.js:5` uses `SIZE*.38/.62` | Name the nearest lane with `closestTrack` (`world.js:30-34`). Update `team-presence.test.mjs:105-107` |
| 3D fog size | `render3d/materials.js:6` (`uSize: 9600`) | Import `SIZE` |
| HUD clock | `main.js:237` counts down to `LIMIT` | Count down to "Sudden death" (960), then to the end (1200) |
| Bot movement | Straight line through `move()` (`sim.js:416`) | Use `route()` from `navigation.js` for goals more than about 600 away. Cache the route per bot for 0.5 s |
| 2D prop loops | `illustrated-render.js:141,274` visit every prop twice per frame | Put props in 1024-unit cells and draw only visible cells |
| 2D ground | `paint-ground.js:30` (one 3072² canvas), `illustrated-render.js:45,132` | Tiles (1.4) |
| Old WebGL path | `render.js`, `world-art.js`, `environment.js`, `toon.js` (nothing imports `render.js`) | Delete |
| Docs | `docs/tidebreak.md:7,20,22,57` | Rewrite |
| Spec | `openspec/specs/moba-combat/spec.md:56-63` ("6400 … outer and inner tower") | MODIFIED requirement |

### 1.4 Ground memory plan (2D fallback)
`render3d/choice.js:22-28` sends browsers without WebGL2, software GL and `?renderer=2d` to the 2D renderer. Phones will land there, so the 2D ground still matters.

**Today:**
- 2 × 3072² canvases = 72 MiB.
- That is 0.32 texels per unit at 9600, which looks blurry.
- Matching today's sharpness needs 4608² per canvas. That is 21.2 Mpx, above iOS's 16.7 Mpx limit per canvas.

**Tiles:**
- 512² texels at 0.5 texels per unit. One tile covers 1024 units and uses 1 MiB.
- 10×10 tiles per realm. At most 12 are visible at 1440×900, 1920×1080, 390×844 and 844×390.
- An LRU cache of 30 tiles, plus 12 painted ahead for the other realm, uses about **42 MiB at any map size**.

**Overview canvas:** one 1024² per realm. The minimap and tactical map use it, and it fills in for tiles that are not painted yet.

**Painting:**
- `paintGround` records its drawing operations in world coordinates, each with a bounding box. It keeps the same random-number order, so the look stays deterministic.
- To paint a tile: `setTransform(k,0,0,k,-tx·k,-ty·k)`, then replay only the operations that touch the tile.
- Add a 2-texel gutter around each tile. Patterns are defined in world space, so tiles join without seams.

**Budget:**
- Paint at most one tile per idle slice.
- Start painting the other realm 10 s before each realm swap (`world.js:115`; the countdown is at `main.js:277-280`).
- Replace the full blit at `illustrated-render.js:132` with a `drawImage` call per visible tile.

**3D:** the splat mask is 2048² over `SIZE + 2×5200` (`render3d/terrain.js:8,13,106`). Surface detail comes from world-mapped textures (`render3d/materials.js:38`), so it does not depend on `SIZE`. Check mask sharpness in a real browser.

### 1.5 Map tests
- Replace `SIZE===6400` (`towers.test.mjs:24`, `sim.test.mjs:7-8`) with the spec constant.
- Add `qa/tidebreak/spots.mjs`. It returns open points derived from `laneMid` and `TOWER_POSITIONS`, checked against `OBSTACLES`, `BRUSH` and `insideRiver`. Use it in the suites that place units at fixed coordinates:
  - `sim.test.mjs:6,38`
  - `scenery.test.mjs:27`
  - `targeting.test.mjs:5`
  - `base-attacks.test.mjs:9`
  - `tactical-combat.test.mjs:6`
  - `combat-decisions.test.mjs:7,37`
  - `hero-classes.test.mjs:7`
  - `legends.test.mjs:8,40`
  - `skills.test.mjs:4,23-35`
  - `items.test.mjs:4`
  - `skill-aim.test.mjs:7`
  - `creatures.test.mjs:23,30`
- New checks:
  - tower distances along the lane equal across teams within 2%
  - tier gaps of at least 2.5 tower ranges
  - one river crossing per lane (`river.test.mjs:20` already checks this)
  - lanes open in both realms (`sim.test.mjs:9`)
  - a browser pixel check that water is painted at every river sample
  - scenery density of 25 props per million square units, ±10%

---

## 2. Three tower tiers and the base defense

### 2.1 Stats today (working tree, `sim.js:30-38`)

| Structure | HP | Range | Damage | Rate | Reward (xp / gold) |
|---|---|---|---|---|---|
| Outer ward | 3000 | 360 | 175 | 1.05 | 120 / 150 |
| Middle ward | 3800 | 385 | 195 | 1.05 | 150 / 180 |
| Inner ward | 4500 | 410 | 215 | 1.05 | 180 / 220 |
| Guardian (×2) | 4200 | 420 | 230 | 1.2 | 200 / 250 |
| Core | 7000 | 380 | 160 | 1.1 | Win |

Guardian slam (`sim.js:38`): radius 230, tell 0.8 s, recovery 1.4 s, cooldown 6 s, 380 damage. Hits during recovery deal ×1.25 (`sim.js:107`).

**Protection chain** (`objectives.js:13-19`):
- A ward waits for the tier before it on the same lane.
- Guardians wait for any inner ward of their team to fall.
- The core waits for both guardians.
- Sudden death lifts every gate.

**End of match:**
- Sudden death starts at 960 s (`sim.js:475`): respawn ×1.5 (`sim.js:47`), and a damage ramp for units only (`sim.js:232`).
- Hard stop at 1200 s. Tiebreak: structures broken, then structure health, then kills (`sim.js:590-597`).

### 2.2 Changes to make

| # | Change | Where | Why |
|---|---|---|---|
| a | **One guardian per side.** The West guardian (lane 0, `sim.js:73`) unlocks when the West or Middle inner ward falls. The East guardian unlocks when the East or Middle inner ward falls. The core still needs both | `objectives.js:17`; `nextObjective` `:21-25` and `objectiveText` `:30` point at the unlocked guardian; lock tip `sim.js:181` | Today one lane breach opens both guardians. 7 of 36 matches end before 7:00, and the median from guardian to end is 172 s |
| b | **Outer fortification.** Outer wards take 50% damage before 240 s. Show "FORTIFIED 2:31" on the label and a ring | `damage()` next to the escort rule at `sim.js:109` | The first tower falls at a median of 100 s. Target: 4:00-5:30 |
| c | **Closing mechanic.** Once a lane's inner ward falls, the attacker's waves in that lane add an elder wisp (1400 hp, 120 damage, 30 armour) | `spawnWave` `sim.js:373-380` (use `laneOpen`, `objectives.js:7-10`) | Ends stalled sieges. 2 of 36 reached the hard stop. `BASE_GATE` (`layout.js:22`) is a portal, so there is no gate structure to carry this |
| d | **Tower lock-on tell.** When a ward or core picks a hero, draw a tether. Raise its windup against heroes from 0.12 to 0.35 s. Shots at wisps stay fast | Windup `sim.js:225`; targeting `sim.js:553-566`; rings `illustrated-render.js:205`, 3D ward `render3d/units.js:165` | Rule 2. Today the ring turns red only after the first hit lands (`sim.js:242`) |
| e | **Target priority.** Siege, then caster, then melee, then heroes | Default pick `sim.js:566` | Rule 6 |
| f | **A role per tier.** Outer: today's ramp of +22% per hit (`sim.js:233,242`). Middle: each shot also hits one wisp within 200 for 40%. Inner: a 0.8 s, 25% slow on heroes. Guardian: the slam (done) | Tower branch around `sim.js:553-570` | Tiers that differ only in health break rule 6 |
| g | **2D presentation.** Height per tier (`illustrated-render.js:185`). Ring (`:205`). Label (`:225`): guardians currently read "OUTER WARD". Minimap marker (`:332`). Also fix: `announcer.js:32` (outer/inner), `team-chat.js:21,39`, help text `main.js:213`, protected tip `main.js:356` ("Clear both towers on one lane"), `index.html:33` objective subtitle | Listed | The fallback must show the new rules |
| h | **Rubble in 2D.** Draw a rubble sprite where a ward fell (3D already sinks it to a stump, `render3d/units.js:168-170`) | `illustrated-render.js` unit loop | Rule 5 |
| i | **Result sheet.** Show the tiebreak rule and structure counts | `main.js:233` | Rule 10 |

### 2.3 Tower tests
- `towers.test.mjs:5-28`: rewrite for 18 wards + 4 guardians. Cover the chain per tier, the per-side guardian rule, the core after both guardians, sudden death lifting protection, fortification, and the hero spawn behind the outer ward (`:22-23`).
- `sim.test.mjs:13-17`: `s.towers[1]` goes from 9 to 8.
- `sim.test.mjs:63`: `t<6` becomes `t<9`.
- `team-presence.test.mjs:63-68`: the alarm names the tier.
- `tactical-combat.test.mjs:37-39`: re-time if (d) changes the windup.
- New: tiebreak order, and that the elder wisp spawns only in an open lane.

---

## 3. Pacing and match length

| Beat | Now (median) | Target |
|---|---|---|
| First hero-vs-hero damage / first blood | about 0:40 / 0:45 | 0:30-0:50 / 1:00-2:30 |
| First outer ward | 1:40 | 4:00-5:30 |
| First inner ward | 4:38 | 9:00-11:00 |
| First guardian | 6:27 | 11:00-13:00 |
| End | 11:42 (IQR 7:28-17:14) | 14:00 median, IQR 12-17 min, at most 2 of 36 at 20:00 |

**Constants still to change**

| Constant | Now | Proposed |
|---|---|---|
| Fortification | none | 2.2b |
| Guardian unlock | any inner ward | 2.2a |
| XP curve | `60+25L` (`abilities.js:24`) | `80+32L`. Target about level 9 at 6:00 and 15 at 12:00 |
| Realm interval | `SHIFT 40` (`world.js:9`) | 60, so swaps line up with the beats. Update `sim.test.mjs:22-23` and `index.html:33` |
| Wild Hunt | First at 120 s, then every 150 s (`sim.js:40,164,476`) | From 12:00 the elder version: +40% hp, stronger leviathan. Horn and timer 30 s ahead |
| Out-of-combat regen | 12 hp/s after 5 s (`sim.js:507`) | 2% of max hp per second after 6 s |
| Escalation | none | Waves +6% hp and damage every 3 min. A siege wisp every 2nd wave from 8:00 (`sim.js:376`) |
| Camp first spawn | t = 0 (`campTimers` `sim.js:65`) | 60 s |
| Shop | Anywhere (`items.js:74-78`) | Base court or while dead, with a queue that buys on return (section 4, rule 7) |
| Bot reset | none | After a fight with 2 or more deaths, Normal and Hard bots recall or farm for about 15 s |

**Validation**
- Move `pace.mjs` into `qa/tidebreak/pacing.mjs`, outside CI.
- Check the median and IQR above, a side-swapped win rate of 45-55%, and at most 2 of 36 at the hard stop.

**CI run time**
- One full match now takes 14-90 s, so 36 of them cannot fit the 10-minute job (`.github/workflows/creature-browser.yml:14`).
- Keep `sim.test.mjs:57-66` for invariants only: cap each match at 300 s, assert progress (a ward damaged, at least 2 kills, units below 150), and keep the 85 s replay.
- Put full-length checks in `pacing.mjs`.
- `team-presence.test.mjs:94` (400 s loop) can stay.

---

## 4. Combat-fun mechanics, ranked by impact

The rules are at `docs/combat-fun-system.md:7-16`. Scores come from the earlier audits.

| # | Rule | Mechanic | Code | Check |
|---|---|---|---|---|
| 1 | 8 Pressure rhythm (score 1) | Section 3 timeline, designed rest, escalation, bot reset | Section 3 | Fight share 25% or less in minute 0-1 and 35-45% overall; at least 2 lulls of 30 s or more; 70% or more within 60 s of each Hunt spawn |
| 2 | 2 Readable threat (1) | **Warnings in three channels.** Sound: in `announcer.js:119-131`, detect a new `castIntent` or `specialIntent` and play a new `sound.windup(x,y,{ult,neutral,aimedAtPlayer})` (`audio.js`). Pose: a charging stage in `combat-motion.js:9-19`; in 3D, start the cast clip at `intent.start` so its strike frame (`render3d/assets.js:53`) lands on `intent.at`. Colour: a pulsing "aimed at you" outline (`combat-motion.js:3-8`). **Tells for engages:** split slot 0 in `castTiming` (`combat-state.js:13-14`): Devil leap, Golem charge and Kraken ink get 0.45 s (bots) or 0.25 s (players). Apply the Devil stun on landing, not on the cast step (`sim.js:329`). **Arm zones:** default `armed: .35` for zones that now start at `tick:0` (`legend-rules.js:7`; maelstrom `sim.js:344`; stomp `sim.js:340`). Tower lock-on (2.2d) | Listed | Node: every intent emits a windup event within one step; no bot hard control lands sooner than 0.45 s after its first cue. Browser: warning contrast of 3:1 or more |
| 3 | 5 Impact feedback (1) | `s.impacts {x,y,weight}` from `damage()` (`sim.js:128`). Hitstop: hold the accumulator (`main.js:422`) 60 / 80 / 90 ms for a heavy hit, an ultimate or a kill that involves the player, at most once per 0.3 s. Sim steps do not change, so replays stay identical. Shake by weight, 4 / 6 / 8 px (`illustrated-render.js:129`; 3D camera). Hurt channel: a sound scaled by health lost, a red edge pulse, a heartbeat below 30%. Kill tone only for heroes, camps and the boss (`audio.js:223,231`). Damage numbers sized by amount (`illustrated-render.js:176`). All of it off under reduced motion | Listed | Replay test `sim.test.mjs:66` still passes; browser check that hitstop never stalls input |
| 4 | 10 Understandable failure (1) | **Death recap:** a ring buffer per hero covering the last 8 s, written where `actual` is computed (`sim.js:128`): source, ability label, amount, shield absorbed, control applied. Snapshot it into the kill record (`team-events.js:58`) and show it on the respawn overlay (`main.js:273`) with one rule-picked tip. Drop DEFEATED labels for wisps (`sim.js:147`). Leave the body down until respawn in 2D (3D has a death clip) | Listed | Recap names every source and its totals match health lost; card fits 390×844 |
| 5 | 4 Punish window (1) | A committed cast that hits no hero extends recovery to 0.5 s (0.7 s for ultimates), during which heroes deal ×1.15 to it (`combat-state.js:18`, `sim.js:107`, `resolveIntent` `sim.js:439`). Credit interrupts: pass the controller, not the caster, at `sim.js:433`, plus a 0.4 s stagger with no cost. Stuns no longer clear a neutral's exposed window (`encounters.js:22-23`) | Listed | 30% or more of recovery windows after a miss get punished. Update `combat-decisions.test.mjs:72-77` |
| 6 | 3 Real counterplay (2) | Use `Math.max` for stuns: `sim.js:270` (`Object.assign`), `legend-rules.js:35,41,51,89` (the fix already exists at `:117,122`) | Listed | A short stun never shortens a long one |
| 7 | 6 Target priority (1) | Tower priority (2.2e). Siege range 270 to 400, so it outranges wards, but it takes +50% damage from heroes (`MINIONS` `sim.js:42-46`). **Camp archetypes** that match their art. Today one stat block (`sim.js:485`), art chosen by `(camp+roll)%4` (`marketplace-sprites.js:8`) and the special by index (`encounters.js:7`). Make it ogre (cleave, slow; reward hp and armour), knight (blocks frontal damage, exposed after slam; reward +20% structure damage for 60 s), mage (line nuke, low hp; reward mana), archer (kites; reward speed). A warden wisp from 8:00 gives +25% armour nearby | Listed | Heroes kill casters and siege wisps at a higher rate than melee |
| 8 | 7 Resource tension (1) | Shop at base (`items.js:74-78`; quick-buy queue `main.js`); bots follow the same rule. Mana regen `3.5+0.25L` (`sim.js:519`). Ultimates cost about 25% of the pool (`combat-rules.js:4-8`). Kill bounty only within 1500 (`sim.js:87`), plus a bounty for ending a streak. Gold sinks: a 3-charge draught, a lantern ward for brush, buyback after 10:00 | Listed | Mana-starved 10-20% of alive time; builds finish at about 12-13 min |
| 9 | 9 Skill expression (1) | Range slack against heroes 90 to 35 (`sim.js:240`). Third chain strike +0.08 s windup with an arc preview (`basic-attacks.js:15-19`). A "killable" tick on wisp health bars, and denies. Combo cue fades after N uses (`combat-feedback.js:41-51`). Result screen stats (`main.js:233`) | Listed | Update `base-attacks.test.mjs:28` |
| 10 | 1 Immediate control (2) | Accept a press in the last 0.12 s of intent or recovery and show QUEUED (`main.js:388`, `requestCast` `sim.js:285`). A commit click when the intent starts (`main.js:432` fires only at resolution) | Listed | No silent dropped presses |

**Already done:** movement parity; caster wisps; heroes deal 25% to structures without an escort, which gives rotating defenders an answer; core aggro; the guardian slam with its tell and opening; the sudden-death ramp; waves from the bases.

---

## 5. Bots

**Done:** walking with the wave and avoiding untanked tower range (`sim.js:382-399`), speed parity (`sim.js:416`), base gate use (`sim.js:421-430`).

**Fixes for every difficulty**

| Fix | Where |
|---|---|
| Tower-dive guard: drop hero targets under an untanked enemy ward unless the target is below 20%. Abort when that ward targets the bot and the bot is below 60% | `combat-ai.js:37-39` |
| Trade-aware retreat: today 1v1 never counts as outnumbered, because `allies` includes the bot itself (`combat-ai.js:9`) | `combat-ai.js:30-31` |
| Recall parity: stand still, cancel on a hit, show the channel. Today the bot teleports while it keeps walking | `sim.js:409` |
| Count every escort by reusing `escorted()` (`sim.js:185`), not only `kind==='minion'` | `combat-ai.js:37` |
| Escape spells for Kraken, Wendigo, Golem and Dryad; remove the duplicate Phoenix clause | `combat-ai.js:33` |
| Act on defend alarms, so the "I'll go" chat line (`team-chat.js:21`) is true | `team-events.js:34-39` |
| River gates for rotations | `PORTALS` `world.js:54`, `portal()` `sim.js:345` |
| Take camps when the wave is safe (team -1 is dropped today) | `combat-ai.js:8` |
| Punish recovering or exposed heroes: −250 to target score | `combat-ai.js:38` |
| Lock casts for 1.1 s only after a cast succeeds | `sim.js:413-414` |
| Rotation ranges times `ROTATION_SCALE` | Section 1.3 |

**Difficulty profiles**
- Add `bot-profiles.js`. `createMatch(kind, seed, lineup, {enemy, ally})` stores `s.botProfile`, and `combatDecision` reads `s.botProfile[e.team]`. Allies play one step below the enemy.

| Knob | Today | Easy | Normal | Hard |
|---|---|---|---|---|
| Reaction (`combat-ai.js:19`) | 0.18-0.30 | 0.40-0.60 | 0.28-0.42 | 0.20-0.30 |
| Dodge success | always | 50% | 75% | 90% |
| Windup, normal / ultimate (`combat-state.js:14`) | 0.5 / 0.7 | 0.65 / 0.9 | 0.55 / 0.75 | 0.45 / 0.65 |
| Aim lead (`combat-ai.js:58`) | 0 | 0 | 50% | 85% |
| Interrupt enemy ultimates | never | never | 40% | 80% |
| Focus fire | none | none | soft | firm, with a "Hunted" mark on the player |
| Ganks | none | none | every 90 s | every 50 s, using gates |
| Gather for objectives | when visible | when visible | 5 s ahead | 12 s ahead |

- Guard rails: same stats for every hero; bots see only what `canSee` and `visibleTo` allow; windups never below 0.45 s; seeded hash for randomness, never `s.random`.
- Show the difficulty on the draft board and the result screen.

**Bot tests**
- Make the reaction bounds in `encounters.test.mjs:66,79` depend on the profile.
- `tactical-combat.test.mjs:41-45` and `team-presence.test.mjs:71-100`.
- New A/B targets, seeded with sides swapped:
  - Normal against Normal: about 50%.
  - Hard against today's AI: 65% or more.
  - Easy against today's AI: 40% or less.
  - A bot alone in its lane spends 0.5 s or less in untanked range.

---

## 6. Art

### 6.1 Direction and state
- Mythic realism, with 3D as the default (`proposal.md:3-4,9-11`). The scene spec is `specs/moba-graphics/spec.md`.
- The 3D grade is warm and golden-hour (`render3d/sky.js:6-12`). Team colours are teal `#58c4ad` against crimson `#d65a6c` (`render3d/units.js:14`).
- The 3D renderer is not wired in yet: `main.js:6` imports only `illustrated-render.js`.
- **Credits:** `design.md:23` records about 6.25 credits left. A Tripo model costs 9 (`design.md:5`). `higgsfield/.env.local` is absent. So new meshes are blocked until the user adds credits. Plan to fill the gaps in code.

### 6.2 Gaps in 3D, and how to fill them without credits

| Need | Today | Plan |
|---|---|---|
| 3 tiers + guardian ("Towers SHALL differ by tier") | One `tower.glb`, scaled by `TOWER_HEIGHT` (`render3d/units.js:17,155-157`) | Kitbash from existing meshes. Outer: the tower. Middle: plus a boulder plinth and a brazier light. Inner: plus an arch gateway, banners and an emissive rune band. Guardian: a core crystal on an arch plinth |
| Caster and siege wisps | One `minion.glb` | Caster: a staff with a glowing tip and a robe tint. Siege: 1.5× scale with shield plates |
| 4 camp archetypes | One `beast.glb` (`CAMP_HEIGHT` `units.js:18`) | Scale, tint and a held prop per archetype, matching section 4 rule 6 |
| Elder wisp, elder Wild Hunt | `wildhunt.glb` | Scale 1.3 plus emissive |
| Rubble | Sinks to a stump | Add instanced boulders and smoke (`render3d/textures.js` `smokeTexture`) |

If credits are added, 6 Tripo jobs (3 tower tiers, guardian, caster, knight camp) cost about 54 credits.

### 6.3 The 2D fallback
**Sprites:** re-render them from the GLBs with the portrait script (`qa/tidebreak/render-portraits.mjs`), at the 2D camera angle. This costs no credits.

| Group | Count | Size (px) |
|---|---|---|
| Towers, 3 tiers × 2 teams | 6 | 512×1024 |
| Guardians | 2 | 512×1024 |
| Cores | 2 | 900×1200 |
| Wisps, 3 roles × 2 teams × front/back | 12 | 256×320 |
| Camps | 4 | 512×640 |
| Wild Hunt | 1 | 900×900 |
| Rubble | 2 | 512×384 |
| Props (pine, oak, boulders, arch) | 4 | 384-512 long side |

- That is 33 images. They replace the pixel camps (`marketplace-sprites.js:14`) and pixel wisps. That needs a MODIFIED version of `moba-combat/spec.md:49-54`.

**Code-side grade (no new art)**
- Team colours at `illustrated-render.js:14` change to the 3D teal and crimson.
- Ground palette toward stone and umber: base `paint-ground.js:32`, water gradient `:86`, woods tint `:124`.
- Long baked shadows replace the radial blobs (`paint-ground.js:116`).
- Grade each remaining cartoon image once at load in `loadArt` (`illustrated-render.js:20-26`).
- Live overlays, measured in headless software Chromium:
  - multiply tint: +0.55 ms
  - top-of-screen haze: +0.7 ms
  - cached vignette: +5.4 ms
  - `ctx.filter`: +22 ms (avoid)
- Scenery names in `layout.js:53-63` (mushrooms, willow, greenhouse) still pull the cartoon props into 2D.

### 6.4 HUD
The restyle is in progress (CSS diffs; `toon.css` deleted). When it lands, check for:
- one set of colour tokens
- Cinzel and Barlow only
- no lime
- slim rank pips instead of coins

The DOM ids the tests use must survive (section 7).

### 6.5 Visual checks
Take screenshots at 1440×900 in both renderers and check:
- brightness spread (standard deviation of value) of 0.22 or more
- dark pixels (value below 20%) of 15% or more
- vivid teal at 4% or less
- vivid violet at 0.5% or less
- warning contrast of 3:1 or more

Also measure 3D frame time at 1440×900 and 3440×1440, which the spec requires.

### 6.6 Cleanup
Remove assets nothing uses once the above lands:
- 40 creature fallback sprites, still loaded at `illustrated-render.js:21` (3.5 MB)
- `ability-*` and `stones`
- `animated/` (update `hero-gifs.test.mjs`)
- `ground`, `monsters` and the 4 small portraits
- the old `models/*.glb`, used only by `render.js`

---

## 7. Tests, CI and OpenSpec

**Browser contracts with 3D as the default**
- `three-render.js:307-312` returns no `creatures` field, so `qa/creatures/browser.mjs:223-225` will time out. Either add `{creatures:{loaded,failed}}` built from `models`, or change the test to check `models.failed.length===0`.
- `push`, `freeCam`, `heroScreen` and `canvas` exist (`three-render.js:309`), which covers `desktop.e2e.mjs:119-163,256-261`.
- `desktop.e2e.mjs:216-217` assumes open ground to the right of the spawn point. Re-check it on the new layout.
- Run both suites with `?renderer=3d` and `?renderer=2d`.

**OpenSpec**
- `shore-grand-arena` has only the `moba-graphics` delta, no `tasks.md`, and empty design sections (`design.md:26-33`).
- Deltas still to write:
  - `moba-combat`: MODIFIED `:56-63` (arena and tiers), `:65-74` (match flow), `:76-81` (bot decisions), `:83-88` (spell resources), `:90-95` (lane and tower pressure), and `:49-54` if camp and wisp art changes
  - `moba-ui` (HUD, portraits, graphics option)
  - `moba-roster:19-32` (artwork comes from the 3D models)
- Conflicts to settle:
  - `moba-combat-decisions/design.md:3` ("Preserve … the six-minute match limit", "existing visual direction") and its `proposal.md:3`
  - `moba-team-presence` ranges (1900 / 3200) against `ROTATION_SCALE`
- The OpenSpec CLI is not installed, so structure validation has to be done by hand.

---

## 8. Order of work

Each step must leave the game playable. Three tracks can run in parallel:
- **A:** simulation (`sim.js`, `objectives.js`, `combat-*`)
- **B:** 3D renderer (`three-render.js`, `render3d/`)
- **C:** 2D fallback and HUD

They meet at `stats()`, at `s.impacts`, and at the tier, role and archetype fields on units.

1. **(A) Land the map and tier work in progress.**
   - Fix the 6 failing suites and the `SIZE` assertions.
   - Restructure `sim.test.mjs` for run time.
   - Add `spots.mjs`.
   - Gate: all Node suites green; pacing run recorded.
2. **(A) Fairness:** run with sides swapped and explain the 26-to-10 skew. Fix it before any tuning.
3. **(A) Structure and pacing rules:**
   - guardian per side, fortification, elder wisp
   - XP curve, `SHIFT 60`, elder Hunt, camps at 60 s, regen, escalation
   - HUD sudden-death clock
   - Gate: pacing targets in section 3.
4. **(C) Show the new tiers in 2D:** renderer, announcer, chat, help text, rubble. Gate: `desktop.e2e.mjs`, `qa/creatures/browser.mjs`, screenshots.
5. **(A) Cheap fun fixes:** stun `Math.max`, no DEFEATED labels for wisps, interrupt credit, hurt channel, death recap.
6. **(A + B + C) Warnings, engage tells, zone arming and tower lock-on.** Then impact weights and hitstop, read by both renderers.
7. **(A) Punish windows,** then the bot fixes (section 5).
8. **(A + C) Difficulty profiles** with the draft and result screen UI. Gate: A/B targets.
9. **(A) Roles and resources:** tower priority, siege range, camp archetypes, tier roles, shop at base, mana, bounty, gold sinks, skill-expression items.
10. **(B) Make 3D the default** through `choice.js`. Add the kitbashed tiers, camps and wisps, and the `stats()` contract. Gate: browser suites in both renderers, frame time at 1440×900 and 3440×1440.
11. **(C) 2D art:** re-rendered sprites, colour grade, ground tiles, prop culling. Gate: visual metrics, memory under 50 MiB for the ground.
12. **Finish:** HUD restyle, docs, OpenSpec deltas and tasks. Archive the change, review `openspec/specs/`, open the PR.

---

## 9. Risks

- **Concurrent edits.** Several agents are writing to `sim.js`, `layout.js`, the CSS and `render3d/` right now. Merge carefully and re-grep line numbers.
- **Side skew.** Team 0 won 26 of 36. Possible causes:
  - The river is not mirrored (`layout.js:49`).
  - The base gate's exit choice (`world.js:54`, `sim.js:421-430`).
  - The draft lineup.
- **Bimodal match length.** Matches split into snowballs that end before 7:00 and stalls that reach sudden death. Rules 2.2a-c target both ends, but only a re-run will show whether they work.
- **CI time.** Full matches now take 14-90 s each, against a 10-minute job.
- **Art budget.** New meshes need credits that are not there. The kitbash plan has to satisfy "Towers SHALL differ by tier" without them.
- **Phone memory.** The 2D ground must move to tiles before phones can run the fallback at 9600.
- **Not checked by me:** browser runs, phones, audio, motion sensors, GPU frame times and the 3D renderer in a real browser. Every number here comes from Node simulation with bots on both sides, or from the earlier reports.