# Skill details, market relics and the next purchase in Shore of the Ancients

The player asked for three things:
- See what a skill does when the mouse is over it, or when they tap it on a phone.
- Fix the Night Market: no relics showed up.
- See a preview of the recommended next purchases in the HUD.

After trying it, the player said that on mobile the skill card took too much space and asked for a shorter card, perhaps at the left where the items are. They also asked for the quick buy to sit on the top row, above the items, and to be clearly a quick buy.

## Scope
- A skill card above the command bar. It shows the skill name, key, rank, mana cost, cooldown, tags, what the skill does and why it cannot be used now. A mouse shows it on hover; keyboard focus shows it too. A touch shows it while the finger is down and for 2.5 s after release. A tap still casts.
- The Night Market is no longer cut into pages. The whole panel scrolls. A category tab selects its first item. On narrow screens the item list comes first, and a chosen item scrolls its detail into view.
- On phones the skill card is compact: the name and key, one line with mana, cooldown and status, and the first sentence of the text. It sits at the left of the bar, above the items, away from the skills.
- The quick-buy button is a tab labelled QUICK BUY on top of the bar, above the item slots. It shows the next purchase: its icon, name and price, or the embers saved toward it, and a small icon of the build goal. A press still buys it. The market button fills the item column.

## Capabilities
- Modify `moba-skills` and `moba-ui`.
