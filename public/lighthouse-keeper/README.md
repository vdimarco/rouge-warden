# Lighthouse Keeper

Guide eight approaching boats around the reef to the western harbor. Three wrecks end the watch.

Original bas3line/ascii landscape is reused from `../last-light/vendor/` under its MIT license. Gameplay draws dot sprites on the same 200 × 100 square-cell grid, aligned with the scene waterline. No build is required.

Checks: `node --test qa/scene-games/coastal.test.mjs` and `node qa/scene-games/coastal.browser.mjs` from the repository root. Browser checks use the static site at port 8765 and system Chromium.
