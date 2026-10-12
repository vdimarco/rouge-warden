# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run.

- [x] `mobile.js`: the left half is a move stick under the thumb (walk, run, `sprint`); the right half swings; `pick()` throws the free plunger; `canMove` lets the left half swing before play; no badges; the climb pad keeps only JUMP; the gesture card is two lines.
- [x] `desktop.js`: `PHONE.stick` and `canMove` into `createMobile`; `phone.sprint` into `inp.sprintHeld`.
- [x] `actionhud.js` and `main.js`: no fixed stick and no drive pad; the stick drives through `inp.move`; a tap that reaches only the held building keeps that rope.
- [x] CSS: the ghost and the live stick, JUMP alone on the right, no badges.
- [x] Words: the hint, the card, the title note, How to play, the tutorial, the wall line and the training rows.
- [x] Version 1.21.0 (APK code 28).
- [x] Tests: `mobile.test`, `mobile-panel.test`, `phone-move.e2e` (with a car), `climb.e2e`, `mobile.e2e`, `phone-swing.e2e`, `phone-hold.e2e`, `layout.e2e`, and `phone-controls.e2e`, which passes except its 360×740 score-pill row (that row fails on main too).
- [ ] Try it on a real phone. No phone was available here, so the touch has only run through Chrome DevTools touch events and synthetic pointer events.
