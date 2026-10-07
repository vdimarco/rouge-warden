# Command bar in Shore of the Ancients

The player asked for a HUD for the buttons at the bottom centre of the screen, like Dota. The first pass added it for desktops. The player then asked for the same HUD on mobile.

Before this change the skills sat in a thumb fan at the bottom right, the health bar at the bottom left and the item slots at the bottom centre. The eye had to move to three corners.

## Scope
- Every screen shows one framed command bar at the bottom. It holds the hero portrait and level, the four skills in a row (Q, E, C, R), the health, mana and experience bars, and the six item slots with the market and quick-buy buttons.
- Large screens (from 1040x600): one 700 px row at the bottom centre. The order is portrait, skills over the bars, then items.
- Short landscape screens (under 600 px high): a smaller row at the bottom right. The order is items, portrait, then skills, so R is near the corner under the right thumb.
- Upright and mid-size screens: a stacked bar across the bottom, up to 440 px wide. The top row has the portrait at the left and the skills at the right. The middle row has the bars, and the bottom row has the market, quick-buy and six item slots. The movement pad and the rally button sit above the bar.
- Each skill keeps its key cap, rank pips, cooldown, lock state and "+" upgrade badge. The "+" badges and the skill point button sit above the row.
- No change to controls, keys, the simulation or the markup.

## Capabilities
- Modify `moba-skills`.
