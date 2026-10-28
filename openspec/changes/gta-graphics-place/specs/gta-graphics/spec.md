# gta-graphics

## ADDED Requirements

### Requirement: A session can start on Sherbrooke or on Rachel

Sherbrooke is the opening sidewalk and the default. Rachel is a second sidewalk, more than 700 m away, past the curb and short of the wall, with the look running down that street. An unknown place name stays on Sherbrooke. The opening aim and the night hour stay for the default start.

#### Scenario: The default start is the opening

- **WHEN** the player starts without asking for a place
- **THEN** they begin on the Sherbrooke spawn and the opening aim is unchanged

#### Scenario: Rachel is the other start

- **WHEN** the player asks for Rachel
- **THEN** they begin on the Rachel sidewalk, more than 700 m from Sherbrooke, and the look runs down that street

#### Scenario: An unknown name stays put

- **WHEN** the player asks for a place that is not Sherbrooke or Rachel
- **THEN** they still begin on Sherbrooke
