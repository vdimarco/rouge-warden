## ADDED Requirements

### Requirement: The clock line floors the hour and names the weather

The line is the hour and minute, then the weather name. 15.0 is 15:00. 15.9 is 15:54. An hour past the day clamps to 23:59. The names are CLEAR, BREEZY, OVERCAST, FOG, DRIZZLE, and RAIN.

#### Scenario: A mid-afternoon hour floors

- **GIVEN** the hour is 15.9 and the weather is RAIN
- **WHEN** the clock line is made
- **THEN** the line is 15:54 · RAIN

### Requirement: The play shell can show the line with no host

The play page has a sky plate. A page script can fill it without a running game. An empty line hides the plate.

#### Scenario: An offline frame shows the afternoon

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given 15:00 · CLEAR
- **THEN** the plate is visible
- **AND** the line is 15:00 · CLEAR
