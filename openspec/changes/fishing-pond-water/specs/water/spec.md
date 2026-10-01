## ADDED Requirements

### Requirement: Shallow water depth
The painted lake SHALL allow the shallow bed to remain visible and retain opaque deep water.

#### Scenario: View from the stand
- **WHEN** the player looks across shallow and deep water
- **THEN** shallow water reveals the bed and distant deep water retains its reflected shore.

### Requirement: Moving underwater light
The water SHALL show slow light patterns that fade with depth, darkness, and distance.

#### Scenario: Day and night
- **WHEN** the scene advances from daylight to night
- **THEN** underwater light fades with sun visibility without altering gameplay rings or aiming dots.

### Requirement: Ripple response
The painted texture SHALL respond to the existing wave gradient.

#### Scenario: Lure splash
- **WHEN** a lure enters the water
- **THEN** its ripple distorts the painted texture while the splash and target markers remain visible.
