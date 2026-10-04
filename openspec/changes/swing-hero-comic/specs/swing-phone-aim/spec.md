## ADDED Requirements

### Requirement: The one-tap phone scheme works with the chase camera
The one-tap phone scheme of the change `full-swing-phone-and-climbing` SHALL keep working when the chase camera is on. A tap or the SWING button SHALL fire the right rope, the rope SHALL let go by itself past the bottom of the arc, and a rope that catches SHALL give its speed kick. The phone's field of view SHALL follow the phone curve (wider with speed, and a kick on a fling) in third person as well; the chase camera SHALL take it as its target.

#### Scenario: First swing from the start roof
- **WHEN** the player presses SWING on the start roof in the chase view
- **THEN** the rope catches on a building at least 5 m above the roof, the hero leaves the roof, and 0.6 s later the hero moves at more than 10 m/s

#### Scenario: Taps alone
- **WHEN** the player plays 12 s from the start roof with taps only, in the chase view
- **THEN** the checks of `phone-swing.e2e.mjs` hold: average speed, distance, flings, the field of view and the speed lines

#### Scenario: A miss
- **WHEN** nothing is in reach in any direction and the player presses SWING
- **THEN** the hero stays on the roof and the button shows SWING

#### Scenario: Pause
- **WHEN** the player presses Pause and then RESUME
- **THEN** play stops and then goes on

### Requirement: A tap aims through the pixel the player sees
A tap on a building SHALL fire the right rope through the tapped pixel. The tap ray SHALL start at the camera and use the camera's own position, direction, field of view and aspect. The rope SHALL aim from the hero's head to the first point that ray hits. If the ray hits nothing, the rope SHALL aim along the ray. The tap ray SHALL last for the one frame in which the tap fires.

#### Scenario: Tap off the middle in third person, 844x390
- **WHEN** the player taps a building at least 0.4 of the half-screen away from the screen centre
- **THEN** the rope attaches to that building, within 8 m of the tapped point
- **AND** the rope does not go to the building at the screen centre

#### Scenario: Tap another building
- **WHEN** the player taps a second building off the screen centre after the first swing
- **THEN** the rope catches on that building
- **WHEN** a rope holds and the tapped place is not a valid target
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
In third person, when the view ray shows only ground below the hero's head and within 12 m of the hero (a hit on an up-facing surface, or no hit with the ray reaching the street or the lake within 12 m), the rope SHALL aim ahead along the same bearing, 32 degrees above the horizon (as high as the gold ring from the start roof). Ground means a roof, a street or water. A lower roof further away than 12 m SHALL stay a normal target, so a clog on it can be aimed at. This SHALL apply to a tap on the hero or on the floor, and to the SWING button, which aims through the middle of the screen. The rope SHALL never attach to the roof at the hero's feet.

#### Scenario: Tap the hero
- **WHEN** the player taps the hero or the roof at the hero's feet
- **THEN** the rope attaches to a building more than 5 m above the roof

#### Scenario: Press SWING from the chase view
- **WHEN** the camera looks down at the hero and the player presses SWING
- **THEN** the rope attaches to a building up and ahead, and not to the roof

#### Scenario: Aim low at a clog on the same roof
- **WHEN** the hero stands on a roof 14 to 24 m from a clog on the same roof, and the view ray passes low over the clog with nothing behind it
- **THEN** the aim takes that clog

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
A phone SHALL report the input kind "touch", and the tutorial SHALL use the phone lines (`LINES_PHONE`). The phone lines SHALL have the same keys and the same counts as the desktop lines, and they SHALL name no mouse, key, trigger, pinch or grip. A mouse, or a pad in use, SHALL read the desktop lines. Hands and controllers SHALL read their own lines.

#### Scenario: First tutorial step on a phone
- **WHEN** the tutorial starts on a phone
- **THEN** the first line comes from the phone lines and tells the player to tap the gold ring
- **AND** no phone line names a mouse, Shift, a key, a trigger, a pinch or a grip

#### Scenario: Same tutorial with a mouse
- **WHEN** the tutorial starts with a mouse
- **THEN** the first line comes from the desktop lines and names the mouse button

### Requirement: The phone layouts fit
The phone layouts of the change `full-swing-phone-and-climbing` SHALL hold with the comic HUD: at 844x390 and 390x844 the top buttons SHALL not cover the score pills, the spoken line SHALL not cover the SWING panel, and the page SHALL not scroll sideways.

#### Scenario: Landscape and portrait
- **WHEN** the phone shows a spoken line in portrait (390x844) or landscape (844x390)
- **THEN** the checks of `phone-swing.e2e.mjs` and `mobile.e2e.mjs` for the layout hold
