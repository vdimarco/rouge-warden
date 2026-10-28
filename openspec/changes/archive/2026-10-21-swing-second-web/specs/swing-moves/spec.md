## ADDED Requirements

### Requirement: A second web takes a different building
In flat chase view, a second swing while one web is already on a building SHALL attach to a different building when one is in reach. Two swing inputs in the same frame SHALL do the same. That second web SHALL NOT add a kick while the first is already attached. The easy web's reported hand end SHALL be the hero's hand.

#### Scenario: The other hand
- **WHEN** one web is on a building and the player fires the other hand
- **THEN** the new web is on a different building and it does not kick

#### Scenario: Both inputs in one frame
- **WHEN** the player presses both swing inputs in the same frame
- **THEN** the two webs are on two different buildings
