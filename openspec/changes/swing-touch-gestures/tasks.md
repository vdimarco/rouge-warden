# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run.

- [x] `mobile.js`: a finger still for 0.12 s throws while down and holds its plunger; a lift after 0.35 s lets go (`lets`); a drag within 0.12 s looks and never throws; a cancelled hold keeps the rope; `presses` and `lets` in `sample()`.
- [x] `desktop.js`: `inp.phoneHeld`, `inp.phoneLetGo`.
- [x] `main.js`: no arc, stall or hand-off let-go for a held rope; `phoneLift` before physics with the arc's fling (`phoneLetGo`, shared with the arc let-go).
- [x] Finger rings (`.phone-touch`), the hold hint, and the gesture card (`.phone-coach`, `G.save.seen.phoneCoach`).
- [x] Words: the resting hint, the touch note, How to play.
- [x] Version 1.20.0 (APK code 27).
- [x] Unit tests (`mobile.test.mjs`, `mobile-panel.test.mjs`) and the new `phone-hold.e2e.mjs` pass.
- [x] Phone suites here: `mobile.e2e`, `phone-swing.e2e`, `phone-move.e2e` and `layout.e2e` pass. `phone-controls.e2e` passes except its 360×740 score-pill row, which fails on main too.
- [ ] Try it on a real phone. No phone was available here, so the touch timing has only run through Chrome DevTools touch events.
