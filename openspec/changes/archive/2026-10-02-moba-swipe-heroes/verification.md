# Verification

- All twelve hero GIFs have 24 or 30 actual frames, infinite loop extensions, matching dimensions and byte counts. Leading/trailing magenta reference frames were removed; frame pixel checks found no remaining magenta background flashes. Final GIF budget: about 5.6 MB across the entire roster; only visible and nearby lineup animations load.
- Desktop Chrome at 1363x936: five cards fit across; every hero selects with four matching spells and a GIF source. Native mouse dragging changes selection; Home/End and arrows work; role filters preserve existing preview behavior.
- Start, skillbook overview/progression/combo, HUD plus learning, market pages, instructions through the last page and returning to selection were exercised. Inspected panels show no vertical scrollers and no clipped buttons at this viewport.
- Page identity, meaningful content, absence of framework errors and screenshot evidence checked. Only unrelated browser-extension metadata errors appeared in collected logs.
- All qa/tidebreak/*.test.mjs suites passed, including new real GIF integrity checks and actual shared pointer-handler sequences for all twelve heroes: non-primary training, aimed casting, held movement, cancellation, out-of-bounds release and keyboard activation.
- Responsive CSS uses 3/4/5 cards, zero-minimum viewport rows, safe-area padding, compact portrait/landscape rules and measured dialog pages. Physical phone touch, orientation changes and phone-sized rendered layouts could not be exercised with the available browser API. They remain device validation limits; no claim of physical phone verification is made.
- OpenSpec CLI is unavailable. Proposal, design, tasks and capability scenarios were checked manually, and canonical requirements were updated.
