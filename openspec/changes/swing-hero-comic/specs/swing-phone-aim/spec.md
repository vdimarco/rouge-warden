## ADDED Requirements

### Requirement: One thumb plays the whole swing
The one-thumb phone scheme from main SHALL keep working with the chase camera. The SWING button SHALL fire the right rope at a valid target and jump off a roof by itself. While the rope holds, the game SHALL pull the rope in by itself. A second press, labelled LET GO, SHALL release the rope and keep the speed. A drag of more than 8 pixels SHALL turn the view, and a shorter touch SHALL count as a tap. Motion sensors SHALL be optional.

#### Scenario: Swing and let go
- **WHEN** the player presses SWING on the start roof
- **THEN** the rope attaches to a building at least 5 m above the roof and the hero leaves the roof
- **WHEN** the player presses LET GO
- **THEN** the rope lets go and the hero keeps moving at more than 2 m/s

#### Scenario: A miss
- **WHEN** the player presses SWING with no valid building in range
- **THEN** the hero stays on the roof and the button does not stay on LET GO

#### Scenario: Pause
- **WHEN** the player presses Pause and then RESUME
- **THEN** play stops and then goes on

#### Scenario: Sensors refused
- **WHEN** the phone refuses motion access
- **THEN** the player can still drag to look, tap to fire and press SWING

### Requirement: A tap aims through the pixel the player sees
A tap on a building SHALL fire the right rope through the tapped pixel. The tap ray SHALL start at the camera and use the camera's own position, direction, field of view and aspect. The rope SHALL aim from the hero's head to the first point that ray hits. If the ray hits nothing, the rope SHALL aim along the ray. The tap ray SHALL last for the one frame in which the tap fires.

#### Scenario: Tap off the middle in third person, 844x390
- **WHEN** the player taps a building at least 0.4 of the half-screen away from the screen centre
- **THEN** the rope attaches to that building, within 8 m of the tapped point
- **AND** the rope does not go to the building at the screen centre

#### Scenario: Switch ropes
- **WHEN** a rope holds and the player taps another building
- **THEN** the rope moves to the new building without a separate release
- **WHEN** the tapped place is not a valid target
- **THEN** the old rope stays

#### Scenario: Tap in first person
- **WHEN** the player is in first person and taps a building off the screen centre
- **THEN** the rope attaches to that building

#### Scenario: Tap the gold ring, 390x844
- **WHEN** the player looks up at the gold ring on a phone held upright and taps its pixel
- **THEN** the rope attaches within 6 m of the ring

#### Scenario: One frame only
- **WHEN** the player taps a building and the next frame has no tap
- **THEN** the next shot aims along the middle of the screen again

### Requirement: Ground in view aims up and ahead
In third person, when the view ray shows only ground below the hero's head and within 12 m of the hero, the rope SHALL aim ahead along the same bearing, 20 degrees above the horizon. Ground means a roof, a street or water. A lower roof further away than 12 m SHALL stay a normal target, so a clog on it can be aimed at. This SHALL apply to a tap on the hero or on the floor, and to the SWING button, which aims through the middle of the screen. The rope SHALL never attach to the roof at the hero's feet.

#### Scenario: Tap the hero
- **WHEN** the player taps the hero or the roof at the hero's feet
- **THEN** the rope attaches to a building more than 5 m above the roof

#### Scenario: Press SWING from the chase view
- **WHEN** the camera looks down at the hero and the player presses SWING
- **THEN** the rope attaches to a building up and ahead, and not to the roof

#### Scenario: Point at a clog on a lower roof
- **WHEN** the hero stands on a roof and the view points at the roof beside a clog 14 to 60 m away and lower down
- **THEN** the aim takes that clog

### Requirement: The phone starts facing the gold ring
On a phone, play SHALL start on the start roof with the hero and the camera facing the gold ring. Only the yaw SHALL turn toward the ring. The view SHALL keep its chase pitch, so the camera never tips up into the roof.

#### Scenario: Start on a phone
- **WHEN** the player starts play on a phone
- **THEN** the camera settles 4.5 m behind the hero and looks down at the hero by about 15 degrees
- **AND** the camera is not blocked by the roof
- **AND** the hero and the camera face the same way

### Requirement: The tutorial speaks to a thumb
A phone SHALL report the input kind "touch", and the tutorial SHALL use the touch lines. The touch lines SHALL have the same keys and the same order as the desktop lines. They SHALL name no mouse, key, trigger, pinch or grip, and they SHALL contain no em dash. A mouse, or a pad in use, SHALL read the desktop lines. Hands and controllers SHALL read their own lines.

#### Scenario: First tutorial step on a phone
- **WHEN** the tutorial starts on a phone
- **THEN** the first line comes from the touch lines and tells the player to drag to the gold ring and tap SWING
- **AND** no touch line names a mouse, Shift, a key, a trigger, a pinch or a grip

#### Scenario: Same tutorial with a mouse
- **WHEN** the tutorial starts with a mouse
- **THEN** the first line comes from the desktop lines and names the mouse button

### Requirement: The phone layouts fit
At 844x390 (landscape) and 390x844 (portrait) the phone panel SHALL stay inside the window and inside the safe areas, and the page SHALL not scroll. The buttons SHALL be at least 44 px tall.

#### Scenario: Landscape
- **WHEN** the player holds the phone in landscape at 844x390
- **THEN** the SWING button sits at the lower right, the small help text is hidden, and the page does not scroll sideways

#### Scenario: Portrait
- **WHEN** the player holds the phone upright at 390x844
- **THEN** the SWING button is centred at the bottom, at most 85 percent of the window wide, and the page does not scroll
