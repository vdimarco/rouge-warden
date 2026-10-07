# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run. Each requirement has SHALL and at least one scenario.

A box is ticked only when the code and a test show the work done.

## Movement

- [x] Glide: `MOVES.glide`, the glide in `physics.js step`, `inp.glide` from Space held or the phone GLIDE button, the glide pose (`hero.js`). Physics tests (sink rate, speed range, turn) and browser checks (desktop, phone).
- [x] Wall run: `CLIMB.run`, `P.wallRun` in `climb()`, the leap off it, the leap off the top. Physics tests (start, rate, leap, slow touch clings, top leap) and a browser check with real keys.

## Combat

- [x] Throw: `C.throwTarget`, `C.throw`, `C.landThrow`; G, pad d-pad up, phone THROW; the lid mesh and its arc (`main.js throwFrame`). Unit tests and browser checks.
- [x] Group pull: `FIGHT.heap` in `C.pull`. Unit test and browser check.
- [x] A perfect dodge slows the world for 0.35 s.

## Crimes

- [x] `J.crime`, crime offers (take radius, expiry, red marker), `CRIME_LINES`, `QUIPS`, `J.crimesOn` tied to Mission 1.
- [x] Mugging, Getaway Car (`cars.js jobCar`, `autoDrive`, `stopCar`, `release`), Sludge Tanker (leak, seals, flood).
- [x] Unit tests for each crime, and browser checks: a crime marker, the take, a rope stops the getaway car and the crew jumps out, three ropes seal the leak.

## Sound

- [x] The fight layer of the music (`audio.js fight`), on while goons fight. Browser check.

## Release

- [x] Version 1.17.0 in `config.js`, `sw.js` and `quest/twa-manifest.json` (APK code 24); `pwa.mjs` passes.
- [x] Unit suites pass: action (five runs in a row), physics, target, city, street, mobile, mobile panel.
- [ ] Browser suites on the final tree: `action.e2e`, `flat`, `training.e2e`, `climb.e2e`, `phone-swing.e2e`, `fight-moves.e2e`, `spider-world.e2e`.
- [ ] Hardware checks: a real phone, a pad and a Quest headset (the headset must show no change).
- [ ] Archive this change and `swing-spider-moves` after the hardware checks.
