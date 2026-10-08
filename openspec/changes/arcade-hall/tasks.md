- [x] Implement ranked default All Games view (initial local launches superseded by shared PostHog metrics).
- [x] Build neon 3D room with desktop/touch input and cabinet launching.
- [x] Check desktop catalog rendering, search, launch ranking persistence and WebGL fallback on deployed preview.
- [x] Check storage failure paths, scene construction, desktop/touch movement, collision, selection and launch in Node.
- [ ] Check 3D visuals and performance in a browser with WebGL, plus a physical phone. Cloud Chrome has WebGL disabled; local Chromium download is invalid.
- [ ] Validate through OpenSpec CLI and archive once visual checks pass. CLI is unavailable. Markdown structure inspected.

- [x] Replace local leaderboard with PostHog views, plays, likes and active time sorting.
- [x] Instrument every catalog destination without replay or preview pollution.
- [x] Add bounded, cached server aggregate queries and document private read credential setup.
- [x] Verify query against the connected project, endpoint failure paths, tracking lifecycle, and rendered ranking controls.
- [ ] Configure a private PostHog read credential and verify live production collection after deployment.

Desktop preview checks passed on commit 173d54f: plays is selected by default; views, likes and active time update selection; title search and empty results work; metric definitions expand; all 23 games remain playable in the missing-key state. PostHog accepted the fixed query with an empty result and expected taxonomy warnings for the newly defined events. Capture/API lifecycle checks pass. Physical phone, WebGL room visuals and live production ingestion remain unverified.
