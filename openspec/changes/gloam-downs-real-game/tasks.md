# Tasks

Three builders work in parallel. design.md "Who builds what" names the files each one owns and the hooks each may add. Each builder runs its own checks before it hands over. The merge pass (section 4) runs every check.

## 0. Shared start (each builder, first)
- [x] 0.1 Create `public/lab/gloam-downs/bus.js` with exactly the text in design.md "The event bus", if it is not there yet. Do not change it in a branch. A change goes through the merge pass.

## 1. Builder A: music
- [x] 1.1 `qa/lab/gloam-downs-synth.mjs`: render cello, gurdy, drum-lo and drum-mid offline in Node, as design.md "The new instruments, made offline" says. Encode them with ffmpeg to `games/gloam-downs/audio-src/`. Note the sizes in design.md.
- [x] 1.2 Listen to each instrument over its range, on headphones if you can. Write one line for each in design.md. If no listening could happen, say so.
- [x] 1.3 `qa/lab/gloam-downs-bank.mjs`: read both sources, keep only the notes in use, and set the limit to 800 KB with 100 KB for each new instrument. Update `audio/README.md` with how the four were made. Rebuild the bank.
- [x] 1.4 `music.js`: split `combat` into `drums` and `strings`; add `elite`; every layer change on the next bar line; keep `setCombat` as a wrapper. Add the cello and gurdy parts to each theme (design.md "Layers and their changes"). Add the code voices for the new instruments, as the fallback.
- [x] 1.5 `music.js`: the boss's six levels by health share, with the Ember 5 line at 40%; `level` in `view()`; `STINGS.fall`.
- [x] 1.6 `run-sound.js`: subscribe to every event in `EVENTS`; the strings come in on the first tell or hit cue after `foes-alert`.
- [x] 1.7 `main.js` hooks only: the `emit` import, the existing `audio` lines as emits, and `emit('boss-health', ...)` in `fillBossBar()`.
- [x] 1.8 `gloam-downs-sound.test.mjs`: layers on bar lines, no flapping, the elite layer, six boss levels, the fall sting, a throwing listener.
- [x] 1.9 `gloam-downs-run.sound.e2e.mjs`: the scenarios of "Layers on the bar", "Strings when the fight starts", "The elite's drone", "The boss music builds", "The fall sting", "The combat layer" and "The sampled bank". (Builder A checks the elite's drone with `elite-alert` and `elite-fall` sent on the page's own bus; the real Wardmother waking it is checked in 4.3, after BC's `elites.js` is merged.)
- [x] 1.10 `gloam-downs-music-demo.mjs`: the `layers` group; every loudness target still holds. `CHROMIUM_PATH=/opt/pw-browsers/chromium node qa/arcade/quiet.mjs --only=lab/gloam-downs` passes.

## 2. Builder BC: relics, builds, lasting upgrades, Ember
- [ ] 2.1 `run.js`: Cinders (25%, or 55% with Ash pocket); the third Flask level; `UNLOCKS`; the three new wicks in the offers once bought; `run.route`, `run.ember`, `run.relics`, `run.elitesDown`; the Ember glim factor; Last ember.
- [ ] 2.2 `run-save.js`: the v2 key, the one-time read of v1, and `clean()` for every new field.
- [ ] 2.3 `elites.js` (new): the five elites, `makeElite`, `eliteMove`, `dressOf`, and `elite-alert` and `elite-fall` on the bus. In `foes.js`, only the three hooks that design.md names.
- [ ] 2.4 `relics.js` (new): the eight relics, the kindlings, `groundRelics`, the touch, and `relic-take`. `moves.js`: each relic's change to its move, Rising cut and Ember parry.
- [ ] 2.5 `screens.js`, `cards.js` and the `main.js` hooks: the Unlocks list, the Ember row, the Wick shelf card, the relic marks on the HUD, "Kindled" on the beacon card, the win card's level and best time, and the help lines for the new moves.
- [ ] 2.6 `index.html`: `#unlocks`, `#emberRow` and `#relics`, with their CSS. Check them at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720.
- [ ] 2.7 `gloam-downs-builds.test.mjs` (new): every scenario of Elites, the five elites, Relics, the relic lists, Kindlings, Unlocks, the wicks from unlocks, Kindled flask, Rising cut, Ember parry, Ember levels and rules, Cinders, Names, and the save.
- [ ] 2.8 `gloam-downs-run.builds.e2e.mjs` (new): the elite shows in each place, take a relic, buy an unlock, Wick shelf, the Ember row after a win, the Lamp-room in five layouts with keys alone and a pad alone, and the build hooks.
- [ ] 2.9 `qa/lab/gloam-downs-bot.mjs` (new): add-gloam-downs tasks 454 to 457, with the page's rules, `mix.js`, `elites.js`, `relics.js` and the unlocks. The bot buys in the Lamp-room between runs.

## 3. Builder D: feel and variety
- [ ] 3.1 `feel.js`: no shake from a cut, the new trauma values, `FEEL.kick` at 2.4, the 0.15 m clamp, and a stagger shock. Run `gloam-downs-camera.test.mjs` and see it pass.
- [ ] 3.2 The Shake switch: `#bShake`, its listener and label in `main.js`, `fx.kick` from the save's `shake`, and the reduced-motion default.
- [ ] 3.3 Poise and stagger in `foes.js` (the hit function only), with the crack glow in `fight.js`.
- [ ] 3.4 `combo.js` (new): counts, tiers, the end rules, `combo-tier` on the bus, and the glim factor on the `foeOut` line in `foes.js`.
- [ ] 3.5 `fight.js` and `sparks.js`: the lamp halo, the elite crown and size from `dressOf`, the relic lamps from `groundRelics`, the fire line, the burning rings and the spark. No dab uses slot 37.
- [ ] 3.6 `#combo` in `index.html` and `updateCombo()`. Check it at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720.
- [ ] 3.7 `mix.js` (new): the foe mix, the elite's zone, the route, Ember 3's extra foe, and the guard's second wave; `mixWave` in `foes.js`'s all-out check. Pass `mix` to `makeFight` in `newRunner()`.
- [ ] 3.8 The seed code in Crockford base 32, `?seed=` for a code or a number, and `#seedLine` in the pause panel and the summary.
- [ ] 3.9 `gloam-downs-feel.test.mjs` (new): the shake cap, no cut shake, poise, the combo rules and its glim.
- [ ] 3.10 `gloam-downs-seed.test.mjs` (new): the streams apart, the mix fits for seeds 1 to 200, the elite zones, the route, the same seed giving the same run, and Ember 3. `gloam-downs-foes.test.mjs`: the second wave.
- [ ] 3.11 `gloam-downs-run.feel.e2e.mjs` (new): Shake under reduced motion, the lamp at tier II, the meter in five layouts, and the pause panel that fits.

## 4. Merge pass (after 1, 2 and 3)
- [ ] 4.1 Merge in the order A, BC, D. Fix the hook lines in `main.js` and `index.html` where two builders met.
- [ ] 4.2 Run every Gloam Downs Node test and `node qa/lab/gloam-downs-zones.mjs`.
- [ ] 4.3 Serve `public/` and run every Gloam Downs e2e file with `NODE_PATH=qa/browser/node_modules`, and `quiet.mjs`.
- [ ] 4.4 Run the bot at skills 0.3, 0.5 and 0.9. Tune with the levers in design.md "Pacing", in their order. Write the results in design.md. If a target cannot be met, tell the user.
- [ ] 4.5 Play a run with the mouse at 120 Hz, and one with keys alone. Write what felt wrong. Say which checks could not run here: a real phone, a real gamepad, and listening on speakers.
- [ ] 4.6 Keep the spec and design current with what was built, and validate with `openspec validate gloam-downs-real-game --strict`.
- [ ] 4.7 Archive `add-gloam-downs` first, so the `gloam-downs-run` spec exists in `openspec/specs/`. Then archive this change, and review the resulting spec.
