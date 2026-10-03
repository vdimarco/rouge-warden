# Tasks

- [x] Tune shared handling.
- [x] Check handling and tour route in browser; report device limitations.
- [x] Review spec structure manually and archive specs (OpenSpec CLI unavailable).

## Verification

Passed `qa/crimson/handling.mjs`, `qa/crimson/touch.mjs`, and `qa/crimson/pad.mjs` using the existing Playwright harness and system Chromium. Keyboard driving tested at 1280x720; touch suite and handling route tested in emulated touch layouts. All eight kinds turn tighter on asphalt and dirt, recenter within 0.15 seconds, stop from 20 m/s within 25 m, and retain reverse and handbrake turns. Gabe's route reached 1.8 m from the vista in 116 seconds. Reviewed `/tmp/crimson-handling.png`. No page errors. `git diff --check` passed.

OpenSpec CLI is not installed; proposal/design/tasks, requirement/scenario headings, and canonical spec were reviewed manually. Real phone and physical gamepad testing were not performed; gamepad tests use simulated standard input. No deployment performed.

Run from repo root with public served on port 8765:
`NODE_PATH=./qa/browser/node_modules CRIMSON_CHROMIUM=/usr/bin/chromium node qa/crimson/handling.mjs`
