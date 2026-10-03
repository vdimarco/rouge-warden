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

### Requirement: Visible pond character from the fishing view
The daylight painted water SHALL show a pronounced jade-to-dark-teal depth gradient and broad moving light contours from the default fishing camera on both quality settings.

#### Scenario: Compare daylight views
- **WHEN** the default cast view is captured before and after the revision at the same time and camera in low and high quality, including portrait layout
- **THEN** the water colour and moving light are visibly distinct, the shallow bed is clearer, and aiming dots and fish rings remain legible.

#### Scenario: Observe motion
- **WHEN** the player watches the water for five seconds and casts a lure
- **THEN** broad light contours drift and the splash visibly bends the surface pattern without distant flicker.
