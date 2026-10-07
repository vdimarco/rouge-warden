# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run.

- [x] Reproduce in the browser with real multi-touch (Chrome DevTools touch input). In the emulator both plungers fire and a drag turns the view, so the fixes aim at what differs on a real phone: lift timing, and the camera follow taking the view back.
- [x] The move stick: `PHONE.stick`, the stick element in `actionhud.js`, the vector in `inp.move`, sprint at the rim, hidden while driving.
- [x] Free look: `PHONE.follow.idle` from 0.7 to 2.5 s.
- [x] The pair: `d.both` and `state.pairs` in `mobile.js`, `inp.phonePair` in `desktop.js`, `firedPair` in `phoneHandoff`, and a `handoff` ring event.
- [x] `qa/vr/phone-move.e2e.mjs` with real touch events: walk, sprint, stop, drag look, look holds in flight, the pair, the handover. With the pair fix turned off, the pair check fails.
- [x] Version 1.18.0 (APK code 25); `pwa.mjs` passes.
- [ ] Regression suites: `mobile.test`, `mobile-panel.test`, `mobile.e2e`, `phone-swing.e2e`, `phone-controls.e2e`, `spider-world.e2e`, `fight-moves.e2e`, `action.e2e`.
- [ ] On a real phone: the user checks the stick, the free look and a two-thumb press.
