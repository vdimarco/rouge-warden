## ADDED Requirements

### Requirement: Sound
Splat Isle SHALL make its sound in the browser, with no sound files: the sea and the wind under everything, crickets at night, slow soft notes in each island's own key, steps, a knock for each hit by what the thing is made of, a burst when a thing breaks and a glide when it pops back, a chime for each thing found, blips under each line a person says, the bell, the well, the flower, the goat, sailing, the lamp lit and dawn. The sound SHALL start on the player's first press. The Sound button SHALL turn it off and on and SHALL share the arcade's one sound switch. The sound SHALL go silent while the page is hidden.

#### Scenario: First press
- **WHEN** a player opens the game and taps the opening words
- **THEN** the sea and the wind start, quietly

#### Scenario: Sound off
- **WHEN** the player presses Sound
- **THEN** the game goes silent and the button shows Sound as off, and the next arcade game also opens with its sound off
