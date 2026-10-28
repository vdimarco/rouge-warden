## ADDED Requirements

### Requirement: A held swing attaches by itself
In the chase view, holding swing SHALL attach the web without the player choosing a point. The anchor SHALL be chosen in this order. First, a tutorial or mission target within 16 body-heights of the chest, fired as an aimed cup. Second, the nearest building within 6 body-heights of the point 12 body-heights ahead along the horizontal velocity (or along the facing when that speed is under 1 m/s) and 14 body-heights above the feet, including when that point is inside the building. Third, sky, raised until it is off the screen. The anchor SHALL NOT be sky while the gold-ring tower is in range: that shot is the aimed cup on the tower face, including when the tower is farther than 16 body-heights. Over open water an empty 6 body-height ball SHALL stay sky, even when a building past the shore is still in view. Over the city that same empty ball SHALL use the aimed building when the aim has one, and on the ground with nothing aimed the cup SHALL dry-fire. This SHALL work over open ground. A phone tap, first person, a headset, a test aim, and a hero on a wall SHALL keep their existing aim. With a goon in reach the swing button stays a punch, so a missed blow does not fire an easy web. The left swing button SHALL fire the left rope, and the right swing button the right rope, every time both ropes are free. A held rope on a building SHALL stay attached until the player releases that button.

#### Scenario: Open ground
- **WHEN** the player holds swing over open ground with no building within 6 body-heights of the anchor point
- **THEN** the web attaches to a sky anchor, and the feet are not pulled below 1.5 body-heights

#### Scenario: Open water with the city in view
- **WHEN** the player holds swing in the air over open water, no building is within 6 body-heights of the anchor point, and a building past the shore is still in view
- **THEN** the web attaches to a sky anchor

#### Scenario: An aimed building over the city
- **WHEN** the player holds swing over the city, the 6 body-height ball is empty, and the aim has a building
- **THEN** the rope attaches to that building

#### Scenario: A building in reach
- **WHEN** the player holds swing and a building face is within 6 body-heights of the point 12 body-heights ahead and 14 above
- **THEN** the web attaches to that face

#### Scenario: The gold ring lesson
- **WHEN** the player holds swing on the start roof during the gold-ring lesson
- **THEN** 30 ropes in a row attach to the tower face at the gold ring, and none attach to a sky point

#### Scenario: Inside the tower
- **WHEN** the auto point sits inside the gold-ring tower
- **THEN** the rope attaches to that tower's face

#### Scenario: The buttons match the hands
- **WHEN** both ropes are free and the player presses the left swing button, then the right, at a 1280-wide view
- **THEN** the left button fires the left rope and the right button fires the right rope, 10 times out of 10

#### Scenario: A held building rope
- **WHEN** the player holds a rope that is attached to a building, and keeps the button down
- **THEN** the rope stays attached until the button comes up, and letting go does not fire another rope

#### Scenario: A phone tap
- **WHEN** the player taps the right half of the screen on a building
- **THEN** the web still attaches to the building under the tap

#### Scenario: Touch hold
- **WHEN** the player holds a finger on the right half of the screen
- **THEN** the web attaches to the auto anchor, and no new button is shown

### Requirement: The easy rope swings and lets go
The rope length SHALL be the distance to the anchor and SHALL NOT exceed 16 body-heights. One body-height is 1.8 m, so the cap is 28.8 m. Gravity SHALL drive the arc. Holding forward SHALL add 15% speed once at the bottom of the arc. Release SHALL keep the speed and add 10% of it upward and forward. Another web SHALL be allowed 150 ms after the release. If the arc would put the feet below 1.5 body-heights, the rope SHALL shorten so the bottom of the arc stays on that line.

#### Scenario: Twenty swings
- **WHEN** the player swings 20 times in a row over open ground
- **THEN** every swing attaches, and the feet never go below 1.5 body-heights

#### Scenario: A chain keeps its speed
- **WHEN** the player chains 10 swings while holding forward
- **THEN** the average speed across the chain is at least the speed at the start

### Requirement: The web is an ink line
When the scene is 3D, the web SHALL be a line in world space from the hand toward the anchor, not a 2D stroke clipped to the screen edge. On a 1280-wide view it SHALL stay about 2 px wide at every distance, so a far anchor does not disappear. The ink SHALL be `#2B2A33`. It SHALL sag at the start of the swing and pull straight under tension, and SHALL fade out over 150 ms on release. In the chase view a rope anchored on the gold-ring tower, including the aimed cup whose flight and length stay a normal cup, SHALL be drawn as that same ink line from the hand to the anchor and SHALL fade out over 150 ms on release. At the top of the swing speed, 3 or 4 thin lines of paper `#F3E9D6` at 25% opacity SHALL still trail the body on the overlay. `window.__test.swing` SHALL be `{ attached, anchor: { x, y, z, offscreen }, ropeLength, speed }`.

#### Scenario: An anchor off the screen
- **WHEN** the web holds a sky anchor outside the 3D view
- **THEN** the ink line runs through the world from the hand toward that anchor, the part on screen is the projection of that line, and `window.__test.swing.anchor.offscreen` is true

#### Scenario: The line stays readable far away
- **WHEN** the web is out on a 1280-wide view and the anchor is much farther from the camera than the hand
- **THEN** the line is about 2 px wide both near the hand and farther along it

#### Scenario: The line sags when the swing starts
- **WHEN** an easy web has just attached in the 3D scene and the rope is not yet taut
- **THEN** the middle of the part on screen sits about 16 px off the straight chord through that part, on a 1280-wide view

#### Scenario: The gold-ring rope fades in ink
- **WHEN** the chase view is mid-swing on a rope anchored to the gold-ring tower and the player releases
- **THEN** the line is ink `#2B2A33`, about 2 px wide on a 1280-wide view, drawn from the hand to that anchor, partly faded about 100 ms after release, and gone by 150 ms

### Requirement: A headset does not turn the view to follow a swing
When a headset session is in play, the game SHALL NOT rotate the view to follow a swing, the velocity, or an anchor. The view SHALL stay the headset pose. A stick snap or smooth turn MAY still yaw the rig, including while a rope is out. A swing SHALL start from the trigger of the hand that fires it. The other hand's trigger SHALL NOT start that rope, and the grip SHALL NOT start it. The anchor distances, the rope cap, the speed adds, the reswing wait, the ink line, and `window.__test.swing` stay as specified above.

#### Scenario: A swing with the stick centered
- **WHEN** a headset player is swinging and the turn stick is centered
- **THEN** the game adds no yaw this frame, even though the body has velocity and a follow amount is available

#### Scenario: The player snaps during a swing
- **WHEN** a headset player deflects the turn stick while a rope is out
- **THEN** the yaw added this frame is the stick turn alone

#### Scenario: The swinging hand's trigger
- **WHEN** the player pulls the trigger on one hand in a headset
- **THEN** that hand's rope may start, and the other hand's trigger and either grip do not start it

#### Scenario: Flat play still follows
- **WHEN** the chase view is in play and easy swing is on
- **THEN** the phone's follow yaw is still added to the player's own turn

## MODIFIED Requirements

### Requirement: A held swing catches the next building
In flat play with a mouse or a pad, a building rope SHALL stay attached for the whole time the swing button is held. It SHALL NOT let go by itself when the GO cue shows, and it SHALL NOT fire a new rope while that button stays down. A sky rope SHALL also stay while the button is held, including over open water and when a building is ahead. Letting go of the button SHALL let the rope go, and SHALL NOT catch another building by itself. A clog, a pipe, or the crack SHALL stay while the button is held. A phone's own let-go is unchanged. A headset is unchanged.

#### Scenario: The button stays down
- **WHEN** the player holds the swing button on a building rope
- **THEN** that rope stays attached, and no second building is caught

#### Scenario: The button comes up
- **WHEN** the player lets the swing button up
- **THEN** the rope lets go and no new rope fires while the button stays up

#### Scenario: Open water
- **WHEN** the player holds the swing button on a sky rope over open water through the GO cue
- **THEN** the sky rope stays attached

#### Scenario: A clog stays
- **WHEN** the player holds the swing button on a clog
- **THEN** the clog rope stays

### Requirement: The first web hangs from a building
The first swing in the chase view SHALL follow the anchor order above. A tutorial or mission target within 16 body-heights, and the gold-ring tower while it is in range, SHALL be the aimed cup. Otherwise the nearest building within 6 body-heights of the auto point SHALL take the easy web, including a point inside that building. Over the city, an empty 6 body-height ball with an aimed building SHALL use that building. Over open water that empty ball SHALL stay sky. A sky rope SHALL stay at most 16 body-heights. The swing SHALL NOT attach a short sky rope when the gold-ring tower is in range.

#### Scenario: A building ahead
- **WHEN** the player holds the swing button in the air over the city and the aim has a building
- **THEN** the rope attaches to that building and the hero does not hit the wall on a sky point

#### Scenario: Open water
- **WHEN** the player holds the swing button over open water and no building is within 6 body-heights of the auto point
- **THEN** the web attaches to the sky
