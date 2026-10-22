# Round42: building-supported swings

Removes the player-facing sky fallback from flat automatic swinging. Existing real-building search and ground-clearance validation remain; no artificial height ceiling. Real-building attachments above rooftops are allowed; the player must still be within reach.

Baseline browser: two failures show attached sky ropes over water and1500m above city. Candidate3/3 passes, no errors. Existing integrated chain6/6 passes: real building attachment, distinct next building, release behavior, no water rope, no errors. Synthetic software-browser checks only; no physical-device/user-Chrome/performance/full-playthrough acceptance. Screenshots are candidate controlled chain probes, not comparative aesthetic evidence.

No score increase. Responsiveness and stability remain unverified; total withheld. Rendering and physics unchanged. All review/CI/deployed-preview/rebase/production gates remain pending.

Follow-up: reachable surfaces that cannot support assisted ground clearance use the existing ordinary rope physics, rather than an invisible sky anchor or a rejection. The visible lock-on is a fallback for building searches. No physics constants changed. Roof113.5m→real roof111.5m attachment verified. All54 focused swing/bot assertions pass, including three real buildings in16.6/17.4/17.4s at original±10° headings. The three-building goal and30s limit remain unchanged. Updated simultaneous-input assertion allows idle secondhand when no different building qualifies.
