# Command bar in Shore of the Ancients

The player asked for a HUD for the buttons at the bottom centre of the screen, like Dota. The first pass added it for desktops. The player then asked for the same HUD on mobile. After that, the player said the bar took up too much space on mobile and asked for a better look.

Before this change the skills sat in a thumb fan at the bottom right, the health bar at the bottom left and the item slots at the bottom centre. The eye had to move to three corners.

## Scope
- Every screen shows one framed command bar at the bottom. It holds the hero portrait and level, the four skills in a row (Q, E, C, R), the health, mana and experience bars, and the six item slots with the market and quick-buy buttons.
- Large screens (from 1040x600): one 700 px row at the bottom centre. The order is portrait, skills over the bars, then items.
- Short landscape screens (under 600 px high): a compact 82 px row at the bottom right. The order is items, portrait, then skills, so R is near the corner under the right thumb.
- Upright and mid-size screens: a compact 124 px stacked bar across the bottom, up to 440 px wide. The bars run as a strip along the top. The middle row has the portrait at the left and the skills at the right. The bottom row has the market, quick-buy and six item slots. The movement pad and the rally button sit above the bar.
- The look: a frame with cut top corners, a gold trim with a small jewel at its centre and a faint texture. Skills are gold-rimmed sockets that glow when ready, with a key chip, rank diamonds and a mana-cost chip. The bars are glossy, and the health bar has segment ticks. The portrait carries a gold level medallion, and the item slots are recessed sockets.
- Each skill keeps its key cap, rank pips, cooldown, lock state and "+" upgrade badge. The "+" badges and the skill point button sit above the row.
- No change to controls, keys, the simulation or the markup.

## Capabilities
- Modify `moba-skills`.
