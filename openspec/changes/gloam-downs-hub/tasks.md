# Tasks

Three builders work in parallel worktrees after the fair-fight change (`gloam-downs-fair-fight`) merges into the work branch. design.md "Who builds what" names the files each one owns and the exact lines each may add to the other's files. Each builder runs its own checks before it hands over. The merge pass (section 4) runs every check.

## 0. Shared start (once, before the split)
- [x] 0.1 On the merged branch, add the new rows to the tables, data only: `growth.js` (`ABILITIES` 10 rows, `PANES` 6, `LAMP_KEYS` Gloam dash, `PATTERNS` from abilities, panes, blades and off-hands, each with its `kind`, `STARTERS` with `lamp` and `buckler`), new `gear.js` (`BLADES` 4, `OFFHANDS` 6, `TIERS` 3, `DEPTH_TIERS` 6 rows, `TRAITS` 10, the gear and pattern kind odds; no imports from `run.js`), `run.js` (`WICKS` 4, `UPGRADES` Whetstone and Horn lamp, `UNLOCKS` Blade rack and Wick crate), `relics.js` (`RELICS` 4, `KINDLE` 4). Numbers exactly as design.md "Part B" and "Part C". Commit it; all three builders branch from it. Done: the rows are in; the tests that pin a table's rows or totals are updated; `screens.js` has a Buy line for the two new wares, `run-save.js` keeps a kindled blade or off-hand pattern, and an ability with no effect yet only refuses (`abilities.js`), until B and G land.

## 1. Hub builder (H)
- [x] 1.1 `games/gloam-downs/biomes/lamproom.mjs`: the hall of design.md "Decision 4" with its 12 stations (the blade rack, the off-hand stand and the ability post among them), open front, torches, every station's object and mark, and every growth object as its own range (`ctx.grow(id, fn)`), the blades and off-hands included.
- [x] 1.2 `bake.mjs`: `HUB`, the `hub` set (spawn and `door`, no beacon or wisps), `meta.stations`, `meta.grow`; `lib/check.mjs`: the hub's checks and budget. `node games/gloam-downs/bake.mjs lamproom --check` passes, and the five places bake byte-identical.
- [x] 1.3 `save.js`, `places.js`: `HUB`, `placeName('lamproom')`, the hub never in the Map.
- [x] 1.4 `hub.js` (new): stations, the use prompt, growth ranges by the save (density 0 or baked), the ability post with quarter cooldowns and any two abilities to try, the blade rack and off-hand stand with Pick (`chooseBlade`, `chooseOffhand`, stubbed until G lands), the bell, the map table, the door, the prefetch of the first place.
- [x] 1.5 `cards.js`: `anchor(card, x, y)` with the layout rules of design.md "Decision 6"; the beacon shrine's tabbed card; `screens.js`: station row makers from the row makers there now, the blade and off-hand rows, `gearMark(item)` on every row (stubbed until G lands), and the quick list's category headings of design.md "The cards by category".
- [x] 1.6 `input.js`: Use (E, Enter, pad A, the touch Use button), the quick list (Tab, pad View, the touch List button), and the Off-hand input `input.off` (V or O, the middle mouse button, pad RB, facing moved to R3, the touch button); `index.html`: the prompt, the Use, List and Off-hand (`#bOff`, at least 44 px) buttons, the restyled `#lamp` as the quick list.
- [x] 1.7 `main.js`: the title, the end of a run and a win go to `lamproom`; Spend glim becomes "Go to the shrine"; one place on the GPU at a time.
- [x] 1.8 `life.js` `LIFE.lamproom`, `beds.js` `BEDS.lamproom`; reduced motion as design.md "Decision 8".
- [x] 1.9 `qa/lab/gloam-downs-hub.test.mjs` (new): stations, growth ranges, station rows, the shrine's spend order, the budget. Update `gloam-downs-life.test.mjs` for the hall.
- [x] 1.10 `qa/lab/gloam-downs-hub.e2e.mjs` (new): every scenario of the hall with keys alone, a pad alone, a mouse and touch alone, and the phone load. `qa/lab/gloam-downs-hub-layout.e2e.mjs` (new): the six layouts and reduced motion, with screenshots kept under `SHOTS`.
- [x] 1.11 Update `gloam-downs-screens.e2e.mjs`, `gloam-downs-run.cards.e2e.mjs`, `gloam-downs-run.growth.e2e.mjs` and `gloam-downs-run.builds.e2e.mjs` where they open today's Lamp-room card.
- [x] 1.12 `games/gloam-downs/README.md`: the hall, its budget and how to bake it.

## 2. Buffs builder (B)
- [x] 2.1 `status.js`: Char, Soot, Blind, Mark, the tick cap, `statusTick`, `statusOut`, `blindMiss`; ticks never flinch or wear poise. The three hook lines in `foes.js`.
- [x] 2.2 `build.js` (new): sure cuts with the `sure` stream, the ward shell and its cap, Horn lamp, the colour sets (the held blade and off-hand count), `makeBuild`, `shellShare`, and for G `markSure` and `addShell`. The hook lines in `main.js` and `index.html`.
- [x] 2.3 `abilities.js`, `fight.js`, `sparks.js`: the ten abilities with their tells, effects and cues.
- [x] 2.4 `run.js`: the panes' rules, the wicks' rules, Whetstone, Horn lamp, Blade rack, Wick crate; the one `cracked` line in G's `run-save.js`.
- [x] 2.5 `relics.js`: the four relics and kindlings. `keys.js` and `moves.js`: Gloam dash.
- [x] 2.6 `run-sound.js`: the cues of design.md "Sound". `gloam-downs-sound.test.mjs`: each new cue keys on its event.
- [x] 2.7 `qa/lab/gloam-downs-states.test.mjs` and `qa/lab/gloam-downs-kit.test.mjs` (new): every scenario of the foe states, sure cuts, the shell, the abilities, panes, wicks, relics, wares, the key, sets, gaining, and the power budget. Update seeded tests that pin a draw.
- [x] 2.8 `qa/lab/gloam-downs-run.kit.e2e.mjs` (new): the e2e scenarios, in one place with `?test`.
- [x] 2.9 `qa/lab/gloam-downs-bot.mjs`: the bot knows the new kit and picks build families.

## 3. Gear builder (G)
- [x] 3.1 `gear.js`: `rollGear` (the `gear`, `tier` and `trait` streams with their counters), `tierPower`, `traitCool`, `traitWide`, `bladeHit`, `bladeHold`, `patternKind`, `startGear`, `chooseBlade`, `chooseOffhand`, `cleanGear`; the depth tables with the Keen eye and Ember shifts.
- [x] 3.2 `gear-play.js` (new): `makeGear(R)`, the held blade's colour and row for the fighter, the six off-hands with tells, effects and cooldowns, the Buckler's parry under the fair-fight interrupts, gear drops on the ground, the hold-to-swap, traits on hits, `R.gear.view()`.
- [ ] 3.3 The blades: the strings, reach and the Bell maul slam from `bladeHit` and `bladeHold`, with the cut poses there now and the blade bone scaled; the hook lines in `moves.js`, `run.js` and `abilities.js` of design.md "The hooks".
- [x] 3.4 `run-save.js` v4: the save fields of design.md "Save fields", `clean()`, and the v3 to v4 move.
- [x] 3.5 `hud-gear.js` and `gear.css` (new): `gearRow` with the glyphs, colour edges, tier marks, cooldown sweeps and the label; `gearMark` for the cards and rows; `compareToast`; the six layouts; the touch buttons' marks. The hook lines in `main.js` and `index.html`.
- [x] 3.6 The gear's cues in `run-sound.js`, one handler a cue; `gloam-downs-sound.test.mjs` checks each.
- [x] 3.7 `qa/lab/gloam-downs-gear.test.mjs` (new): every Node scenario of the categories, blades, off-hands, tiers, traits, depth tables, patterns, colour growth, the save and the gear budget. Update seeded tests that pin an ability lamp.
- [x] 3.8 `qa/lab/gloam-downs-run.gear.e2e.mjs` and `qa/lab/gloam-downs-gear-hud.e2e.mjs` (new): the swaps with keys, a pad, a mouse and touch, the parry, the Twin string, the slam, the compare toast, and the gear row and cards at the six layouts and on a grey screen, with screenshots under `SHOTS`.
- [x] 3.9 The bot (with B): it picks up better gear and swaps blades and off-hands by its build family.
- Gear builder's notes (`gloam-hub-g-2`): 3.3 is done but for the blade bone scaled by blade (the pose code). 3.8 is done but for the Off-hand's own inputs (V, the middle mouse button, RB, `#bOff`), which wait for the hub builder's `input.off`; the e2e presses the Off-hand through `__gloam.gear({ off: true })` and says which inputs it could not press. 3.9: the bot's gear half is in (it takes a better blade or off-hand, prefers its spark colour at an equal tier, raises the Buckler in place of some rolls and uses the other off-hands in a fight); the build families of the buffs builder are not. The numbers moved for the gear budget are in design.md "Gear budget", "Measured".

## 4. Merge pass
- [x] 4.1 Merge H, then B, then G. Run every test in design.md "Tests" and the Gloam Downs checks in AGENTS.md.
- [x] 4.2 Pacing after all three and the fair-fight change: `node qa/lab/gloam-downs-bot.mjs` with 60 bots a skill at 0.3, 0.5 and 0.9. Write the numbers in design.md; move any buff, tier or trait that breaks the budget, and say so there.
- [x] 4.3 Say in the report which browser, phone and sound checks could not run.
- Merge pass notes: 3.8 is done now that `input.off` is in; the gear e2e requires V, the middle mouse button and RB to work the off-hand. 3.9 is done: the bot plays B's build families with G's gear (design.md "Merge pass" has the numbers). 3.3 stays open for the blade bone scaled by blade (the pose code and the figure), so 4.4's archive waits; the change validates. Every gloam-downs Node test, the zone check, every gloam-downs e2e but the uniforms one (about 12 minutes, untouched by the hub), the hall bake check, the quiet check and the music demo ran on the merged tree, on headless Chromium with software WebGL. No real phone, GPU, gamepad, touch screen or speaker was used, and nobody listened to the sound.
- [ ] 4.4 `OPENSPEC_TELEMETRY=0 openspec validate gloam-downs-hub --strict`, then archive the change and review `openspec/specs/gloam-downs-run`.
