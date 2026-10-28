## ADDED Requirements

### Requirement: The street darkens where an upright surface meets it
A ground pixel SHALL darken when a nearby sample is upright and within 70 cm of its depth. A sample 200 cm away SHALL not darken it. The sky SHALL not darken.

#### Scenario: A figure stands on the street
- **WHEN** the walking camera is shaded at pitch −12 with a figure meeting the ground
- **THEN** the ground around the base is darker than the open street, and the open street away from the figure stays at its own colour
