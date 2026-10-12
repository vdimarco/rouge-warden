# Echoes Under Ice

Recover six hidden bells using sonar before oxygen or the 150-second dive expires. Recharge near the surface.

Original bas3line/ascii landscape is reused from `../last-light/vendor/` under its MIT license. Gameplay draws dot sprites on the same 200 × 100 square-cell grid, aligned with the scene waterline. No build is required.

Checks: `node --test qa/scene-games/coastal.test.mjs` and `node qa/scene-games/coastal.browser.mjs` from the repository root. Browser checks use the static site at port 8765 and system Chromium.
