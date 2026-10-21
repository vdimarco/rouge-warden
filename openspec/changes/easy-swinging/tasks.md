# Tasks

- [x] Version 1.24.2 in `config.js`, `sw.js`, and `quest/twa-manifest.json` (APK code 33).
- [x] `easyAnchor`, `armEasy`, `easyBoost`, rope cap, ground shorten, bottom pump in `physics.js`.
- [x] Chase-view hold uses the auto anchor. Phone taps, first person, headset, test aim, and a wall keep the old aim.
- [x] Ink line, sag, fade, speed lines, `window.__test.swing`.
- [x] In the 3D scene the web is a world-space line, about 2 px wide at 1280 at every distance. Speed lines stay on the overlay.
- [x] `qa/vr/easy.test.mjs`: 20 open-ground swings attach with no scrape; 10 swings keep average speed.
- [ ] `openspec validate` — the CLI is not installed in this environment, so this check did not run.
- [x] Browser: a swing chain at 390×844 and 1280×800, including an off-screen anchor line. Frame time at both widths is under a 60 Hz budget. Existing `qa/vr/*.test.mjs` and e2e scripts pass.
