## ADDED Requirements

### Requirement: Entrances have a gallery rail
The estimated facade shader SHALL draw a rail and bars on the floor above each entrance, and a downspout between bay groups. Doors and the windows beside that rail SHALL stay readable.

#### Scenario: Read a facade from the street
- **WHEN** the facade shader is evaluated across several bays from the street to the upper floors
- **THEN** the floor above each entrance has a rail, a downspout runs between bay groups, and the door below the rail remains a door
