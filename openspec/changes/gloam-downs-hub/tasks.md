# Tasks

Two builders work in parallel worktrees after the fair-fight change (`gloam-downs-fair-fight`) merges into the work branch. design.md "Who builds what" names the files each one owns and the exact lines each may add to the other's files. Each builder runs its own checks before it hands over. The merge pass (section 3) runs every check.

## 0. Shared start (once, before the split)
- [ ] 0.1 On the merged branch, add the new rows to the tables, data only: `growth.js` (`ABILITIES` 10 rows, `PANES` 6, new `TEMPERS` 3, `LAMP_KEYS` Gloam dash, `PATTERNS` with kind `temper`), `run.js` (`WICKS` 4, `UPGRADES` Whetstone and Horn lamp, `UNLOCKS` Temper rack and Wick crate), `relics.js` (`RELICS` 4, `KINDLE` 4). Numbers exactly as design.md "Part B". Commit it; both builders branch from it.

## 1. Hub builder (H)
- [ ] 1.1 `games/gloam-downs/biomes/lamproom.mjs`: the hall of design.md "Decision 4", open front, torches, every station's object and mark, and every growth object as its own range (`ctx.grow(id, fn)`).
- [ ] 1.2 `bake.mjs`: `HUB`, the `hub` set (spawn and `door`, no beacon or wisps), `meta.stations`, `meta.grow`; `lib/check.mjs`: the hub's checks and budget. `node games/gloam-downs/bake.mjs lamproom --check` passes, and the five places bake byte-identical.
- [ ] 1.3 `save.js`, `places.js`: `HUB`, `placeName('lamproom')`, the hub never in the Map.
- [ ] 1.4 `hub.js` (new): stations, the use prompt, growth ranges by the save (density 0 or baked), the training post with quarter cooldowns, the bell, the map table, the door, the prefetch of the first place.
- [ ] 1.5 `cards.js`: `anchor(card, x, y)` with the layout rules of design.md "Decision 6"; the beacon shrine's tabbed card; `screens.js`: station row makers from the row makers there now.
- [ ] 1.6 `input.js`: Use (E, Enter, pad A, the touch Use button), the quick list (Tab, pad View, the touch List button); `index.html`: the prompt, the Use and List buttons, the restyled `#lamp` as the quick list.
- [ ] 1.7 `main.js`: the title, the end of a run and a win go to `lamproom`; Spend glim becomes "Go to the shrine"; one place on the GPU at a time.
- [ ] 1.8 `life.js` `LIFE.lamproom`, `beds.js` `BEDS.lamproom`; reduced motion as design.md "Decision 8".
- [ ] 1.9 `qa/lab/gloam-downs-hub.test.mjs` (new): stations, growth ranges, station rows, the shrine's spend order, the budget. Update `gloam-downs-life.test.mjs` for the hall.
- [ ] 1.10 `qa/lab/gloam-downs-hub.e2e.mjs` (new): every scenario of the hall with keys alone, a pad alone, a mouse and touch alone, and the phone load. `qa/lab/gloam-downs-hub-layout.e2e.mjs` (new): the six layouts and reduced motion, with screenshots kept under `SHOTS`.
- [ ] 1.11 Update `gloam-downs-screens.e2e.mjs`, `gloam-downs-run.cards.e2e.mjs`, `gloam-downs-run.growth.e2e.mjs` and `gloam-downs-run.builds.e2e.mjs` where they open today's Lamp-room card.
- [ ] 1.12 `games/gloam-downs/README.md`: the hall, its budget and how to bake it.

## 2. Buffs builder (B)
- [ ] 2.1 `status.js`: Char, Soot, Blind, Mark, the tick cap, `statusTick`, `statusOut`, `blindMiss`; ticks never flinch or wear poise. The three hook lines in `foes.js`.
- [ ] 2.2 `build.js` (new): sure cuts with the `sure` stream, the ward shell and its cap, Horn lamp, the colour sets, `makeBuild`, `shellShare`. The hook lines in `main.js` and `index.html`.
- [ ] 2.3 `abilities.js`, `fight.js`, `sparks.js`: the ten abilities with their tells, effects and cues.
- [ ] 2.4 `run.js`: the panes' rules, the wicks' rules, Whetstone, Horn lamp, Temper rack, Wick crate, `chooseTemper`, the pattern kind odds; `run-save.js`: `temper` and the new fields in `clean()`.
- [ ] 2.5 `relics.js`: the four relics and kindlings. `keys.js` and `moves.js`: Gloam dash; the tempers' strings, reach and the bell slam with the cut poses there now.
- [ ] 2.6 `run-sound.js`: the cues of design.md "Sound". `gloam-downs-sound.test.mjs`: each new cue keys on its event.
- [ ] 2.7 `qa/lab/gloam-downs-states.test.mjs` and `qa/lab/gloam-downs-kit.test.mjs` (new): every scenario of the foe states, sure cuts, the shell, the abilities, panes, wicks, relics, wares, the key, tempers, sets, gaining, and the power budget. Update seeded tests that pin a draw.
- [ ] 2.8 `qa/lab/gloam-downs-run.kit.e2e.mjs` (new): the e2e scenarios, in one place with `?test`.
- [ ] 2.9 `qa/lab/gloam-downs-bot.mjs`: the bot knows the new kit and picks build families.

## 3. Merge pass
- [ ] 3.1 Merge H, then B. Run every test in design.md "Tests" and the Gloam Downs checks in AGENTS.md.
- [ ] 3.2 Pacing after both changes: `node qa/lab/gloam-downs-bot.mjs` with 60 bots a skill at 0.3, 0.5 and 0.9. Write the numbers in design.md; move any buff that breaks the budget, and say so there.
- [ ] 3.3 Say in the report which browser, phone and sound checks could not run.
- [ ] 3.4 `OPENSPEC_TELEMETRY=0 openspec validate gloam-downs-hub --strict`, then archive the change and review `openspec/specs/gloam-downs-run`.
