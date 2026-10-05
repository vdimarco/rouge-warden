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
