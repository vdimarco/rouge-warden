# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run. The files follow the layout of the other changes: each
requirement has SHALL and at least one scenario. A box is ticked only when the code and a test show the work done.

## The Gauntlet

- [x] `JOB.gauntlet`, `gauntletRound`, `gauntletPay`, the always-offered marker, the rounds, the rest, the heal, the end (`jobs.js`).
- [x] The arena in the city (`city.js pickArena`, `city.arena`); the props keep off it (`cityview.js`).
- [x] `?gauntlet`, `startGauntlet`, the round, cleared and end banners, the best round (`main.js`, `actionhud.js banner`).
- [x] No goal beam over the gang during a round.
- [x] The training checklist folds away while it runs (`game.hush`, `ui.js`).
- [x] The painted fight ring (`actionview.js`).

## The brute and the fight marks

- [x] `FIGHT.brute`: points, size, armour, the charge, the late-dodge rule, the rope stagger (`combat.js`).
- [x] The red rim and outline, the white flash (`streetview.js` `aB.w`; `combat.js` `g.tele`, `g.flash`).
- [x] The heavy impact, the THUCK words, the charge WHOOSH (`main.js`).

## The baked charge

- [x] MotionBricks on the CPU (`qa/vr/motionbricks/cpu_engine.py`), the bake from our own poses (`bake.py`), the contact sheets
  (`sheet.py`) and the figure's channels (`to_goon.py`); `public/vr/anim/brute-charge.json`; credits in `anim/CREDITS.md`.
- [x] Pose 16 in the street figure shader, `figures.setClip`, the charge's phase in `combat.js`, the load in `main.js`, the
  file in the offline cache (`sw.js`).
- [x] Unit test (phase and file) in `gauntlet.test.mjs`; the browser check that the charging brute plays the clip.

## The loop

- [x] `qa/vr/gauntlet-bot.mjs` and `qa/vr/gauntlet.test.mjs` pass.
- [x] `qa/vr/gauntlet.e2e.mjs` passes at 960 × 540 and 390 × 844; screenshots and the report written.
- [x] The other unit suites pass: action, physics, target, city, street, mobile, mobile panel.
- [x] Version 1.25.0 in `config.js`, `sw.js` and `quest/twa-manifest.json` (APK code 34).

## Not checked

- [ ] A real phone and a real GPU (the browser runs are SwiftShader in headless Chromium).
- [ ] Sound by ear (the runs mute audio).
- [ ] The headset (the Gauntlet is flat play only).
