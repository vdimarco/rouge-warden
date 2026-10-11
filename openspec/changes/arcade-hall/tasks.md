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

- [x] Fix the leaderboard endpoint: a null active-time sum and an event without a game id made every request fail with 503, so Plays and Likes sorting had no data. Checked the fixed query against PostHog project 653362.
- [x] Add the analytics script to the nine games that did not record views, plays or likes.
- [x] Make Plays, Views, Likes and Time report when ranking is not available, and ask for activity again.
- [x] Add a visible Old arcade control to the header. Checked in Chromium at 1363×936 and 390×844: no overflow, overlay closes, ALL GAMES reopens it, sorts reorder with mocked PostHog data. Physical phone not checked.
- [ ] Confirm the live endpoint returns 200 after deployment.

- [x] Raise 3D room quality: shaped clearcoat cabinets with neon edges, CRT screens, lit marquees, bloom, mirrored glossy floor, blacklight carpet, light shafts, wall signs, reflection lighting and merged geometry. The hall now grows with the catalog; before, 16 cabinets stood past the back wall.
- [x] Replace the touch D-pad with a floating left-half stick for walking and strafing, right-half look, tap to walk to a cabinet or the floor, click to walk on desktop, and Shift to run.
- [x] Add adaptive quality steps and a script-load error fallback.
- [x] Check in Node (`qa/arcade/room-controls.test.mjs`, `qa/arcade/room-logic.test.cjs`) and in Chromium with SwiftShader at 1363×936 and 390×844: no errors, stick strafes and walks, two thumbs work together, taps walk, the cabinet close-up selects and enables play.
- [ ] Check frame rate and visuals on a physical phone and a hardware GPU. SwiftShader cannot measure real performance.
