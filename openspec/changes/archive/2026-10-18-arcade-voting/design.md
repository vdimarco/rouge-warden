# Design

Use the documented public route `https://vibetoplist.com/vote/<slug>` from https://vibetoplist.com/api-docs (checked 2026-10-18). A fixed mapping connects existing game IDs to the six user-confirmed listing slugs. No player identifier is passed. No callback, API key, reward, or extra authentication is added.

Use native anchors in a new tab with noopener and noreferrer. Gold text and borders match the arcade palette. Targets are at least 44px tall with cyan keyboard focus. Card links sit outside the game launch anchor. In games, place the current game’s link in the existing menu footer, away from gameplay. In Full Swing retains its lazy-loaded menu.

Check at 320, 390, and 1280px wide. Verify each URL, new-tab behavior, keyboard focus, lack of horizontal overflow, and unchanged Keep playing action. Browser plugin not available; use Playwright.

The browser check found that the existing header forced the catalog wider than a 320px viewport. Allow its card to shrink and its heading to wrap at that width so the vote links remain within the screen.
