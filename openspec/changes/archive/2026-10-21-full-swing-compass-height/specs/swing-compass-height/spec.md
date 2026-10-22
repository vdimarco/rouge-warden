## ADDED Requirements

### Requirement: Flat compass indicates vertical separation
For a selected target at least five metres above or below the player, the flat compass SHALL show the vertical separation rounded to five metres with the word above or below. Near the same height it SHALL omit this cue. The existing horizontal distance, bearing and target selection SHALL remain unchanged, as SHALL headset behavior.

#### Scenario: Target above or below
- **WHEN** the player is thirty metres below or above the selected target
- **THEN** the compass reads 30 m above or 30 m below respectively

#### Scenario: Vertical movement at constant horizontal distance
- **WHEN** the player changes height while remaining fifty metres away horizontally
- **THEN** the height cue updates while the horizontal distance stays 50 m

#### Scenario: Near the target height
- **WHEN** the player is less than five metres from the target's height
- **THEN** the height cue is empty

#### Scenario: Portrait display
- **WHEN** a player views the compass at 390 pixels wide
- **THEN** both distance lines fit inside the viewport without horizontal scrolling
