# Tasks
- [x] Add dedicated Shift sprint and clearer daytime mid-range hills; verify movement and rendering.
- [x] Implement arsenal selection, props, gunfire, ammo/reload and nonlethal spray.
- [x] Integrate melee feedback, armed police and upgraded patrol physics.
- [x] Add skyward camera look and rotor audio.
- [x] Verify rule tests, browser interactions, screenshots and regressions.
- [ ] Validate with OpenSpec CLI and archive when available.

## Validation

- Follow-up: local Playwright desktop check passes both Shift keys starting/releasing sprint, F retaining guard, and daytime Q1 fog beginning at 385m with its existing 700m far limit. Screenshot: `/tmp/crimson-clear-hills.png`. Eight existing rule tests and diff whitespace check pass. Browser plugin not available; physical keyboard/mobile visual follow-up not tested.

- `node qa/crimson/arsenal.test.mjs`: three tests pass for loadout roles, ray hits/misses, finite ammo and patrol-only tuning. Existing `wanted.test.mjs`: five pass.
- `CRIMSON_CHROMIUM=/usr/bin/chromium NODE_PATH=./qa/browser/node_modules node --max-old-space-size=512 qa/crimson/arsenal.mjs`: desktop 1280×720 and landscape touch 844×390 pass. Checks cover actual number/J/T controls, each firearm, automatic fire, empty magazine, reload and pause, solid cover, civilian damage/crime, nonlethal spray, melee props, officer warning/fire/cover, upward cameras, actual helicopter visibility and touch selection/fire/reload. No browser errors.
- Existing `wanted.mjs` and `street-fights.mjs` both pass after integration, including sheriff arrest, escape, theft ownership and returning officers.
- Screenshots inspected for weapon HUD/aim pose, touch controls and normal-camera helicopter visibility. Rotor synthesis tested with OfflineAudioContext and nonzero RMS output; this is not a subjective listening test. Physical phone, physical gamepad, subjective audio and hardware frame-rate testing remain unverified.
- Browser plugin skill unavailable; used the repository's existing Playwright harness. `git diff --check` and JavaScript syntax checks pass. OpenSpec artifacts reviewed manually; CLI is unavailable, so the change remains active.
