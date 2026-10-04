## MODIFIED Requirements

### Requirement: A tap aims through the pixel the player sees
A tap SHALL fire the right rope. The tap ray SHALL start at the camera and use the camera's own position, direction, field of view and aspect, and it SHALL last for the one frame in which the tap fires. The rope SHALL go to the first of these that exists. First, a clog or pipe within 16 degrees of the tapped ray and in line of sight, the one nearest the ray. Second, the exact point the ray hits, when that point can hold a swing. Third, the target the ring marks. Fourth, when nothing is marked, a target found with the bearing of the tap as the preferred bearing. When none exists, the tap SHALL be a miss. A point can hold a swing when it is 9 to 88 m from the head, is not a roof, a floor or a roof antenna, and is more than 3 m above the chest. A ray steeper than 70 degrees from the horizontal SHALL give no bearing, and the search SHALL use the velocity heading or the view yaw. With a rope out, the search SHALL skip the building that holds it. When only that building qualifies, the rope SHALL stay and no new rope SHALL fire. With a rope idle, the right hand's aim SHALL point at the marked target on every frame, and straight up when there is none.

#### Scenario: Tap off the middle in third person, 844x390
- **WHEN** the player taps a building at least 0.4 of the half-screen away from the screen centre
- **THEN** the rope attaches to that building, within 8 m of the tapped point
- **AND** the rope does not go to the building at the screen centre

#### Scenario: Tap another building
- **WHEN** the player taps a second building off the screen centre after the first swing
- **THEN** the rope catches on that building
- **WHEN** a rope holds and the tapped place is not a valid target and no target is marked
- **THEN** the old rope stays

#### Scenario: Tap in first person
- **WHEN** the player is in first person and taps a building off the screen centre
- **THEN** the rope attaches to that building

#### Scenario: Tap the gold ring, 390x844
- **WHEN** the player looks up at the gold ring on a phone held upright and taps its pixel
- **THEN** the rope attaches within 6 m of the ring

#### Scenario: Tap a clog on a lower roof
- **WHEN** a clog sits on a lower roof, the ray through its pixel hits the roof behind it, and the player taps
- **THEN** the rope attaches to the clog and not to the roof

#### Scenario: One frame only
- **WHEN** the player taps a building and the next frame has no tap
- **THEN** the next shot aims at the marked target again

#### Scenario: Tap at the sky
- **WHEN** the player taps where no building is in reach
- **THEN** the rope attaches to the marked target, a building ahead of and above the player, or to one the search finds
- **WHEN** the aim points straight up, as a test sets it, and the player presses SWING
- **THEN** the rope still attaches to a building above and ahead

#### Scenario: Tap at a miss that the ring marks
- **WHEN** the ring marks building B and the player taps a place that holds nothing
- **THEN** the rope goes to building B

#### Scenario: The only building holds the rope
- **WHEN** the rope holds the only building in reach and the player taps
- **THEN** the old rope stays and the hint says it is kept

### Requirement: Ground in view aims up and ahead
In third person, the rope SHALL NOT attach to a roof, the street or the water at the hero's feet. A tap on the hero or on the floor, and the SWING button (which has no tapped pixel), SHALL fire at the marked target chosen by the auto target. A clog on a lower roof or on the hero's own roof SHALL stay a target when the view points at it, within 60 m and 22 degrees of the camera forward. A tap on its pixel SHALL reach it within 16 degrees.

#### Scenario: Tap the hero
- **WHEN** the player taps the hero or the roof at the hero's feet
- **THEN** the rope attaches to a building more than 5 m above the roof

#### Scenario: Press SWING from the chase view
- **WHEN** the camera looks down at the hero and the player presses SWING
- **THEN** the rope attaches to a building up and ahead, and not to the roof

#### Scenario: Aim low at a clog on the same roof
- **WHEN** the hero stands on a roof 14 to 24 m from a clog on the same roof, and the view points at the clog
- **THEN** the target is that clog

#### Scenario: Point at a clog on a lower roof
- **WHEN** the hero stands on a roof and the view points at the roof beside a clog 14 to 60 m away and lower down
- **THEN** the target is that clog

### Requirement: The tutorial speaks to a thumb
A phone SHALL report the input kind "touch", and the tutorial SHALL use the phone lines (`LINES_PHONE`). The phone lines SHALL have the same keys and the same counts as the desktop lines, and they SHALL name no mouse, key, trigger, pinch or grip. A mouse SHALL read the desktop lines. A pad in use SHALL read the pad lines (`LINES_PAD`). They have the same keys and counts. They name the triggers, the bumpers and the sticks in words that fit an Xbox pad and a PlayStation pad. Hands and controllers SHALL read their own lines. The first wall line SHALL come from the `wall` group of the lines table for the device.

#### Scenario: First tutorial step on a phone
- **WHEN** the tutorial starts on a phone
- **THEN** the first line comes from the phone lines and tells the player to tap SWING for the gold ring
- **AND** no phone line names a mouse, Shift, a key, a trigger, a pinch or a grip

#### Scenario: Same tutorial with a mouse
- **WHEN** the tutorial starts with a mouse
- **THEN** the first line comes from the desktop lines and names the mouse button

#### Scenario: Same tutorial with a pad
- **WHEN** the tutorial starts with a pad in use
- **THEN** the first line comes from the pad lines and names the right trigger
- **AND** no pad line names Shift, F, a mouse button, RT or A
