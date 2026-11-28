# Tasks

Three builders work in parallel worktrees. design.md "Who builds what" names the files each one owns and the hooks each may add. Each builder runs its own checks before it hands over. The merge pass (section 4) runs every check.

## 0. Shared start (each builder, first)
- [x] 0.1 Create `public/lab/gloam-downs/growth.js` with exactly the text in design.md "growth.js", if it is not there yet.
- [x] 0.2 Set `public/lab/gloam-downs/bus.js` to exactly the text in design.md "bus.js". Do not change either file in a branch; a change goes through the merge pass.

## 1. Builder G: growth
- [x] 1.1 `run.js`: glim at risk (no bank at the beacon, the kept share at death and at End the run, the spend order carried then bank, the win banks all), and the new `UPGRADES` table with Belt, Keen eye, Lantern panes and First spark.
- [x] 1.2 `run.js`: patterns (drops on `foeOut` and `eliteOut` from the seed's `pattern` stream, carried, kept at a beacon or a win, lost at a death), `kindle`, `dropPattern`, `groundPatterns`, and their bus events.
- [x] 1.3 `run.js`: sparks (`takeSpark`, `takeSparkPick`, First spark), `colourPower`, the Flame term in `bladeBonus`, the Ward health, and the panes (`setPane`, `paneOf`, each pane's rule that is not about cooldowns).
- [x] 1.4 `run.js`: the hooks for K and P named in design.md (the `abilities` and `keys` options, the pend list, the two step lines, the `eliteOut` line).
- [x] 1.5 `run-save.js`: the v3 key, the one-time read of v2 (or v1), the Ash pocket move, and `clean()` for every new field.
- [x] 1.6 `screens.js`, `cards.js`, the `main.js` hooks and `index.html`: the Lamp-room's colours, wares, patterns and pane rows; the beacon card's spark picks and kept line; the start picks (Belt, First spark); `#colourRow` and `#patternsN`; the summary's glim and pattern lines.
- [x] 1.7 `gloam-downs-growth.test.mjs` (new): every scenario of Glim at risk, Patterns, Kindle a pattern, The new wares, Sparks, Colours of the moves (the Flame and Edge one), Lantern panes, Ash pocket at death, The lasting upgrades, The run in the save and Saved run. Update `gloam-downs-run.test.mjs` and `gloam-downs-builds.test.mjs` for the 10% rule and the beacon that no longer banks.
- [x] 1.8 `gloam-downs-run.growth.e2e.mjs` (new): carry glim past a beacon, keep a pattern, kindle it, pick Ward, two pane slots, and the Lamp-room and beacon card at 320 by 640, 390 by 844, 360 by 640, 800 by 600, 1280 by 720 and 844 by 390, with keys alone and a pad alone.

## 2. Builder K: abilities
Not built by K (the branch never came back). Built in the fix pass after the checkers, on `ccr-43aa269a-y8yo7l`; see design.md "Fix pass after the checkers" for what differs from the plan.
- [x] 2.1 `abilities.js` (new): two slots, cooldowns on the play clock with Gloam and the cooldown panes, the buffer, the start draw, `makeAbilities`, `abilityView`, `dropAbility`, `groundAbilities`, the swap, bright lamps, and `ability-use` and `ability-ready`.
- [x] 2.2 The nine abilities with the numbers of `ABILITIES`, their tells, cues (with `ability: <id>`) and powers by colour.
- [x] 2.3 Foe states: `statusHit` and `statusStep` in `abilities.js`, and K's three hooks in `foes.js`. The Barrow Reeve takes damage only.
  - They live in `status.js` (no imports), so `foes.js` and `abilities.js` share them with no import loop.
- [x] 2.4 `input.js`: F or U and G or I; mouse buttons 3 and 4 with no back or forward; pad LB and LT, and LT no longer rolls; the latch; the touch buttons. Update `gloam-downs-mouse.test.mjs` and the input lines of `gloam-downs-run.input.e2e.mjs`.
- [x] 2.5 `fight.js` and `sparks.js`: each ability's effect, the ability and pattern lamps, the sealed stones and the caches. No dab in slot 37 or above.
- [x] 2.6 `index.html` and the `main.js` hooks: `#bAb1`, `#bAb2`, `#abilities`, `updateAbilities()`, and the two help lines. Check them in the six layouts of 1.8.
  - On touch the HUD row is hidden: the two buttons show the same, and the HUD stays as tall as it was at 320 px.
- [x] 2.7 `run-sound.js`: a handler for each new bus event with the cues in design.md "Sound and music". `gloam-downs-sound.test.mjs`: the Growth sounds scenarios.
- [x] 2.8 `gloam-downs-abilities.test.mjs` (new): every scenario of Ability slots, The abilities, Lantern bomb, Foe states from abilities, Ability lamps and the Gloam cooldown.
- [x] 2.9 `gloam-downs-run.abilities.e2e.mjs` (new): Ability inputs, Drawn under fire, the swap, The ability HUD, and Test hooks for growth.

## 3. Builder P: pacing and keys
Not built by P either. Built in the fix pass after the checkers; see design.md "Fix pass after the checkers".
- [x] 3.1 `foes.js` and `boss.js`: `FOE_HARD` (damage 1.3, health 1.15) and `REEVE.hard` (1.2), with the Ember 4 factor on top. `gloam-downs-foes.test.mjs`: the Snuffer's hook at Ember 0.
- [x] 3.2 `mix.js`: `EXTRA`, two or three page zones a place, added before the mix. `gloam-downs-zones.mjs` reads them and checks the floor, the spacing and the pool. `gloam-downs-seed.test.mjs`: the mix still fits for seeds 1 to 200.
- [ ] 3.3 `qa/lab/gloam-downs-ledges.mjs` (new): the two `reachable` searches, the ledge patches, the flat floor for stones, and the shortcuts. Write what it found for each place in design.md, and say if a place has no shortcut.
  - Built, but not the shortcut search: the scan does not look for shortcuts, so this stays open. The rest is in design.md.
- [x] 3.4 `keys.js` (new): `makeKeys`, the second jump through `body.s.vy`, the stone rule on the plunge's landing, `SPOTS`, the caches and their prizes, `groundSpots`, `keyDrop` from `elites.js`'s Rookchief and Bellwether, `key-found` and `cache-open`. The `main.js` hooks and `#keysLine`.
- [x] 3.5 `gloam-downs-keys.test.mjs` (new): every scenario of Keys and Hidden ledges and sealed stones. `gloam-downs-camera.test.mjs` still passes with the second jump.
- [ ] 3.6 `gloam-downs-run.keys.e2e.mjs` (new): the Rookchief gives Crow step, a ledge cache, a sealed stone, and the pause panel's keys line.
  - Partly: the ledge cache and the keys line are in `gloam-downs-run.abilities.e2e.mjs`; the Rookchief's key and the stone are checked in Node (`gloam-downs-keys.test.mjs`), not in a browser.
- [x] 3.7 `qa/lab/gloam-downs-bot.mjs`: the rewrite in design.md "The bot with growth", with the boss stepped by `boss.js`.
- [x] 3.8 Run the bot at 0.3, 0.5 and 0.9 (60 bots each) and tune with the levers in design.md "Targets", in their order. Write "Pacing results" in design.md. If a target misses, say which and why, and tell the user.
  - Done; two targets missed with every lever at the top of its range. The pacing pass (6) meets three of the four. See design.md "Pacing results".

## 4. Merge pass (after 1, 2 and 3)
- [x] 4.1 Merge in the order G, K, P. Fix the hook lines in `run.js`, `foes.js`, `main.js` and `index.html` where two builders met.
  - G merged (`gloam-grow-g` at `4dc0dc89`) with no conflict. K and P did not come back; their parts were built in the fix pass on the same branch, on G's hooks. The `main.js` import line that G packed with a bind call is split into an import and a bind after the imports.
- [x] 4.2 Run every Gloam Downs Node test and `node qa/lab/gloam-downs-zones.mjs`.
  - All 14 Node tests pass (boss 28, builds 34, camera 49, feel 11, foes-ai 44, foes 30, growth 23, lattice 16, mouse 11, run 68, seed 9, sound 28, stairs 1, uniform-blocks 10), and `gloam-downs.test.mjs` 33. Zones: 142 ok lines, none bad.
  - Fixed for G's rules: `gloam-downs-sound.test.mjs` counts 23 bus events, and `gloam-downs-foes-ai.test.mjs` checks that the keepers' 9 glim are carried on, not banked.
- [x] 4.3 Serve `public/` and run every Gloam Downs e2e file with `NODE_PATH=qa/browser/node_modules`, and `CHROMIUM_PATH=/opt/pw-browsers/chromium QUIET_URL=http://127.0.0.1:8765 node qa/arcade/quiet.mjs --only=lab/gloam-downs`.
  - Results are in design.md "Merge pass". Fixed for G's rules: the v3 save key in run.boss, run.cards, run.feel and run.input; the beacon that carries glim on in run.fight, run.input and run.cards; the beacon's spark pick before Walk on in run.cards, run.input, run.fight, run.sound and clicks; the new run help, the 10% and 18% kept shares, the nine wares and the summary's glim and pattern rows in run.cards.
- [x] 4.4 Run the bot at the three skills after the merge, and update "Pacing results".
  - The bot is not P's rewrite. The merge pass changed it only so far as G's rules need: it keeps one save across runs (up to 40 runs, or 5 after the first win), shops at every lit beacon with the glim carried first, takes spark picks (Ward under 50% health, else Flame), kindles and sets the panes that work without abilities, and prints the catalogue share bought and the glim kept and lost. It does not use abilities, keys or caches, and the boss is still drawn. Every target misses; see design.md "Merge pass".
- [ ] 4.5 Play a run with the mouse and one with keys alone. Write what felt wrong. Say which checks could not run here: a real phone, a real gamepad, real mouse side buttons, and listening on speakers.
  - Not done by hand: this session has no display. The screenshots of the Lamp-room, the beacon card and the HUD were looked at instead. Not checked: a real phone, a real gamepad, real mouse side buttons, and listening on speakers.
- [ ] 4.6 Keep the spec and design current with what was built, and validate with `openspec validate gloam-downs-growth --strict`.
  - `openspec validate --strict` says both `gloam-downs-growth` and `gloam-downs-real-game` are valid. The spec still holds K's and P's requirements, which are not built, so this stays open.
- [ ] 4.7 Archive after `add-gloam-downs` and `gloam-downs-real-game`, in that order, and review the resulting spec.
  - Not archived: K and P are not built.

## 5. Fix pass after the checkers
- [x] 5.1 Confirm each problem the checkers found; design.md "Fix pass after the checkers" lists each, what was found and what was done.
- [x] 5.2 Abilities, keys and hidden ground, page zones, the harder Ember 0 and the bot with the boss stepped (sections 2 and 3).
- [x] 5.3 The smaller fixes, each with a Node test that fails before it: the elite's pattern lamp and relic on the floor (`R.floorAt`), a pattern lamp left lying at a lit beacon, a flier's drops on the ground, the 2% roll only skipped for the elite itself, Lead glass by the foes that see the lamplighter, the old summary's kept glim, the beacon card's warning in numbers, the colour row in words, and the summary that says the glim once.
- [x] 5.4 Run every Node test, the zone check, every Gloam Downs e2e file, the quiet check and the bot at three skills; write the numbers into design.md.
- [ ] 5.5 Play by hand on a real phone, a real gamepad, real mouse side buttons and speakers. Not possible here (no display, no devices).

## 6. Pacing pass: start weak, grow strong
- [x] 6.1 Measure the levers with 20 and then 60 bots at 0.3, 0.5 and 0.9: a lower start health, blade and flask count, foes that grow with the place index, a Reeve that grows with the run's sparks. Every step's numbers are in design.md "Pacing results".
- [x] 6.2 `run.js`: the run starts with 1 flask; `PACE`, `foeScale` (damage ×(1 + 0.35 d^1.5), health ×(1 + 0.4 d^1.5)) and `bossScale` (+5% a spark). `foes.js` takes `scale`, and `fight.js` and the bot pass it and the Reeve's scale.
- [x] 6.3 Tests: the later places and the Reeve in `gloam-downs-foes.test.mjs`; the start of 1 flask and every ware's 5 flasks in `gloam-downs-run.test.mjs` and `gloam-downs-growth.test.mjs`; the coal in The Crow Wall in `run.fight`; the start in `run.cards` and `run.input`.
- [ ] 6.4 A 0.9 winning run of 15 to 25 minutes: missed (10.3). It needs more ground to cover, which is the user's call.

## 7. Second fix pass after the checkers
- [x] 7.1 Merge the pacing pass (`gloam-grow-pace`, 7760ad79).
- [x] 7.2 Abilities: a swap keeps both cooldowns (the lamp holds and cools the one put down); the cooldowns and a Moth wisp carry over to the next place; the swap hint shows as the feet touch the lamp; a press while busy or in the air gives `refuse`; Smoke step moves over 0.12 s; Crook line pulls to 1.2 m; a snare is sprung by a heavy foe too, and a slow slows a charge; Bell guard is not spent on a blow that would not hurt.
- [x] 7.3 The look: foe states drawn (stun, hold, slow, burn) and a stunned foe staggers; the snare and the pool of pitch drawn larger; a cooling touch button goes dark with its seconds in large figures.
- [x] 7.4 Inputs: the mouse's side buttons read from their pointer events (real input in Chromium sends no `mousedown`); the HUD's labels follow the input in use; the help lines name the side buttons and the swap; after Kindle the focus stays in the Lamp-room's growth rows.
- [x] 7.5 Hidden ground: the scan keeps only ledges no single jump reaches from 4 m round, and stones with slack in the approach; a ledge cache opens only on the ledge; a coyote jump does not use Crow step. The spots are rescanned (The Bell Knoll now has one ledge).
- [x] 7.6 The save: a run starts with `abilityRolls` 0, a v2 run keeps slot 1 through the first reload, and an opened cache's prize goes into the entry with the cache.
- [x] 7.7 Each fix has a test that failed on 7760ad79 (design.md "Second fix pass after the checkers").
- [x] 7.8 Run every check again and the bot at three skills; the numbers are in design.md.
- [ ] 7.9 Play by hand on a real phone, a real gamepad, real mouse side buttons and speakers. Not possible here.
