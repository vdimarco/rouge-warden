# Design

## Where the Corridor comes from

The Corridor is one self-contained HTML file, kept in its own repository (`afterglow-corridor`): raw WebGL, inline art and fonts, no libraries. `scripts/import-corridor.py <that index.html>` writes `public/corridor/index.html` from it. The script makes five changes and stops if any of its anchors is missing:

- the title and head tags become the arcade's (icons, description, share image, canonical `/`)
- the game links lose `https://arcade.uptick.systems`, so a preview deployment opens its own games
- the wordmark links to `/`
- an All games link (`/?view=classic`) joins the top bar
- at 760px and narrower the top bar has no room, so the same link is added to the category strip after the page builds it

Run the script again after the Corridor changes. Do not edit `public/corridor/index.html` by hand, with one exception: cabinets for new arcade games, described below.

## Cabinets added in this repository

Lake Brawl, Eleven Wells and Warden's Ledger joined the arcade after the import. Their cabinets were added directly to `public/corridor/index.html`, because the source file is in another repository (`afterglow-corridor`). The source needs the same three entries before the next import. An import without them removes the cabinets, and `qa/arcade/machines.mjs` then fails.

Each cabinet is these edits to the page:

- a 448 by 370 WebP in `ART`, as a data URI
- an entry in `PIECES` after the last cabinet of its group, with `n` renumbered so the numbers have no gap
- the written counts: `--n`, the aria label, the role line, the index, the counter, and the count in words in the two About texts
- three light slots in the tunnel shader: `uPP`, `uPC`, the loop bound, `lightPP`, `lightPC`, and the two offsets (`n` and `2n`)

Lake Brawl is cabinet 08, the last of Cottage. Eleven Wells is cabinet 40 and Warden's Ledger is cabinet 41, the last of The Lab. Title, route and subtitle come from `public/arcade/switch.js` and the hall cabinet's marquee. The dot color is the hall cabinet's `--c1` for Lake Brawl (`#1F5FD0`) and `--c2` for Eleven Wells (`#FFB547`) and Warden's Ledger (`#F3CF7A`).

The screens:

- Lake Brawl: `public/arcade/key/lake-brawl.webp` (480 by 270), cropped to the screen's shape around the two fighters and scaled to 448 by 370.
- Eleven Wells: the hall art (`public/arcade/eleven-wells.webp`, 480 by 207) is too wide to crop to this shape. The screen is drawn from the game's own page: its title in the middle, with the eleven game-card pictures above and below. The cabinet marquee shows the middle band of the art, so the title is there.
- Warden's Ledger: the hall art (`public/arcade/ledger.webp`, 480 by 360), with 22 pixels cut from each side to make the screen's shape, scaled to 448 by 370. It shows a checked map delivery and its payment quote.

No rendering technique is added. The art goes through the page's existing texture path.

No rendering technique is added here. The Corridor's shaders and geometry arrive as they are.

## Choosing the view

A short script at the top of `public/index.html` decides before anything else loads:

1. `?view=classic` stores `arcade.view = "classic"` in localStorage and stays. `?view=walk` removes it and goes to `/corridor/`.
2. A stored `classic`, any hash, an automated browser (`navigator.webdriver`) or a browser that cannot create a WebGL context stays on this page.
3. Otherwise `location.replace("/corridor/")`, so Back does not return to a page that redirects again.

Automated browsers stay because about forty QA scripts open `/` and expect the hall and All Games. `qa/arcade/default-view.e2e.mjs` hides that flag to act as a visitor. Link previews and crawlers that do not run scripts keep reading the home page's tags.

A redirect was chosen over moving the hall to another path. The hall owns the hash routes, the share tags and the return path from every game, and all of those keep working untouched.

## Controls

- Corridor, wide: `All games` in the top bar, the same glass pill as Index and Contact (38px).
- Corridor, 760px and narrower: `All games` as the last pill of the category strip (36px), which already wraps.
- All Games, wider than 480px: `Corridor ↗` beside Old arcade and 3D arcade.
- All Games, 480px and narrower: `Corridor view` in Menu, because a third link in the bar runs under the title at 320px.

## Order

The hall is built once from its game list, so the Order control stores the choice and reloads the page. The import script bakes the dates from `public/arcade/game-dates.json` into the page, so the first visit sorts without waiting. The page also reads that file in the background and keeps it in localStorage (`corridor-dates`) for the next visit, so a run of `qa/arcade/game-dates.mjs` reaches the Corridor without another import.

## Known limits

- The Corridor has 42 cabinets. Frostwing's cabinet (18, the last of Action) is part of `openspec/changes/add-frostwing`.
- The Corridor file is 1.4 MB before compression, because its art is inline.
- Each cabinet uses six uniform vectors in the tunnel shader. At 42 cabinets the shader declares 266. A device that allows 256 or fewer shows the flat list. A third of the light slots (`n` to `2n`) are always dark. Without them the shader declares 182, so the source can drop them.
- On a phone, the picture of an open cabinet can sit partly behind the next section sign. This applies to the last cabinet of each group, and it was so before Lake Brawl and Eleven Wells took those places.
- The Corridor does not rebuild its scene after a lost WebGL context.
- A game opened from the Corridor does not add to the Plays count that All Games keeps on the device.
- Frame rate on low-end phones is not measured.
