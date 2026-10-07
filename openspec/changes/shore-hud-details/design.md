# Decisions

## Skill card
`skill-card.js` builds one `#skill-card` element in the HUD. `main.js` gives it a function that returns live data for a slot: name, key, rank, mana, cooldown at the current rank (rank 1 for an unlearned skill), tags, description and a status line ("Ready", "Ready in 4s", "Need 20 more mana", "Not learned yet. Press + to learn it.", "Learn at level 3", "Respawning"). It refreshes every 250 ms while shown.

- A mouse uses `pointerenter` and `pointerleave`. Keyboard focus shows the card only for `:focus-visible`, because a tap also focuses the button.
- A touch listens on the skill cluster in the capture phase, so the casting code still gets the press. A press in a gap between skills picks the nearest skill, as the reach layer does. The card hides 2.5 s after release.
- The card sits above the highest of the skill, its "+" badge and the point button, so it covers none of them. It takes no presses.
- The old native `title` on the skill buttons is removed, so two tooltips do not show at once.

## Night Market
The panel pager measures blocks and moves those that do not fit to the next page. A relic's detail (trade-off, inherited powers, recipe) is tall. With the item list beside it, the detail and the list moved to pages 2 to 4, and page 1 showed only the tabs. The market now skips the pager and the whole panel scrolls. The Relics tab also selected the recommended item, not a relic; a tab now selects its first item.

## Next purchase
`nextPurchase` returns an item only when it can be bought. When it cannot, the HUD walks the goal's recipe to the first missing part, so the preview always names the next step. The icon is grey and the price reads saved/needed until it can be bought; then the icon glows and the price turns gold. The goal (`nextItem`) shows as a small corner icon when it differs from the next step.

## Second pass: compact phone card and the quick-buy tab
- On the phone layouts (the same media queries as the bar) the card adds the class `compact`. It keeps the head (key, name, rank diamonds), puts mana, cooldown and status on one line, and shows only the first sentence of the description, clamped to two lines. It is 236 px wide and about 85 px high, down from 290 x 161 px.
- The compact card sits at the left edge of the bar, over the items. Its top is above the bar, the quick-buy tab and any badge or point button under it, so it covers none of them. A touch now keeps it 1.8 s after release.
- The card head is a `div`, not a `header`: the HUD's own `#hud header` rule (44 px high, 60 px left padding) also matched the card's header.
- The quick-buy tab is absolute inside `#loadout`, with `grid-area:auto` so its frame is the whole item block and not its old grid cell. It sits on the frame above the items. On large screens the attack status moves above the tab and the Hunted mark onto the portrait. On upright phones the tab sits at the top left of the bar and hides the item name; the movement pad moves up to 166 px and the rally button to 276 px. In landscape the death recap moves up to 122 px to clear the tab.
