# Reuse registered goon rope records

Private GOON_ROPE stores each complete target record rather than just its chest position. Reconciliation updates t.pos and reuses the registered record until removal. Removal deletes the cache entry at the same lifecycle point. No public API, target eligibility, anchor, physics or graphics changes. Job records retain their independent fresh-record contract.

Baseline60movingframes produce60desiredrecords; corrected Node test producesone, with stable live chest coordinates and fresh record/position after removal and return. Existing100cycle target reconciliation and action suites pass. Four browser checks use an actual spawned goon, real combat selection and real rope registration across60manualreconciliations, checking position/identity/removal/return/noerrors. Existing4realframechecks also pass. No FPS claim.

Released #658 as6aa20d58 after all6CI/review/current26deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified; SHA256a0ea0e75ff5f569a142b19b95458a03f651b95cf9172fb6ec57c3ec539718f95. OpenSpec CLI unavailable; scenarios manually checked. No physical-device/listening/full-playthrough claims.

| Dimension | Assessment |
| --- | --- |
| Lighting | Unchanged scope; no fresh acceptance score or new points. |
| Color palette | Unchanged scope; no fresh acceptance score or new points. |
| Detail density | Unchanged scope; no fresh acceptance score or new points. |
| Texture and material quality | Unchanged scope; no fresh acceptance score or new points. |
| Composition and camera | Unchanged scope; no fresh acceptance score or new points. |
| Atmosphere | Unchanged scope; no fresh acceptance score or new points. |
| Character models | Unchanged scope; no fresh acceptance score or new points. |
| Animation smoothness | Unchanged scope; no fresh acceptance score or new points. |
| Particles and VFX | Unchanged scope; no fresh acceptance score or new points. |
| UI polish | Unchanged scope; no fresh acceptance score or new points. |
| Responsiveness and input latency | Affected Chrome unverified; no hardware score. |
| Controls feel | Unchanged scope; no fresh acceptance score or new points. |
| Mission clarity | Unchanged scope; no fresh acceptance score or new points. |
| Pacing | Unchanged scope; no fresh acceptance score or new points. |
| Fun factor | Unchanged scope; no fresh acceptance score or new points. |
| Difficulty curve | Unchanged scope; no fresh acceptance score or new points. |
| Feedback | Unchanged scope; no fresh acceptance score or new points. |
| Sound design | Unchanged scope; no fresh acceptance score or new points. |
| Variety | Unchanged scope; no fresh acceptance score or new points. |
| Performance stability | Affected Chrome unverified; no hardware score. |

Total and delta withheld. Historical rubric numbers are context only.
