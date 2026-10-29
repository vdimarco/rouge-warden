# Increment 71 — materialize the selected street car once

Baseline: main `6fa470d2b0f4913342d5c30b242a1c1eaed46986`, preserving all concurrent Full Swing and NORD work. OpenSpec `full-swing-traffic-winner` preceded runtime edits. `nearTraffic` keeps the winning index during its unchanged scan, then creates one fresh result and paint array. No caller changes. Four progressively closer candidates previously created four result records/paint arrays; now one. A miss still creates none. This is a work-count observation, not an FPS or latency result.

`baseline.log` fails only the new one-materialization assertion (4 versus 1); all equivalence and ownership checks already pass. `candidate.log` passes 300 exact query comparisons over four headings, clock wraps, lane fades and reach boundaries, seven filter/tie/fallback cases, retained snapshots, and hit/miss materialization counts. `action.log` records existing car/combat/job simulation checks. `browser.log` contains five actual assertions: exact selected car/steal/entry/exit/stats/events and exact nonblank pixels at 640×360 and 390×844, plus no page errors. The browser uses SwiftShader and isolated rendered car scenes; this is not a full city playthrough or physical-device check. Both after images were visually inspected.

Before/after PNG SHA-256 values are identical per layout:
- 640×360: `d9bab503043a489acb0d0ba374cfab1b255bee0f3437b737405d2fe720871bd9`
- 390×844: `3429a091422b924280376fa856eb85a40ee67776b3be63f8b8193fcb2a218d23`

## Release state and prior archive reconciliation

Runtime release is pending fresh six-job CI, successful automated review, current authenticated preview/exact bytes, rebase before and after preview, exact-head merge and production verification. Canonical scenarios and archive follow release. `openspec` CLI is unavailable; Markdown structure/scenarios are checked manually.

PR #712 was externally merged by vdimarco at 2026-10-27 20:43:14 UTC as `aa7368eec26fa6b3e42efc3cdca81d8a77d32df5` from `63b75416bf37f7b92e77df444b0afb6fba2e52ce`. AgentReview remained absent; the only new check was neutral Entire Gates. Fresh six-job CI, authenticated final preview and required rebases were not completed before that external merge. No future waiver is inferred. #785 merged afterward and changes NORD only. #712 has no runtime changes. `archive712-production-bytes.json` verifies HTTP 200 and exact current-main index/cars/combat bytes on Oct 27; it does not verify the combined runtime's behavior. Oct 25 production #711 action/frame evidence remains historical.

## All twenty rubric limits

No points or inherited hardware scores are awarded; total and delta remain withheld.

| Dimension | Evidence and limit |
|---|---|
| Lighting | Isolated car pixels identical; full city lighting not reassessed. |
| Color palette | Selected paint and rendered colors identical in the fixtures. |
| Detail density | No scene content changed; city density not reassessed. |
| Texture/material | Same car models/materials and exact fixture pixels. |
| Composition/camera | Test cameras unchanged; full city composition not reassessed. |
| Atmosphere | No atmosphere change or new assessment. |
| Character models | No character changes or new assessment. |
| Animation smoothness | No real display cadence or hardware motion measurement. |
| Particles and VFX | No VFX changes or new assessment. |
| UI polish | No UI change; isolated scene checks do not assess HUD polish. |
| Responsiveness/input latency | No affected Chrome 120 Hz access or hardware timing; not claimed fixed. |
| Controls feel | Steal/entry/exit simulation matches; no physical input-device assessment. |
| Mission clarity | Existing action/job simulation checked; no new player clarity assessment. |
| Pacing | No pacing change or full-playthrough assessment. |
| Fun factor | No play-session or user-fun assessment. |
| Difficulty curve | No difficulty change or full progression assessment. |
| Feedback | Relevant car events match; no general feedback assessment. |
| Sound design | Audio disabled in focused browser fixture; no listening claim. |
| Variety | No content added or variety reassessment. |
| Performance stability | Redundant result construction reduced in the fixture; no FPS/benchmark merge gate, measured hardware benefit or combined-production behavior claim. |
