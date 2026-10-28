## ADDED Requirements

### Requirement: The clog distance keeps up
While the card says to flush the clogs and names a district, the distance on that card SHALL drop on the next frame when the hero moves toward that clog. The compass SHALL keep naming that district.

#### Scenario: A step closer
- **WHEN** the card names a clog and the hero moves toward it
- **THEN** the distance on the card is shorter within the next few frames
- **AND** the compass still names that district
