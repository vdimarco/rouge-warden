# Tasks

- [x] Implement entry, traffic transfer, parked cars and patrol behavior.
- [x] Run browser theft and input regression checks.
- [x] Review and archive specs; record limitations.

## Verification

Passed `qa/crimson/theft.mjs` on desktop with real keyboard E entry and all eight vehicle kinds. Passed with `THEFT_TOUCH=1`: portrait rotate-phone overlay, rotation to 844x390, real touch entry and gas for all eight occupied kinds. Both runs cover Gabe passenger/driver seats, traffic identity/tint/damage preservation, cleanup immunity, re-entry, all eleven parked props and collider removal, occupied patrol theft, wreck/speed restrictions and session cleanup. Touch run additionally asserts stolen patrols do not witness themselves.

Passed existing `qa/crimson/touch.mjs` and `qa/crimson/pad.mjs`. The touch test's no-prompt fixture moved away from newly interactive rental cars. Reviewed desktop and phone screenshots at `/tmp/crimson-theft.png` and `/tmp/crimson-theft-phone.png`. No page errors. Syntax checks and `git diff --check` pass.

Run with public served on port 8765:
`NODE_PATH=./qa/browser/node_modules CRIMSON_CHROMIUM=/usr/bin/chromium node qa/crimson/theft.mjs`
Add `THEFT_TOUCH=1` for phone controls.

OpenSpec CLI unavailable; artifact structure and requirement/scenario headings reviewed manually. Real phones and physical gamepads were not tested. No deployment performed.
