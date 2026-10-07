# Skill details, market relics and the next purchase in Shore of the Ancients

The player asked for three things:
- See what a skill does when the mouse is over it, or when they tap it on a phone.
- Fix the Night Market: no relics showed up.
- See a preview of the recommended next purchases in the HUD.

## Scope
- A skill card above the command bar. It shows the skill name, key, rank, mana cost, cooldown, tags, what the skill does and why it cannot be used now. A mouse shows it on hover; keyboard focus shows it too. A touch shows it while the finger is down and for 2.5 s after release. A tap still casts.
- The Night Market is no longer cut into pages. The whole panel scrolls. A category tab selects its first item. On narrow screens the item list comes first, and a chosen item scrolls its detail into view.
- The quick-buy button shows the next purchase: its icon and price, or the embers saved toward it, and a small icon of the build goal. A press still buys it.

## Capabilities
- Modify `moba-skills` and `moba-ui`.
