# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run. Each requirement has SHALL and at least one scenario.

A box is ticked only when the code and a test show the work done.

- [x] Read the user's build guide and list the gaps against `swing-verse-style`.
- [x] The gang on threes (`goonOnThrees`, `VERSE.goons`) and the goon walk cycle (`combat.js`). Browser check.
- [x] Key pose: `H.attack(kind, side, apex)` from punches, kicks, the zip kick and the finisher. Browser check (the punch pose).
- [x] Squash and stretch (`S.sq`, `S.sqV` in `hero.js`). Browser check (jump, landing, settle).
- [x] Multiples (`H.ghost`, `makeGhost`). Browser check (a copy, gone in 0.5 s).
- [x] Finisher word a third of the view (`screenWide`), wall words for 20 s (`fx.js` `life`, `STAY_MAX`). Browser checks.
- [x] Heavy blows: double plates, snap zoom (`flatcam.snap`). Browser check.
- [x] Frame edge and paper grain in the Verse composite (`bloom.js`). The pixel check of the street still passes.
- [x] Version 1.23.0 (Quest APK code 30); `pwa.mjs` passes.
- [x] Unit suites pass (action, physics, target, city, street, mobile, mobile panel). Browser suites pass in headless Chromium: verse (32), hero (97), climb (26), fight-moves (25), action (42), perf (16), spider-world (22), street (21), mouse-look (11), layout (422). `fx.mjs` fails one check ("crossing 20 m/s gives one WHOOSH") on main too.
- [ ] Hardware checks: a real phone and a pad. A Quest headset must show no change.
