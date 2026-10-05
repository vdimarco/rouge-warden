# Shore of the Ancients scored against the ten combat-fun rules

## 0. How this was checked

- **Which code.** Most files are unchanged at HEAD `d1a121f`, and I cite them by their current line numbers. The exception is `arena.js`, `world.js` and `river.js`. The map agent rewrote those for 9600 in `d1a121f`, so I cite them at `1d881a1`, the last commit before the rewrite. These are the same lines the reader reports used. Where HEAD already changes a rule, I say so. For example, HEAD `world.js:7` now sets `SUDDEN_DEATH = 960, LIMIT = 1200`, and `layout.js:16,18,22,24` sets three tower stations, guardians, a base gate and 8 camps.
- **What I measured.** I wrote my own telemetry script and ran it on a scratch copy of `1d881a1` with one damage hook added. It ran 24 autopilot matches: 12 kits × seeds 1–2, dt 0.05. Script: `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/rules/telemetry.mjs`. Output: `…/rules/telemetry2.out`.
- **Limits.** The autopilot plays the player with bot logic, so every number is bot against bot, not a human playtest. I did not run browser, phone, audio or motion checks.
- I edited no repository files.

## 1. Scores

| # | Rule | Score | Why, in one line |
|---|---|---|---|
| 1 | Immediate control | **2** | 60 Hz fixed step, and input is read on every step. Two parity gaps to fix (section 2, rule 1). |
| 2 | Readable threat | **1** | Warnings are visual only. Engages that stun have no tell. The first tower shot has no warning. |
| 3 | Real counterplay | **2** | Locked aim, interrupts, cover and cleanses. Control chains are short (longest measured: 2.15 s). |
| 4 | Punish window | **1** | Hero recovery is 0.22–0.34 s with no bonus. Only 13% of recovery windows are punished. Bots never punish. |
| 5 | Impact feedback | **1** | No hitstop. Screen shake is the same for every event. Taking damage has no sound and no warning. |
| 6 | Target priority | **1** | Wisps, camps and tower tiers differ only in numbers. Camp art does not match camp behaviour. |
| 7 | Resource tension | **1** | Mana is starved 0% of the time (median). Death costs little. No gold sink, and you can shop anywhere. |
| 8 | Pressure rhythm | **1** | First hero damage at 6 s. The player fights 53% of the time in a flat cycle of about 8.5 s fight and 8.3 s gap. Nothing builds to a peak. |
| 9 | Skill expression | **1** | Kits reward skill. Basic attacks (63% of hero damage) cannot be outplayed. No denying. |
| 10 | Understandable failure | **1** | No death recap, even though 56% of deaths have 3 or more damage sources. 90% of result labels are wisp kills. |

## 2. Rule by rule

### Rule 1. Immediate control: 2

**Evidence**
- Fixed 60 Hz step with an accumulator (`main.js:417-435`). Input is rebuilt on every step (`main.js:426`).
- Q/E/C/R store a cast at the cursor (`main.js:387`), and the next step consumes it (`main.js:424-425`).
- Drawing interpolates between steps (`main.js:449-463`).
- Movement goes straight to `move()` (`sim.js:447-452`). A committed cast starts its intent on the same step (`sim.js:247`). Zero-windup spells resolve at once (`sim.js:243`).

**Gaps (none severe)**
- **Dropped presses.** A press during intent or recovery is dropped silently. `castQueue` holds one slot and is overwritten (`main.js:387`), and `requestCast` returns false (`sim.js:237`). The only cue is the CAST/WAIT label on the button (`main.js:246`).
- **No acknowledgement of your own cast.** The player's cast plays no sound and shows no pose until it resolves. The sound is keyed to `castStarted` (`main.js:431`), which is set in `cast()` (`sim.js:260`), and `attackPose` reads the same field (`combat-motion.js:10`).
- **Click-to-move is slower.** Click orders skip the out-of-combat sprint and the other speed multipliers (`sim.js:471`, against `sim.js:450-451`). On a 9600 map, mouse players walk about 26% slower out of combat.

**To keep it at 2**
- Give all movement the same multipliers.
- Accept a press in the last 0.12 s of intent or recovery and show "QUEUED". That is buffering the player can see.
- Play a quiet commit click when the intent starts.
- The 3D renderer must keep the fixed step and interpolation, and must not add a frame of latency.

### Rule 2. Readable threat: 1

**Evidence of strength**
- A committed cast stores a locked shape, and that shape is also the hit area (`sim.js:244-247`, `combat-rules.js:38-43`). It is drawn red or green with a progress arc (`combat-motion.js:3-8`) and a label (`illustrated-render.js:152-157`).
- Bot windups are 0.5 s, or 0.7 s for ultimates (`combat-state.js:14`). Neutral windups are 0.7–0.85 s (`encounters.js:10`). Both exceed the 0.3 s that `docs/drain-fun.md:31` sets as the minimum.
- Measured: 72.3% of hero casts (4857 of 6722) went through a warning.

**Gaps (verified)**
- **Warnings use one sense only.**
  - No audio code reads `castIntent` or `specialIntent`. The enemy cast sound `worldCast` fires when the cast resolves (`announcer.js:127`).
  - There is no windup pose: `attackPose` needs `castStarted` or `attackStarted` (`combat-motion.js:9-19`).
  - The research asks for pose, colour and sound together (`drain-fun.md:33`).
- **Engages that stun have no tell.** Every slot 0 counts as defensive (`combat-state.js:13`).
  - Jersey Devil's leap moves the hero and stuns for 0.65 s on the cast step (`sim.js:274,280`), while the sprite is still arcing for 0.38 s (`sim.js:275`, `illustrated-render.js:197`).
  - Stone Golem's charge stuns for 0.8 s on contact (`legend-rules.js:21,85-89`).
  - Kraken's ink is a damaging zone (`legend-rules.js:11`).
  - Measured instant casts: Golem slot 0 213, Kraken slot 0 164, Devil slot 0 85.
- **Some zones hurt on their first tick.**
  - Legend zones start with `tick:0` (`legend-rules.js:7`). Only zones given an explicit `armed` time are drawn dashed first (`combat-motion.js:99`).
  - Maelstrom and stomp also start at `tick:0` (`sim.js:295-296`).
- **The first tower shot has no warning.**
  - Hero-damage aggro is invisible (`sim.js:98`).
  - The range ring turns red only when `towerTarget` is the player (`illustrated-render.js:205`), and `towerTarget` is set when a shot lands (`sim.js:198`).
  - The tower windup is 0.12 s (`sim.js:182`).
  - Up to 45% of tower hits on the player (123 of 276) started a new pressure sequence. That is an upper bound for shots that came before any red ring.

**Proposals**
1. **Warnings with three senses: sound, pose and colour.**
   - *Sound.* In `announcer.update` (`announcer.js:119-131`), detect a new `castIntent` or `specialIntent` and call a new `sound.windup(x, y, {ult, neutral, aimedAtPlayer})`: a spatial rising swell of 0.3–0.7 s. It is brighter when `insideWarning(player, shape)` is true.
   - *Pose in 2D.* Add a "charging" stage to `attackPose` that runs from `intent.start` to `intent.at`: lean back plus a growing glow.
   - *Pose in 3D.* Start the cast clip at `intent.start`, at playback rate `(strike − from) / windup`, so the strike frame in `CLIP_TIMING` (`render3d/assets.js:53-58`) lands on `intent.at`. Examples: `cast` has 0.51 s to its strike, `slam` 0.72 s.
   - *Colour.* Add an "aimed at you" state with a thicker, pulsing outline.
   - *Checks.* A Node test that every intent emits a windup event within one step. A browser check of warning contrast against the new ground (luminance ratio of 3:1 or more).
2. **Give engages a tell and arm the zones.**
   - Split slot 0 in `castTiming` into escapes and engages. Devil leap, Golem charge and Kraken ink become engages, with a 0.45 s windup for bots and 0.25 s for players. Show a landing circle or path line; `drawWarning` already draws `path` and `line` shapes (`illustrated-render.js:245-250`).
   - Apply Devil's stun at landing, 0.38 s later, not on the cast step.
   - Give damaging legend zones, maelstrom and stomp a default `armed` time of 0.35 s.
   - *Check.* No hard control from a bot lands earlier than 0.45 s after its first visible cue.
3. **Tells for structures.**
   - When a tower switches to a hero (aggro or target choice), draw a lock-on tether and a red ring. Raise the windup for shots at heroes from 0.12 s to 0.35 s (`sim.js:182`). Shots at minions stay fast.
   - The new guardians and the elder wave unit use the `encounterPattern` model (`encounters.js:5-15`) with tells of 0.8 s or more.
   - *Check.* The first tower shot at a hero lands at least 0.35 s after the lock-on.

### Rule 3. Real counterplay: 2

**Evidence**
- Locked aim and the lock reused at resolution (`sim.js:244-247,369`).
- Interrupts by stun, fear, silence, a root on a movement spell, or displacement over 8 units (`combat-state.js:4`, `sim.js:363`). Neutral specials can be cancelled too (`encounters.js:22-23`).
- Cover for cones, areas, zones and specials (`sim.js:224,268,379`, `encounters.js:32`). Brush (base `world.js:70-71,86`).
- Shields, mirror cloak and Root crown (`sim.js:86-88,100-102`), Gorgon's cleanse (`legend-rules.js:19`), recall (`sim.js:456-459`), portals (`sim.js:301-306`).
- Measured: the longest hard-control chain (stun or fear) was 2.15 s. Only 21 of 917 chains were longer than 2 s.

**Gaps**
- A shorter stun can overwrite a longer one, because stuns are plain assignments: `sim.js:226` (`Object.assign`), `sim.js:289`, `legend-rules.js:35,41,51,89`. Measured: 8 times in 24 matches. Fix with `Math.max`, as `legend-rules.js:117,122` already do.
- Bots never interrupt anyone. That is a challenge gap, covered in section 4.

**To keep it at 2 on the new map.** Every new major threat needs a legal answer:
- Guardian slam: a tell, then leave the area.
- Elder wisp after a gate falls: it can be cleared.
- Split-pushing on the bigger map: structures take 60% less damage from heroes when no attacking wisp is in range. This gives defenders, who now rotate further, a legal answer.

### Rule 4. Punish window: 1

**Evidence**
- Recovery lasts 0.22, 0.26 or 0.34 s (`combat-state.js:18`) and is set when the cast resolves (`sim.js:369`).
- During recovery the hero cannot cast, attack or use a portal (`sim.js:237,176,302`) and moves at 0.55× speed (base `world.js:106`).
- Recovery is shown with a ring and a label (`illustrated-render.js:159-162`).
- Neutrals are exposed for 1.15 or 1.4 s (`encounters.js:12,30`) and take ×1.25 damage (`sim.js:80`).

**Gaps**
- Recovery is shorter than the 0.3 s reaction budget. So the spec's own scenario "Punish a whiff" (`openspec/changes/moba-combat-decisions/specs/moba-combat/spec.md:40-42`) is not met in practice.
- The ×1.25 opening bonus applies only to bosses and camps (`sim.js:80`).
- Instant casts have no recovery at all (`combat-state.js:18`, when windup ≤ 0).
- `combat-ai.js` never reads `recoveryUntil` or `exposedUntil` (checked with grep).
- When the player interrupts a bot, no cue appears. `emitCombatFeedback(s, e, e, 'interrupt')` passes the caster as both source and target (`sim.js:363`), so the filter drops it unless the caster is the player (`combat-state.js:23`). Measured: 34 interrupts by the player, all with no cue.
- A stun on a neutral clears its exposed window (`sim.js:478`).
- Measured: 13.2% of hero recovery windows saw any hero damage. Up to 58% of committed casts dealt no spell damage within 0.35 s; that is an upper bound, because zones with delayed damage count as misses. Only 23% of those were punished within 1 s.

**Proposals**
1. **A miss costs more than a hit.**
   - A committed cast that hits no enemy hero extends its recovery to 0.5 s, or 0.7 s for an ultimate.
   - During that time the caster is exposed and takes ×1.15 damage from heroes. Extend `sim.js:80` to heroes; it reuses the OPENING HIT cue.
   - A cast that hits keeps today's recovery.
   - *Check.* At least 30% of recovery windows after a miss are punished. A ranged hero can still kite, since movement during recovery stays at 0.55×.
2. **Credit interrupts and keep openings.**
   - Record who applied the control (`lastControlSource`) and pass that hero as the source at `sim.js:363`.
   - The interrupted hero is staggered for 0.4 s (exposed). Its mana and cooldown stay unspent, as the spec requires (`…/spec.md:17-19`).
   - Stop stuns from clearing a neutral's exposed window (`sim.js:478`, `encounters.js:22-23`).
3. **Bots punish, and structures get windows.**
   - Normal and Hard bots add −250 to the target score of an exposed or recovering hero (`combat-ai.js:38`) and fire a ready skill within their reaction delay.
   - The guardian slam leaves 1.2 s of recovery. A fallen gate gives a 150 s window before it respawns.

### Rule 5. Impact feedback: 1

**Evidence**
- A player's basic hit has a strike effect (`sim.js:221`), recoil (`sim.js:91`, `illustrated-render.js:198-200`), a sound (`main.js:433`, `audio.js:206-212`) and a damage number (`sim.js:96`).
- A kill has a burst (`sim.js:116`), a tone (`audio.js:223`) and the feed and voice (`announcer.js:15-28,91-93`).

**Gaps**
- No hitstop anywhere (checked with grep).
- Screen shake is at most 3×2 px and the same for every event (`illustrated-render.js:127-128`).
- When the player takes damage, there is only a red number (`sim.js:96`) and the recoil. There is no hurt sound: the player sound only plays for the player's own hits (`main.js:433`). There is no vignette and no low-health warning.
- Damage numbers are a fixed 17 px (`illustrated-render.js:176`).
- Dead towers simply stop being drawn (`illustrated-render.js:150`).
- The wisp "DEFEATED" event plays the same kill tone as a hero kill, and it outranks the combo and interrupt sounds (`audio.js:223,231`).

**Proposals**
1. **Impact events with a weight, read by both renderers.**
   - The sim emits `s.impacts` entries `{x, y, weight, source, target}`.
   - The main loop holds the accumulator for 40–90 ms on heavy hits that involve the player. The sim steps themselves do not change, so seeded replays stay identical (`sim.test.mjs:66`). Allow at most one hitstop per 0.3 s.
   - Shake scales with weight, replacing the flat 3×2 px:

     | Event | Hitstop | Shake |
     |---|---|---|
     | 3rd chain strike, ambush, opening hit | 60 ms | 4 px |
     | Ultimate | 80 ms | 6 px |
     | Hero kill | 90 ms | 8 px |

   - Reduced motion turns this off (`illustrated-render.js:39`).
2. **A channel for damage you take.**
   - A hurt sound scaled by the share of health lost.
   - A hit flash: an additive tint in 2D, an emissive pulse plus the `hit` clip in 3D (`render3d/assets.js:59`).
   - A red edge pulse, and a heartbeat with a HUD pulse below 30% health.
   - A direction arc for damage from sources off screen.
3. **Make big moments look big.**
   - Towers crumble and leave rubble.
   - Separate announcer lines for each tier, the gate and the guardians (`announcer.js:36-45`).
   - Damage numbers sized by amount and coloured by damage type.
   - The kill tone plays only for heroes, camps and the boss.

### Rule 6. Meaningful target priority: 1

**Evidence**
- Dryad's sentinel heals allies (`legend-rules.js:13-17`, `sim.js:422-425`).
- A siege wisp comes every third wave (`sim.js:330-331`). The Wild Hunt leviathan (`sim.js:131`).
- Auto-target prefers heroes, then lowest health (`sim.js:171-173`). Bot target scoring (`combat-ai.js:38`).

**Gaps**
- Wisps differ only in numbers (`sim.js:331`).
- All four camps share hp 960, damage 55 and range 170 (`sim.js:414`), and give the same reward (`sim.js:135-137`).
- The special alternates by camp index (`encounters.js:7`), but the art rotates by `(camp + roll) % 4` (`marketplace-sprites.js:8`). So an "Undead Archer" can cleave in melee.
- Tower tiers differ only in hp, range and damage (`sim.js:44-45`).
- Towers shoot the nearest non-hero (`sim.js:484`).

**Proposals**
1. **Roles in the lane wave.**
   - Melee: as today.
   - Caster: 300 hp, 55 damage, range 320.
   - Siege: range 400, so it outranges towers, but takes +50% damage from heroes. Heroes must clear it.
   - Towers shoot siege first, then casters, then melee, then heroes.
   - From 8:00, or in a lane whose gate has fallen, a warden wisp gives nearby wisps +25% armour until it dies.
   - *Check.* In bot runs, heroes kill casters and siege wisps at a higher rate than melee wisps.
2. **Camp archetypes that match their art.**
   - Fix the art per camp.
   - Ogre bruiser: cleave and slow. Reward: health and armour.
   - Knight: blocks frontal damage, so it must be flanked; it is exposed after its slam. Reward: +20% damage to structures for 60 s.
   - Mage: a line nuke, low hp. Reward: mana.
   - Archer: kites. Reward: speed.
   - Across 8 camps (`layout.js:24`, mirrored), this turns route choice into a decision.
3. **Structures with roles, and readable hero roles.**
   - Outer tower: single-target sniper with today's ramp. Middle tower: hits that chain across wisp clusters. Inner tower: a slowing beam. Guardians: an area slam.
   - Mark priority units in the world: a healer icon on the Dryad sentinel, a decoy tag on the Kitsune decoy.

### Rule 7. Resource tension: 1

**Evidence**
- Mana costs (`combat-rules.js:4-9`), capacity (`:10`), regen of 6 + 0.35 × level (`sim.js:437`). A failed cast is free (`sim.js:239,254`). Bots keep a mana reserve (`combat-ai.js:77`).
- Respawn is 5 + level seconds (`sim.js:119`). The hero kill bounty goes to the whole team with no distance check (`sim.js:120`, `:59-60`).
- Gold arrives at 3.2/s (`sim.js:427`).
- Every item is permanent (`items.js:5-35`). `purchase` has no position check (`items.js:74-78`), and bots buy every 2 s wherever they are (`sim.js:429`).

**Measured**
- The player was below the cost of its cheapest learned spell for 0% of its alive time (median; 9.4% at most).
- Dead for 7.2% of the match.
- 122 gold unspent at the end (median).

**Proposals**
1. **Shop only at the base court, which makes recall a decision.**
   - Purchases only inside `BASE_HEAL_RADIUS`, or while dead. Add a "buy on return" queue for quick-buy (`main.js:241,295`). Bots follow the same rule.
   - The base gate (`layout.js:22`) keeps the trip back short.
2. **Mana that binds over a long match.**
   - Lane regen drops to 3.5 + 0.25 × level.
   - Ultimates cost about 25% of the pool. The column today is 135–180 (`combat-rules.js:4-8`).
   - The mage camp restores mana. Failed casts stay free.
   - *Target.* Mana-starved for 10–20% of alive time.
3. **Death and gold that cost something.**
   - Respawn becomes 6 + 1.2 × level, capped at 28 s.
   - The kill bounty goes to heroes within 1500 units, plus a bounty for ending a streak.
   - Passive gold drops to 2.4/s so builds finish at about 12–13 minutes.
   - Gold sinks: a healing draught with 3 charges, a "tide lantern" vision ward for brush on the bigger map, and buyback after 10:00 at 100 + 40 × level.

### Rule 8. Pressure rhythm: 1 (the weakest dimension at match scale)

**Evidence**
- Wave 1 spawns at t = 1 at the lane midpoint (`sim.js:40,330`). Waves then come every 14 s (`sim.js:404`).
- The boss first spawns at 26 s (`sim.js:40`), then 65 s after each kill (`sim.js:129`).
- Camps respawn after 32 s (`sim.js:135`). The realm changes every 40 s (base `world.js:6`).
- After 240 s, all basic-attack damage ramps up (`sim.js:188`).
- The limit tiebreak (`sim.js:519-521`).

**Measured**
- First hero damage at 6.0 s (median; range 4.1–7.3).
- The player is fighting 52.8% of the time. Median fight 8.5 s, median gap 8.3 s, 90th-percentile gap 18.4 s.
- The share of each minute spent fighting swings between 21% and 78% with no build-up, and minute 0 is already at 31–66%.
- 11 of 24 matches hit the 360 s limit.

**Proposals.** These fit HEAD's `SUDDEN_DEATH 960` and `LIMIT 1200`. The full timeline is in section 3.
1. **A match clock with announced peaks.**
   - Wave 1 leaves the bases at 0:15. Half a lane is 20–24 s of wisp walking at HEAD lengths of 11517/9488/11452 (measured), so contact comes at about 0:40.
   - Camps first spawn at 1:00, then every 60 s.
   - The Wild Hunt first spawns at 4:00, with a horn and a timer 30 s ahead. It respawns 3:30 after each kill and becomes the elder version from 12:00.
   - Outer towers take 50% damage until 4:00.
2. **Designed rest.**
   - Longer respawn (rule 7).
   - After a fight with 2 or more deaths, Normal and Hard bots reset for about 15 s: recall, heal or farm.
   - Out of combat for 6 s, a hero regains 2% of max health per second (today 12 hp/s after 5 s, `sim.js:436`).
   - Bots must not trickle back into a fight one at a time.
3. **Escalation instead of the global damage ramp.**
   - Remove `sim.js:188`.
   - Wave strength +6% every 3 minutes. A siege wisp every second wave from 8:00. An elder wisp in any lane whose gate is down.
   - Sudden death at 960 s: respawn +50%, and only now a damage ramp of `1 + (t − 960) / 150`, which does not apply to structures.
   - *Check.* In bot runs, the fight share in minute 0–1 is 25% or less, and overall 35–45%. There are at least 2 lulls per match of 30 s or more with no hero-vs-hero damage. Fight share peaks at 70% or more in the 60 s around each Wild Hunt spawn.

### Rule 9. Skill expression: 1

**Evidence**
- Aim (`skill-aim.js:18-28`).
- Combos: wet stun (`sim.js:289`), root bonus ×1.6 (`sim.js:382`), fear on a bleeding target (`sim.js:286`), and legend combos at ×1.5–1.6 (`legend-rules.js` zone rules).
- Ambush ×1.75 (`sim.js:185-190`). Last-hit gold (`sim.js:140`). A three-strike basic chain (`basic-attacks.js:15-19`).

**Gaps**
- Basic attacks pick their own target (`sim.js:167-174,474-475`) and still land at range + 90 (`sim.js:196`). Measured: basic attacks are 62.9% of hero-on-hero damage and 42.2% of all damage the player takes.
- Last hits only pay gold. There is no deny and no cue that a wisp can be finished.
- The follow-up cue names the exact button to press (`combat-feedback.js:41-51`, `main.js:259`).

**Proposals**
1. **Spacing that counts.**
   - Cut the slack for hits on heroes from 90 to 35 (`sim.js:196`).
   - The third chain strike gets +0.08 s windup and a small arc preview, so stepping out dodges it.
   - Update `base-attacks.test.mjs:28`.
2. **Last hits and denies.**
   - A "killable" tick on a wisp's health bar.
   - Deny: you can kill your own wisp below 35% health. You get no gold, and the enemy gets half the XP.
3. **Hints that fade with mastery, and visible improvement.**
   - The combo cue fades after N successful uses (a setting with Always / Learning / Off).
   - The result screen (`main.js:232`) lists warnings dodged, combos landed, opening hits and last hits.

### Rule 10. Understandable failure: 1

**Evidence**
- Red damage numbers on the player (`sim.js:96`) and control badges (`illustrated-render.js:228-240`).
- The tower threat line (`main.js:288-289`), the protected-structure tip (`sim.js:73`) and the mana tip (`main.js:428`).
- The kill feed (`announcer.js:68-76`), the respawn overlay (`main.js:272`) and last-seen markers (`illustrated-render.js:296-299,336`).

**Gaps**
- `damage()` (`sim.js:70-142`) keeps no history. The kill record stores only assists (`team-events.js:55`).
- Dead heroes vanish (`illustrated-render.js:150`).
- No indicator for damage from off screen.
- Wisp "DEFEATED" labels (`sim.js:115`) crowd the 4 visible result slots (`illustrated-render.js:260`).

**Measured**
- 43 player deaths. Killing blows: heroes 30, towers 6, boss 3, leviathan 2, minions 2.
- The median death had 3 damage sources in its last 6 s. 55.8% of deaths had 3 or more. The top source dealt a median 58%.
- Of 973 kill labels shown to the player, 875 (90%) were DEFEATED and only 98 BANISHED.

**Proposals**
1. **A death recap.** See section 5.
2. **Death made visible in the world.**
   - The body falls and leaves a marker for the respawn time (`death` clip, `render3d/assets.js:59`).
   - A line from the killer to the victim, a direction arc for damage from off screen, and a low-health warning.
3. **A cleaner feedback channel and lessons after the match.**
   - Drop DEFEATED labels for wisps.
   - The result screen adds "Lessons": deaths by cause, damage from towers, objectives lost while you were dead, and a trend from the saved record (`main.js:231`).

## 3. Pacing plan for a 16–20 minute match on the 9600 map

| Time | Beat | Mechanic |
|---|---|---|
| 0:00–0:40 | Deploy (quiet) | Heroes start at the outer tower. Waves leave the bases at 0:15. |
| 0:40–4:00 | Laning (pressure) | Bots trade inside their own wave. Camps from 1:00. Outer towers take 50% damage. |
| 3:30 / 4:00 | First peak | Horn and timer, then the Wild Hunt spawns. Bots gather 5 s (Normal) or 12 s (Hard) ahead. |
| After a peak | Rest, about 30–45 s | Longer respawns, bot reset, faster regen out of combat. |
| 8:00 | Escalation | Wardens. A siege wisp every second wave. |
| 12:00 | Elder | Elder Wild Hunt. Gates and guardians come into play. |
| 16:00 (960 s) | Sudden death | Damage ramp, respawn +50%. |
| 20:00 (1200 s) | Hard end | Tiebreak: structures destroyed first, then health. Replaces the summed-hp rule at `sim.js:519-521`. |

Change the realm interval from 40 s to 60 s so it lines up with these beats. Today the changes come at 40 s intervals and fall on no particular beat (base `world.js:6`).

## 4. Challenge: bot difficulty that stays fair

**Weaknesses I verified in the code**
- Bots walk the lane into towers with no wave. `followLane` has no tower check (`sim.js:334-340,359`). The tower check covers attacking, not walking (`combat-ai.js:37`).
- Bots dive towers with no check.
- A 1v1 never counts as outnumbered, because the ally count includes the bot itself (`combat-ai.js:9,30`).
- Bots skip camps (`combat-ai.js:8` drops team −1).
- No sprint for bots (`sim.js:357`, against `:450-451`).
- No portals: `portal()` is called only from player input (`sim.js:454`).
- Recall teleports a bot home while it keeps walking (`sim.js:349`).
- Defend alarms are never read by bots, yet chat says "I'll go" (`team-chat.js:21`).
- Bots never read recovery or exposed states.

**Fixes for every difficulty**
- Lane walking that waits for the wave.
- A tower-dive guard.
- Retreat that compares the trade.
- Speed parity and recall parity: stand still, cancel on a hit, show the channel.
- The Wild Hunt and summons count as an escort.
- Bots answer defend alarms.
- Bots use portals.
- `Math.max` for stuns.

**Profiles per team** (`createMatch(..., {enemy, ally})`). Allies play one step below the enemy.

| Knob | Easy | Normal | Hard |
|---|---|---|---|
| Reaction to a warning | 0.40–0.60 s | 0.28–0.42 s | 0.20–0.30 s |
| Dodge succeeds after reacting | 50% | 75% | 90% |
| Bot windup, normal / ultimate | 0.65 / 0.9 s | 0.55 / 0.75 s | 0.45 / 0.65 s |
| Aim lead | none | 50% | 85% |
| Interrupts enemy ultimates | never | 40% | 80% |
| Focus fire | none | soft | firm, with a visible "Hunted" mark on you |
| Ganks | none | every 90 s | every 50 s, using gates |
| Gathers for objectives | when visible | 5 s ahead | 12 s ahead |

Today's values for comparison: reaction 0.18–0.30 s (`combat-ai.js:19`), and dodges always succeed (`combat-ai.js:24-28`).

**Fairness guardrails**
- Same stats for every hero.
- Bots use only what they can see (`canSee`, `visibleTo`).
- Every bot behaviour has a tell.
- Bot windups are never below 0.45 s.
- Seeded randomness by hash, never `s.random`.
- Show the difficulty on the draft and result screens.

## 5. Death recap

- **Data.** In `damage()`, keep a ring buffer per hero covering the last 8 s, written where `actual` is computed (`sim.js:91`). Each entry holds the source and its kind, an ability label (from a new `meta` argument, set by `cast`, zones and missiles), the amount, the amount the shield absorbed, and any control applied. Snapshot it into the kill entry (`team-events.js:58`).
- **Display.** Show it on the respawn overlay (`main.js:272`). Example: "Banished by Riftblade · Abyssal Maw 640 · 58% basic attacks · stunned 1.9 s by Stoneheart's charge · Inner ward ×3 (+66%)".
- **Tip.** Add one tip chosen by rule:
  - "You stood in two warned attacks"
  - "Tower fire stacked to +88%"
  - "3 enemies were missing from the map"
- **Checks.** A Node test that the recap names every source in the window and that its totals match the health lost. A browser check that the card fits on a 390×844 phone.

## 6. Order of work

1. Rules 8 and 7 (match clock and economy). These depend on the map agent's `SUDDEN_DEATH` and `LIMIT`.
2. Rule 10 recap and rule 5 hurt channel (cheap).
3. Rule 2 warnings and engage tells (the 3D clips need these anyway).
4. Rule 4 misses and openings.
5. Bot fixes, then difficulty profiles.
6. Rule 6 roles (these need art for the caster wisp and the camps).
7. Rule 9.

## 7. Tests and specs these changes touch

**Tests**
- `combat-decisions.test.mjs:72-77`: recovery exactly 0.26 / 0.34 / 0.
- `encounters.test.mjs:66,79`: reaction 0.18–0.3 s; needs bounds per profile.
- `tactical-combat.test.mjs:37-39`: tower pressure 100 → 122.
- `base-attacks.test.mjs:28`: deliberate miss.
- `sim.test.mjs:50,53,59`: respawn, boss at 27 s, the `LIMIT` loop.
- `creatures.test.mjs:30`: camp respawn at 32 s.
- `team-presence.test.mjs:94`: the 400 s loop.

**Specs**
- `moba-combat-decisions`: "Punishable commitments" (`:37-42`). Keep "Interrupt before contact" (`:17-19`) free of cost.
- Canonical `moba-combat/spec.md`: `:76-81` (tactical decisions), `:83-88` (spell resources), `:90-95` (lane and tower pressure).

**New checks.** Rerun `telemetry.mjs` against the new code with the targets above:
- recovery windows after a miss punished at least 30% of the time;
- mana starved 10–20% of alive time;
- first hero damage at 30–50 s;
- fight share 35–45%;
- recap coverage of 100%;
- DEFEATED labels at 0%.

**Not checked:** browser, phone, audio, rendering and GPU. All numbers come from the Node simulation with bots on both sides.