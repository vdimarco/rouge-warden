# Design

## Where the Corridor comes from

The Corridor is one self-contained HTML file, kept in its own repository (`afterglow-corridor`): raw WebGL, inline art and fonts, no libraries. `scripts/import-corridor.py <that index.html>` writes `public/corridor/index.html` from it. The script makes five changes and stops if any of its anchors is missing:

- the title and head tags become the arcade's (icons, description, share image, canonical `/`)
- the 38 game links lose `https://arcade.uptick.systems`, so a preview deployment opens its own games
- the wordmark links to `/`
- an All games link (`/?view=classic`) joins the top bar
- at 760px and narrower the top bar has no room, so the same link is added to the category strip after the page builds it

Run the script again after the Corridor changes. Do not edit `public/corridor/index.html` by hand.

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

## Known limits

- The Corridor file is 1.3 MB before compression, because its art is inline.
- The Corridor does not rebuild its scene after a lost WebGL context.
- A game opened from the Corridor does not add to the Plays count that All Games keeps on the device.
- Frame rate on low-end phones is not measured.
