## ADDED Requirements

### Requirement: Night Market shows every category
The Night Market SHALL show the items of the chosen category on its first view, with the first item selected. The panel SHALL scroll as one page.
#### Scenario: Open the relics
- **WHEN** the player opens the Night Market and chooses Relics at 1440x900, 390x844 or 844x390
- **THEN** relics show in the list at once, and the detail shows the first relic.
#### Scenario: Choose an item on a phone
- **WHEN** the player taps an item in the list on a narrow screen
- **THEN** the panel scrolls to that item's detail.

### Requirement: Next purchase preview
The quick-buy button SHALL be a tab labelled QUICK BUY on top of the bar, above the item slots. It SHALL show the next item the build recommends: its icon and price, or the embers saved toward it when it cannot be bought, and the build goal it leads to. A press SHALL buy that item when it can be bought.
#### Scenario: Find the quick buy
- **WHEN** a match runs at 1440x900, 390x844 or 844x390
- **THEN** the QUICK BUY tab sits above the item slots and overlaps no other control.
#### Scenario: Save toward the next item
- **WHEN** the player has fewer embers than the next item costs
- **THEN** the button shows the item's icon in grey with saved/needed embers, and a press buys nothing.
#### Scenario: Buy the next item
- **WHEN** the player can afford the next item
- **THEN** the icon glows with its price, and a press buys it.
