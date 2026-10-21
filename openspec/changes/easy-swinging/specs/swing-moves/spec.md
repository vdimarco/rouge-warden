## ADDED Requirements

### Requirement: A held swing attaches by itself
In the chase view, holding swing SHALL attach the web without the player choosing a point. The anchor SHALL be 12 body-heights ahead along the horizontal velocity, or along the facing when that speed is under 1 m/s, and 14 body-heights above the feet. A building within 6 body-heights of that point SHALL take the anchor. With no building there, the anchor SHALL be that sky point, raised until it is off the screen. This SHALL work over open ground. A phone tap, first person, a headset, a test aim, and a hero on a wall SHALL keep their existing aim. With a goon in reach the swing button stays a punch, so a missed blow does not fire an easy web.

#### Scenario: Open ground
- **WHEN** the player holds swing over open ground with no building within 6 body-heights of the anchor point
- **THEN** the web attaches to a sky anchor, and the feet are not pulled below 1.5 body-heights

#### Scenario: A building in reach
- **WHEN** the player holds swing and a building face is within 6 body-heights of the point 12 body-heights ahead and 14 above
- **THEN** the web attaches to that face

#### Scenario: A phone tap
- **WHEN** the player taps the right half of the screen on a building
- **THEN** the web still attaches to the building under the tap

#### Scenario: Touch hold
- **WHEN** the player holds a finger on the right half of the screen
- **THEN** the web attaches to the auto anchor, and no new button is shown

### Requirement: The easy rope swings and lets go
The rope length SHALL be the distance to the anchor and SHALL NOT exceed 16 body-heights. Gravity SHALL drive the arc. Holding forward SHALL add 15% speed once at the bottom of the arc. Release SHALL keep the speed and add 10% of it upward and forward. Another web SHALL be allowed 150 ms after the release. If the arc would put the feet below 1.5 body-heights, the rope SHALL shorten so the bottom of the arc stays on that line.

#### Scenario: Twenty swings
- **WHEN** the player swings 20 times in a row over open ground
- **THEN** every swing attaches, and the feet never go below 1.5 body-heights

#### Scenario: A chain keeps its speed
- **WHEN** the player chains 10 swings while holding forward
- **THEN** the average speed across the chain is at least the speed at the start

### Requirement: The web is an ink line
When the scene is 3D, the web SHALL be a line in world space from the hand toward the anchor, not a 2D stroke clipped to the screen edge. On a 1280-wide view it SHALL stay about 2 px wide at every distance, so a far anchor does not disappear. The ink SHALL be `#2B2A33`. It SHALL sag at the start of the swing and pull straight under tension, and SHALL fade out over 150 ms on release. At the top of the swing speed, 3 or 4 thin lines of paper `#F3E9D6` at 25% opacity SHALL still trail the body on the overlay. `window.__test.swing` SHALL be `{ attached, anchor: { x, y, z, offscreen }, ropeLength, speed }`.

#### Scenario: An anchor off the screen
- **WHEN** the web holds a sky anchor outside the 3D view
- **THEN** the ink line runs through the world from the hand toward that anchor, the part on screen is the projection of that line, and `window.__test.swing.anchor.offscreen` is true

#### Scenario: The line stays readable far away
- **WHEN** the web is out on a 1280-wide view and the anchor is much farther from the camera than the hand
- **THEN** the line is about 2 px wide both near the hand and farther along it

#### Scenario: The line sags when the swing starts
- **WHEN** an easy web has just attached in the 3D scene and the rope is not yet taut
- **THEN** the middle of the line sits about 16 px below the straight line from the hand to the anchor on a 1280-wide view
