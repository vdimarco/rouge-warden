## ADDED Requirements

### Requirement: The corner blades hang on the wood pole
City pole 13707 SHALL be the wooden utility pole at (-38893.9, 46509.5, 18). The street blades on that pole SHALL leave out their own post. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: The surveyed pole is wood
- **WHEN** city pole 13707 is read
- **THEN** its kind is wood and its base is (-38893.9, 46509.5, 18)

#### Scenario: The opening camera stays
- **WHEN** the avenue is framed
- **THEN** the look stays at pitch −16 and the socket stays at Y 70 and Z 110
