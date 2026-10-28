## ADDED Requirements

### Requirement: The avenue carries low air
A point down the street near the ground SHALL take more haze than a point at the same distance up among the roofs. A point within about 28 m SHALL stay as sharp as it is now.

#### Scenario: Street shot
- **WHEN** the named `street` camera draws one frame with the comic art loaded
- **THEN** the lower floors and the walks down the avenue carry a haze the near kerb does not, and the frame is not a flat wash

### Requirement: The print steps stay
The haze amount SHALL still pass through the four-step poster. The stock `toonify` colour SHALL stay as it was.

#### Scenario: The lit sphere is unchanged
- **WHEN** the city render check shades its lit sphere
- **THEN** that sphere still matches the stock cel colours
