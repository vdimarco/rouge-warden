# Shore of the Ancients: combat audit against the ten combat-fun rules

Repository root: `/home/user/rouge-warden/`. All `file:line` citations are relative to that root. No repository files were edited. I wrote three read-only scratch scripts in `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/`: `rhythm.mjs` (with `rhythm.log`), `mana.mjs` (with `mana.log`), `lanes.mjs` and `early.mjs`.

---

## 0. Facts that change the plan (read first)

1. **The map is already 6400, not 4800.**
   - `public/tidebreak/arena.js:2` sets `SIZE = 6400`, and `arena.js:3` sets `MAP_SCALE = SIZE/4800` (1.333). Authored anchors go through `arenaPoint` (`arena.js:5`).
   - The change came in commit `ea4a34d` (2026-10-02, "Expand Monster Mash arena and tower progression").
   - The canonical spec says 6400 (`openspec/specs/moba-combat/spec.md:57`). Tests assert it at `qa/tidebreak/sim.test.mjs:7-8` and `qa/tidebreak/towers.test.mjs:24`.
   - `docs/tidebreak.md:7` still says 4800, so that doc is out of date.
   - So "double the size" means 12800 if measured from now (4× the area). 9600 is only 1.5× the current width. This needs a decision.
2. **Two tower layers already exist (outer and inner).** The code below assumes exactly two:
   - `sim.js:40`: `towers:[6,6]`
   - `sim.js:43-45`: the `tier<2` loop, hp 2700/3400, range 360/390, damage 180/195, names "Outer/Inner"
   - `sim.js:73`, `sim.js:126`: tier messages
   - `world.js:33-37`: `TOWER_POSITIONS` returns `[outer, path[index*.48]]`
   - `objectives.js:9`: only tier 1 is gated by tier 0
   - `objectives.js:3`: `laneOpen` needs `towers.length===2`
   - `objectives.js:18`: "outer/inner", "/6"
   - `announcer.js:32`: `ping.tier ? 'inner':'outer'`
   - `illustrated-render.js:184, 204, 224, 331`: tier-1 height, ring, label and minimap size
   - Tests: `towers.test.mjs:8` (12 towers, `[6,6]`), `sim.test.mjs:13-17`
   - Measured with `lanes.mjs`: the **middle inner tower is 412 units from its base centre, inside the 420 healing radius** (`bases.js:1`). There is no room for a third middle tower unless the map grows or the tower spacing changes.
3. **Hero art is static.**
   - Every hero draws its identity's single reference portrait (`illustrated-render.js:193-194`). Identities are always assigned (`main.js:28`, `main.js:164`).
   - The per-hero attack frames loaded at `illustrated-render.js:21` are only a fallback.
   - So hero wind-up, attack and hit "animation" is only transforms: lunge, tilt, squash and recoil (`illustrated-render.js:198-201, 217`). This matters for rules 2 and 5 and for the new art direction.
4. **Baseline:** all 21 `qa/tidebreak/*.test.mjs` suites pass today.
5. **How the measurements were made:** `rhythm.mjs` ran 36 autopilot matches (12 heroes × seeds 1-3) at 60 Hz. The player uses bot logic under autopilot, so this is bot-vs-bot behaviour, not a human. Its numbers differ from `sim.test.mjs`, which steps at 0.05 s.

---

## 1. Where combat lives

| Concern | File:line |
|---|---|
| Damage pipeline, kill handling, rewards, floaters | `sim.js:70-142` (`damage`) |
| Basic attack start and impact, combo chain, tower ramp, ambush | `sim.js:175-191` (`attack`), `sim.js:192-222` (`resolveAttack`), `basic-attacks.js:15-31` |
| Committed casts (intent, lock, interrupt, recovery) | `sim.js:236-250` (`requestCast`), `sim.js:361-370` (`resolveIntent`), `combat-state.js:7-20` (`castTiming`) |
| Spell effects, original 4 heroes | `sim.js:251-300` (`cast`) |
| Spell effects, 8 legends | `legend-rules.js:5-76` (`castLegend`), `77-95` (`tickHeroMechanic`), `96-130` (`tickLegendZone`) |
| Zones and traps | `sim.js:371-397` (`terrainEffects`) |
| Homing missiles, bloom | `skill-events.js:3-34` |
| Hit shapes and warning geometry | `combat-rules.js:22-44` |
| Control rules (root, stun, silence, disarm) | `combat-state.js:2-4` |
| Result events (combo, shield-break, interrupt, kill, exposed) | `combat-state.js:22-29`, `combat-feedback.js:53-62` |
| Marks, control badges, follow-up cue | `combat-feedback.js:6-51` |
| Neutral camp and boss specials | `encounters.js:5-48` |
| Bot decisions | `combat-ai.js:7-82`, `sim.js:341-360` |
| Main loop and input | `main.js:417-463`, keys at `main.js:387` |
| Visual feedback | `illustrated-render.js:127-177, 181-268`, `combat-motion.js:3-135` |
| Audio feedback | `audio.js:206-254`, `main.js:431-433`, `announcer.js:116-133` |
| Kill calls and feed | `announcer.js:14-28, 68-94`, `team-events.js:41-62` |

---

## 2. Rule by rule

The scores are my estimates from reading the code (0 = absent, 1 = weak, 2 = strong). They are not playtest scores.

### Rule 1: Immediate control (estimate: movement 2, skills 1)

**What exists**
- The loop runs a fixed 60 Hz step with an accumulator (`main.js:417-435`). Input is rebuilt every step (`main.js:426`). Q/E/C/R queue a cast at the cursor's world point (`main.js:387`), and the next step consumes it (`main.js:424-425`). Latency is at most about 16.7 ms.
- Drawing interpolates between steps (`main.js:449-463`).
- Movement is never blocked by basic attacks (`base-attacks.test.mjs:46-51`). Spells with zero windup cast at once (`sim.js:243`).

**What is weak or missing**
- A committed cast freezes the hero: `move()` returns while `castIntent` is set (`world.js:105`). Recovery cuts speed to 55% (`world.js:106`). Casts, attacks and portals are blocked during intent and recovery (`sim.js:237`, `sim.js:176`, `sim.js:302`).
- Presses in those windows are dropped. `castQueue` holds one slot and is overwritten (`main.js:387`), and `requestCast` returns false (`sim.js:237`). The only cue is the HUD label CAST or WAIT (`main.js:245-247`). This is honest, but silent.
- **The player's own committed cast has no sound and no body pose when pressed:**
  - `sound.skill` fires when `castStarted` changes (`main.js:431`).
  - `castStarted` is set in `cast()` at resolution (`sim.js:260`).
  - `attackPose` also reads `castStarted` (`combat-motion.js:10`).
  - So during the 0.2-0.4 s windup, the only feedback is the green ground warning (`illustrated-render.js:155`, `combat-motion.js:3-8`).
- Basic attacks need no input. Targets are chosen automatically (`sim.js:167-174, 474-475`); clicking only sets a focus (`sim.js:145-155`).

### Rule 2: Readable threat (estimate: 1)

**What exists**
- **Hero casts.** `requestCast` stores a locked shape that is also the hit geometry (`sim.js:244-247`, `combat-rules.js:22-43`).
  - It is drawn red for enemies (`#ff8f75` with fill `#ff57392e`) and green for allies (`#a3ead3`), with a dashed outline and a progress arc (`combat-motion.js:3-8`).
  - The skill name appears above the caster (`illustrated-render.js:153-157`).
  - The caster is revealed for windup + 1 s (`sim.js:248`).
- **Bot windups** are always 0.5 s, or 0.7 s for ultimates (`combat-state.js:14`). That is longer than the 0.3 s reaction minimum in `docs/drain-fun.md:31-32`.
- **Player windups** come from the per-hero `WINDUPS` table, 0-0.4 s (`combat-state.js:7-11`).
- **Neutral specials.** Camps wind up 0.7 or 0.8 s and the boss 0.8 or 0.85 s (`encounters.js:10`). They are drawn in `#ffc17a` with a label (`illustrated-render.js:155-157, 241-258`).
- **Delayed ground spells:**
  - Witchfire arms after 0.7 s (`sim.js:290`) and stays dashed until then (`combat-motion.js:100-103`).
  - Spirit knot 0.45 s (`legend-rules.js:47`), Worldbreaker 0.8 s (`:53`), Brambles 0.5 s (`:66`), decoy 0.7 s (`:29`).
  - Unarmed legend zones are dashed (`combat-motion.js:99`). Traps arm after 0.5 s (`sim.js:285`).
- **Towers.** The range ring turns red when the tower targets the player (`illustrated-render.js:205`), and the objective line says "Tower fire is growing" (`main.js:288-289`). Damage ramps +22% per hit, up to +88% (`sim.js:189, 198`).
- **Marks and controls** are badges with timers (`combat-feedback.js:6-24`, `illustrated-render.js:228-240`).

**Measured:** 70% of hero casts (6516 of 9253) went through a telegraph, and every windup was 0.5 or 0.7 s. The other 30% were instant.

**What is weak or missing**
- **Warnings use one sense only.**
  - The enemy cast sound `worldCast` fires at resolution, not at wind-up (`announcer.js:127`, `audio.js:239`).
  - A neutral `specialIntent` starts with no sound.
  - There is no wind-up pose. Casters stay idle because `attackPose` needs `castStarted` or `attackStarted` (`combat-motion.js:9-19`). Camps only animate on `attackAnim` (`illustrated-render.js:213`, `marketplace-sprites.js:12`).
  - The research asks for pose, colour and sound together (`docs/drain-fun.md:33`).
- **Offensive engages with no telegraph.** `castTiming` treats every slot 0 as defensive (`combat-state.js:13`), so for bots these are instant:
  - Jersey Devil's leap: 0.65 s stun and 180 damage on landing (`sim.js:280`).
  - Stone Golem's charge: 0.8 s stun, 210 damage and a push (`legend-rules.js:20-22, 89`).
  - Kraken's ink: a damage zone (`legend-rules.js:11`).
  - Bots use all three to engage (`combat-ai.js:66, 69, 75`).
- **Blink effects land before the art arrives.** Slot-0 blinks move the simulated position at once (`sim.js:274`, `legend-rules.js:26`) and apply landing effects such as the Devil's stun immediately. The sprite is still drawn mid-arc for 0.38 s (`sim.js:275`, `illustrated-render.js:197`).
- **Zones that damage on the first tick with no arm phase:**
  - ink, abyss, blizzard, garden, grove, ninelights (`tick:0` at `legend-rules.js:7`)
  - maelstrom and stomp (`sim.js:295-296`); the first stomp pulse is immediate (`sim.js:378`)
- Enemy traps are invisible unless you are within 110 units (`illustrated-render.js:138`). This is by design.
- A warning is drawn only when the caster is visible (`illustrated-render.js:152`).
- Red-orange enemy warnings (`#ff8f75`) and orange neutral warnings (`#ffc17a`) on a warm painted ground need a contrast check in the new art direction.

### Rule 3: Real counterplay (estimate: player vs bots 1-2, bots vs player 1)

**What exists**
- **Dodge.** Aim is locked (`sim.js:244-247`) and resolution reuses it (`sim.js:369`). Neutral shapes are locked too (`encounters.js:4, 32`). Tests: `combat-decisions.test.mjs:24-30`, `tactical-combat.test.mjs:40-43`, `encounters.test.mjs:16-26`.
- **Interrupt.**
  - Stun, fear, silence, or a root (for movement spells) cancels a pending cast (`combat-state.js:4`). So does being displaced more than 8 units (`sim.js:363`). No mana or cooldown is spent, and an INTERRUPTED cue shows.
  - Neutral specials are cancelled by stun, fear or leash (`encounters.js:22-23`).
  - Sun ray stops on stun, fear or silence (`legend-rules.js:98`, `sim.js:374`).
  - Tests: `combat-decisions.test.mjs:31-43`, `encounters.test.mjs:45-49`.
- **Cover.** Every cone, area, zone and special checks line of sight (`sim.js:224, 268, 379`, `legend-rules.js:104`, `encounters.js:32`). Brush hides heroes (`world.js:70-71, 86`).
- **Mitigation.**
  - Shields on many kits.
  - Mirror cloak (`items.js:19`, `sim.js:86-88`) and Root crown (`items.js:17`, `sim.js:100-102`).
  - Golem reflects 20% (`sim.js:94`).
  - Gorgon cleanses and takes 35% less damage (`legend-rules.js:19`, `sim.js:83`).
  - Pale reaper cuts healing and shields (`items.js:32`, `sim.js:84-85`).
  - Phoenix rebirth (`sim.js:114`).
- **Silence and disarm** deny spells and basics (`legend-rules.js:56, 51`).
- **Escape.**
  - Eight slot-0 movement spells (`combat-state.js:3`).
  - Recall takes 2.5 s and is cancelled by damage (`sim.js:456-459`).
  - Portals (`sim.js:301-306`).
  - Sprint ×1.35 out of combat (`sim.js:450`).

**What is weak or missing**
- There is no shared defensive move. Kraken, Wendigo, Dryad and Gorgon have no slot-0 movement (`combat-state.js:3`).
- **Bots never interrupt on purpose.** `combatDecision` only uses an enemy `castIntent` to evade (`combat-ai.js:12-29`). Bots also never bait.
- **Crowd control stacks without limit.** There is no immunity or diminishing return (grep finds nothing).
  - Stuns are overwritten by plain assignment, so a short stun can cut a long one: `area()` uses `Object.assign` (`sim.js:226`), and `legend-rules.js:35, 41`, `sim.js:289` assign directly.
  - Long chains include the garden's 1.2 s stun on every third pulse (`legend-rules.js:122`) and the gaze stun of up to 1.9 s (`legend-rules.js:72`).
- Instant engages (see rule 2).

### Rule 4: Punish window (estimate: 1)

**What exists**
- **Hero recovery after committed casts.** `castTiming` gives 0.22, 0.26 or 0.34 s (`combat-state.js:18`), set at resolution (`sim.js:369`).
  - During recovery: no casts (`sim.js:237`), no basics (`:176`), no portal (`:302`), bots do nothing (`:342`), movement ×0.55 (`world.js:106`).
  - The game shows a "RECOVERY 0.2s" ring (`illustrated-render.js:159-162`) and "WAIT" on the HUD (`main.js:246`).
- **Neutral recovery.** Camps are exposed for 1.15 s and the boss for 1.4 s (`encounters.js:12, 30-31, 36`). Hits then deal +25% with an "OPENING HIT" cue (`sim.js:80`) and an EXPOSED ring.
- Tests: `combat-decisions.test.mjs:28-29, 61-66, 72-77`, `encounters.test.mjs:23-25`.

**Measured:** only 17% of hero recovery windows (1132 of 6516) saw the recovering hero take any damage.

**What is weak or missing**
- **Hero recovery is shorter than human reaction time and gives no damage bonus.** It lasts 0.22-0.34 s, against the 0.3 s+ reaction budget. Neutrals give +25%, and Crimson Rouge gives 1.45× (`docs/combat-fun-system.md:42-45`).
- Instant casts have no recovery at all. That covers every slot 0 and every player slot with windup 0, for example Baba slots 1-2, Kitsune 1-2 and Dryad 0-2 (`combat-state.js:7-11`).
- **Bots never punish.** `combat-ai.js` never reads `recoveryUntil` or `exposedUntil`, and target scoring ignores them (`combat-ai.js:38`).
- A missed basic attack only resets the combo (`sim.js:196`).
- Interrupting a neutral special clears its exposed window (`sim.js:478-479`, `encounters.js:22-23`). Answering a special earns nothing beyond stopping it.

### Rule 5: Impact feedback (estimate: 1)

| Event | Visual | Motion and reaction | Sound | UI and text |
|---|---|---|---|---|
| Player basic hit | strike VFX (`sim.js:221`, `combat-motion.js:27-51`) | hero target recoils 13 px for 0.16 s (`sim.js:91`, `illustrated-render.js:198-200`); creatures play a hit clip or drop to 0.7 alpha (`illustrated-render.js:213`, `marketplace-sprites.js:14`); shake up to 3×2 px | variant and hero-pitch tone plus punch clip (`main.js:433`, `audio.js:206-212`) | damage floater (`sim.js:96`, `illustrated-render.js:176`) |
| Other heroes' basics | strike VFX | recoil | spatial `worldHit` (`announcer.js:126`, `audio.js:238`) | no floater unless the player is involved (`sim.js:96`) |
| Spell | per-hero VFX (`sim.js:267`, `combat-motion.js:52-77, 118-135`) | some displacement (`sim.js:284, 289`, `legend-rules.js:35, 89`) | sound at cast time only (`main.js:431`, `audio.js:213-218`, `announcer.js:127`) | floaters |
| Combo, shield break, interrupt, kill, exposed | 11 px label (`illustrated-render.js:259-268`) | none | short tones (`audio.js:219-235`) | only when the player is source or target (`combat-state.js:23`); same event suppressed for 0.5 s (`:25`) |
| Tower shot | beam (`sim.js:221`) | none | `towerShot` (`audio.js:240`) | none |
| Structure falls | none | none | `structureFall` and stinger (`audio.js:254, 290-291`) | banner (`announcer.js:37-38, 110-111`) |

**What is weak or missing**
- **No hitstop anywhere.** A grep for hitstop, freeze and timeScale finds nothing.
- **Shake is tiny and not weighted by event.**
  - It triggers on any strike or spell effect from the player or within 250 units, at up to 3×2 px (`illustrated-render.js:127-128`).
  - A third hit, a kill and being hit all feel the same.
  - It is turned off under reduced motion (`illustrated-render.js:39`).
- Heroes get no hit flash or tint, only recoil, and they are static portraits.
- Basic attacks never knock back.
- **When the player takes damage**, there is only a red floater (`sim.js:96`). There is no hurt sound, no vignette and no low-health warning (grep finds none).
- Floaters are all 17 px (`illustrated-render.js:176`). They are coloured only by whether the target is the player. They do not scale with damage or show the damage type.
- Spells have no impact sound per target.

### Rule 6: Meaningful target priority (estimate: 1)

**What exists**
- **Hero roles** differ by kit (`sim.js:22-28`, `legends.js:3-44`).
  - The Dryad sentinel is a summon that heals allies, a real priority target (`legend-rules.js:13-17`, `sim.js:422-425`).
  - The Kitsune decoy explodes (`legend-rules.js:29`).
- **Siege wisp** on every third wave: 780 hp, 88 damage, range 270, against 390/45/95 for normal wisps (`sim.js:330-331`).
- **Wild Hunt leviathan:** 4400 hp, 350 damage (`sim.js:131`).
- **Towers** prefer non-heroes, and switch to a hero who hits a hero in range (`sim.js:98, 483-484`).
- **Target choice.** Player auto-targeting prefers heroes, then the lowest health (`sim.js:171-173`). Bot scoring prefers heroes and wisps they can finish, and front-line bots protect allies (`combat-ai.js:37-48`).

**What is weak or missing**
- **Lane wisps differ only in numbers** (`sim.js:331`). There is no caster, healer, shielder or bomber. Wisps attack the nearest target (`sim.js:508`) and never react to hero aggression.
- **All four camps share stats and rewards:** hp 960, damage 55, range 170 (`sim.js:414`), and the same reward (`sim.js:135-137`). Only the special alternates between cleave and line, by camp index (`encounters.js:7`). Sprites named "Undead Mage" and "Undead Archer" (`marketplace-sprites.js:5-6`) have the same range as the ogre.
- The boss has two patterns plus a fury phase below 50% (`encounters.js:6-13`). That is reasonable.

### Rule 7: Resource tension (estimate: 1)

**What exists**
- **Mana.**
  - Costs: `COSTS` (`combat-rules.js:4-9`).
  - Capacity: 420 + 100 if ranged + 32 per level + class growth (`combat-rules.js:10`).
  - Regen: 6 + 0.35 × level + class bonus per second; 30% of max per second at base (`sim.js:437`).
  - Kraken steals mana (`legend-rules.js:36`); Bloom restores it (`skill-events.js:31`).
  - A failed cast is free (`sim.js:239, 254`; test `tactical-combat.test.mjs:10-15`). A "Need N mana" tip shows (`main.js:428`).
  - Bots keep a mana reserve (`combat-ai.js:77`).
- **Cooldowns** come from `abilities.js:4-21` and `legends.js` spells, with haste scaling (`abilities.js:31`, `items.js:71`).
- **Health.** Base heals 24% per second; out of combat, 12 per second after 5 s (`sim.js:435-436`).
- **Death.** Respawn takes 5 + level seconds (`sim.js:119`). You come back with a 140 shield and the ultimate cooldown capped at 6 s (`sim.js:432`).
- **Gold** arrives at 3.2 per second (`sim.js:427`). Relics carry trade-offs (`items.js:25-35`).

**Measured**
- Casting every spell on cooldown empties mana in 32-65 s. A full rotation costs 165-473, which is 30-45% of the pool, while regen is 6.3-15.7 per second (`mana.log`).
- Under bot play, the median hero spent 0% of the match below its cheapest learned spell (maximum 15%).
- Fights lasted a median 10.3 s with 8.5 s gaps between them.

**What is weak or missing**
- Mana seldom changes a decision.
- Death is cheap: 6-23 s to respawn and no gold lost. The 95 xp / 100 gold bounty goes to the whole team with no distance check (`sim.js:120`, `sim.js:59-67`).
- Ultimates cost little, 135-180.

### Rule 8: Pressure rhythm (estimate: 0-1)

**Timers**

| Event | Value | Source |
|---|---|---|
| First wave | at 1 s | `sim.js:40` |
| Wave interval | 14 s | `sim.js:404` |
| Siege wisp | every third wave | `sim.js:330` |
| Boss spawn | 26 s, then 65 s after each kill | `sim.js:40, 129` |
| Camp respawn | 32 s | `sim.js:135` |
| Realm shift | every 40 s | `world.js:6` |
| Late basic-attack damage | ×(1 + (t-240)/110), about ×2.09 at 360 s; **spells are not scaled** | `sim.js:188` |
| Match limit | 360 s | `world.js:5` |
| Battle music hold | 7 s | `audio.js:20` |

**Measured**
- The player was in a fight for 38-75% of the match (median 56%).
- The first fight came at 4-10 s.
- Median fight: 10.3 s. Median gap: 8.5 s.
- The share of each minute spent fighting stays around 30-90% in every minute. There is no quiet phase and no build-up.
- **One match ended at 70 s** (seed 2, Dryad, from `early.mjs`):
  - The enemy took the Wild Hunt at 45 s.
  - The leviathan pushed middle: outer tower down at 53 s, inner at 62 s.
  - The 6200-hp core fell at 70 s.
- 12 of the 36 matches hit the 360 s limit.

**What is weak or missing**
- The boss arrives at 26 s, before laning has settled.
- Respawns are short, so a death never creates a real lull.
- The only alternation is the realm shift, and it is not tied to intensity.
- The middle lane is 4619 units long against about 7000 for the side lanes (`lanes.mjs`).
- Music follows the threat level (`announcer.js:117-133`, `audio.js:172-185`), but the gameplay has no designed rest.

### Rule 9: Skill expression (estimate: 1-2)

**What exists**
- **Aim.** Cursor aim (`skill-aim.js:18-22`), drag aim (`skill-aim.js:24-28`) and previews (`skill-aim.js:30-58`).
- **Combo payoffs:**
  - Wet stun (`sim.js:289`)
  - Root bonus ×1.6 (`sim.js:382`)
  - Fear against a bleeding target 2.2 s (`sim.js:286`)
  - Brine lance 340 against 205 (`legend-rules.js:36`)
  - Chill bite (`legend-rules.js:42`)
  - Spirit bind ×1.6 (`legend-rules.js:109`)
  - Ninelights ×1.5 (`:110`), garden ×1.5 (`:111`), sun ray ×1.5 (`:112`)
  - Omen consumption with recloak (`sim.js:200-205`)
- **Gorgon facing check** (`legend-rules.js:72`) and **Kitsune return** (`combat-rules.js:12`, `sim.js:253`).
- **Follow-up cue** for the next combo spell (`combat-feedback.js:26-51`, `main.js:242, 259-260`, `abilities.css:17-18`).
- **Ambush** ×1.75 (`sim.js:185-190`).
- **Last hits** give +40 or +65 embers and a floater (`sim.js:140`).
- **Basic chain** of three strikes at 1 / 0.85 / 1.15 damage (`basic-attacks.js:15-19`, `sim.js:197`).
- **Item weaving:** Nightfang after a cast (`sim.js:208-209`), Starfall (`sim.js:219`).

**What is weak or missing**
- Basic attacks are automatic. The chain resets after 2 s or on a target switch. Moving never cancels an attack, so kiting costs nothing.
- Last hits only give gold. There is no deny and no cue that a wisp can be finished.
- The follow-up cue tells the player exactly which button to press.
- The recovery and opening rewards apply only to neutrals.
- **Bots all behave the same:** reaction 0.18-0.30 s (`combat-ai.js:19`), a cast at most every 1.1 s (`sim.js:354`), and fixed 0.5/0.7 s windups. There are no difficulty levels.

### Rule 10: Understandable failure and death feedback (estimate: 1)

**What exists**
- Red floaters on the player (`sim.js:96`).
- Control badges, and the interrupt label.
- Tower-threat line (`main.js:288-289`), protected-structure tip (`sim.js:73`) and mana tip (`main.js:428`).
- Kill feed with the killer's name and colour (`announcer.js:68-76`) and kill calls (`announcer.js:15-28`). "You were banished" plays a stinger and a voice line (`announcer.js:25, 92`).
- On death: a message with the respawn time (`sim.js:122`) and a countdown overlay (`main.js:272`).
- Last-seen markers for vanished enemies (`illustrated-render.js:296-299, 336`).
- Result-screen statistics (`main.js:232`).

**Measured:** the player died to heroes 40 times, towers 6 times and the boss once in 36 matches (median 1 death per match).

**What is weak or missing**
- **No death recap.** `damage()` keeps no log. The kill record stores only assists (`sim.js:121`, `team-events.js:55`).
- **Dead heroes vanish.** Units with hp ≤ 0 are skipped when drawing (`illustrated-render.js:150`). There is only a burst ring (`sim.js:116`).
- There is no indicator for off-screen damage and no low-health warning.
- **"DEFEATED" wisp-kill labels are noise.** There were 1263 kill events in 36 matches, crowding out the important cues.

---

## 3. Constant inventory: every number that sets how combat feels

**`combat-state.js`**
- `WINDUPS` per hero and slot (`:7-11`), for example Mothman `[0,.24,0,.36]` and Nessie `[0,.32,.3,.4]`.
- Bot windup 0.5, ultimate 0.7 (`:14`).
- "Defensive" (no windup): every slot 0; slot 2 for heroes 7 and 10; slot 3 for heroes 3 and 9 (`:13`).
- Recovery: 0 / 0.22 / 0.26 (if windup ≥ 0.3) / 0.34 for ultimates (`:18`).
- Feedback: same event suppressed for 0.5 s; at most 20 kept (`:25`, `:28`).

**`basic-attacks.js`**
- `ATTACK_TIMINGS`: windup 0.12 / 0.14 / 0.18, duration 0.46 / 0.48 / 0.54, damage 1 / 0.85 / 1.15 (`:15-19`).
- `RHYTHMS` per hero (`:22-26`).
- Windup capped at max(0.04, cadence × 0.55). Frenzy cadence ×0.48 (`:28-30`).

**`sim.js`**
- Core: 6200 hp, radius 130, range 350, damage 145, rate 1.1 (`:42`).
- Towers: hp 2700/3400, radius 42, range 360/390, damage 180/195, rate 1.05 (`:44-45`).
- Hero start: 360 gold (`:36`). Level-up heal +230 (`:63`). Local XP radius 1200 (`:60`).
- Damage modifiers:
  - spell power ×0.55 (`:79`)
  - opening ×1.25 (`:80`)
  - armor formula (`:82`)
  - scale guard ×0.65 (`:83`)
  - reaper ×1.5 against shields, wound for 4 s (`:84-85`)
  - mirror: 220 shield, 20 s cooldown (`:86-87`)
  - hit 0.16 s, reveal 2.6 s (`:91`)
  - soul thread 0.25 (`:93`)
  - guard reflect 0.2 (`:94`)
  - frenzy heal 0.3 (`:95`)
  - floater life 0.8 (`:96`)
  - tower aggro 3 s (`:98`)
  - root crown: 300 shield below 35%, 35 s cooldown (`:100-101`)
  - burn 28 + 5% power (`:104`)
  - frost slow 1.2 (`:105`)
  - winter: 3 marks within 5 s, 1 s root, 10 s cooldown (`:106-110`)
  - rebirth: 35% hp, 140 shield, 330-radius blast for 260 (`:114`)
- Rewards:
  - respawn 5 + level (`:119`)
  - hero kill 95 xp / 100 gold (`:120`)
  - tower 150 / 180 (`:125`)
  - boss 190 / 160, next boss +65 s; leviathan 4400 hp / 350 damage / range 190 / rate 1.2 / speed 180 (`:129-131`)
  - camp 90 / 110, respawn 32 s, heal 430, haste 18 s (`:135-136`)
  - wisp 18 xp; last hit 40 / 65 (`:139-140`)
- Basic attacks:
  - tower and wisp windup 0.12, duration 0.46 (`:182-183`)
  - frenzy ×0.48 (`:184`)
  - late damage ramp (`:188`)
  - tower ramp +0.22 per hit, up to 4 hits (`:189`)
  - ambush ×1.75 (`:190`)
  - range slack +90 and combo window 2 s (`:196-197`)
  - tower ramp window 2 s (`:198`)
- Item procs: omen recloak 1.2 s (`:203`); Nightfang 65 + 0.5 power, 3 s cooldown (`:209`); thorn 3% capped at 160 (`:212`); tempest and storm 60 + 0.2 power, storm range 300 (`:213-214`); starfall 160 + 0.4 power, radius 240 (`:219`).
- Casting: target range 540 (`:230-234`); rank strength 1 + (rank-1) × 0.28 (`:259`); empowered 5 s (`:260`); worldroot 15% (`:262-264`). Base-kit numbers are at `:272-298`.
- Portal: 10 s cooldown, 150 range (`:302-304`).
- Wisps: 3 per lane; 390 or 780 hp; damage 45 or 88; range 95 or 270; speed 240 (`:329-331`).
- Boss: 3300 hp, damage 95, range 200, speed 125, rate 1.2 (`:406`). Camps: 960 hp, damage 55, range 170 (`:414`).
- Zones:
  - tick 0.6, or 0.8 for stomp; stomp radius 210 + 80 per pulse, 3 pulses, 0.45 s stun (`:376-378`)
  - witchfire on rooted ×1.6 (`:382`)
  - slow 1, wet 2 s, maelstrom pull 24 and heal 45 (`:384-387`)
  - trap trigger 95, radius 145, damage 260, root 2.5 s (`:393-394`)
- Economy and recovery:
  - gold 3.2 per second (`:427`)
  - respawn shield 140, ultimate cooldown capped at 6 s (`:432`)
  - base heal 24% per second; out of combat 12 per second (`:435-436`)
  - mana regen (`:437`)
  - shield decay 13 per second (`:438`)
- Movement multipliers: fear 0.8 (`:443`); sprint 1.35, slow 0.52, frenzy 1.25, hunt 1.2, pursuit 1.3, Nessie in river 1.4 (`:450-451`).
- Recall 2.5 s (`:456-458`).
- Bots: think every 1.1 s (`:354`); bot recall (`:349`); neutral leash 390 / 330, regen 150 / 240 per second (`:493-503`); wisp aggro range + 140 (`:508`).

**`world.js`**
- `LIMIT` 360 (`:5`), `SHIFT` 40 (`:6`).
- Sight 950 / 620 / 500 (`:83`). Concealed units are seen only within 125 (`:86`).
- Recovery movement ×0.55 (`:106`), chase ×1.4 (`:107`).

**`encounters.js`**
- Shape radius 600 / 500 / 450 / 400 / 320; width 0.19 / 0.21 / 1.1 / 1.0 (`:9`).
- Windup 0.85 / 0.8 / 0.8 / 0.7 (`:10`).
- Damage 235 / 185 / 145 / 125 (`:12`).
- Recovery 1.4 / 1.15 (`:12`). Cooldown 4.8 / 6.2 / 6.5 (`:13`).
- Leash 390 / 430 (`:22`). First special at 1.8 s (`:37`). Range 490 (`:39, 42`). Start margin 20 (`:44`).

**`combat-ai.js`**
- Escape heroes (`:6`). Scan range 850 / 650 (`:8-9`).
- Reaction 0.18 + ((id×17 + src×13) mod 13) × 0.01 (`:19`). Evade step 320 (`:28`).
- Retreat when hp < 0.28, or < 0.65 when outnumbered, or < 0.82 when already retreating (`:31`).
- Target score −190 + hp% × 100 for heroes, −400 for a finishable wisp, −35 for the current target (`:38`).
- Protection at 0.58 hp within 500, only heroes 1 and 7 (`:44-45`).
- Boss rally 1600 / 1700 / 1900 (`:51-52`). Per-hero cast rules (`:61-74`). Gap-close at 330-580 (`:75`).
- Mana reserve (`:77`). Kite at 0.7 × range, step 260 (`:79`).

**`combat-rules.js`**
- `COSTS` (`:4-8`), +8 per rank (`:9`), capacity (`:10`).
- Placement ranges 290 / 380 / 360 (`:14`). Cone and circle tables (`:27, 32, 34, 36`). Threat margin 65 (`:44`).

**`abilities.js`**
- Cooldowns: basics 8-14 s, ultimates 32-34 s (`:5-20`).
- `MAX_LEVEL` 18 (`:23`). XP needed 60 + 25 × level (`:24`).
- Rank gates 1/3/5/7 and 6/12/18 (`:25`).
- Cooldown reduction 0.75 per rank, or 3 for ultimates; minimum 3 s (`:31`).

**`legends.js` and `legend-rules.js`**
- Legend cooldowns 8-14 s, ultimates 34-42 s (`legends.js:5-43`).
- Slot-0 values (`legend-rules.js:11-29`), slot-1/2/3 values (`:35-73`), frost trail (`:79`), travel hits 210/140/110 with Golem stun 0.8 (`:88-89`), zone rules (`:100-123`).

**`skill-events.js`**
- Missile speed 520 / 680, life 5 (`:4`). Spirit return heal ×0.5 (`:18`).
- Venom: 3 bounces, range 260, ×0.8 per bounce (`:20-22`).

**Presentation**
- Shake ×3 / ×2 px, trigger radius 250 (`illustrated-render.js:127-128`).
- Floater 17 px (`:176`). Result label 11 px (`:265`); age 0.8 s and radius 650 (`combat-feedback.js:55`).
- Recoil 13 px; lunge 42 / 28 / 24 px (`illustrated-render.js:198-200`).
- Warning colours (`combat-motion.js:5`, `illustrated-render.js:155`).

**Audio and team events**
- `MUSIC_LEVEL` 0.62, `BATTLE_HOLD` 7 (`audio.js:20`). Intensity threshold 0.32 (`:176`).
- Event-sound priority (`:231`). Gap between event sounds 0.09 s (`:233`).
- Threat: +0.45 per enemy hero within 900, +0.3 while fighting (`announcer.js:129, 133`).
- `team-events.js:5-10`: multi-kill window 12, alarm 14, rally 12, fight ping 7, assist 1900, rally range 3200. Skirmish lasts 3 s (`:24`). Assist window 8 s (`:55`).

---

## 4. Tests that lock in this behaviour

These tests will need updates if the related constants change.

- **`qa/tidebreak/combat-decisions.test.mjs`**
  - `:11-23`: root, disarm and silence rules
  - `:24-30`: committed lance, dodge, and the recovery timings `.2/.27`
  - `:31-43`: interrupts and displacement
  - `:44-56`: kept targets
  - `:57-60`: combo and shield-break events
  - `:61-66`: boss dodge and the opening hit equal to 125
  - `:67-71`: attack rhythms
  - `:72-77`: recovery exactly .26 / .34 / 0
- **`qa/tidebreak/tactical-combat.test.mjs`**
  - `:10-15`: mana, regen, base and respawn
  - `:32`: Gorgon damage reduction to 65
  - `:34-35`: last hit gives 18 xp / 40 gold
  - `:37-39`: tower ramp 100 → 122, then reset
  - `:40-43`: bot intent, interrupt, dodge
  - `:44-46`: AI combo, evade, retreat
- **`qa/tidebreak/encounters.test.mjs`**
  - `:23`: exact shapes 400/320 and 1.1/1
  - `:30`: line width < 0.3
  - `:54-61`: boss fury
  - `:66, :79`: bot reaction within 0.18-0.3 s
  - `:89-105`: objectives and protection
- **`qa/tidebreak/base-attacks.test.mjs`**
  - `:23-24`: chain order `[0,1,2,0]` and total damage = 3× damage
  - `:26-35`: chain resets
  - `:37-42`: heal radius
  - `:46-51`: moving and casting during attacks
- **`qa/tidebreak/combat-feedback.test.mjs`**
  - `:5-7`: marks and labels
  - `:8-18`: follow-up cue
  - `:19-21`: feedback filter
  - `:22-26`: 12 distinct cast pitches; the combo two-note sound
- **`qa/tidebreak/skills.test.mjs`** `:31-36`: witchfire ×1.6, stomp radius 370, fear 2.2, frenzy life steal 30.
- **`qa/tidebreak/legends.test.mjs`** `:19-40`: brine ≥ 340, spirit ≥ 320, 9 pulses, rebirth 35%.
- **`qa/tidebreak/sim.test.mjs`**
  - `:7-8`: `SIZE` 6400
  - `:13-17`: two tower tiers
  - `:29`: ambush ×1.75
  - `:57-66`: 36 full matches, more than 4 kills, wards damaged
- **`qa/tidebreak/towers.test.mjs`** `:8, :24`: 12 towers, `[6,6]`, 6400.
- **Fixed coordinates:** 33 test lines place units at fixed points (2400, 2800, 3100, CENTER). They stay inside the bounds on a larger map, but they may land inside obstacles.
- **Browser tests:** `qa/tidebreak/desktop.e2e.mjs` and `qa/creatures/browser.mjs` check nothing about warnings, feedback or shake.

**OpenSpec:** the active change `openspec/changes/moba-combat-decisions` has three tasks still open (`tasks.md:8-10`): playtest the recovery, rendered checks, and archive. Its `verification.md` records that rendered checks were blocked. The canonical requirements that the new work must modify are `openspec/specs/moba-combat/spec.md:56-63` (arena and two tiers), `:76-81`, `:83-88` and `:90-95`.

---

## 5. Biggest gaps, in priority order

1. **Warnings are visual only.** Add a sound and a body pose at wind-up for hero casts and neutral specials. The research asks for pose, colour and sound together.
2. **Instant stun engages** (Devil leap, Golem charge) skip the telegraph system, and the leap stun lands before the leap is drawn.
3. **Hero punish windows are too short (0.22-0.34 s) and pay nothing.** Bots never use them and never interrupt. Neutral openings already give +25%, and Crimson Rouge gives 1.45×.
4. **Impact has no weight.** There is no hitstop, shake is at most 3 px and the same for every event, heroes never flash, and taking damage has no sound or warning.
5. **Intensity is flat.** About 56% of the match is spent fighting, with 8.5 s gaps. The boss comes at 26 s and a leviathan snowball can end a match at 70 s. Respawns are cheap, and late scaling applies to basic attacks only.
6. **Enemies differ only in numbers.** Wisps and all four camps have no distinct roles.
7. **Mana seldom binds,** and death costs little.
8. **No death recap.** Dead heroes vanish, and wisp-kill labels crowd the feedback channel.
9. **Crowd control stacks without limit,** and a later short stun can cut a longer one.
10. **Distances that do not scale with the map** will distort a doubled map:
    - sight 950/620 (`world.js:83`)
    - tower ranges (`sim.js:45`)
    - AI scan 850, assist 1900, rally 3200, boss rally 1600-1900 (`combat-ai.js:8, 51-52`; `team-events.js:9-10`)
    - XP radius 1200 (`sim.js:60`)
    - neutral leash 390/430 (`encounters.js:22`; `sim.js:502`)
    - wave interval 14 s, match `LIMIT` 360 s, respawn time
    - At hero speed 320, lanes now take 14-22 s to walk (minions 19-29 s). Doubling the size doubles both.

**Files:** combat code is in `/home/user/rouge-warden/public/tidebreak/` (`sim.js`, `combat-state.js`, `combat-rules.js`, `combat-feedback.js`, `combat-motion.js`, `basic-attacks.js`, `legend-rules.js`, `encounters.js`, `combat-ai.js`, `illustrated-render.js`, `audio.js`, `announcer.js`, `arena.js`, `world.js`, `objectives.js`). Docs are `/home/user/rouge-warden/docs/combat-fun-system.md` and `/home/user/rouge-warden/docs/drain-fun.md`.