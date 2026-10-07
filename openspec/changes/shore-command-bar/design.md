# Decisions

The bar is CSS only, in `public/tidebreak/command-bar.css`. `main.js` loads it after `skill-controls.css`, so it wins over the old thumb fan rules. Its rules start with `#hud` for the same reason. The markup does not change, so every script that reads the skill buttons, the "+" badges, the bars and the item slots keeps working.

The frame is `#hud::before`. It paints under all HUD children, so the item slots in `#loadout` (before `#controls` in the markup) stay on top of it. It catches pointer events, so a click between two buttons does not reach the battlefield canvas. The camera push reads the mouse on `window`, so it still works over the bar.

## Layouts
The three media queries cover every viewport:
- `(min-width:1040px) and (min-height:600px)`: the large row. At 1040 px the 700 px bar starts 4 px right of the movement pad. A large touch screen (`pointer:coarse`) gets 34 px badges.
- `(max-height:599px) and (min-width:540px)`: the landscape row, 516 px wide (415 px from 540 to 699 px wide), anchored to the bottom-right corner.
- `(max-width:1039px) and (min-height:600px), (max-width:539px)`: the stacked bar, `min(100vw, 440px)` wide and centred.

Large row, from the screen centre line: portrait at -338 px (92 px wide), skills at -236 px (four 66 px squares, 10 px apart), items at +72 px.

On phones the order changes for the thumb. A centred row put R about 390 px from the corner at 844x390. In the landscape row, the order is items, portrait, then skills, so R is 82 px from the corner. In the stacked bar the skills are at the right of the top row.

The spell name labels stay in the markup for screen readers and are hidden on screen. The key cap and the art name the skill. The automatic attack status shows above the items on large screens and is hidden on phones, where there is no room.

On upright phones the team chat moves to the right, above the point button, so it does not cover the movement pad.

The skill reach layer in `skill-reach.js` measures the buttons, so it follows the new row without change.

The death recap moves with the bar on phones. In landscape it sits above the bar, between the movement pad and the skill column. Upright, it sits right of the movement pad and above the point button.

## Compact phone bars and the new look
The player said the phone bar took up too much space. The landscape row went from 98 px to 82 px high and from 516 px to 458 px wide. The upright bar went from 160 px to 124 px: the bars became a 10 px strip along the top, the skills went from 60 px to 52 px, and the items went into one 32 px row. The movement pad moved down with it, from 214 px to 134 px above the bottom edge.

The look stays inside the game's bronze, gold and parchment palette, with the cyan of selection feedback as the accent:
- The frame (`#hud::before`) has cut top corners from `clip-path`, a top bevel, an inner dark rim and a faint diagonal texture from a repeating gradient. Box shadows outside the frame are clipped, so it uses inset shadows only.
- The gold trim (`#hud::after`) is a gradient line with an inline SVG jewel at its centre. Each layout sets the frame box in `--fx`, `--fw` and `--fh`, so the frame and the trim always line up.
- A skill that can be used now has a gold ring and a soft glow; the ultimate uses the hero colour. Unlearned skills are desaturated. A cooldown is a dark veil with a large number.
- The mana track is the `::before` of the bar box, because the mana fill sits outside that box. Health ticks repeat every 24 px, so they do not stretch as the fill changes.
- The "+" badges are gold coins. They pulse unless the player asks for reduced motion.
