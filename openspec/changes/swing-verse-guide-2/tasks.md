# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run. Each requirement has SHALL and at least one scenario.

A box is ticked only when the code and a test show the work done.

- [x] Ink lines from depth in the Verse composite (`bloom.js` `uLines`; `VERSE.lines`). Browser check (dark pixels Full against Off).
- [x] Hatching in the darkest shadows (`uHatch`; `VERSE.hatch`). Same check.
- [x] Mood grading (`uMood`, `uMoodTint`; `MOOD`, `moodFight`, `moodHurt` in `main.js`). Browser checks (fight, one heart, healed).
- [x] Velocity smear (`smear` group, `SMEAR`, `H.setSmear` in `hero.js`). Browser check (32 m/s, at rest).
- [x] Version 1.24.0 (Quest APK code 31) in `config.js`, `sw.js` and `quest/twa-manifest.json`; `pwa.mjs` passes in CI.
- [x] Unit suites and the CI browser suites pass (both Swing browser QA jobs green). `verse.e2e.mjs` passes in headless Chromium (38 checks): ink lines on 0.41 % of the pixels, hatching on 12.65 %.
- [x] Hatching too faint: below a luminance of 0.18 it darkened 0.14 % of the street. It now runs up to 0.26.
- [x] `verse.e2e.mjs` ran the page out of memory on SwiftShader (the kernel killed it at about 8 GB, and the mood check then waited on a page that was gone). Part two of the checks now runs on a new page, and its mood and smear checks on a 320 x 180 canvas. The city CI job takes 19 to 20 minutes, so its limit is now 30.
- [ ] Hardware checks: a real phone and a pad. A Quest headset must show no change.
