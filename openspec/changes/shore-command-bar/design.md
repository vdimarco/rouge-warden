# Decisions

The bar is CSS only, in `public/tidebreak/command-bar.css`. `main.js` loads it after `skill-controls.css`, so it wins over the thumb fan rules. Its rules start with `#hud` for the same reason. The markup does not change, so every script that reads the skill buttons, the "+" badges, the bars and the item slots keeps working.

The media query is `(hover:hover) and (pointer:fine) and (min-width:1040px) and (min-height:600px)`. A mouse is the signal for the desktop bar; a touch screen keeps the thumb fan, which suits two thumbs. At 1040 px the 700 px bar starts 4 px right of the movement pad.

The frame is `#hud::before`. It paints under all HUD children, so the item slots in `#loadout` (before `#controls` in the markup) stay on top of it. It catches pointer events, so a click between two buttons does not reach the battlefield canvas. The camera push reads the mouse on `window`, so it still works over the bar.

Layout from the screen centre line: portrait at -338 px (92 px wide), skills at -236 px (four 66 px squares, 10 px apart), items at +72 px (three 58 px columns and one 72 px column for the market and quick-buy). The spell name labels stay in the markup for screen readers and are hidden on screen; the key cap and the art name the skill. The automatic attack status sits above the item slots.

The skill reach layer in `skill-reach.js` measures the buttons, so it follows the new row without change.
