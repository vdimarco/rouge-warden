## ADDED Requirements

### Requirement: The game picks one swing target
In flat play, the game SHALL pick one target for each swing. A target SHALL be a wall or an underside of a building or of another city structure, such as the Needle, the Dome or the expressway. It SHALL be 9 to 80 m from the head and more than 4 m above the chest. A target SHALL NOT be a roof, a floor, the street, the water or a roof antenna. The game SHALL search for a target at most 20 times a second and SHALL keep the last target between searches.

#### Scenario: Swing from the start roof
- **WHEN** a player stands on the start roof in the default view, holds the swing input and does not touch the look input
- **THEN** a rope attaches within 0.6 s to a building point at least 10 m above the roof

#### Scenario: Reach rules
- **WHEN** the picker runs from 5,000 sampled states (roofs and air, random views)
- **THEN** every target is 9 to 80 m from the head and more than 4 m above the chest
- **AND** no target is a roof, a floor or a roof antenna

#### Scenario: Cost of one search
- **WHEN** the picker runs one search
- **THEN** it casts at most 66 rays in the first tier and at most 28 rays in the second tier
- **AND** the held target costs one ray each frame

### Requirement: The target stays inside the width of the view
The search fan SHALL NOT reach past the horizontal field of view. A narrow view, such as a phone in portrait, SHALL narrow the fan with it.

#### Scenario: Phone in portrait
- **WHEN** the view is 390 by 844 with a vertical field of view of 75 degrees and the picker finds a target in its first tier
- **THEN** the target lies within 0.92 of the half-width of the screen

#### Scenario: Computer in landscape
- **WHEN** the view is 960 by 540 and the picker finds a target in its first tier
- **THEN** the target lies within 35 degrees of the view bearing

### Requirement: Higher anchors when the view looks up or the body falls
The preferred elevation SHALL be the camera pitch plus 35 degrees, held between 35 and 60 degrees. While the body falls faster than 3 m/s, the preferred elevation SHALL rise by up to 12 degrees (all of it at 15 m/s), to a top of 72 degrees. A body at rest SHALL use the same rule.

#### Scenario: Default view
- **WHEN** the camera looks down 15.5 degrees and the body stands still
- **THEN** the preferred elevation is 35 degrees

#### Scenario: Look up
- **WHEN** the camera pitch is +20 degrees and the body stands still
- **THEN** the preferred elevation is 55 degrees

#### Scenario: Fall
- **WHEN** the body falls at 15 m/s and the camera pitch is -15.5 degrees
- **THEN** the preferred elevation is 47 degrees

### Requirement: Clogs, pipes and the gold ring come first
A clog, a pipe or the gold ring SHALL win over every building when three things are true. It is within 60 m (80 m for the ring). It is within 22 degrees of the camera forward, measured at the camera (35 degrees for the ring). It is in line of sight from the head. A pipe SHALL count only from within 60 degrees of its outward normal. The gold ring SHALL count only while tutorial step 0 runs. Among specials, the one nearest the view axis SHALL win.

#### Scenario: A clog in view
- **WHEN** a clog is 30 m away and 5 degrees from the camera forward, with no wall between
- **THEN** the target is the clog and the marker is sludge green with points
- **AND** a swing input attaches the rope to the clog, and three yanks flush it

#### Scenario: A clog behind a wall
- **WHEN** a wall stands between the head and a clog that is in view
- **THEN** the target is a building and not the clog

#### Scenario: A clog far from the view axis
- **WHEN** a clog is 40 degrees from the camera forward
- **THEN** the target is a building and not the clog

#### Scenario: A pipe seen from behind
- **WHEN** the head is outside 60 degrees of the outward normal of a pipe
- **THEN** the pipe is not the target

#### Scenario: The gold ring in the tutorial
- **WHEN** tutorial step 0 runs and the ring is within 35 degrees of the view bearing, in line of sight
- **THEN** the target is the centre of the ring
- **AND** after step 0 the ring has no special rank

### Requirement: The target does not flicker
The picker SHALL keep the held target while it is valid. A new candidate SHALL replace a valid held target only when its score is more than 20 percent higher and the held target is at least 0.2 s old. An invalid held target SHALL be replaced at once. A special SHALL replace a building at once.

#### Scenario: Two close buildings
- **WHEN** the view turns 0.5 degrees each frame for 120 frames across two buildings that score within 20 percent of each other
- **THEN** the target changes at most 4 times
- **AND** no change goes to a candidate that scores 20 percent or less above the held one

#### Scenario: The held target is hidden
- **WHEN** a wall moves between the head and the held target
- **THEN** the next search replaces the target in the same frame

### Requirement: The hand follows the target
The hand that fires SHALL be the hand on the side of the target. A target more than 6 degrees left of the view axis SHALL pick the left hand. A target more than 6 degrees right SHALL pick the right hand. Otherwise the hand that did not fire last SHALL fire. On a phone the hand SHALL be the right hand.

#### Scenario: Target on the left
- **WHEN** the target is 20 degrees left of the view axis and the player presses the swing input
- **THEN** the left rope fires, and the hero's left hand starts the rope

#### Scenario: Target on the right
- **WHEN** the target is 20 degrees right of the view axis and the player presses the swing input
- **THEN** the right rope fires

#### Scenario: Target dead ahead
- **WHEN** the target is within 6 degrees of the view axis and the left hand fired last
- **THEN** the right hand fires

#### Scenario: The second rope
- **WHEN** a rope is attached to building A and the player presses the second-rope input
- **THEN** the idle hand fires at a different building when one qualifies
- **AND** the marker before the press shows that other building

### Requirement: A building the player points at gets the rope
When the player points at a building point that can hold a swing, the rope SHALL go to that exact point. A point can hold a swing when it is 9 to 88 m from the head, is not a roof or a floor, and is more than 3 m above the chest. Otherwise the rope SHALL go to the auto target. The exact ray SHALL be the tapped pixel on a phone, and the screen centre in first person.

#### Scenario: First person, crosshair on a building
- **WHEN** the player is in first person and the crosshair rests on a building 40 m away and 15 m above the chest
- **THEN** the swing input attaches the rope within 8 m of the crosshair point

#### Scenario: First person, crosshair on the roof
- **WHEN** the player is in first person and the crosshair rests on the roof at the hero's feet
- **THEN** the swing input attaches the rope to the auto target, a building more than 5 m above the roof

#### Scenario: Third person has no centre aim
- **WHEN** the camera looks down at the hero in third person and the player presses the swing input
- **THEN** the rope goes to the auto target and never to the roof at the hero's feet

#### Scenario: Tap at the sky
- **WHEN** a phone player taps where no building is in reach
- **THEN** the rope goes to the auto target, with the bearing of the tap as the preferred bearing

### Requirement: A marker shows the next target
In play, a marker SHALL show the target of the next swing. The marker SHALL show while a rope is attached too, and then it SHALL mark the next building and not the one the rope holds. It SHALL hide when both ropes are out, in the intro, when paused, and when there is no target. The marker SHALL be a world reticle on the surface and a lock-on ring in screen space. A target outside the screen SHALL show as an arrow on the screen edge.

#### Scenario: Computer, target on screen
- **WHEN** a target exists inside the screen at 960 by 540
- **THEN** the lock-on ring is 44 px across and its centre is within 3 px of the projected target
- **AND** the world reticle of `rope.js` sits on the same point

#### Scenario: Game pad
- **WHEN** a pad is the device in use and a target exists
- **THEN** the lock-on ring and the world reticle show as for the mouse

#### Scenario: Phone
- **WHEN** a target exists inside the screen on a phone
- **THEN** the lock-on ring is 56 px across and its centre is within 3 px of the projected target
- **AND** the SWING button is not dimmed

#### Scenario: Target above the screen
- **WHEN** the best target is above the top edge of the screen
- **THEN** an arrow sits on the top edge at the target's horizontal position and points up
- **AND** on a phone the arrow stays clear of the top buttons and the SWING panel

#### Scenario: A rope is attached
- **WHEN** the right rope holds building A and a second target exists
- **THEN** the marker shows the second target
- **WHEN** both ropes are attached
- **THEN** no marker shows

### Requirement: No target is clear to the player
When no target exists, no marker SHALL show. A swing input SHALL wait 0.3 s for a target and then dry-fire: the cup flies 6 m and drops. A computer or a pad player SHALL read the line "No building to swing from. Look up at one." at most once every 10 s. A phone SHALL dim the SWING button and show its hint line.

#### Scenario: Nothing in reach
- **WHEN** no building is in reach in any direction and the player holds the swing input
- **THEN** the cup flies out and drops, the rope stays idle, and the line shows once
- **AND** a second press 3 s later shows no new line

#### Scenario: A target appears
- **WHEN** the player holds the swing input and a target comes into view within 0.3 s
- **THEN** the rope fires at it

#### Scenario: Phone with no target
- **WHEN** no target exists on a phone
- **THEN** the SWING button is dimmed and still works, and a tap is a dry fire that leaves the hero on the roof

### Requirement: A wall gives a way out
A player who holds a wall and uses the swing input SHALL get a target away from the wall. The picker SHALL use the view bearing when the view faces away from the wall. Otherwise it SHALL use the outward normal of the wall.

#### Scenario: Swing off a wall
- **WHEN** a player holds a wall in third person with the view toward the wall and presses the swing input
- **THEN** the rope attaches to a building on the side the wall faces, more than 9 m away
- **AND** the player leaves the wall

#### Scenario: Look away from the wall
- **WHEN** the player turns the view away from the wall and presses the swing input
- **THEN** the target lies within 35 degrees of the new view bearing, if a building qualifies

### Requirement: The picker is never narrower than the old phone assist
The second tier of the picker SHALL include every ray of the old phone assist. Those rays use the yaw offsets 0, 22, 45 and 75 degrees to both sides, and the pitches 16, 28, 42 and 56 degrees. A state where the old assist found a building SHALL give a target.

#### Scenario: Compare with the old fan
- **WHEN** 5,000 sampled states run through the old fan and through the picker
- **THEN** no state exists where the old fan finds a swingable point and the picker finds none

#### Scenario: Sky tap on a phone
- **WHEN** a phone player taps straight up at the sky from the start roof
- **THEN** the rope attaches to a building above and ahead, as it did with the old assist

### Requirement: The picker is pure
`target.js` SHALL take the city and plain objects and SHALL NOT import three or use the DOM. It SHALL call `city.raycast` through the city object on every call. It SHALL NOT allocate in its per-frame update.

#### Scenario: Import in Node
- **WHEN** a Node script imports `target.js` and `city.js`
- **THEN** the import works with no browser and no three

#### Scenario: Replaced raycast
- **WHEN** a test replaces `city.raycast` with a function that returns `null`
- **THEN** the picker finds no target

### Requirement: The headset does not change
In a VR or AR session no picker SHALL run, and no lock-on ring or hint strip SHALL show.

#### Scenario: Quest session
- **WHEN** the player enters VR on a Quest or its emulator
- **THEN** the aim, the ropes and the controls work as before
- **AND** `G.test.target().on` is false and the page has no `#lockRing` and no `#keyHints` in view
