## ADDED Requirements

### Requirement: A parked car lamps at dusk
When the street lamps are on, the headlight pool SHALL include a parked car. In daytime rain the pool SHALL stay limited to driven and traffic cars. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: The spawn car's lamps sit in the opening shot
- **WHEN** the opening walk camera looks at the spawn car
- **THEN** both of its headlights project inside the frame

#### Scenario: Daytime rain leaves a parked car dark
- **WHEN** headlights are on and the street lamps are off
- **THEN** a car with no occupant and no traffic flag is not added to the pool
