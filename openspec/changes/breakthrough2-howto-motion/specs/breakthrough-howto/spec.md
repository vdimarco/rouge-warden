## ADDED Requirements

### Requirement: Motion how to play
How to play SHALL show a motion stage with the century, a turn, heat lag, the hold path, the energy race, and pathway stages.
#### Scenario: Phone sheet
- **WHEN** the player opens How to play at 390 by 844
- **THEN** one scene is visible in the stage
- **AND** the close control is at least 44px tall
- **AND** the sheet still explains a 6 or 10 year step, the Idea Lab, quiet policies, the 2.0° mark, the grid pilot gate, and the UNEP and Ember context
#### Scenario: Motion on
- **WHEN** motion is allowed
- **THEN** the active scene animates
- **AND** the stage advances to the next scene on its own
#### Scenario: Motion off
- **WHEN** `fast=1` is set or the player prefers reduced motion
- **THEN** the stage stays on a still frame
- **AND** choosing another scene still shows that scene
