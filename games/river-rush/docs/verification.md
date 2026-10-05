# River Rush runner verification — 2026-10-05

The boring treasure race was replaced by an endless three-lane runner. Verification below applies to the runner build, not the archived race/Surge release.

- `npm test --prefix games/river-rush`: 14/14 pass. Includes short-tap/lane limits, log/jump and branch/duck outcomes, fatal wrong actions, shield/grace, cancellation/buffering, coin streak expiration, eight-second magnet, Rush duration/invulnerability/no self-recharge, deterministic legal routes, versioned score validation and challenge rewards.
- Delayed-input playtest: 40 seeds × 240 seconds, 180–288 ms decision delay, all survive without relying on an initial shield. 2,719 successful tricks; 939 Rush activations; 404,283 total metres. At most 58 live entities. The scripted player reads upcoming obstacles; this verifies reachability and timing, not subjective fun or human difficulty.
- `node qa/river-rush/runner.mjs`: pass at 1536×1024, 390×844, 844×390 and the native concept viewport 1024×1536. Real keyboard and touch-button inputs, CDP directional touch swipes, actual first log/branch collision clearance, protected/unprotected failures, direct Enter retry, saved best, malformed save fallback, cabinet launch, shared switcher, live reduced-motion and video-error fallback. Pause preserves identical simulation state and canvas pixels. No JS errors or failed same-origin asset responses.
- The real browser play segment ran 32.88 seconds, cleared six perfect actions and three challenges, collected 156 coins and activated Rush. Warm active-play frame sample: mean 16.67 ms, p95 16.8 ms in this headless Chromium environment. This is a browser measurement, not a physical-phone performance guarantee.
- The test status observer uses a test-only WebMCP shim; a separate page also starts without WebMCP support. State waits explicitly await the actual snapshot, rather than treating a promise as a successful predicate.
- Native `view_image` inspection compared the concept and final gameplay capture at 1024×1536, plus mobile/desktop/landscape, duck and result states. The five-point comparison ledger is in design.md. Corrected blocky scanline water, HUD darkening, portrait scenery stretching and transition-time result captures. Rounded compact panels and live Rush/challenge copy are intentional concept adaptations.
- `npm run build:arcade --prefix games/river-rush`: pass. Shared quiet/switch scripts remain unbundled external arcade scripts; their Vite informational warnings are expected. New generated assets and bundle are committed in the existing `/river-rush/` output.
- OpenSpec change validation: strict/no-interactive pass. Archive/canonical validation and live deployment verification are recorded after publication.

Browser checks use Playwright Chromium because no callable interactive-browser tool was available. Physical iOS/Android, Safari and listening on audio hardware were not tested. Visibility/audio checks emulate browser visibility events separately from input testing.

## Production release

Implementation commit `98034315674f6107c295491fd33e1c5a523b0dd6` deployed READY as `dpl_HY4d5tzwHvp3wLTGBP5NjHLrFMSy`, with aliases `arcade.uptick.systems` and `warden-alpha-wheat.vercel.app`. Published HTML, JS, CSS, all three new gameplay art files and the Higgsfield menu video match the locally verified bytes by SHA-256.

`node qa/river-rush/live.mjs` passed at https://arcade.uptick.systems/river-rush/ with 390×844, real browser touch events and DPR2: jump and duck clear the opening hazards without losing the shield, pause stops time, touch retry starts a fresh run, title video plays, no overflow, no JavaScript errors or failed same-origin responses. `node qa/river-rush/lifecycle.mjs` also passed visibility-event pause, suspended Web Audio, identical paused pixels and mute control.

The final documentation commit archives this completed change; it does not change the verified game bundle.

OpenSpec archive completed as `2026-10-05-river-rush-endless-runner`; canonical River Rush specification passed strict validation and its purpose was updated to the runner. All task checkboxes reflect completed work.

## Living motion verification — 2026-10-05

- `npm test --prefix games/river-rush`: 19/19 pass. Five additional motion tests verify simulation-time freezing, real pose interpolation, pickup source lanes and expiry, bounded buffers, live reduced-motion presentation and exactly one non-scoring landing per completed jump. The unchanged 40-seed delayed-input playtest retains the same 2,719 tricks, 939 Rush uses and 404,283 metres.
- `node qa/river-rush/runner.mjs`: all four viewports pass with real keyboard, touch buttons and directional touch swipes, hazard clearance, shield/Rush, retry, storage, cabinet/switcher, live preferences and identical paused canvas pixels. Thirty-three seconds of active keyboard play: ten tricks, two goals and 141 coins. Warm active-play frame sample: mean 19.44 ms, p95 33.3 ms in headless Chromium, within the 55 ms regression budget. This is not a physical-device measurement.
- Native inspection compared the new phone and 1024×1536 game captures to the accepted concept and inspected both fal.ai video frames plus generated paddle frames. The eight-frame cycle preserves the approved likeness and loincloth; river clips preserve the existing environment without added hazards. All controls and HUD remain readable; flying coins briefly pass in front of the character as collected.
- fal.ai MiniMax H3 Max produced both five-second 768P loops. Published rate was $0.03/second, estimated $0.30 for both requests. Production copies are silent H.264/24fps with faststart: portrait 768×1152, 3,442,472 bytes; landscape 1152×768, 2,659,873 bytes; actual encoded duration 5.166667 seconds. Original endpoints, request IDs and CDN URLs are preserved in media.json.

- `node qa/river-rush/motion.mjs`: pass. Portrait and landscape verify lazy silent gameplay video, visible water/character motion, action poses, paused state and identical pixels, live reduced-motion toggles and menu playback stop. Independent cases verify video-error GPU fallback, forced WebGL context loss, combined unavailable video/WebGL, data-saving mode without gameplay-video downloads, and hidden-page pause. No page errors.
- `node qa/river-rush/lifecycle.mjs`: pass; visibility events suspend Web Audio, freeze pixels and preserve mute control. Physical phone switching and hardware audio remain untested.
- Production rebuild and strict OpenSpec change validation pass. Vite warnings remain the expected external quiet/switch scripts.

The first motion implementation `3b1b29df8adbdded1b95d1833aeed578182b4902` deployed READY as `dpl_AG6cwkrUmQtqcgzKS4Dv1BoE8dEZ` on the existing production aliases. HTML, JS, CSS, all runner art, paddle atlas, both fal.ai clips and menu video matched local SHA-256 bytes. Live touch and motion checks both passed on arcade.uptick.systems. A subsequent loading/pause review adds recovery from an interrupted `play()` promise: an intentional AbortError from pause must not permanently mark the clip failed. The focused browser check now delays video loading, pauses before readiness, verifies frozen pixels through late decode and resumes normal animation.
