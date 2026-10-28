# Invisible street preparation

A one-line visibility guard skips sign-list rebuilding, time-uniform writes and people enumeration when the street view is hidden. Street simulation is outside this visual update and is unchanged. On showing the street, its next update refreshes signs for the current camera, time and people.

Focused synthetic fixture: 60 hidden updates previously dirtied sign buffers and advanced shader time; now neither changes. Visible initialization and resume still populate the expected one/two signs and people. No FPS benefit, power or affected-browser claim. No physics, anchors, height ceiling, resolution or art change.

## Rubric assessment

All 20 dimensions retain their prior historical assessments as context only; this nonvisual command reduction earns no new points. Aesthetics (composition, lighting, color, detail, texture, character models, environment, vehicles, animation, UI) and playability (responsiveness/input latency, controls, mission clarity, pacing, fun, difficulty, feedback, sound, variety, stability) receive no new acceptance score. Responsiveness and stability remain unverified on the affected Chrome profile; current total and delta withheld.

Review, CI, deployed focused preview, final rebase and production verification remain required. No FPS gate. OpenSpec CLI unavailable; scenarios checked manually.
