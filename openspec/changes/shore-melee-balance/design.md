# Design: melee heroes close the gap

## Melee and ranged kits
The attack type comes from the listed reach in `sim.js`. A reach above 250 is ranged. Ranged reach is then multiplied by 1.5 (`RANGED_REACH`).

| Type | Kits (index, reach) |
| --- | --- |
| Melee (7) | Mothman (0, 150), Nessie (1, 155), Jersey Devil (3, 140), Wendigo (5, 145), Stone Golem (7, 155), Irontide (12, 160), Bloodwake (13, 150) |
| Ranged (9) | Baba Yaga (2, 540), Kraken (4, 450), Kitsune (6, 435), Banshee (8, 585), Phoenix (9, 495), Dryad (10, 525), Gorgon (11, 480), Zephyrs (14, 450), Coral Sage (15, 540) |

## How we measured
- **Kit strength:** `qa/tidebreak/kit-strength.mjs` logic, 480 matches, Veteran bots on both teams, seeds 1 to 480. Each match uses six random distinct kits. A kit's win rate is the share of its matches that its team won. The "melee" and "ranged" rates are the averages over all melee or all ranged appearances.
- **Same seeds:** the before run used the code at the parent commit. The after run used the final code. Both runs used the same seeds, so both runs used the same kit lineups.
- **Harness:** the runs used a copy of the kit-strength loop that also writes each match row. On seeds 1 to 8, it gives the same result as `kit-strength.mjs`.
- **Noise:** each kit played 160 to 198 matches. One standard error of a kit's rate is about 3.7 points.
- **Duel:** a scratch script put one melee bot against one ranged bot on open ground. Both had equal level, equal gold, and the same Veteran profile without retreat. It ran every melee and ranged pair, on both teams, at levels 1, 6 and 11 (378 duels).
- **Match statistics:** a scratch script logged damage by source type, deaths and bot modes for 12 matches (seeds 1 to 12).

## Why melee kits lost
- **Poke on the way in:** a melee hero took about 19,600 damage per match from ranged basic attacks. Melee basic attacks did about 8,500 per match to a ranged hero. Melee heroes also took more damage from wisps (5,000 against 3,700), because they stand in the wave.
- **More deaths:** a melee hero died 5.5 times per match and was dead 12.6% of the time. A ranged hero died 3.8 times and was dead 8.8% of the time. Melee heroes also finished fewer wisps (50 against 61).
- **Kiting:** a ranged bot steps back 260 units when its target is inside 70% of its reach and its attack is on cooldown. With the longer reach, it starts to step back at 305 to 410 units. In duels, a melee bot was inside its own reach for only 44% of the fight.
- **Not raw stats:** in duels with basic attacks only, melee heroes won 82%. Melee heroes have more health and more damage per hit. With spells, melee won 73% at level 1, 44% at level 6 and 34% at level 11.
- **Not bot retreat:** melee and ranged bots spent a similar share of time in fight mode (30% and 35%) and in retreat (11% and 9%).

## Decision
When a ranged hero's basic attack hits a melee hero:
- **Shot guard:** the hit deals 25% less damage (`MELEE.shotGuard`). The reduction applies after armor and before shields.
- **Closing speed:** the melee hero moves 15% faster for 1.5 seconds (`MELEE.closeSpeed`, `MELEE.closeTime`). Each new shot restarts the 1.5 seconds. The speed stacks with other speed effects in `heroSpeed`, like every other haste.

The rule is in `damage()` and `heroSpeed()` in `sim.js`. It checks only the attack type of the source and the target. The player and all bots use these functions, so both teams get the same rule. The rule uses no random numbers, so seeded matches stay deterministic.

### Why these two rules
- They answer the measured cause: damage taken on the way in, and a target that walks away.
- A player feels both rules. The damage numbers are smaller, and the hero speeds up toward the shooter.
- They do not change spells, items, wisps, wards, reach or bot decisions.

### Options we tried
All options ran on seeds 1 to 160. The baseline on these seeds was melee 44.3%, ranged 54.4%.

| Option | Melee | Ranged | Gap |
| --- | --- | --- | --- |
| 25% shot guard, 10% melee life steal | 46.2% | 52.9% | 6.7 |
| 40% shot guard, 15% melee life steal | 47.6% | 51.9% | 4.3 |
| 30% shot guard, 12% life steal, 20% closing speed | 53.3% | 47.4% | -5.9 |
| 25% shot guard, 10% life steal, 10% closing speed | 49.8% | 50.2% | 0.4 |
| **25% shot guard, 15% closing speed (chosen)** | **51.4%** | **48.9%** | **-2.5** |

Closing speed had the largest effect. Life steal had a small effect. The chosen option uses two rules instead of three, and the 480-match run put it at parity.

## Results (480 matches, seeds 1 to 480)

| | Before | After |
| --- | --- | --- |
| Melee kits | 44.5% | 50.0% |
| Ranged kits | 54.1% | 50.0% |
| Gap | 9.6 points | 0.0 points |
| Spread of kit rates (standard deviation) | 12.7 points | 11.6 points |
| Kits outside 42% to 58% | 8 | 9 |

| Kit | Type | Before | After |
| --- | --- | --- | --- |
| Mothman | Melee | 48.9% | 50.0% |
| Nessie | Melee | 55.9% | 61.2% |
| Jersey Devil | Melee | 58.2% | 67.4% |
| Wendigo | Melee | 48.7% | 57.6% |
| Stone Golem | Melee | 30.6% | 34.4% |
| Irontide | Melee | 21.9% | 27.8% |
| Bloodwake | Melee | 44.5% | 48.4% |
| Baba Yaga | Ranged | 48.3% | 38.9% |
| Kraken | Ranged | 53.0% | 52.5% |
| Kitsune | Ranged | 65.4% | 59.5% |
| Banshee | Ranged | 39.9% | 37.1% |
| Phoenix | Ranged | 54.5% | 52.5% |
| Dryad | Ranged | 50.3% | 49.1% |
| Gorgon | Ranged | 61.0% | 52.7% |
| Zephyrs | Ranged | 76.0% | 70.2% |
| Coral Sage | Ranged | 40.0% | 38.4% |

Match statistics after the change (12 matches): a melee hero died 3.9 times per match (before 5.5) and took about 13,800 damage per match from ranged basic attacks (before 19,600).

Duels after the change: melee won 63.5% (before 50.3%). By level: 89% at level 1, 54% at level 6, 48% at level 11. A melee bot was inside its reach for 50% of the fight (before 44%). A duel has no wave and no team, so it does not predict match win rates.

## Kits still outside the target band
The melee and ranged averages now match. Single kits do not. Zephyrs (70%) and Jersey Devil (67%) are too strong. Irontide (28%), Stone Golem (34%), Banshee (37%), Coral Sage (38%) and Baba Yaga (39%) are too weak. Nessie (61%) and Kitsune (60%) are a little high. A rule for all melee or all ranged heroes cannot fix these kits. Each one needs its own change, and each change needs a new 480-match run. That work is not in this change.

## Bot drafting
`KIT_POWER` in `bot-difficulty.js` holds the new lane values from the after run. Only the Mythic profile uses it to draft. Veteran bots, which the measurements use, do not.

## Risks
- **Closing speed also helps escape.** A melee hero that runs away from a ranged hero also moves faster. This is accepted: it also reduces the number of melee deaths.
- **No visual cue for the speed.** The HUD files belong to another person at this time, so this change adds no icon or text. The smaller damage numbers show the guard.
