# Reusable street hazard samples

Cars accept an optional hazard output array. The real street frame reuses that array and existing populated records, trimming stale entries as moving-car counts change. Calls without storage still return fresh independent snapshots. Shrinking then growing may allocate new tail records; no extra pooling layer.

Node checks cover100stablelists/recordidentity/reversepositions/freshindependence/shrink/empty/grow and a real pedestrian fleeing a reused hazard. Existing action and street suites pass. Browser instrumentation of the actual cars module records60real street frames using one array, remaining in play without errors. Baseline ignores the supplied output and fails reuse; corrected checks pass.

No physics, controls, anchors, height ceiling, art or resolution change. No FPS claim or benchmark gate. All20rubric dimensions retain historical context only; no new points. Composition, lighting, color, detail, texture, characters, environment, vehicles, animation, UI, controls, mission clarity, pacing, fun, difficulty, feedback, sound and variety receive no fresh acceptance score. AffectedChrome responsiveness/input latency and stability remain unverified; total/delta withheld. No physical-device/listening/full-playthrough claims. OpenSpec CLI unavailable; scenarios manually checked. Review/CI/currentpreview/rebase/production verification pending.
