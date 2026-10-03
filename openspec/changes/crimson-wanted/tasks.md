# Tasks

- [x] Extend street fighting with civilian hit reactions and combat-capable police/sheriffs.
- [x] Implement police dismount/return and theft-safe vehicle ownership.
- [x] Verify police fighting, theft, pursuit cleanup and shared input controls.

- [x] Inspect crowd, cast, combat, vehicles, UI and existing QA.
- [x] Implement contacts, melee damage, reactive civilians and death animation.
- [x] Implement wanted escalation, police/sheriff chases, helicopter, search and arrest.
- [x] Add readable wanted HUD, minimap units and pursuit audio.
- [x] Run rule tests and browser integration checks; inspect desktop/touch captures.
- [x] Manually review proposal, design and requirement/scenario structure.
- [ ] Run OpenSpec CLI validation and archive completed work (CLI unavailable).

## Validation

- Crash follow-up: source recovered from PID 844962's core returned `returningPatrol.vehicle.controller` from the pursuit assertion, causing the controller object graph to cross the Playwright boundary. The working file already converts it to `!!returningPatrol.vehicle.controller`; retain that conversion. `CRIMSON_CHROMIUM=/usr/bin/chromium NODE_PATH=./qa/browser/node_modules node --max-old-space-size=512 qa/crimson/street-fights.mjs` passes both desktop and touch scenarios with a 512 MiB Node heap cap. No heap-limit increase or gameplay change was needed.
- Follow-up `qa/crimson/street-fights.mjs` passes with system Chromium: occupied patrol seats reject entry, regular police brake/dismount, officers pursue and retaliate, J punches raise heat, K knocks out a weakened officer, E steals the vacated patrol, W drives it on a clear road, escape preserves ownership, reset removes retained vehicles, and living officers return to their own vehicles and resume pursuit. Landscape touch CUT and USE also pass with no browser errors. Desktop and touch screenshots inspected.
- Follow-up reran `wanted.mjs` and all five rule tests successfully. Arrest now measures player movement/attack input on foot rather than treating an officer's knockback as a voluntary escape.

- `node qa/crimson/wanted.test.mjs`: five rule tests pass.
- `CRIMSON_CHROMIUM=/usr/bin/chromium NODE_PATH=./qa/browser/node_modules node qa/crimson/wanted.mjs`: Chromium/SwiftShader checks cover keyboard acceleration, lethal forward/reverse contacts, pause, dispatch, bounded five-star escalation, moving pursuers, helicopter, search/escape, melee deduplication, sheriff dismount/arrest, reset and landscape touch acceleration. No browser errors.
- Screenshots inspected at 1280×720, 390×844 desktop and 844×390 touch. Touch remains landscape-only, matching existing game behavior.
- The existing `qa/crimson/van.mjs` slope fixture fails at 0.04 radians on both this change and untouched HEAD served separately; all its other checks pass. No unrelated slope changes made.
- Unit counts are bounded to four ground units and one helicopter. One Q1 helicopter-view sample records 36 draw calls and 114,122 triangles; this is not a hardware frame-rate benchmark.
- Physical phone, physical gamepad and subjective audio checks remain unverified. OpenSpec CLI validation was unavailable, so the change remains active rather than claiming a completed archive.
