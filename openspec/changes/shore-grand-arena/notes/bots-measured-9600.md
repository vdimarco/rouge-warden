# Bot strength on the 9600-unit map

Measured on main at d0c7a2b (the grand arena with the bots merged, including the move guard), before vdimarco/rouge-warden#229 turned
spirit camps off, removed the siege without a wave and added Mythic drafting. The final drafted measurements after #229 are in
`notes/bots.md` (Mythic 67% against Veteran and 68% against the old bots, Veteran 52%, Apprentice 35%). Measured with
`node qa/tidebreak/bot-ab.mjs <A> <B> 30 1 3`: 30 seeds, sides swapped on every seed, 60 matches per row, 20 Hz steps, up to the 17:00
limit. Wards taken count from the start count of 9 per team (guardians are not counted).

| A against B | A wins | Seeds A won both / B won both / split | Kills A–B | Wards A / B | Dive deaths A / B | Spell share A / B | Wild Hunts A / B | Minutes |
|---|---|---|---|---|---|---|---|---|
| Veteran vs old | 38% | 3 / 10 / 17 | 14.8 – 10.7 | 4.45 / 5.68 | 0.43 / 2.28 | 34.0% / 29.9% | 2.83 / 0.98 | 12.4 |
| Mythic vs old | 33% | 1 / 11 / 18 | 17.7 – 7.2 | 5.32 / 5.70 | 0.27 / 3.30 | 34.7% / 29.6% | 3.38 / 0.95 | 13.2 |
| Apprentice vs old | 30% | 1 / 13 / 16 | 9.3 – 15.1 | 4.63 / 6.05 | 0.70 / 1.85 | 27.8% / 28.3% | 1.68 / 1.67 | 11.9 |
| Mythic vs Veteran | 48% | 4 / 5 / 21 | 15.0 – 10.4 | 5.20 / 5.37 | 0.28 / 0.88 | 37.8% / 36.2% | 2.23 / 2.35 | 13.7 |
| Old vs old | 50% | 0 / 0 / 30 | 13.3 – 13.3 | 5.48 / 5.48 | 2.17 / 2.17 | 27.9% / 27.9% | 1.63 / 1.63 | 12.0 |

"Old" is the `legacy` profile. On this map it already has the map work's bot rules: it walks with its wave, stays out of untanked ward range
in lane mode, and joins a push on an open lane.

## What the numbers say
- Veteran and Mythic win fights clearly (more kills, more Wild Hunts, a much lower dive-death rate) and use spells more.
- They still lose most matches against the old bots. In the seeds that the bots decide (not split), the old bots won both games 10 times
  against Veteran's 3, and 11 times against Mythic's 1. The old bots deal more hero damage to wards (about 43k against 33k per match for
  Mythic). Wards fall only with a wave (heroes deal 25% without one) and the rift heals while no wisp is at it, so kills turn into wins only
  through waves.
- Apprentice is gentler, as intended.
- Mythic and Veteran are even against each other.
- The bot session measured Veteran at 50% and Mythic at 40% before the move guard. The guard made both more careful at wards.

The 80% and 82% in the first table of `bots.md` came from the 6400-unit map with the 6-minute limit and do not hold here.

## Next step
Retune Veteran and Mythic so they siege with their wave after a won fight, then measure again. The bot review findings (in the PR that
carries this note) come first, because a bot that freezes beside a ward also loses wards.
