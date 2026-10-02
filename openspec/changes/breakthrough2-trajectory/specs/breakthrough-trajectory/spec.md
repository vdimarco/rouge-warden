## ADDED Requirements

### Requirement: Real trajectory
The play screen SHALL show warming history and a forward path computed from the current sim state.
#### Scenario: Hold path
- **WHEN** a run is in progress
- **THEN** the chart history matches the log and the opening stock
- **AND** the forward warming matches stepping the world with no new card
- **AND** a band contains that forward line
- **AND** the heading names the ending `judge` would give the hold path
#### Scenario: Tipping mark
- **WHEN** the hold path crosses 2.0 degrees
- **THEN** the chart marks that crossing
- **WHEN** warming is already at or above 2.0
- **THEN** the screen says the tip is already past

### Requirement: Live indicators
The play screen SHALL show per-meter sparklines and deltas, warming stock and lag, pressure between meters, emissions against removal, ending shares, and the turn log.
#### Scenario: Same numbers in node and the page
- **WHEN** the browser and the headless model start the same seed
- **THEN** their indicator objects match
#### Scenario: Phone layout
- **WHEN** the viewport is 390 by 844 or a supported landscape size
- **THEN** the path and the choice targets remain usable

### Requirement: Motion
Motion SHALL ease meter fills and numbers, move the map with the stocks, and stay still when the player prefers reduced motion or `fast=1` is set.
#### Scenario: Reduced motion
- **WHEN** reduced motion is on
- **THEN** the path and indicators still render and the page does not run the drift loop
