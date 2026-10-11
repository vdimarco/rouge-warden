# Verification

## Corrected behavior

Hazards resolve analytic raft position, action and protection at the exact crossing. Fatal frames stop at the same contact and retain the lethal obstacle in both renderers. One full-width action wave pays one trick. White waterfall/mist cards are absent in Redstone and Moonlit; their solid cliffs remain and Canopy waterfalls remain.

## Source checks

All 97 source tests passed: 45 focused engine/contact/snappy tests, two gameplay tests, and 50 remaining tests. The gameplay proof covers 240 campaigns / 720 stages, 40 seeds, 30/60/120 Hz, with and without Rush, 180–288 ms reaction delay, and no shield rescues. It spans 3,888,000 m, 14,171 tricks and 1,903 Rush activations with at most 59 active entities.

## Rendered checks

Browser plugin unavailable; existing Playwright/Chromium with SwiftShader used. This is not a physical-device FPS measurement.

- Twelve corrected visual contact cases span phone, desktop and short landscape at 5 ms and 50 ms crossings. Exact fatal time/distance/raft pose and frozen pixels pass.
- Same-task framebuffer isolation confirms the retained lethal rock changes 934 phone, 691 desktop and 303 landscape pixels; fallback isolation changes 2,772 pixels.
- Eighteen corrected terrain/bank states cover three layouts, two seeds and all maps. Redstone/Moonlit waterfall and mist counts are zero with cliffs retained; Canopy keeps its waterfall landmarks.
- Hide-only-card isolation identifies the old white strips in both affected maps. Paused and reduced-motion pixels remain exact, shaders compile/link, and no new GPU preparation occurs in those checks.
- Full gorge geometry scan covers 251 course profiles and 1,200 refined candidate frames without any near-raft wall/ledge intersection.

Detailed local evidence is saved outside source in `/tmp/river-redstone-diagnosis/contact-proof.json`, `water-proof.json`, before/after screenshots, and `/tmp/river-rock-investigation.json`.

## Build and publication

Arcade build passes and references `index-MQ4IqNKY.js` and `index-aD_k1wTR.css`. Actual App smoke passes on phone, desktop and short landscape using normal keyboard handlers, the rock-loss dialog, Redstone retry and whole-screen drag. Exact loss/pause pixels and the prepared primary WebGL renderer pass with no shader/link/runtime errors or new GPU preparation. Maximum observed scene work is 32 draw calls and 78,331 triangles. Detailed local proof: `/tmp/river-redstone-diagnosis/app-smoke.json`. Published on GitHub main as `32f809dd941d68b19e6240fa1df47f801a9a9a0f`, preserving unrelated upstream changes. Vercel deployment `dpl_72q4UXfnXZkSvcrwaqvWPU1PX6bu` is READY and the arcade alias points to that exact commit. Live HTML, JavaScript and CSS match the local build byte-for-byte (SHA-256). Receipt: `/tmp/river-redstone-live-assets.json`.

OpenSpec CLI is unavailable. Markdown structure is checked manually; source and browser verification are separate checks.
