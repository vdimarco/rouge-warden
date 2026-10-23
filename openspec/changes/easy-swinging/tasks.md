# Tasks

- [x] Version 1.24.2 in `config.js`, `sw.js`, and `quest/twa-manifest.json` (APK code 33).
- [x] `easyAnchor`, `armEasy`, `easyBoost`, rope cap, ground shorten, bottom pump in `physics.js`.
- [x] Chase-view hold uses the auto anchor. Phone taps, first person, headset, test aim, and a wall keep the old aim.
- [x] Ink line, sag, fade, speed lines, `window.__test.swing`.
- [x] In the 3D scene the web is a world-space line, about 2 px wide at 1280 at every distance. Speed lines stay on the overlay.
- [x] Headset comfort: while a headset session is in play, the game does not yaw the view to follow a swing. The stick snap and smooth turn stay. A swing starts from that hand's trigger. `qa/vr/headset-comfort.test.mjs`.
- [x] `qa/vr/easy.test.mjs`: 20 open-ground swings attach with no scrape; 10 swings keep average speed. The gold-ring lesson attaches 30 of 30 ropes to the tower, including when the auto point is inside it. A marked point within 16h beats that building. A held building rope stays until the button comes up. `h` is 1.8 m and the 16h cap is 28.8 m (an open-ground rope of 25.3 m, a longer span clamped to 28.8 m).
- [x] Left swing button fires the left rope and the right button the right rope (`buttonHand`), including 10 of 10 at a 1280-wide view.
- [ ] `openspec validate` — the CLI is not installed in this environment, so this check did not run.
- [x] Browser: a swing chain at 390×844 and 1280×800, including an off-screen anchor line. Frame time at both widths is under a 60 Hz budget. Existing `qa/vr/*.test.mjs` and e2e scripts pass.
- [x] Browser: the gold-ring tower holds the rope at 390×844 and 1280×800, the left button fires the left rope 10 of 10 at 1280, and the page reports 0 errors. `qa/vr/gold-ring.e2e.mjs`.
- [x] Chase-view gold-ring rope is the ink web: a mid-swing frame and a frame about 100 ms after release at 1280×800 and 390×844. Ink `#2B2A33`, about 2 px at 1280, drawn to the anchor, gone by 150 ms. The aimed cup stays easy-off. `qa/vr/gold-ring.e2e.mjs`.
