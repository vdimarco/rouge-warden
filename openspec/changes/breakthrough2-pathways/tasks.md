# Tasks

- [x] Add pathway progress, stall, breakthroughs, and the energy race to the model without moving the no-investment ending mix
- [x] Show pathway rings, the race, and the breakthrough moment at 390px, including reduced motion
- [x] Rewrite ending and help copy: UNEP and IPCC as labeled context, no fatalistic close
- [x] Extend the sim and browser QA, including 390px shots and the before/after ending mix
- [x] Confirm random seeds 1-500 still match the previous ending counts

Browser QA passed (179), including the 390px race, pathway rings, grids breakthrough, reduced-motion breakthrough, and the ending-mix card. Random seeds 1-500 still count fractured 63, emergency 63, abundance 6, regeneration 21, managed 159, hotgrowth 188. The sim's random fractured + long emergency share stays 25.2% against a 25% cap, and that miss is already on main. Greedy-clean abundance moves from 174 to 175 and managed from 202 to 201. OpenSpec CLI was not installed, so spec validation did not run. A physical phone was not used.
