# Clog guard source reuse

The recurring guard selector reads city.clogs and completed save IDs instead of constructing the full game.targets snapshot. Initialization normalizes saved IDs into game completion state; flush updates both synchronously. Positions are copied unchanged from city data. Reset reloads the page and recreates the guarded set. Public target snapshots are unchanged.

Node reference equivalence covers all generated clogs, completed IDs, repeated calls, fresh sessions and the 140m boundary:20 spawns identical,96 target snapshots before versus zero after. Five browser checks exercise actual main guard code and real game.clearClog synchronization. Existing action Node suite passes. Fixture development initially captured city/combat before initialization; test-only getters fixed that, with failure logs retained externally. No runtime fix was needed.

Released in PR#650 as5f5c85f5 after review/all6CI/current10deployedchecks/fresh rebase before and after preview. Production main.js HTTP200 exactly matches the merged bytes; SHA2569ea7f755a4e6a8ec8d7ef33b7c5fcef657f5f22e5cd06bd1bb0aa422070ffee7. No FPS benefit claim or benchmark gate. OpenSpec CLI unavailable; scenarios manually checked. No physical-device, listening or full-playthrough acceptance.

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
