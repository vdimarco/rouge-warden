# Verification

## Reproduction

Baseline natural generation across 150 seed/maps postponed the first required jumps to 959–2,701 m. Seventy-two normal jump timing trials cleared their logs but could not collect the mixed low/raised trail. The raised pickup rule worked; conflicting low gold and disconnected lane cues caused the complaint.

## Final local checks

- Final engine/generation/contact suite: 63 tests pass. Two additional terrain-order tests pass, covering seeded variation, nonrepeating neighbors, finite-map coverage and consistent next-section cues.
- 486 natural first-jump trials across 18 seeds, all three maps, 30/60/120 Hz and .22/.32/.42 s requested leads collect all 2,430 arc coins. Actual applied leads range about .195–.418 s. Lateral pickup radius remains .25 lanes; legacy launch-frame and action/contact tests pass.
- 105 naturally generated seed/maps introduce required logs by row 3 and branches by row 5, bound action droughts and equal formations to three intervening/repeated rows, and show varied lane holds/spacing. Independent review of 300 maps confirms required jumps by 251/298/346 m and ducks by 391/451/509 m, 100 distinct hazard routes per map and noncyclic terrain orders.
- All 240 unshielded delayed-input campaigns finish all 720 stages at 30/60/120 Hz with 180–288 ms delays, with and without Rush: 20,336 tricks, 2,164 Rushes, 3,888,000 m total; active entities peak at 52. No shield rescues are used.
- Review caught optional ground coins requiring a 49 ms lane change and early low ribbons crossed before landing during Rush. Final log routes contain only their five raised arc coins; compact low ribbons and later finish gold resolve those conflicts. Across 2,706 changed-lane reward transitions, minimum time is 429.7 ms at maximum Rush speed. Fifty-four naturally earned-Rush stages collect all 13,684 aligned ground coins and 864 finish coins, with 384 earned Rushes.
- Natural 150 seed/map chain review: 403 advertised Wave Trains provide at least three eligible log rows; 39 truncated encounters suppress the chain cue. Independent 300-map review agrees for all 809 advertised chains.
- Six preceding built-candidate actual-App runs on phone/desktop with early/normal/late inputs collect all 30 arc coins, clear required jumps and ducks with protection intact, and emit flights from the shared numeric heights. The final exact `index-CzEJCImM.js` phone probe also passes with all five arc contacts/flights, required duck, protection intact, all coin cues and no active GPU preparation/errors. The real 2D renderer shows 36.06 pixels of difference between numeric .35/.95 heights and launches a physical pickup flight from the matching height; measured positions agree within .001 pixel. No App state or clock mutations are used.
- Final arcade build passes: JavaScript `index-CzEJCImM.js`, 1,067,749 bytes, SHA-256 `c2f5899e7f4d160ecdc81f756d5dbdb566c99d321435f677e816635fcb86913d`. CSS `index-BttXBCLJ.css` is unchanged (33,889 bytes, SHA-256 `6517ad030e1900dda887e6c15822a45cddd2b54f4d3d26b35d922f109d30ed95`). Local music and generated model assets are unchanged.

The compact [browser receipt](browser-receipt.json) identifies the candidate and final versions, measurements and limits. `qa/river-rush/jump-routes.e2e.mjs` retains the natural-input and isolated fallback checks.

## Limits and publication

The OpenSpec CLI is unavailable; Markdown requirements/scenarios are checked manually. Browser checks use Chromium/SwiftShader and viewport layouts, not physical phone hardware or hardware frame-rate measurement. Production publication and exact asset/live-play checks remain pending.
