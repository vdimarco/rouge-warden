# Verification

## Gameplay and automated checks
- Full `npm test --prefix games/river-rush`: 221 tests passed, zero failed or skipped. See `proof/tests.log`.
- New choice coverage: 216 complete safe/risk/abort courses across 30/60/120 Hz, early/late jump leads, earned Rush, two seeds and all maps. Every selected token collected; 9,360 untaken alternatives missed; 568 physical enter-then-bail decisions; no losses or shield consumption. Maximum observed 24 visible coins and 44 entities.
- Twelve matched natural jump/duck stations: safe 30 base coin points versus guarded 100 coin points plus 100 unprotected skill points. Gold Boost applies honestly; protected impacts earn no skill reward; wrong unprotected actions lose. A partial duck-route grab and physical bailout pays only its contacted coins.
- Thirty-six seeded maps: 325 decisions, counts 79/110/136 by map; 172 deeper entries and 168 deeper exits. Real mean entry width increases from 1.13 to 1.72 lanes and exit width from 1.26 to 1.67. Both actions, native branches and all three enemy species occur.
- Relic-chasing regression: 180 complete courses, 480 relics and 15,630 primary arc coins collected, 3,420 untaken guarded arc coins missed, 564 earned Rush activations; no losses or shields consumed.
- Actual pickup tolerances, heights, streak/charge advancement and bounded pools remain unchanged. Terrain-boundary re-planning recomputes the final jump clearance rather than relying on the relocated row's old action.

## Build and source freeze
`npm run build:arcade --prefix games/river-rush` passed. Bundle `index-DDzMwcui.js`, stylesheet `index-CMCYypmh.css`; approved living title, arcade analytics and switch script preserved. See `proof/build.log`. Existing non-module static-script and large-bundle warnings remain. Source/build manifest checked unchanged after testing.

## Browser verification
Source renderer fixtures passed all three viewport layouts in WebGL and the 2D fallback, with visibly distinct premium denomination, unchanged pool capacity and preparation resources, and exact stopped pixels. Natural actual-App runs passed at 390×844, 1365×900 and 844×390. Each used real keyboard handlers with an unchanged seed, clock and state, collected three safe ordinary coins versus five guarded premium coins plus a physical perfect clear, and missed the untaken adjacent ribbon. Desktop included a swooping-bird guard. Running screenshots show the cue before contact with working inputs and within viewport bounds. Steering error remained below 1e-7; visible gold stayed at or below 24 with no overflow; uploads/shaders remained fixed at 52/76. Settled-and-hidden pause overlays permit exact scene-status and pixel-hash comparison. See `proof/phone-natural.json`, `proof/desktop-natural.json`, `proof/landscape-natural.json`, and their playing screenshots.

An initial QA interruption came from formatting a giant failed PNG Buffer diff while the pause overlay was still fading; the checker now waits for the overlay to settle, hides it, and compares pixels with a compact hash on failure. All three fresh runs passed at unchanged normal rendering quality. Incomplete interrupted receipts are excluded. Production verification follows publication.

## Validation limits
OpenSpec CLI is unavailable; delta/canonical Markdown structure and scenario checks are validated directly. Chromium uses SwiftShader with emulated viewport sizes; physical-phone frame rate, human reaction difficulty and audible listening are not claimed. Source renderer/matched-station fixtures explicitly own their setup; natural App checks retain the game's original seed, clock and state. No public leaderboard scores are submitted.
