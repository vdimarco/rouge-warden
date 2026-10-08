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

The user provided the capture key for new PostHog project arcade (653362). Capture and aggregate project defaults now match that project. The endpoint accepts lowercase posthog_personal_api_key and posthog_project_id as well as uppercase names. A sensitive lowercase read-key variable exists in Vercel production; its value cannot be read via the connector. Actual read authorization still needs a deployed production check. The official wizard v2.81.0 could not download its required skills and made no tracked changes.

- [x] Condense header and move summary below the games.
- [x] Add Featured default order and preserve genuine metric sorts.
- [ ] Verify rendered first viewport, sticky header, search and menu; report untested phone checks.
