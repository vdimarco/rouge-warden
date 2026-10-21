## ADDED Requirements

### Requirement: The nearest crown sheds a few leaves
When the player is within 18 m of a tree that was just drawn, that crown SHALL shed up to eight autumn cards. A card SHALL drift across and down from about 4.2 m above the trunk, and SHALL disappear after 2.2 s. A tree farther than 18 m SHALL shed none. The rain streak shader SHALL stay unchanged.

#### Scenario: Cards leave the crown
- **WHEN** the player stands near a tree on the opening walk camera
- **THEN** ochre cards sit out from the crown, lower and farther across than a card that was just born, and the crown without them does not

#### Scenario: A distant tree stays still
- **WHEN** the nearest tree is 18 m or farther
- **THEN** no leaf card is spawned

#### Scenario: Rain is untouched
- **WHEN** the leaves are added
- **THEN** the rain streak displacement is unchanged
