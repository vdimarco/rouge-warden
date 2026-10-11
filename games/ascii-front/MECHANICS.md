# Battle City mechanics in ASCII Front

Reference: [Nintendo's Battle City manual](https://www.nintendo.co.jp/data/software/manual/TDFJ.pdf), gameplay sections 6–9. Maps, music, art and implementation here are original.

| Original system | ASCII Front behavior |
| --- | --- |
| 35 stages; stage selection | 35 distinct layouts across brick districts, canals, ice fields, rings, forests, foundries and siege lanes; choose any starting stage |
| 20 enemies per stage | A fixed 20-enemy stage; campaign ends at stage 35, endless continues |
| Manageable enemy pressure | At most 4 enemies solo or 6 in co-op, each with one active shell; 1.5 seconds to prepare, spaced outer-lane arrivals and a 1-second spawn tell |
| Four enemy roles | Basic, fast, power and armored; 100/200/300/400 points and different speed, shells or armor |
| Gradual introductions | Stage 1 has 18 basic tanks and 2 late scouts; armored enemies enter at stage 2 and power enemies at stage 4 |
| Headquarters defense | Either team's projectiles can destroy HQ; losing HQ ends the run |
| Six supplies | Star, helmet, grenade, timer, shovel and extra tank; flashing carriers release supplies on their first hit |
| Accessible progression | The first two carrier drops per stage are stars while a surviving tank is below Siege; supplies favor reachable ground 72–192 pixels from the lowest-ranked tank and last 45 seconds |
| Three stars | Gunner: faster shells; Twin: two simultaneous shells; Siege: steel destruction. Actual rank gains give 2 seconds of protection, a visible celebration and a sound cue, without repairing armor |
| Limited lives | Tank destruction consumes a life, resets star rank and respawns under a shield |
| Terrain | Destructible brick, steel, water, concealing forest and slippery ice |
| Bullet and vehicle interactions | Opposing shells cancel; vehicles block each other; friendly fire stuns a teammate |
| Local two-player mode | Independent controls, ranks, reserves and score; higher stage kill count earns 1,000 bonus points, a tie earns neither |
| Cardinal controls | One movement axis at a time, retaining an already-held direction; blocked perpendicular turns can center slightly within a clear corridor, except on ice. Keyboard/touch fire follows the hull, while held left click enables pointer aiming |
| Campaign continuation | Continue directly to the next stage with full surviving-tank armor, retained stars and remaining lives; tanks face safely upward after redeployment |
| Construction | Paint a map and play it; validated local saving is added, and protected entry roads/HQ keep the field usable |
| Pause | Simulation and soundtrack stop while paused, hidden or in the Arcade menu |

ASCII Front adds optional click aiming, dash, EMP and four-hit starting player armor. Starting movement is 160 pixels per second for deliberate cornering; a dash lasts 0.16 seconds at 3.5 times movement speed and recharges in 2.1 seconds. Endless mode retains permanent upgrade choices between stages, with bounded stats. Campaign progression comes from stars and stage completion.

Enemy arrivals begin 2.4 seconds apart and ease to 1.6 seconds by stage 35. Basic and scout tanks fire every 2.4 seconds, power tanks every 1.8 and armored tanks every 2.6, with only modest late-stage acceleration. Enemies fire along their travel direction unless an aligned target is within 192 pixels; scouts and power tanks pursue players within 224 pixels. Forest hides players from pursuit beyond 160 pixels.

Score milestones award extra lives every 20,000 points as this game's balance choice. Its original synthesized chiptune soundtrack shares the sound toggle with effects.

The boat and gun pickups seen in some later variants are outside the original six-item set.
