## ADDED Requirements

### Requirement: Show the ending before the result card
Small Worlds SHALL keep the scene moving after a world ends, and then show the score and how it compares with the player's best.

#### Scenario: An outro with input off
- **WHEN** a world ends
- **THEN** the scene keeps moving at half speed for 1.6 s, input does nothing, and no card covers the scene

#### Scenario: The card compares the score with the best
- **WHEN** the outro ends
- **THEN** a card rises from the bottom with the score and one of "Your first score in this world.", "New best. Your old best was N.", "You matched your best." or "N short of your best, M."

#### Scenario: A loss sounds like a loss
- **WHEN** a world ends in a loss
- **THEN** the card plays a falling pair of notes instead of the rising chime of a win

### Requirement: Today's world
Small Worlds SHALL open each world on a seed from the date, so the crew plays the same world each day.

#### Scenario: Open a world with no seed in the link
- **WHEN** the player opens a world with no `seed` in the link
- **THEN** the world uses today's seed, and the intro card and the result card say "Today's world"

#### Scenario: Leave today's world
- **WHEN** the player presses "A different world"
- **THEN** the next run uses another seed, and the cards no longer say "Today's world"

#### Scenario: Share a score
- **WHEN** the player presses Share after a run
- **THEN** the shared text gives the world, the score and the unit, and the link carries the same seed
