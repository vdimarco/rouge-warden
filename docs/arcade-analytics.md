# Arcade popularity in PostHog

The default All Games page ranks games using the last 30 days of production PostHog data. Plays are the default; views, likes and active time are selectable. All counts start with this release. There is no historical Warden data in the connected projects.

## Connected project

Uptick HQ, project **500056**, US Cloud: https://us.posthog.com/project/500056

`public/arcade/analytics.js` uses this project's public capture token and only sends on `arcade.uptick.systems`. It does not load the PostHog SDK, autocapture or session replay. If the project changes, update both the browser capture token and server project ID. Preview and localhost do not send events or likes.

## Enable aggregate reads

In Warden's Vercel project, add `POSTHOG_PERSONAL_API_KEY` as a **sensitive server environment variable**, restricted to the PostHog project and the read permissions needed for Query API. Set it for production and preview, then redeploy. Do not place it in source, a public variable, logs, browser code or chat. Optional `POSTHOG_PROJECT_ID` defaults to `500056`. The host is fixed to US Cloud.

The public capture token cannot query private analytics. Until the read key is configured, `/api/arcade-leaderboard` returns 503 and the playable catalog shows activity unavailable. It never substitutes local launches or invented scores. A successful empty query displays zero activity and collecting status without ranked badges.

## Measurement

- `arcade_game_view`: one catalog destination page visit (`session_id` is a page visit UUID).
- `arcade_game_play`: first trusted pointer/key/gamepad interaction on the page; one per visit. Navigation, text entry and game-switch controls are excluded. This measures engaged visits, not exact game-engine rounds.
- `arcade_game_like`: one-way like per anonymous browser visitor per game, deduplicated by visitor in the 30-day window. Clearing storage may create another anonymous visitor. A saved like does not optimistically alter the global count.
- `arcade_active_time`: small periodic increments of focused, visible time, while interaction occurred within the last 30 seconds and the switch dialog is closed. Blur, hiding and leaving stop collection. This is an engagement estimate, not exact unpaused run duration. Passive watching stops after 30 seconds; some game-specific pause menus may be included during that interval.

Events contain only namespaced app/environment markers, game ID, anonymous visitor ID, visit ID, event ID, timestamp and active seconds. There are no identity calls, replay, entered text, full URLs, email or names. Ingest uses keepalive without retries; blocking analytics or leaving offline can undercount. Client events measure popularity and are not tamper-proof competitive scores.

`api/arcade-leaderboard.js` executes a fixed, bounded aggregate. It exposes only per-game counts, total active seconds and refresh time, caches for five minutes, coalesces concurrent refreshes and returns a generic error on auth/network failure. User-supplied SQL and date ranges are not supported. Private read credentials never reach the client.

## Checks

Run `node qa/arcade/analytics.test.cjs` and the existing arcade checks. The fixed SQL was validated against the connected project with an empty result. After configuring the key and deploying production, visit a game, interact, like a cabinet and hide the tab. Check namespaced events in PostHog and that the shared ranking refreshes. Preview cannot prove production event ingestion.
