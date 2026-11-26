# Tasks

Each task is done only when its code and its checks pass. Run the Node tests with `node <file>`; the e2e checks need the site served (`python3 -m http.server <port> --directory public`) and `NODE_PATH=qa/browser/node_modules`, and step the game with `?test`.

## 1. Interrupts
- [x] 1.1 `foes.js`: `weight`, `stun` and `knock` in `TYPES`; `hitFoe` by state (chase, wind-up cancel with the token back and the 0.6 s wait, active time committed with 0.2 s more recovery, recovery up to 0.4 s more); the brace (three flinches in 3 s, 1.0 s); the flinch read in a move, not only in `mind()`.
- [x] 1.2 `elites.js` and `feel.js`: elites heavy; poise 40, 40 and 70; wind-up hits ×2 on poise; the armored specials (Ironback charge, Bellwether bent charge, Cairnwarden sweep, Wardmother second hook) and the braced wind-up.
- [x] 1.3 `abilities.js` and `status.js`: `interrupt` on the hits of Lantern bomb, Moth wisp, Crook line and Ember snare; burn and pitch ticks without it.
- [x] 1.4 `boss.js`: the Reeve's 150 poise, its 1.0 s flinch, the 8 s gap, none in a stumble or the intro, the 4 s refill; `main.js` and `index.html`: the poise line on the boss bar.
- [x] 1.5 `fight.js`: the rim (`ARMOR_DABS`, slot 39, one dab a 10 poise rounded up, doubled in an armored wind-up, still with reduced motion), the flinch pose for every light and medium foe, the snap's sparks in slot 35.
- [x] 1.6 `feel.js` and the hit stop: 5 steps on a cancel or a break, the kick 0.06 (none with reduced motion), no shake of a stunned foe with reduced motion.
- [x] 1.7 `sound.js`, `run-sound.js`: the `snap` cue, synthesized, and the demo's `cues` group; a `PAGES` entry in `qa/arcade/quiet.mjs` is not needed (no new page). The sample bank holds only the score, so it does not change (design.md "What was built").

## 2. Fair foes
- [x] 2.1 `foes.js` and `run.js`: tokens by depth (`PACE.tokens`), held from the wind-up to the end of recovery, given back at once on a cancel; one coal.
- [x] 2.2 `foes.js`: the blow spacing schedule (0.6 s between hit steps, coals by their landing); no wind-up for 1.0 s after a hurt; the hitter backs off 1.0 m and waits 1.2 s; waiting foes circle at 0.8 m/s.
- [x] 2.3 `foes.js` and `sound.js`: the off-screen gate (the tell cue at rank 4 so the voice limit never drops it, panned, the wind-up 0.25 s longer, wait when `tellFree` says no voice is free); the notch as now.
- [x] 2.4 `run.js` or `moves.js`: safe time 1.0 s after a hit; the blink for its length.

## 3. The curve
- [x] 3.1 `foes.js` `FOE_HARD` 1.1 and 1.15; `run.js` `PACE` (`depthDmg 0.1`, `depthHp 0.2`, `depthPow 1`, `sparkDmg 0.015`, `sparkHp 0.03`, `sparkCap 12`) and `foeScale` with the sparks held at load.
- [x] 3.2 `mix.js`: `depth` in `mixZones`, one foe more from depth 2, two kinds in a zone of 3 or more, Ember 3's extra from depth 0, at most one extra a zone; the Gaol's G1 kept. `qa/lab/gloam-downs-zones.mjs` and `gloam-downs-seed.test.mjs` for seeds 1 to 200.

## 4. Checks
- [x] 4.1 `qa/lab/gloam-downs-fair.test.mjs` (new): every scenario of Foe weights, A hit interrupts, Hits in every state, The brace, Armor that shows (the count and the slot), Armored attacks, Blow spacing, Backing off, Tells from off screen (the Node half), Foe growth with sparks, and An elite holds.
- [x] 4.2 Update the tests that quote old numbers or rules: `gloam-downs-foes.test.mjs` (18, 19, 25, 69), `gloam-downs-foes-ai.test.mjs` (Fair crowds), `gloam-downs-feel.test.mjs` (Poise and stagger), `gloam-downs-run.test.mjs` (1.0 s; the 82 is checked in the fight e2e, and Finisher stops a hook in `gloam-downs-foes-ai.test.mjs`), `gloam-downs-boss.test.mjs` (Break the Reeve), `gloam-downs-sound.test.mjs` (snap, the reserved voice), `gloam-downs-growth.test.mjs` and `gloam-downs-builds.test.mjs` where they read `foeScale`.
- [x] 4.3 `qa/lab/gloam-downs-run.interrupt.e2e.mjs` (new): spawn a Snuffer, hold it 0.2 s into its hook, press Attack by keys, then mouse, pad and touch; see the move cancelled, 21 steps of stun, the flinch pose in the draw, `snap` in the cue log, a 5-step stop and no health lost in the next 60 steps. Then an Ironback's charge with 8 rim dabs in slot 39 and none in 34 to 37 at 320 by 640, 390 by 844, 360 by 640, 800 by 600, 1280 by 720 and 844 by 390; the off-screen Snuffer's 48-step wind-up with `scrape` and its notch; the tokens in The Crow Wall; and the reduced-motion pass.
- [x] 4.4 Update `gloam-downs-run.fight.e2e.mjs` (the hook's and the coal's numbers) and `gloam-downs-run.boss.e2e.mjs` (the poise line in the six layouts).
- [x] 4.5 `qa/lab/gloam-downs-bot.mjs`: the cut-in (0.3 + 0.6 × skill, not armored, 0.23 s left), the roll from armor, the new levers, and the prints (first runs to place 2 and 3, death rate and damage per foe by place, interrupts a run, the factor table).
- [x] 4.6 Bot runs: 60 bots at 0.3, 0.5 and 0.9 with the rules alone, then with the curve; tune in the order of design.md; write each run in design.md "Pacing results" with its levers; say which target misses, if any, and why. Then `MAXRUNS=30 AFTER=30 node qa/lab/gloam-downs-bot.mjs 10 0.5 1` for the catalogue quarters. Done: the run-count targets at 0.3 and 0.5 and the death-rate ratio miss (too easy for the bot); design.md says why and what to try after a playtest.
- [x] 4.7 `node qa/lab/gloam-downs-boss.sim.mjs` with the Reeve's poise; the music demo (`cues` group); `node qa/arcade/quiet.mjs --only=lab/gloam-downs`; every `qa/lab/gloam-downs*.test.mjs`, and the run e2e checks.
- [x] 4.8 `openspec validate gloam-downs-fair-fight --strict`. Say which checks could not run: a real phone, a real pad, listening on speakers, and a run played by hand.
