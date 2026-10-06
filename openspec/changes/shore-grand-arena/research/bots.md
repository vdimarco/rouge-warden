# Shore of the Ancients bots: how hard they are, why they are easy to beat, and how to make them harder but fair

No repository files were edited. Scratch work is in `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/`:
- `pub/` is an instrumented copy of the sim. It logs damage, casts and cast warnings.
- `pub3/` is a copy where the four fixes in §7.2 can be switched on for one team.
- `telemetry.mjs`, `scenarios.mjs`, `scen2.mjs`, `ab.mjs`, `focus.mjs`, `structdmg.mjs` and `dmgshare.mjs` are the measurement scripts.

All measurements use the real rules: seeded matches, a 60 Hz step and the drafted lineups.

## 0. Summary

- **There is no difficulty setting.** A search for difficulty, level or profile finds nothing in `public/tidebreak/`. Both teams run the same `combatDecision` (`sim.js:445`, `sim.js:341-360`), which is what the spec asks for (`openspec/changes/moba-team-presence/specs/moba-combat/spec.md`: "Both teams SHALL use the same rules"). Making the enemy smarter also makes your two allies smarter, unless the setting can differ per team.
- **Fights are competent, strategy is weak.** In a fight the bots combine marks with finishers, evade cast warnings after a 0.18–0.30 s delay, kite, keep mana for an escape and last-hit well. Outside fights they are passive and easy to exploit:
  - They never gank.
  - They never take spirit camps (`combat-ai.js:8` drops team −1 units).
  - They never use rift gates (`portal()` is called only on player input, `sim.js:454`).
  - They lack the player's 1.35× sprint out of combat (`sim.js:450-451` against `sim.js:357`).
  - A bot with no wave walks along its lane into the enemy tower (`sim.js:334-340`, `sim.js:359`).
  - They dive towers without counting tower damage.
  - Their retreat uses only fixed health thresholds and never compares health with the enemy.
- **Measured effect.** I patched four of these weaknesses for one team only: wave-gated lane walking, a tower-dive guard, a trade-aware retreat and sprint parity. That team won **38 of 60** matches (63%) against the unpatched AI. It had **1.67× the kills** (446 to 267) and took 240 towers while losing 156. These are real weaknesses, and fixing them adds real challenge without new stats.
- **Most bot damage to heroes is basic attacks (76%).** Spells are 19% and items 4.5%. Spells are the readable, dodgeable threats the ten rules value, so the bots give the player little to read, dodge or punish.

---

## 1. Where the bot logic lives (one tick)

```
sim.js step()                        sim.js:398-523
 └ per hero (sim.js:426-476)
    ├ trainBot(e)                    sim.js:428 → abilities.js:32-38
    ├ nextPurchase/buy every 2 s     sim.js:429 → items.js:83-94
    ├ resolveIntent (cast resolves)  sim.js:441 → sim.js:361-370
    ├ tickHeroMechanic (travel)      sim.js:444 → legend-rules.js:77-95
    └ bot(s,e,dt)                    sim.js:445 → sim.js:341-360
        ├ combatDecision(s,e)        combat-ai.js:7-82
        ├ mode-change pings          sim.js:344-346 → team-events.js:12-19
        ├ retreat recall             sim.js:348-350
        ├ requestCast(...,{bot:true}) + thinkAt 1.1 s   sim.js:352-355 → sim.js:236-250, combat-state.js:12-19
        ├ move / attack              sim.js:357-358 (world.js:104-113, sim.js:175-191)
        └ followLane                 sim.js:359 → sim.js:334-340
```

Other inputs to the bots:
- The draft picks the lineup: `draft.js:34-55`, passed to `createMatch` through `lineup` (`sim.js:39`, `sim.js:49-51`).
- Team facts: fight pings and skirmish timers (`team-events.js:22-32`), rally (`team-events.js:64-68`) and assist targets (`team-events.js:71-78`).
- Team chat only displays text (`team-chat.js:9-44`). No bot logic reads it.

Bots path in straight lines through `move()` (`world.js:104-113`). Only player orders use the route graph (`navigation.js:35-39`, called at `sim.js:471`). Stuck time is small today (about 3 s per bot per match), but it will grow on a larger map with more cover.

---

## 2. The decision order in `combatDecision` (`combat-ai.js`)

| # | Stage | Rule | Lines |
|---|---|---|---|
| 1 | Perception | Enemies within **850** that the bot can see and has line of sight to; team −1 (camps, boss) excluded. Allied heroes within **650**, **counting the bot itself** | 8–9 |
| 2 | Spell ready | Has rank, cooldown done, mana available, and `s.time >= thinkAt` | 10 |
| 3 | Danger | Hostile damaging zones (`combat-rules.js:44`, radius + 65 margin), visible casters whose warning covers the bot (margin 35), and pending zones | 11–14 |
| 4 | Reaction delay | `at = time + .18 + ((id*17 + source*13) % 13) * .01`, so **0.18–0.30 s**, the same for each bot/caster pair. Ground that is already damaging gets an immediate escape | 16–21, 24 |
| 5 | Evade | Moves **320** units: sideways out of a cone, or away from a circle (away from the caster for targeted shapes). Always succeeds once the delay ends | 24–29 |
| 6 | Retreat | `hurt < .28`, or outnumbered and `hurt < .65`, or already retreating and `hurt < .82`. Heads home in a straight line and uses an escape spell only if an enemy hero is visible | 30–35 |
| 7 | Targets | Towers and core count only if an **allied minion** is in their range. Score = distance − 190 for heroes + hp% × 100 − 400 for a minion in last-hit range (hp ≤ damage × 1.15) − 35 for the current target | 36–39 |
| 8 | Boss fallback | Mid-lane bot only (`e.lane === 1`), `hurt > .6`, within 700 | 40 |
| 9 | Peel | Only Nessie (1) and Stone Golem (7): if an ally is below 58% within 500 and the bot is above 55%, target that ally's nearest attacker | 41–48 |
| 10 | Boss rally | `hurt > .72`, a teammate above 55% within 1600 of the boss and 1700 of the bot, bot within 1900, boss visible to the team, no enemy hero within 500, no endangered ally | 49–53 |
| 11 | Assist / rally | Only if the target is not a hero: answer a rally or an ally's skirmish (`team-events.js:71-78`) | 55–56 |
| 12 | Lane fallback | Dryad uses Bloom on an injured ally when it has no target; otherwise mode `lane` | 57 |
| 13 | Spell choice | Per-hero `choose()` rules (table below) | 58–74 |
| 14 | Engage | Escape kits [0,1,2,3,6] dash in when 330 < d < 580, bot above 65%, not outnumbered, target below 70% | 75 |
| 15 | Mana reserve | Skip a slot 1/2 cast when healthy against a healthy hero if it would leave less mana than slot 0 costs | 77 |
| 16 | Spacing | Ranged (range > 250): step back 260 when d < 0.7 × range during attack cooldown. Melee: close in when d > 0.9 × range + radius | 79–80 |

**Spell rules per kit** (`combat-ai.js:62-73`; kit index and name from `legends.js` and `abilities.js`):

| Kit | Ult (3) | Other rules |
|---|---|---|
| 0 Mothman | 2+ heroes near or hp < 45% | Omen if d < 500 and no omen; Feathers if d < 340 |
| 1 Nessie | (2+ near or hp < 50%) and d < 400 | Tail if target wet or stunned and d < 330; Pull if d < 420 |
| 2 Baba Yaga | hero, d < 240 | Mortar if snared, stunned or 2+ near (d < 490); Snare if d < 390 and no trap out; Mortar if d < 410 |
| 3 Jersey Devil | hero, d < 220 | Shriek on bleeding (d < 280); Rend if d < 290; Shriek if d < 260 |
| 4 Kraken | 2+ near | Lance on brine (d < 520); Latch if d < 430; Ink if hero d < 250 |
| 5 Wendigo | d < 350 and (2+ near or hp < 55%) | Bite if chilled or hp < 70% (d < 260); Snap if d < 290; Frost hunt as gap closer 260–650 |
| 6 Kitsune | marked, d < 300 | Bind on mark (d < 470); Flame if d < 420 |
| 7 Stone Golem | d < 410 and (stun or 2+ near) | Granite if hp < 70% or outnumbered; Faultline if d < 490; Charge 280–570 |
| 8 Banshee | d < 360 | Thread if d < 500 and none; Sorrow if d < 520 |
| 9 Phoenix | hp < 50% (rebirth) | Ray on fire-bleed (d < 600) with no own ray; Fan if d < 400 |
| 10 Dryad | d < 380 and (2+ near or ally injured) | Bloom on injured ally; Sentinel if d < 480 and none; Bramble if d < 480 |
| 11 Gorgon | poisoned, d < 350 | Molt when slowed, bleeding or hp < 65%; Gaze if d < 340 (facing not checked); Venom if d < 420 |

**How the decision is carried out** (`sim.js:341-360`):
- Mode changes post an `onmyway` ping (10 s cooldown) or a `retreat` ping (12 s cooldown) (`sim.js:345-346`).
- **Recall:** in retreat, if not hit for 3 s, a 2.5 s counter runs **while the bot keeps walking**, then it teleports home (`sim.js:349`). The player's recall cancels on movement or a hit (`sim.js:456-459`).
- **Cast lock:** after *any* cast request, even one that fails, `thinkAt = now + 1.1` blocks all slots (`sim.js:352-355`, `combat-ai.js:10`).
- **Bot windups:** **0.5 s** for normal offensive casts and **0.7 s** for ultimates. Defensive casts have none (`combat-state.js:12-14`). Player windups are 0–0.4 s (`combat-state.js:7-11`). Recovery is 0.22, 0.26 or 0.34 s (`combat-state.js:18`).
- **Aim** is the target's position when the cast starts (`combat-ai.js:58`) and stays locked (`sim.js:244-247`). There is no lead.
- **Bot speed** = speed × slow (0.52) × pursuit (1.3) (`sim.js:357`), or slow only in `followLane` (`sim.js:338`). The player's keyboard or pad movement also gets sprint 1.35, frenzy 1.25, hunt 1.2 and Nessie-in-water 1.4 (`sim.js:450-451`).
- **Lane:** `lane` is set once at spawn and never changes (`sim.js:36`; slots in `draft.js:6-9`). `followLane` always heads two track points toward the enemy base (`sim.js:337`).

**Training, items and draft:**
- Skills: the ult whenever allowed, then the priority `[0,2,1]`, or `[1,2,0]` for Nessie and Baba, unlearned first (`abilities.js:32-38`).
- Items: the fixed build `BUILDS[h.build]` (`sim.js:28`, `sim.js:36`; per-hero `build:` in `legends.js:4,9,14,19,24,29,34,39`; orders in `items.js:37-42`). Bought anywhere every 2 s (`sim.js:429`). `e.goal` (`items.js:86`) is never set for bots.
- Draft: fill a missing role (+3), match an open filter (+1), avoid a repeated kit (−10), plus random 0–2.2 (`draft.js:19-25`, `draft.js:43`). It ignores the enemy team and the player's pick.

**Team events and chat** (`team-events.js`):
- `skirmishUntil = t + 3` on hero-vs-hero damage (`:24`).
- Fight ping every 7 s (`:8`), defend alarm every 14 s (`:6`), rally lasts 12 s (`:7`).
- Rally reach 3200 needs hp > 45% (`:10`, `:73`). Assist reach 1900 needs hp ≥ 60% (`:9`, `:74-76`).
- **No bot reads `defend` pings.** Only `announcer.js:99`, `audio.js:262,292` and `illustrated-render.js:317` consume them. Yet chat says "`${lane}` ward is under attack. **I'll go.**" (`team-chat.js:21`).

---

## 3. Every difficulty knob that exists today (all hardcoded)

| Group | Constant | Value | Where |
|---|---|---|---|
| Perception | enemy scan / ally count radius | 850 / 650 | combat-ai.js:8-9 |
| | sight (town / woods / non-hero) | 950 / 620 / 500 | world.js:83 |
| Reaction | warning delay | 0.18 + 0–0.12 s | combat-ai.js:19 |
| | evade distance / zone margin / cast margin | 320 / 65 / 35 | combat-ai.js:28; combat-rules.js:44; combat-ai.js:12 |
| Retreat | hp floors | .28, outnumbered .65, keep retreating to .82 | combat-ai.js:31 |
| | recall | 3 s unhit + 2.5 s, walking allowed | sim.js:349 |
| Targeting | hero bonus, hp weight, last-hit bonus and window, current-target bonus | −190, ×100, −400, ×1.15, −35 | combat-ai.js:38 |
| | tower gate | allied *minion* in range | combat-ai.js:37 |
| Peel and support | injured / endangered | .7 within 480 / .58 within 500; only kits 1 and 7 at hp > .55 | combat-ai.js:41-45 |
| Objectives | boss fallback | lane 1, hp > .6, within 700 | combat-ai.js:40 |
| | boss rally | hp > .72; support > .55 within 1600 and 1700; within 1900; no enemy within 500 | combat-ai.js:51-52 |
| Spells | cast lock | 1.1 s | sim.js:354 |
| | bot windup | .5 / .7 s | combat-state.js:14 |
| | engage gate; mana reserve | 330–580, hp > .65, target < .7; keep slot-0 cost | combat-ai.js:75, 77 |
| | per-hero ranges and conditions | see table | combat-ai.js:62-73 |
| Spacing | kite trigger, step, approach | .7 × range, 260, .9 × range | combat-ai.js:79-80 |
| Team | assist and rally reach, health gates, rally time, skirmish window, ping cooldowns | 1900 / 3200, .6 / .45, 12 s, 3 s, 7/10/12/14 s | team-events.js:6-10, 24, 73-74; sim.js:345-346 |
| Economy | shop cadence, build | 2 s, fixed | sim.js:429; items.js:37-42 |
| Draft | randomness | 0–2.2 | draft.js:43 |
| Movement | bot speed multipliers | slow, pursuit only | sim.js:338, 357 |

These world rules also shape the challenge:
- Waves every 14 s, siege minion every third wave (`sim.js:404`, `sim.js:330`).
- Boss at 26 s, then 65 s after each kill (`sim.js:40`, `sim.js:129`).
- Respawn 5 + level s (`sim.js:119`).
- Tower: minions first (`sim.js:484`), aggro when a hero hits a hero in its range (`sim.js:98`), +22% damage per repeat hit up to 4 (`sim.js:189-190`).
- Basic attacks scale after 240 s (`sim.js:188`).
- The match ends at 360 s (`world.js:5`).

---

## 4. Measurements

**A. All six heroes on autopilot** (8 seeds, `telemetry.mjs auto`):
- Wins 4–4. Three matches went to the time limit. Lengths 162–360 s.
- Share of living time per mode: fight 48.6%, lane 23.0%, retreat 16.9%, assist 5.8%, evade 4.2%, objective 1.4%, support 0.0%.
- Time inside an enemy tower's range with no allied minion there: **5.7%**.
- 2.65 recalls per bot per match; 9.7 casts per bot per minute.
- Hero-targeted casts that dealt spell damage to a hero within 1.2 s: 51.5%.
- The Wild Hunt died 2–4 times per match.
- Hero kills of camps: 4 in 8 matches, all incidental, from area spells (`hostile()` allows heroes to hit camps, `sim.js:143`).

**B. Idle player** (8 seeds): the enemy won **8 of 8** in **203–287 s**. The idle player died only 1–3 times.

**C. Micro-scenarios** (`scenarios.mjs`, `scen2.mjs`):
- **Tower dive:** a player at 45% health stands under their own outer tower.
  - Jersey Devil dove, took 5 tower hits, killed the player and died.
  - Wendigo took 6 hits and dropped from 1910 to 337 health while killing the player.
  - Mothman took 4 hits.
- **Bot alone in its lane:** Devil, Banshee and Mothman each walked to **within 5 units** of our outer tower and stayed in range 3.9–4.4 s, taking 2400–3000 tower damage. Banshee died. The others retreated, recalled and **walked back to repeat**, about every 25 s.
- **Bad trades:**
  - A Wendigo bot at 40% fought a full-health Devil down to 22% before leaving; the player was still at 73%.
  - A Mothman bot at 40% fought to 25%.
  - A bot at 30% against a full-health enemy that never attacked stayed in `fight` for 7.5 s.
  - Cause: 1v1 can never count as outnumbered, because `allies` includes the bot itself (`combat-ai.js:9`).
- **Strafing against bot spells** (30 s, direction flips every 0.9 s): spell damage fell 25% (Kraken), 51% (Golem) and 60% (Phoenix). It did not fall against Gorgon, whose venom bolt homes. Basic attacks still did 3.0–3.8k in every case.
- **Player casts against bots:** Kraken Brine lance (0.40 s windup) hit 20 of 20; Golem Faultline (0.34 s) hit 20 of 20. The bot reacts after 0.18–0.30 s and cannot leave a narrow line in the time left.

**D. Teamwork** (`focus.mjs`): when two or more bots of one team are hitting heroes, they share a target only **33.4%** of the time.

**E. Damage shares** (`dmgshare.mjs`, `structdmg.mjs`):
- Hero-on-hero damage: basic attacks 76.2%, spells 19.2%, items 4.5%.
- Structure damage: heroes 62%, Wild Hunt 19%, minions 19%.

**F. A/B test** (`ab.mjs`, `pub3/`): four changes for one team, sides swapped on every seed.

| Changes | Matches | Patched team win rate | Kills (patched – other) | Towers (taken / lost) |
|---|---|---|---|---|
| none | 20 | 0.50 | 126–126 | 66/66 |
| sprint parity | 20 | 0.50 | 115–141 | 67/54 |
| wave-gated lane walking | 20 | 0.55 | 128–101 | 60/63 |
| trade-aware retreat | 20 | 0.45 | 160–129 | 67/75 |
| tower-dive guard | 20 | 0.45 | 154–123 | 56/77 |
| **all four** | **60** | **0.63** | **446–267** | **240/156** |

Each single change is within noise. Twenty matches give a standard error of about 0.11. The combined result is about two standard errors above even. Caveat: in every run, both teams also got the frenzy and hunt speed multipliers.

---

## 5. How hard they are, and what makes them easy

**Overall:** about "Normal" in a fight and "Easy" in strategy. A new player gets real pressure from basic attacks and some combos. A competent player can farm the bots' mistakes. The weaknesses, worst first:

1. **Walking into towers with no wave** (`sim.js:334-340`, `sim.js:359`; the gate at `combat-ai.js:37` covers attacking, not walking). Free tower damage, then a 20–25 s absence from lane every cycle.
2. **Tower dives with no tower check.** Hero targets are never filtered by tower cover (`combat-ai.js:37-39`). The bot pulls aggro (`sim.js:98`) and eats the damage ramp (`sim.js:189-190`). Baiting under your tower is a reliable trade.
3. **Trades judged by fixed thresholds only** (`combat-ai.js:30-31`). 1v1 never counts as outnumbered; enemy health, the tower, mana and cooldowns are ignored.
4. **Camps belong to the player alone** (`combat-ai.js:8`). Each camp gives 110 embers, 90 xp, 430 healing and 18 s of 1.2× speed (`sim.js:135-136`).
5. **Slower movement and no gates.** No sprint, frenzy, hunt or water speed (`sim.js:357` against `sim.js:451`), and no rift gates (`sim.js:454` only). The player wins every chase and escape and every race to rotate.
6. **No ganks, and assists rarely cross lanes.** Assist reach is 1900 (`team-events.js:9`), but the gap between lanes mid-map is about 2250 (computed from `world.js:9-13`), so help across lanes comes only near the bases. Lanes are fixed forever (`sim.js:36`).
7. **No objective plan beyond the boss rally.**
   - Defend alarms are ignored, while chat promises help (`team-chat.js:21`).
   - The Wild Hunt does not count as a tower escort (`combat-ai.js:37` checks `kind==='minion'`).
   - No grouping before the boss timer (`s.objectiveAt`, `sim.js:405`).
   - No pushing when enemies are dead.
8. **Skillshots are easy to dodge.** Aim is the target's current position (`combat-ai.js:58`), the windup is 0.5 s (`combat-state.js:14`), and placed spells add arming delays (0.45–0.7 s, `legend-rules.js:47,66`; `sim.js:285,290`). Dryad and Baba land about 30% of hero-targeted casts.
9. **No focus fire and almost no peel.** 33% shared targets. Only kits 1 and 7 protect allies (`combat-ai.js:45`).
10. **Bots never interrupt.** No bot uses its stun or silence on a cast warning, although the rules support it (`sim.js:363`). Banshee's Sorrow bolt and Golem's Faultline exist for exactly this. Gorgon's Gaze ignores facing.
11. **Escape gaps.** Kraken (Ink veil), Wendigo (Frost hunt is a perfect escape), Golem (Charge) and Dryad (Bloom on self) have no retreat spell (`combat-ai.js:33`). That line also repeats `e.hero===9&&ready(3)?3`, which is dead code.
12. **1.1 s lock even after a failed cast request** (`sim.js:352-355`). An escape cannot fire right after a fizzled offensive request.
13. **Static builds and draft** (`items.js:37-42`, `draft.js:19-25`). No anti-heal against Dryad, Phoenix or Banshee, and no counter-picks.

The bots never cheat. Targeting checks `canSee` and line of sight, and the boss rally uses team vision (`combat-ai.js:8,52`). Every fix below keeps that.

---

## 6. Bot behaviour against the ten rules (0 = absent, 1 = weak, 2 = strong; `docs/combat-fun-system.md:5-20`)

| Rule | Score | Evidence |
|---|---|---|
| 2 Readable threat | 2 | Bot casts show a 0.5/0.7 s labelled shape (`combat-state.js:14`; `illustrated-render.js:153-157`). The tower ring turns red when it targets you (`illustrated-render.js:205`) |
| 3 Real counterplay | 2 (player side) / 0 (bot side) | You can dodge and interrupt (`sim.js:361-363`). Bots never interrupt you, so they never demonstrate the answer |
| 4 Punish window | 1 | Cast recovery is 0.22–0.34 s (`combat-state.js:18`). Bot recall cannot be punished: it walks and has no visible channel (`sim.js:349`) |
| 6 Target priority | 1 | Mostly distance (`combat-ai.js:38`). There is no reason to protect your healer, because bots don't hunt healers |
| 7 Resource tension | 1 | Bots keep mana for an escape (`combat-ai.js:77`) but never recall for mana or weigh cooldowns before engaging |
| 8 Pressure rhythm | 1 | Fight is 49% of living time. Bots trickle into fights with no group peak and reset |
| 9 Skill expression | 1 | Dodging cuts spell damage 25–60%, but spells are only 19% of bot damage. The exploits reward knowledge over execution |
| 10 Understandable failure | 1 | "I'll go" with no action behind it (`team-chat.js:21`). No "missing" calls, because there are no rotations to call |

---

## 7. Proposals for more challenge that stays fair

**Guard rails for every proposal:**
- Same rules and stats for all six heroes; difficulty changes decision quality only.
- No hidden information: only `canSee`, `visibleTo` and team pings.
- Every new behaviour has a tell: ping, chat line, minimap mark or ring.
- Bot windups never below 0.45 s. The research says a player needs more than 0.3 s to see a warning and press (`docs/drain-fun.md:31`).
- Deterministic randomness. Hash `(s.seed, bot id, event key)` the same way `combat-ai.js:19` does, and never draw from `s.random`, or seeded replays break (`sim.test.mjs:66`; `createMatch` draws at `sim.js:51`).

### 7.1 Difficulty profiles, set per team

Add a `BOT_PROFILES` table, for example in a new `bot-profiles.js`. `createMatch(kind, seed, lineup, {enemy:'hard', ally:'normal'})` stores `s.botProfile = [allyProfile, enemyProfile]`, and `combatDecision` reads `P = s.botProfile[e.team]` instead of the literals listed in §3.

| Knob | Today | Easy | Normal | Hard |
|---|---|---|---|---|
| Warning reaction | .18–.30 | .40–.60 | .28–.42 | .20–.30 |
| Dodge succeeds after reacting | always | 50% | 75% | 90% (the miss is a short or wrong-side step) |
| Bot windup (normal / ult) | .5 / .7 | .65 / .9 | .55 / .75 | .45 / .65 |
| Aim lead (velocity × windup) | 0 | 0 | 50% ± 40 u | 85% ± 20 u |
| Cast lock | 1.1 s, even on failure | 1.6 | 1.1, success only | 0.8, success only |
| Interrupt enemy ults (silence or stun) | never | never | 40% after reaction | 80% after reaction |
| Team focus | none | none | soft (+150 to score) | firm (+300; switch only for a kill in reach) |
| Retreat | fixed hp only | hp < .35 | hp < .30 or trade margin .25 | hp < .25 or margin .20 or tower check |
| Tower dive | always | only with escort | only with escort | escort or kill check |
| Ganks | none | none | 1 per 90 s, next lane | 1 per 50 s, any lane, uses gates |
| Objectives | opportunistic | react when visible | gather 5 s before spawn | gather 12 s before, contest, push with the Wild Hunt |
| Camps | never | never | when the wave is safe | on the 32 s respawn |
| Gates and sprint | none | sprint parity | parity + gates | parity + gates |
| Items / draft | fixed | fixed | fixed | counter items via `e.goal`; counter-picks |

- Your allies stay on Normal, or one step below the enemy, so a harder setting means harder opponents.
- Show the setting: on the draft board ("Enemy: Ancient") and on the result screen.
- Optional adaptive mode, the DDA idea in `docs/drain-fun.md:27`: move one step after two losses or two wins, using the record already saved at `main.js:231`, and say so on screen.

### 7.2 Fixes for every difficulty (the four tested ones first)

1. **Wave-gated lane walking.** In `bot()` at `sim.js:359`, stop about 120 units outside an enemy tower's range when no allied minion, Wild Hunt or summon is inside it. Tested in `pub3/tidebreak/sim.js`.
2. **Tower-dive guard.** In `combat-ai.js:37`, drop hero targets standing under an untanked enemy tower unless the target is below 20%. A Hard kill check: estimated time to kill < 2 tower shots and own health > 55%. Abort when `ward.towerTarget === e.id` and own health < 60%. This is readable, because the red ring already shows tower focus (`illustrated-render.js:205`).
3. **Trade-aware retreat.** Leave when own health < 50% and the enemy's is at least 25 points higher. Better: compare (health × damage) of each side within 900, counting towers.
4. **Speed parity.** Use the player's sprint, frenzy, hunt and water multipliers (`sim.js:451`) in `bot()` (`sim.js:357`) and `followLane` (`sim.js:338`).
5. **Recall parity.** Bots must stand still to recall, cancel on a hit, and show the channel. This turns the recall into a punish window (rule 4) instead of a free walking teleport (`sim.js:349`).
6. **Count every allied pusher as an escort**: Wild Hunt and summons, not only `kind==='minion'` (`combat-ai.js:37`).
7. **Escape spells for the missing kits** in `combat-ai.js:33`: Kraken 0, Wendigo 0, Golem 0 (charge toward home), Dryad 2 (Bloom on self). Remove the duplicate Phoenix clause.
8. **Defend alarms that bots act on.** The nearest healthy bot within reach answers a `defend` ping (`team-events.js:34-39`), favouring inner and base towers, so `team-chat.js:21` tells the truth (rule 10).
9. **Rift gates.** Use `PORTALS` (`world.js:38`) when the gate route saves more than 3 s, honouring `portalCd` and the existing gate visuals.

### 7.3 Focus fire

Add `teamFocus(s, team)` in `team-events.js`. It picks the visible enemy hero with the least effective health relative to the damage nearby allies can deal, weighted for role (support or carry). It changes only every 2–3 s, writes `s.focus[team]`, and posts a `focus` ping.
- Allied bots: chat "Focus Kraken!" and a minimap marker.
- Readable threat: when the enemy team focuses *you*, show a small "Hunted" mark over your hero. Peel and escape then become real choices (rules 2 and 6).

### 7.4 Ganks and rotations, with a tell

- **Trigger:**
  - Target: an enemy hero visible to the team, past its outer tower, health < 70% or escape on cooldown.
  - Ganker: a bot whose wave is near its own tower, with no enemy hero nearby, and an estimated arrival under 12 s (gates allowed).
  - One gank per team at a time; per-profile cooldown.
- **Tell:** the ganker leaves its lane. The minimap's last-seen mark already exists. On Easy and Normal, allied bots say "Kraken missing from East" after about 6 s.
- **Route** through brush when possible (`world.js:62-66`), so the ambush rules reward the player's vision play.

### 7.5 Objective timing and pressure rhythm (rule 8)

- **Before the Wild Hunt** (`s.objectiveAt`, `sim.js:405`): healthy bots with safe waves drift to mid 5 s (Normal) or 12 s (Hard) before spawn and post a rally ping, using the same `callRally` (`team-events.js:64-68`).
- **Contest:** when the boss is visible and its health is falling while enemies stand near it, go there.
- **Push after a boss kill:** escort the Wild Hunt in its lane and hit towers it tanks.
- **Push window:** when two or more enemies have `respawn > 8`, group and push the nearest exposed tower. Respawn timers show to players too, so this is fair.
- **Reset:** after a fight with deaths, Hard bots recall or farm for about 15 s instead of trickling back in. This creates pressure, peak and recovery.

### 7.6 Skill dodging and aiming at human speed

- **Reaction:** drawn per warning from the profile range by seeded hash, plus 0.1 s if the bot is in a basic-attack windup ("busy hands").
- **Dodge:** success per profile. A failed dodge steps too short or to the wrong side, so a careless bot is still punishable.
- **Evade target:** never step into an untanked enemy tower's range.
- **Aim lead:** track each unit's previous position (bots keep it on their entity). `aim = target + velocity × windup × lead + error`, with the error from a seeded hash.
- **Interrupts:** when a visible enemy has `castIntent.slot === 3` within range, after the reaction delay use Sorrow bolt (8), Faultline or Charge (7), Tail on wet targets (1), Cold snap on chilled (5), Leap (3) or Gaze when the target faces the bot (11). The player then sees the counterplay the rules allow (rule 3).
- **More spell share:** on Hard, bots should cast more of their combos, lifting spells above 30% of their damage, so more of the challenge is readable and dodgeable (rule 9).

### 7.7 Builds and draft (Hard only)

- **Items:** at match start, set `e.goal` (`items.js:86`), for example Pale reaper against Dryad, Phoenix, Banshee or Nessie, and Mirror cloak against burst kits.
- **Draft:** the enemy scores counters to the player's kit in `draft.js:19-25`. Keep the 2.2 randomness so drafts still vary.

---

## 8. What a doubled map and three tower tiers mean for the bots

- **The map is 6400 units now, not 4800.** See `arena.js:2`, `openspec/specs/moba-combat/spec.md:57` ("6400 units square"), and `sim.test.mjs:7`, which asserts 6400. Doubling means 12800, and `MAP_SCALE` becomes 2.67 against the 4800 authoring grid (`arena.js:3`).
- **Constants in absolute units that must scale** (with `SIZE/6400` or `MAP_SCALE`):
  - Assist and rally reach 1900 / 3200 (`team-events.js:9-10`).
  - Boss distances 700 / 1600 / 1700 / 1900 (`combat-ai.js:40,51-52`).
  - Experience sharing radius 1200 (`sim.js:60`).
  - Keep these tied to sight, not map size: perception 850, ally count 650 (`combat-ai.js:8-9`), evade 320 and kite 260.
- **Travel:** lanes are now 7019 / 4619 / 6953 long (computed from `world.js:27`), roughly 15–23 s of walking at bot speed. Doubled, that is about 30–46 s. Respawns return to base (`sim.js:432`). Without speed parity, gates and recall parity (§7.2 items 4, 5, 9), assists and defends will arrive too late. The 360 s limit (`world.js:5`) also needs revisiting.
- **Pathing:** bots move in straight lines (`world.js:104-113`). A larger map with more cover needs bots to use `route()` (`navigation.js:22-34`) the way player orders do (`sim.js:471`).
- **Code that assumes two tiers:**
  - `laneOpen` requires `towers.length === 2` (`objectives.js:5`); `structureProtected` checks `tier === 1` against `tier === 0` (`objectives.js:9`). Generalise to "the next lower tier is down".
  - Two positions per lane (`world.js:33-37`); `s.towers: [6,6]` (`sim.js:40`); "/6" (`objectives.js:18`); tower loop and names (`sim.js:43-45`); kill text (`sim.js:126`).
  - Alarm wording `tier ? 'inner' : 'outer'` (`announcer.js:32`); `lockTip` text (`sim.js:73`).
  - Bot spawn at the outer tower `[0]` (`sim.js:35`).
  - The tower gate and lane gate already work per structure, but defend priority should weight higher tiers.

---

## 9. Tests that encode bot behaviour today (update alongside any change)

- `qa/tidebreak/encounters.test.mjs:65-72, 78-87`: the 0.18–0.30 s reaction window is hardcoded (`:66`, `:79`). These need profile-aware bounds.
- `qa/tidebreak/encounters.test.mjs:89-97` (both teams gather for the objective, wounded retreat, solo bot stays in lane) and `:98-105` (front-line peel).
- `qa/tidebreak/tactical-combat.test.mjs:41-42` (bot shows a warning, interrupt costs nothing, `thinkAt` reset, locked aim can be dodged) and `:45` (Kraken lance follow-up, evade, retreat at 20%).
- `qa/tidebreak/combat-decisions.test.mjs:49-56` (`{bot:true}` targeted windups keep their target).
- `qa/tidebreak/team-presence.test.mjs:71-89` (assist, rally, rally expiry, enemy team uses the same rule) and `:91-100` (full bot matches produce `onmyway` and fight pings).
- `qa/tidebreak/sim.test.mjs:57-66`: 36 full autopilot matches (winner, more than 4 kills, a tower damaged, under 150 units) and a deterministic replay.
- The browser tests (`desktop.e2e.mjs`, `qa/creatures/browser.mjs`) do not touch bot logic.

**New Node checks**, mirroring §4:
- A bot alone in its lane spends ≤ 0.5 s in untanked tower range.
- A bot at 40% retreats within 1.5 s from a full-health enemy.
- A bot does not dive a 45% player under a tower unless the kill check passes.
- Each profile keeps narrow skillshots dodgeable: a strafing player avoids at least 40% of their damage at a 0.45 s windup.
- A/B targets on the `ab.mjs` method, seeded and with sides swapped:
  - Normal against Normal ≈ 50%.
  - Hard against today's AI ≥ 65%. The four fixes alone already reach 63%.
  - Easy against today's AI ≤ 40%.
  - Hard beats an idle player faster than 250 s.

**Specs to update:**
- `openspec/specs/moba-combat/spec.md:76-81` (Tactical combat decisions).
- The "Teammates answer fights and calls" requirement in `openspec/changes/moba-team-presence/`.
- The "bounded reaction delay" scenario in `openspec/changes/moba-combat-decisions/`.

All bot measurements here come from the deterministic sim. A playtest is still needed to judge readability and fun, as `docs/drain-fun.md:123` says.