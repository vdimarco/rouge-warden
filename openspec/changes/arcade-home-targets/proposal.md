# Arcade home targets, type, and a stale leaderboard

The arcade home asks for Google Fonts, draws some controls at 28px, and sets several labels at 8px. On a 390px-wide screen those controls are hard to tap, and the small pixel type is hard to read. `/api/arcade-leaderboard` keeps its only copy of a good PostHog aggregate in process memory and answers 503 when a later query fails or hits the 8 second limit.

This change stays on the home page and that one route:

- Collection filters, the Lab link, All Games room links, and cabinet controls are at least 44px tall at 390px wide.
- Visible text on the home page, including All Games, is at least 12px. Press Start 2P, Monoton, and Bungee stay the faces.
- Those three faces, weight 400, latin subset, are woff2 files under `public/fonts/` with `@font-face` and `font-display: swap`. The home page does not request Google Fonts.
- If PostHog fails after a good read, the route serves that aggregate with status 200 and `stale: true`. It returns 503 only when this process has never stored a good result. Count responses send `Cache-Control` with `s-maxage` and `stale-while-revalidate`. The HogQL query is unchanged.

Out of scope: game pages, other `/api` routes, and the in-game switcher on those pages.
