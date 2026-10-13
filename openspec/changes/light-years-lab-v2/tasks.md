# Tasks

## 1. Chooser and change

- [x] 1.1 Write `public/light-years-home/lab/index.html`: quiet.js first, `noindex`, the cosmic web backdrop, two thin-ring buttons with one plain line each, keys A/1 and B/2, runs played on this device, the back link, the switcher and analytics.
- [x] 1.2 Check the chooser in Chromium at 390×844, 844×390 and 1440×900: screenshots, no sideways scroll, 44 px targets, no AudioContext, keys, the switcher and blocked storage.
- [x] 1.3 Write this change and pass `openspec validate light-years-lab-v2 --strict`.
- [x] 1.4 After the playtest fixes, bring the specs, `design.md` (with the tuning log) and this list up to date with the code, and pass `openspec validate light-years-lab-v2 --strict` again.

## 2. Prototype A: LIGHT YEARS AHEAD

- [x] 2.1 Write `lab/a/core.js` (pure): `TUNE`, state, `step`, the tube geometry, pass checks, speed and gears, the lead, score, rank by par and the bots.
- [x] 2.2 Write `lab/a/stage1.js`: the stage script with knots, pairs, walls, rails, the swarm, Coma's gate and labels.
- [x] 2.3 Write `lab/a/view.js`: the sky, the dust stream, hazards and the headlight in three.js; the ring, ship, ticks, outlines, leaders, callouts and rim glow on the 2D overlay.
- [x] 2.4 Write `lab/a/sound.js`: the Doppler music bus on the beat clock and every effect.
- [x] 2.5 Write `lab/a/index.html` and `lab/a/main.js`: title, input per device, the 120 Hz loop, pause, URL tuning, `window.__lab`, telemetry and the result card.
- [x] 2.6 Write `qa/light-years-home/lab-a.test.mjs` and tune until the bot spread passes; record before and after in `design.md`.
- [x] 2.7 Check A in Chromium at all three sizes: first input under 3 s, retry under 1.5 s, layouts and screenshots.
- [x] 2.8 Play A adversarially: bots and player models on 20 seeds, real CDP touch, keys and mouse at all three sizes, and write up the findings.
- [x] 2.9 Fix A's findings: Coma always lights the Headlight, a human par with star lines and a next goal, the burst as a visible tug of war with an honest warning, the wall after the rail at beat 56 with its gap shown early, no hit-stop on hairlines, one scheme and camera a run, the drag gain curve, the newest finger steers, the fixed camera on touch, callout priority and hairline limits, the danger whine, retries from beat 9, and the missing sounds and buzzes. Extend `lab-a.test.mjs` to cover them (18 tests pass).

## 3. Prototype B: SLINGSHOT HOME

- [x] 3.1 Write `lab/b/core.js` (pure): `TUNE`, state, `step`, flight with focusing, grab, depth and reel, release judging, gains, chain, nines, LIGHT SPEED, burn, lost, rewind, clock and the bots.
- [x] 3.2 Write `lab/b/course1.js`: the 23 masses to Coma and the `?toy` generator.
- [x] 3.3 Write `lab/b/view.js`: the sky, the headlight, masses, tether, preview line, trail and the north-up camera; labels, leader and callouts on the overlay.
- [x] 3.4 Write `lab/b/sound.js`: drone, hum, chimes and one-shots, all instant.
- [x] 3.5 Write `lab/b/index.html` and `lab/b/main.js`: title, hold and lift per device, the 120 Hz loop, pause, URL tuning, `window.__lab`, telemetry and the result card.
- [x] 3.6 Write `qa/light-years-home/lab-b.test.mjs` and tune until the bot spread passes; record before and after in `design.md`.
- [x] 3.7 Check B in Chromium at all three sizes: first grab under 3 s, input back 1.3 s after a burn, layouts and screenshots.
- [x] 3.8 Play B adversarially: bots and screen-reading player models on 20 seeds, real CDP touch, keys and mouse at all three sizes, and write up the findings.
- [x] 3.9 Fix B's findings: the approach ring and LET GO timed to the release moment, a gentle first swing, pausing keeps the swing, the catch capped at depth 0.6 with burn-zone circles, honest grades near a core, the stylised clock from the first fling, the nine-up fanfare only for a new best, callouts off the aim line, the LOST grace rule, any finger holds, the brief camera turn at LIGHT SPEED, the retry and tutorial-skip rules, and SKIP +2 counting two chain links. Extend `lab-b.test.mjs` to cover them (28 tests pass).

## 4. Playtest and pick

- [ ] 4.1 Run the playtest in `design.md` with five testers and collect their Copy log output, including the real-phone checks of touch lag, sound, haptics and frame rate.
- [ ] 4.2 Pick the winner, record why in `design.md`, and drop the other capability from this change.
- [ ] 4.3 Archive the change and review the canonical spec in `openspec/specs/`.
