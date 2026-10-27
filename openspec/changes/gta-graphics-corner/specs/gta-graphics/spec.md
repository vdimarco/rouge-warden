## ADDED Requirements

### Requirement: A corner camera for signs and parked cars
A second camera SHALL frame the Rue Marie-Anne Est and Rue De Lanaudière blades together with the parked car on Rue Marie-Anne Est, so both are inside the frame. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: The blade and the car are inside the second view
- **WHEN** the corner camera looks at that junction
- **THEN** the Marie-Anne blade and the parked car both project inside the frame

#### Scenario: The opening camera stays
- **WHEN** the avenue is framed for the opening
- **THEN** the look stays at pitch −16 and the socket stays at Y 70 and Z 110
