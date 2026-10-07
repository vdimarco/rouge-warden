# Verification

## Implemented behavior

Two-octave periodic gradient noise gives rounded Canopy hills, eroded Redstone terraces and broken Moonlit ridges. CPU bank/scenery heights and GPU ground share the field. Added relief fades outside the shore and does not displace playable lanes. A six-slot 64 m ring per bank gives 384 m contiguous coverage plus two reusable upcoming descriptors. Absolute matrices remain stable within a section; boundary updates upload one 16-float range per bank. A prepared distance fade hides a new far slot before it becomes visible. Fallback branches now receive the same immutable map profile.

## Source and geometry

- `npm test --prefix games/river-rush`: all 106 tests pass, including five noise checks, four streaming checks and 240 complete simulated campaigns at 30/60/120 Hz without shield rescues.
- Noise values and derivatives meet at positive/negative period seams; seed variation, distinct map shaping, relief bounds and shoreline fade pass.
- Streams retain all object/buffer identities through the three finite maps, seeks, pauses and seed resets; coverage stays 32–96 m behind and 288–352 m ahead.
- Independent geometry scan covers 26,857 cases and 238,952 actual shoreline triangles across all 251 reduced seeds/maps/acts. Minimum clearance beyond the outer raft envelope is 6.59285 m. Added relief is exactly zero in 1,047,423 lane samples.
- 585 duck trees, 390 scenic trees and 3,765 finish layouts retain root/dock registration; dock error is at most 1.78e−15 m.

## Actual rendered checks

Browser plugin unavailable; existing Playwright/Chromium with SwiftShader used. Physical-device FPS is not measured.

- Actual WebGL2 RGBA32F readback covers 2,160 CPU/GPU samples across maps, seeds and chunk/act distances. Maximum bank-height error is 0.0000333 m, maximum full world-coordinate error 0.00470 m, and adjacent chunk edges agree exactly.
- All nine map/layout combinations render opening/late seeded terrain, and all three finish gates retain readable banks and lanes. Phone, desktop and short-landscape screenshots were inspected. Branches remain anchored, paused/reduced pixels are exact, all relevant shaders compile/link, and no new post-prepare GPU texture/shader work occurs.
- A same-origin far-slot isolation initially found 62–70 popping pixels. The final fade yields exactly zero inserted-slot pixels at both 32 m and 96 m boundaries. Restoring the slot is pixel-exact.
- GPU instrumentation records no terrain writes inside a chunk and exactly two 64-byte bufferSubData writes per boundary. Pending update ranges are consumed. The same six instances per bank persist; draw calls do not double (24/27/29 in final map fixtures), with at most 94,675 triangles in those frames.
- Profiled fallback branches on Redstone and Moonlit preserve paused/reduced exact pixels.
- The final arcade bundle passes actual App keyboard/pointer play on phone, desktop and short landscape without engine or clock mutations: physical rock death, contact freeze, retained obstacle, result screen, retry, screen-wide drag and exact pause pixels. Terrain retains six slots and two upcoming descriptors, with 336–342 m ahead in captured runs. There are no runtime/shader errors or post-prepare texture uploads/compiles; observed maximum is 32 draw calls and 74,745 triangles.

Detailed local evidence is saved outside source in `/tmp/river-seamless-terrain/{gpu-parity,terrain-qa,final-probes,app-smoke}.json`, matching screenshots, and `/tmp/river-terrain-clearance.json`. The pre-fade insertion report is retained separately and is not final passing evidence.

## Build and publication

Arcade build passes and references `index-BICyYle8.js` and `index-aD_k1wTR.css`; final-bundle actual App smoke passes on all three layouts. Runtime commit `90d9eb8d275c2da7d5deab3d8a48307d1588905f` is published to GitHub main. Production deployment `dpl_GL5mC6sbjYy2syeuu11FQdUUwyPw` is READY, and a direct lookup confirms `arcade.uptick.systems` serves that exact commit.

Live HTML, JS and CSS all return HTTP 200 and match the built files byte-for-byte. HTML SHA256 is `cdddc9db74b95af564b44c8c96d7572bc0dd043669cda25f0bcc419df9a02f9f`; JS SHA256 is `e4cd8101f3a0d087b74248613cf4f5e9ae3e24addc35716666a98d63d5eb7c6a`; CSS SHA256 is `d2bb8fc0e83bf5ecf0a628811d380fd855648e7132600d3c0c9bb7c623693eac`. Receipt: `/tmp/river-seamless-live-assets.json`.

Focused public-URL phone App smoke also passes with the exact JS/CSS and all detailed models ready. Actual screen-wide pointer drag moves to lane 2; the run reaches 46 m, recycles a section, then pauses with exact pixels. Six slots, two upcoming descriptors and 337 m ahead coverage remain. No runtime/shader errors, post-prepare texture uploads/compiles, game/clock mutations or leaderboard writes occur. Evidence: `/tmp/river-seamless-terrain/live-phone-smoke.json` and matching screenshot. The completed change is archived; subsequent documentation publication does not alter the verified runtime bytes.

The rock/white-bank correction was separately verified and deployed as `32f809dd941d68b19e6240fa1df47f801a9a9a0f`; this upgrade retains it.

OpenSpec CLI is unavailable. Markdown structure is checked manually, separately from source and rendered checks.
