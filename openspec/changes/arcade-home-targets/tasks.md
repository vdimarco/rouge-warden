# Tasks
- [x] Raise home controls to a 44px tap height and visible type to at least 12px
- [x] Self-host the latin woff2 files for Press Start 2P, Monoton, and Bungee
- [x] Serve the last good leaderboard aggregate when PostHog fails, with edge cache headers
- [x] Measure tap targets and type at 390px, and screenshot 390, 360, 320, and 1280
- [x] Run the arcade home QA and record pass counts

QA recorded with the change: `groups.e2e.mjs` all passed (desktop, 390×844, 844×390). `analytics.test.cjs` passed, including a stale 200 after a failed refresh. `machines.mjs` still reports `/light-years-home/` with no cabinet (already true on main), the home scoreboard hiding lab-only tiles, Tell Me's arcade link missing its hit target, and phone Tab stops whose Start control sits outside the carousel. The same Tab miss happens on the previous homepage. The lab swipe loop in the layout part did not return under SwiftShader; cabinet geometry at 320, 360, 390, 375, and 1280 was measured separately and the selected machine sits between the sign and the tray. The OpenSpec CLI is not installed, so spec validation and archive were not run.
