## ADDED Requirements

### Requirement: Ground floors have entrances
The estimated facade shader SHALL place a door and steps in every fourth ground-floor bay, and SHALL leave the windows above that bay intact.

#### Scenario: Read a facade from the street
- **WHEN** the facade shader is evaluated across several bays from the street to the upper floors
- **THEN** every fourth ground-floor bay is a door with steps, and the floors above it keep their windows
