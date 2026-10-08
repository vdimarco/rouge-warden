# Last Light

A finite ASCII sailing adventure in Cottage Arcade. Carry sparks through sunset, night coast and aurora fjord; steer around rocks or dash through them. Three hull, three 35-second crossings.

## Play locally

From the repository root:

```sh
python3 -m http.server 8765 --bind 0.0.0.0 --directory public
```

Open http://127.0.0.1:8765/last-light/. Arrows or WASD steer; Space dashes; P or Escape pauses. Touch buttons support phones. New voyage resets the run; best score persists when storage is available.

## Checks

```sh
node --test qa/last-light/engine.test.mjs
node qa/last-light/browser.e2e.mjs
```

The browser check needs the local static server and `qa/browser`'s Playwright installation. Set `LAST_LIGHT_CHROMIUM=/usr/bin/chromium` to use an existing system Chromium when needed.

## Art direction

Reference: https://ascii.rest/#pieces and https://github.com/bas3line/ascii.
All 216 pieces were rendered and reviewed alongside the full catalogue and source, with ocean sunset, night coast and aurora fjord chosen for the voyage. Minimal monospace controls draw on terminal/UI pieces; collectible sparks and patterned water draw on nature/effects pieces.

ASCII is the requested production art. No generated raster sprite substitute is used. The image-generated design concept is a layout guide; original live procedural scenes intentionally take precedence over approximating its generated landscape.

## Vendored scenes

`vendor/ocean-sunset.js`, `night-coast.js` and `aurora-fjord.js` are from bas3line/ascii commit 5e955ca7652cb9ba309c66ce8b4b7c2a862171f9, with TypeScript type annotations removed for static browser loading. Original copyright and MIT license are in `vendor/LICENSE`. The atlas renderer retains scene time across pause/resume and locally renders the original coloured halftone glyphs. No network dependency is required at game runtime.

