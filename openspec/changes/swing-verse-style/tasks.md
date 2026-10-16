# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run. Each requirement has SHALL and at least one scenario.

A box is ticked only when the code and a test show the work done.

## Research

- [x] Find the sources for on twos, the colour plates and the shake, and name them in `design.md`.

## The look

- [x] On twos: `H.setTwos` in `hero.js`; main sets 12, or 0 with a full meter or Comic motion Off. Browser check (`qa/vr/verse.e2e.mjs`).
- [x] The Verse pass in the bloom composite: depth texture, plates, impact frame, spider-sense; it runs with bloom off (`bloom.js`). Browser checks on a desktop and a phone.
- [x] Impact frames: 0.07 s, at least 0.5 s apart, Full only. Browser checks.
- [x] Spider-sense from `combat.threat`. Browser check.
- [x] Camera bank in `flatcam.js`, drawn only. Browser check with a body on a circle.
- [x] The Comic motion row (Full, Calm, Off) on the Comfort page, saved (`ui.js`, `main.js`). Calm checked in the browser.

## Combat

- [x] Hit-stop in the loop, by blow weight (`VERSE_HIT`). Browser check reads `hitStop`.
- [x] Shake with trauma (`flatcam.shake`, `post`). Browser check.
- [x] Zip strike: `FIGHT.zip`, `C.zipTarget`, `C.zipHit`, `tryZip`, `zipFrame`. Browser checks (chain, and no zip without a combo).
- [x] Combo words grow. Checked in the code only.

## Release

- [x] Version 1.22.0 in `config.js`, `sw.js` and `quest/twa-manifest.json` (APK code 29); `pwa.mjs` passes.
- [x] Unit suites pass: action, physics, target, city, street, mobile, mobile panel. `ui.mjs` passes.
- [x] `verse.e2e.mjs` and `fight-moves.e2e.mjs` pass in headless Chromium.
- [x] Other browser suites pass: hero (97), perf, action, spider-world, phone-swing, mobile, climb (26), layout, comfort, training, flat (219 checks; this run of flat included its headset part).
- [x] Fixes found by `hero.mjs` and `climb.e2e.mjs` (both pass on main): a yank, an attack, a hit or a roll poses at once; the wall climb and the mantle stay on ones; a teleport poses at once and drops the time before it.
- [ ] Hardware checks: a real phone and a pad. A Quest headset must show no change.
- [ ] Archive this change after the hardware checks.
