## ADDED Requirements

### Requirement: The street column is a framed meter
When the street column is showing, it SHALL draw a paper edge rule and a left accent, and each vitals bar SHALL draw three quarter cuts. The rule SHALL stay inside the column padding. The mission-card words SHALL stay unchanged.

#### Scenario: Read the column at desktop scale
- **WHEN** the street column is shaded at scale 1 on a 1280×720 frame
- **THEN** a paper rule outlines the column, the left edge is the warm accent, and the health bar shows quarter cuts with a lip only over the filled share

#### Scenario: Read the column on a phone
- **WHEN** the street column is shaded on a 390×844 frame
- **THEN** the edge rule is no taller than the 4-scale-unit padding, and the health bar still shows three cuts inside its width

#### Scenario: A calm street
- **WHEN** the player has full health, no armour, no weapon, no stars, and no fresh cash
- **THEN** the column width stays 0 and the frame is not drawn
