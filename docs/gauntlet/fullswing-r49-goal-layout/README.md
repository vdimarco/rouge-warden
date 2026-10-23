# Reuse goal layout inputs

Main updates a private viewport object every projection and uses fixed phone/desktop padding objects. placeGoal still only reads them and returns fresh placement results. All original padding values and live dimensions are preserved; no resize listener, result cache, graphics or input change.

Baseline60projections create60viewport+60paddingobjects per layout; afteroneeach. Five browser checks cover repeated projections,960x540→390x844resize,desktop/phone/desktop padding transitions,freshfinite results/noerrors. Existing goalmark Node/browser suites pass including actual runner CLOSING/FALLING BEHIND behavior. No FPS claim.

Released #662 asa51930fe after all6CI/review/currentlayout+goalmarkdeployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified; SHA25626b6cbe45a9a8e67398f43e21ed59de05e97517c234c8214efb868179688d7fc. OpenSpec CLI unavailable; scenarios manually checked. No physical-device/listening/full-playthrough claims.

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
