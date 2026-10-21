## ADDED Requirements

### Requirement: The low sun puts light in the air
On a flat view with the sun in front of the camera, warm light SHALL streak from the sun and stop where a near building covers the sky. The added light SHALL stay capped so the picture does not wash out. A headset view SHALL draw the scene with no shaft pass.

#### Scenario: Needle shot
- **WHEN** the named `needle` camera draws one flat frame with the comic art loaded
- **THEN** the sky near the sun is brighter than the same view with the shaft weight at zero, and the frame is not a flat wash

#### Scenario: The pass stays off the headset
- **WHEN** an XR frame draws
- **THEN** the scene is drawn straight, with no shaft composite
