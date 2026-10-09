# Battle City mechanics in ASCII Front

Reference: [Nintendo's Battle City manual](https://www.nintendo.co.jp/data/software/manual/TDFJ.pdf), gameplay sections 6–9. Maps, music, art and implementation here are original.

| Original system | ASCII Front behavior |
| --- | --- |
| 35 stages; stage selection | 35 distinct layouts across brick districts, canals, ice fields, rings, forests, foundries and siege lanes; choose any starting stage |
| 20 enemies per stage | A fixed 20-enemy stage; campaign ends at stage 35, endless continues |
| Four enemy roles | Basic, fast, power and armored; 100/200/300/400 points and different speed, shells or armor |
| Headquarters defense | Either team's projectiles can destroy HQ; losing HQ ends the run |
| Six supplies | Star, helmet, grenade, timer, shovel and extra tank; flashing carriers release supplies |
| Three stars | Faster shells, two simultaneous shells, then steel destruction; four visibly different tank ranks |
| Limited lives | Tank destruction consumes a life, resets star rank and respawns under a shield |
| Terrain | Destructible brick, steel, water, concealing forest and slippery ice |
| Bullet and vehicle interactions | Opposing shells cancel; vehicles block each other; friendly fire stuns a teammate |
| Local two-player mode | Independent controls, ranks, reserves and score; higher stage kill count earns 1,000 bonus points, a tie earns neither |
| Construction | Paint a map and play it; validated local saving is added, and protected entry roads/HQ keep the field usable |
| Pause | Simulation and soundtrack stop while paused, hidden or in the Arcade menu |

ASCII Front deliberately adds diagonal movement, independent mouse aiming, dash, EMP, multi-hit player armor and roguelite upgrades between stages. Score milestones award extra lives every 20,000 points as this game's balance choice. Its original synthesized chiptune soundtrack shares the sound toggle with effects.

The boat and gun pickups seen in some later variants are outside the original six-item set.
