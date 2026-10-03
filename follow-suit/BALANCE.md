# Balance

## Result

A player with no charms and no redraws, who always plays the best chain, clears stop 1 on 91.7% of 1,000 seeds and stop 2 on 48.9%. The brief asks for at least 90% and about half.

Final values in `src/config.ts`:

- Base targets for stops 1 to 8: 150, 300, 750, 1,875, 4,500, 10,500, 22,500 and 45,000.
- Host scales: The Purist 0.18, The Zebra 0.12, The Climber 0.19, The Miser 0.48 and The Jeweler 0.23.

| Stop | Base | Table 1 | Table 2 | The Purist | The Zebra | The Climber | The Miser | The Jeweler |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 150 | 150 | 225 | 54 | 36 | 57 | 144 | 69 |
| 2 | 300 | 300 | 450 | 108 | 72 | 114 | 288 | 138 |
| 3 | 750 | 750 | 1,125 | 270 | 180 | 285 | 720 | 345 |
| 4 | 1,875 | 1,875 | 2,813 | 675 | 450 | 713 | 1,800 | 863 |
| 5 | 4,500 | 4,500 | 6,750 | 1,620 | 1,080 | 1,710 | 4,320 | 2,070 |
| 6 | 10,500 | 10,500 | 15,750 | 3,780 | 2,520 | 3,990 | 10,080 | 4,830 |
| 7 | 22,500 | 22,500 | 33,750 | 8,100 | 5,400 | 8,550 | 21,600 | 10,350 |
| 8 | 45,000 | 45,000 | 67,500 | 16,200 | 10,800 | 17,100 | 43,200 | 20,700 |

The second table is 1.5 times the base. The host table is 2 times the base times the host scale. Targets are rounded to whole numbers.

## How the simulator plays

`npm run simulate` runs `scripts/simulate.ts` on seeds SIM0001 to SIM1000. For each hand it finds the best legal chain by depth-first search (`src/engine/solver.ts`) and plays it. It uses no charms and no redraws. After each clear it opens the shop and leaves at once, so later deals match a real run with the same seed. The report counts the seeds that clear each table in stops 1 to 3.

The same seed always gives the same report. The run takes about 6 seconds.

## The starting targets

With the brief's starting values (base 150, 400 and 1,000, every host scale 1), only 26.3% of seeds clear stop 1 and 0.3% clear stop 2. The host tables stop most runs:

| Host | Stop 1 host tables cleared | Stop 2 host tables cleared | Stop 3 host tables cleared | All host tables cleared |
| --- | --- | --- | --- | --- |
| The Purist | 0.0% of 205 | 0.0% of 35 | - of 0 | 0.0% of 240 |
| The Zebra | 8.5% of 188 | 0.0% of 25 | - of 0 | 7.5% of 213 |
| The Climber | 0.0% of 210 | 0.0% of 30 | - of 0 | 0.0% of 240 |
| The Miser | 75.3% of 182 | 0.0% of 15 | - of 0 | 69.5% of 197 |
| The Jeweler | 57.3% of 192 | 14.3% of 21 | - of 0 | 53.1% of 213 |

## What the hosts do to scores

`npm run simulate -- --calibrate` deals one table of each kind for every seed, plays all 3 chains with no target and reports the 3-chain totals. A table clears when its target is at most this total, so the low percentiles show what a high clear rate needs.

| Table | 5th | 10th | 25th | 50th | 75th | 90th percentile |
| --- | --- | --- | --- | --- | --- | --- |
| No host | 264 | 346 | 468 | 633 | 829 | 1024 |
| The Purist | 72 | 85 | 107 | 140 | 168 | 198 |
| The Zebra | 31 | 42 | 74 | 118 | 180 | 354 |
| The Climber | 74 | 92 | 115 | 153 | 182 | 208 |
| The Miser | 184 | 218 | 288 | 377 | 500 | 631 |
| The Jeweler | 0 | 0 | 140 | 390 | 642 | 862 |

- The Purist and The Climber allow only single-suit or rising chains. Their medians are 140 and 153, under a quarter of the 633 at a table with no host, and their 90th percentiles stay near 200.
- The Zebra allows only rank follows that change color, and 8s. Its median is 118, but a hand rich in one rank reaches 354 at the 90th percentile, so its spread is the widest.
- The Jeweler scores 0 on about 1 seed in 9, because no ring forms in 3 chains without redraws. No target can fix that.

## How the targets were tuned

1. Stop 1 keeps the base of 150. Its first two tables clear 99.8% and 97.9% of the time.
2. Each host scale puts that host's table at stop 2 near the 25th percentile of its 3-chain totals. Each host table at stop 2 then clears about 3 times in 4, whichever host the seed draws. At stop 1 the same scales give targets half as high, so the host tables there clear 92 to 100% of the time, except The Jeweler near 80% because of its 0-score seeds.
3. A stop 2 base of 300 brings the share of seeds that clear stop 2 to about half.
4. Stops 3 to 8 keep the shape of the brief's curve from stop 2 on, scaled by the same 0.75 that took stop 2 from 400 to 300.

## Final report

Seeds: 1000 (SIM0001 to SIM1000). No charms, no redraws, the best chain for each hand. 6.1 s.

Base targets for stops 1 to 3: 150, 300, 750.
Host scales: The Purist 0.18, The Zebra 0.12, The Climber 0.19, The Miser 0.48, The Jeweler 0.23.

| Table | Target | Reached | Cleared, share of all seeds | Cleared, share of seeds that reached it | Median best chain |
| --- | --- | --- | --- | --- | --- |
| Stop 1, table 1 | 150 | 100.0% | 99.8% | 99.8% | 270 |
| Stop 1, table 2 | 225 | 99.8% | 97.7% | 97.9% | 282 |
| Stop 1, host table | 36 to 144 | 97.7% | 91.7% | 93.9% | 72 |
| Stop 2, table 1 | 300 | 91.7% | 85.4% | 93.1% | 312 |
| Stop 2, table 2 | 450 | 85.4% | 66.2% | 77.5% | 336 |
| Stop 2, host table | 72 to 288 | 66.2% | 48.9% | 73.9% | 78 |
| Stop 3, table 1 | 750 | 48.9% | 17.2% | 35.2% | 342 |
| Stop 3, table 2 | 1125 | 17.2% | 0.7% | 4.1% | 352 |
| Stop 3, host table | 180 to 720 | 0.7% | 0.1% | 14.3% | 192 |

| Stop | Seeds that clear the whole stop |
| --- | --- |
| Stop 1 | 91.7% |
| Stop 2 | 48.9% |
| Stop 3 | 0.1% |

Clears with a power-of-ten bonus: 5 of 5077, 5 of them at host tables.

| Host | Stop 1 host tables cleared | Stop 2 host tables cleared | Stop 3 host tables cleared | All host tables cleared |
| --- | --- | --- | --- | --- |
| The Purist | 99.5% of 205 | 75.9% of 133 | 0.0% of 1 | 90.0% of 339 |
| The Zebra | 92.6% of 188 | 71.5% of 130 | 0.0% of 1 | 83.7% of 319 |
| The Climber | 99.5% of 210 | 79.0% of 119 | - of 0 | 92.1% of 329 |
| The Miser | 97.8% of 182 | 72.0% of 125 | 0.0% of 2 | 86.7% of 309 |
| The Jeweler | 79.2% of 192 | 71.6% of 155 | 33.3% of 3 | 75.4% of 350 |

## The same targets on other seeds

Seeds BAL0001 to BAL1000:

| Stop | Seeds that clear the whole stop |
| --- | --- |
| Stop 1 | 92.8% |
| Stop 2 | 48.6% |
| Stop 3 | 0.1% |

Seeds TUN0001 to TUN1000:

| Stop | Seeds that clear the whole stop |
| --- | --- |
| Stop 1 | 92.8% |
| Stop 2 | 48.2% |
| Stop 3 | 0.1% |

## A player who buys charms

`npm run simulate -- --buy-charms --stops 8` buys every charm it can afford after each clear, in offer order. It still uses no redraws and no stamps.

| Stop | Seeds that clear the whole stop |
| --- | --- |
| Stop 1 | 94.8% |
| Stop 2 | 78.2% |
| Stop 3 | 22.5% |
| Stop 4 | 1.7% |
| Stop 5 | 0.0% |
| Stop 6 | 0.0% |
| Stop 7 | 0.0% |
| Stop 8 | 0.0% |

## Open points

- No simulated player clears stop 5 or later. Stops 5 to 8 need playtests with real charm choices, stamps and redraws before their targets can be tuned.
- The power-of-ten bonus is rare: 5 of 5,077 clears with no charms, and 42 of 6,833 clears with charm buying. A table clears as soon as its total reaches the target, so the bonus needs one chain of at least 10 times the target. All 5 bonuses with no charms, and 40 of the 42 with charm buying, came at host tables, where the targets are lowest.
