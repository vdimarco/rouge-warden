## ADDED Requirements

### Requirement: The upper back reads as its own cloth

In the chase view, the hero's jacket SHALL show a darker panel on the upper back, above the cream belt. The belt SHALL stay cream. The panel SHALL stay on the red cloth, and it SHALL move with the hips when the body rolls. No new mesh is added.

#### Scenario: Standing, seen from behind

- **GIVEN** flat play, the chase camera at rest, and the hero standing
- **WHEN** the player looks at the hero's back
- **THEN** the upper back is a dark wine panel, and the cream belt is still at the hips

#### Scenario: The street is unchanged

- **GIVEN** the street camera, where the hero is hidden
- **WHEN** the avenue is drawn
- **THEN** the facades and the ink lines are the same as before the panel
