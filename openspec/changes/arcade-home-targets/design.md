# Design

## Tap targets and type

The collection row (Cottage, Action, Strategy, GTA, Lab, All Games) used `min-height: 28px` and `font: 8px`. Those controls, the tray controls, Start, and the coin slots now use a 44px minimum height. Start and the coin slots also set `flex-shrink: 0` so a short cabinet cannot squash the hit area.

Visible type uses `12px` or `max(12px, ...)`. The pixel faces are unchanged. Letter-spacing on the sign line stays wide on a large screen and a little tighter under 900px so the longer line can wrap without leaving the header.

A taller header would otherwise cover the machines, because cabinet height was a fraction of the viewport and ignored the sign. Each machine sets `--h` to the smaller of the old cap and the stage height (`100cqh` minus the stage's bottom gap). Width still follows height. No outside rendering source fitted this; it is layout, not a new paint technique.

All Games rules live in `public/arcade/switch.js` and are injected after the home stylesheet. Home overrides use `.gsw.scoreboard` so they win on this page only. Game pages do not use that sheet.

## Fonts

Google's stylesheet for Monoton, Press Start 2P, and Bungee (weight 400) lists 95,976 bytes of woff2 across latin, latin-ext, and other scripts, plus a 3,919 byte CSS file. The home page's copy is latin (it includes é and ¢). A browser only fetched the three latin files, 43,348 bytes.

Those three files are the practical subset. They are served from `public/fonts/` with `unicode-range` set to Google's latin range, so arrows and other symbols still fall through to the next family. `@font-face` uses `font-display: swap`. The style element is marked `data-arcade-fonts`. `switch.js` skips its Google Fonts link when that mark is present, so the home page makes no font request to Google. Game pages without the mark still load their own faces as before.

Licenses: SIL Open Font License texts sit next to the files.

## Leaderboard

`load` and `QUERY` are unchanged, including `AbortSignal.timeout(8000)`.

The in-memory record is `{ at, data, stale }`. A successful read stores `stale: false` and is reused for five minutes. If a refresh throws, and a record exists, the same `data` is kept, `stale` becomes true, and `at` moves forward so PostHog is not called on every hit during the outage. The response is 200 with `stale: true` added beside the original fields. If nothing has been stored, the response stays 503 and `Cache-Control: no-store`.

Count responses (fresh or stale) send:

`public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400`

`stale-while-revalidate` lets the edge serve the cached aggregate while it refreshes. `stale-if-error` covers a cold instance that would otherwise answer 503 and replace that cache.
