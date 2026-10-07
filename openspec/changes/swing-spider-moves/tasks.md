# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run. The files follow the layout of the other changes: each requirement has SHALL and at least one scenario.

A box is ticked only when the code and a test show the work done.

## Review

- [x] Review the YouTube video (scene log from a Higgsfield analysis), the uploaded PS4 clip (frames every 0.25 s) and the Giphy clip (Higgsfield analysis). The Tenor clip was blocked by the network rules and is not reviewed.

## Release boost

- [x] `MOVES.release` in `config.js`; `cueAir` per rope in `flatHud`; `releaseBoost` on a real let-go (`main.js`).
- [x] `H.flip` and the `flip` pose (`hero.js`).
- [x] Browser check: the boost on the cue adds speed forward and up and flips the hero; no boost outside the cue (`qa/vr/fight-moves.e2e.mjs`).

## Warning and dodge

- [x] `C.threat`, `C.dodge`, the `dodged` mark on blows, `dodgeT` (`combat.js`); unit tests (`qa/vr/action.test.mjs`).
- [x] `fightKeys`: Space or pad A dodges with a threat, and jumps without one (`main.js`).
- [x] The red mark `#actWarn` and the `DODGE` prompt (`actionhud.js`); the phone's `DODGE` button.
- [x] Browser checks on a desktop and a phone (`fight-moves.e2e.mjs`).

## Perch takedown

- [x] `C.perched`, the `hung` state, quiet KO, targets for a perched hero only (`combat.js`); unit tests.
- [x] `firePerch` judged at the shot; the `TAKEDOWN` prompt (`main.js`).
- [x] Browser check from a 29 m roof edge (`fight-moves.e2e.mjs`).

## Focus meter and finisher

- [x] `C.focus`, `C.hits`, `C.finish` (`combat.js`); unit tests.
- [x] F or pad RB finishes; slow motion in `loop()`; the `FINISH` prompt (`main.js`).
- [x] The combo count and meter at the right edge (`#actFight`, `actionhud.js`); screenshots at 960×540 and 390×844.
- [x] Browser check (`fight-moves.e2e.mjs`).

## Release

- [x] Version 1.16.0 in `config.js`, `sw.js` and `quest/twa-manifest.json` (APK code 23); `qa/vr/pwa.mjs` passes.
- [x] Unit suites pass: action, physics, target, city, street, mobile, mobile panel.
- [ ] Browser suites on the final tree: `action.e2e`, `flat`, `training.e2e`, `climb.e2e`, `phone-swing.e2e`, `fight-moves.e2e`.
- [ ] Hardware checks: a real phone, a pad and a Quest headset (the headset must show no change). These cannot run here.
- [ ] Archive the change and fold the specs into `openspec/specs/swing-combat` and `swing-moves` after the hardware checks.
