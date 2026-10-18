# Tasks

- [x] Bake module `public/fish/js/sea-waves.js` (spectrum, looping FFT, slopes, Jacobian foam with fade and drift), run in a worker (`sea-waves-worker.js`) with a main-thread fallback.
- [x] Unit test `qa/fish/sea-waves.test.mjs`: deterministic, bake time, loop seam, tile wrap, crest squeeze, foam share, foam fade, foam drift.
- [x] Shader: sample the tile at Gull Rock (`waves` in the look), both styles, both qualities; fade in over one second.
- [x] Free the GPU texture when the player leaves Gull Rock (travel loop in `world.render.mjs`: no texture leak).
- [x] Credit web-ocean: code header, `public/fish/js/LICENSE-web-ocean.txt` (bundled in the app), `public/fish/art/README.md`, the About credit line.
- [x] Render Gull Rock before and after (`WORLD_PLACES=sea node qa/fish/world.render.mjs`) and tune the foam; run the full render for every place (106 shots, OK; draw calls and triangles unchanged).
- [x] Loon Lake and Cedar River cast shots match the base build, apart from the random sun sparkle that also differs between two runs of one build.
- [x] Motion: frame-to-frame change is steady over 24 frames (no pulse at the baked-frame steps); aim dots, rings and wakes stay above the foam.
- [ ] Phone check on a real device (feel of the motion, worker start in the iOS and Android apps).
