# Full Swing flat-page visibility

## Requirements

### Requirement: Hidden flat pages freeze gameplay simulation
Flat Full Swing SHALL preserve the hero's physics state while the document is hidden and resume simulation when it becomes visible.

#### Scenario: Hide a moving hero
- **GIVEN** a flat game is playing and the hero is moving
- **WHEN** the document becomes hidden and further simulation callbacks occur
- **THEN** the hero's position does not advance
- **AND** flat input reports not visible

#### Scenario: Return to the page
- **WHEN** the document becomes visible again
- **THEN** input reports visible and normal simulation resumes
- **AND** no catch-up simulation of the hidden interval is introduced
