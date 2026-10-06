## ADDED Requirements

### Requirement: The game picks one swing target
In flat play, the game SHALL pick one target for each swing. A target SHALL be a wall or the underside of a building or of another city structure, such as the Needle, the Dome or the expressway. A target SHALL NOT be a roof, a floor, the street, the water, or a roof antenna found by a search. A roof antenna SHALL be the target when the exact ray through the screen centre rests on it, in third and in first person, so a player who aims at one can rope it and climb it (swing-climbing). The picker SHALL work in three tiers. Tier 1 is a fan of rays in front of the view: its targets are 9 to 80 m from the head and more than 4 m above the chest. Tier 2 runs only when tier 1 finds nothing: its targets are 9 to 88 m from the head and more than 3 m above the chest. Tier 3 is the exact ray through the screen centre, with the tier 2 bounds. The game SHALL search the fan at most 20 times a second and tier 2 at most 5 times a second, and SHALL keep the last target between searches.

#### Scenario: Swing from the start roof
- **WHEN** a player stands on the start roof in the default view with tutorial step 0 running, holds the swing input and does not touch the look input
- **THEN** a rope attaches within 0.6 s to the tower face at the gold ring, at least 10 m above the roof

#### Scenario: Reach rules of tier 1
- **WHEN** the picker runs from 5,000 sampled states (roofs and air, random views) and returns a tier 1 target
- **THEN** the target is 9 to 80 m from the head and more than 4 m above the chest
- **AND** it is not a roof, a floor or a roof antenna

#### Scenario: Reach rules of tier 2 and tier 3
- **WHEN** the picker returns a tier 2 or tier 3 target in the same 5,000 states
- **THEN** the target is 9 to 88 m from the head and more than 3 m above the chest
- **AND** it is not a roof, a floor or a roof antenna

#### Scenario: Cost of one search
- **WHEN** the picker runs one search with no rope out
- **THEN** it casts at most 66 rays in tier 1, at most 700 rays in tier 2 and one ray in tier 3
- **AND** the held target costs one ray each frame

#### Scenario: Cost of one search with a rope out
- **WHEN** the picker runs one search while a rope holds a building
- **THEN** it casts at most 1,400 rays in tier 2 (the strict pass and the relaxed pass)

#### Scenario: Tier 2 rate
- **WHEN** the picker runs for 2 s of frames in a city where tier 1 finds nothing
- **THEN** tier 2 runs at most 10 times, which is 5 times a second

#### Scenario: A rope holds the only building that qualifies
- **WHEN** a rope holds the one building that qualifies, which only tier 2 can see, for 2 s of frames
- **THEN** tier 2 runs at most 5 times a second (the pass that may return the held building shares the clock of the strict pass)
- **AND** the result says `same` on every frame, so a second rope of a computer or a pad may still take that building

### Requirement: The target stays inside the width of the view
A tier 1 target SHALL be in front of the camera, and its screen x SHALL lie within 0.92 of the half-width of the screen. A target above the top edge MAY pass. The fan width SHALL follow the Aim assist setting: 21, 28 or 35 degrees each side for Low, Medium and High.

#### Scenario: Phone in portrait
- **WHEN** the view is 390 by 844 with a vertical field of view of 75 degrees and the picker returns a tier 1 target, at the default pitch and at +8 degrees
- **THEN** the target's screen x lies within 0.92 of the half-width of the screen

#### Scenario: Computer in landscape
- **WHEN** the view is 960 by 540 and the picker returns a tier 1 target
- **THEN** the target's screen x lies within 0.92 of the half-width of the screen

#### Scenario: Aim assist Low
- **WHEN** the Aim assist setting is Low and a building stands 30 degrees to the side of the view bearing
- **THEN** the fan does not find it in tier 1

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
A clog or a pipe SHALL win over every building when it is within 60 m, within 22 degrees of the camera forward measured at the camera, and in line of sight from the head. Once it is the target, it SHALL stay the target until it is more than 28 degrees from the camera forward. A pipe SHALL count from any side, as long as it is in line of sight from the head: the only places to stand near the pipes are the pod roof behind them and the deck under them. The gold ring SHALL win while tutorial step 0 runs, when it is within 80 m and in line of sight. It SHALL be within 35 degrees of the view bearing, measured around the vertical axis, at any elevation. After step 0 the ring SHALL have no special rank. Among specials, the one nearest the view axis SHALL win.

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

#### Scenario: A clog on the edge of the cone
- **WHEN** the view turns so that a clog moves from 20 to 26 degrees and back to 20 degrees from the camera forward
- **THEN** the clog stays the target for the whole turn
- **WHEN** the clog moves beyond 28 degrees
- **THEN** a building replaces it

#### Scenario: A pipe seen from the pod roof
- **WHEN** the King is awake and the hero stands on the pod roof behind a pipe and looks at it
- **THEN** the pipe is the target, a rope catches it, and three yanks rip it off

#### Scenario: A roof antenna under the crosshair
- **WHEN** the screen centre rests on a roof antenna 15 m away and the player fires
- **THEN** the rope catches the antenna

#### Scenario: The gold ring from the start roof
- **WHEN** tutorial step 0 runs, the player stands on the start roof in the default view, and the screen is 16 by 9 or 390 by 844
- **THEN** the target is the point on the tower face at the centre of the ring, although the ring is above the top edge of the screen
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

#### Scenario: Climbing a wall
- **WHEN** a player holds a wall with the view into it and climbs 20 m up and down for 30 s
- **THEN** a held target is replaced by the 20 percent rule at most 10 times
- **AND** each replacement goes to a candidate that scores more than 20 percent higher than the held target, both scored against the bearing the fan was cast around (the way out of the wall), not against the view

### Requirement: The next swing goes to a new building
The score of a building that held one of the last two ropes SHALL fall by 0.6 for 8 s after the rope let go. A building that holds a rope SHALL NOT be the target of the second rope while another building qualifies. The picker SHALL still return a building that is the only one that qualifies.

#### Scenario: Two towers
- **WHEN** a rope has just let go of tower A and a tower B scores 0.4 lower than A before the penalty
- **THEN** the target is tower B

#### Scenario: Only one tower
- **WHEN** a rope has just let go of tower A and no other building qualifies
- **THEN** the target is tower A

### Requirement: The hand follows the target
The hand that fires SHALL be the hand on the side of the target. A target more than 6 degrees left of the view axis SHALL pick the left hand. A target more than 6 degrees right SHALL pick the right hand. Otherwise the hand that did not fire last SHALL fire. On a phone the hand SHALL be the right hand. In the opening the hand SHALL follow the old mapping: the left button or E fires the left hand, and the right button or Q fires the right hand.

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

#### Scenario: Two inputs in one frame
- **WHEN** both swing inputs go down in the same frame, so the first rope is still flying when the second is chosen
- **THEN** the second rope fires at a different building when one qualifies (the picker is asked again for the frame)

### Requirement: The picker decides a flat swing
In flat play with state "play" and no test aim override on the hand, the picker SHALL decide whether a swing fires. The game SHALL fire at the picker's point and SHALL NOT let `ropes.aim` choose again. With no target, no rope SHALL fire, even when the view ray hits a roof or a wall in reach. With a test aim override on a hand, the old decision by `ropes.aim` SHALL hold for that hand. In the opening and in a pause the picker SHALL be off.

#### Scenario: No target, a roof in view
- **WHEN** the picker returns no target, the view ray hits the roof 6 m ahead, and the player presses the swing input
- **THEN** the cup dry-fires along the view and no rope attaches to the roof

#### Scenario: The rope goes to the pick
- **WHEN** the picker returns a building point and the player presses the swing input
- **THEN** the rope attaches to that point, with the same normal, and no other building is chosen

#### Scenario: A test override
- **WHEN** a test aims the right hand at a point with `G.test.aimAt` and presses
- **THEN** the old path decides and the rope attaches as it did before this change

### Requirement: A building the player points at gets the rope
In first person, when the exact ray through the crosshair hits a point that passes the tier 3 test, the rope SHALL go to that exact point, and the marker SHALL sit there. Otherwise the rope SHALL go to the auto target. In third person the exact ray SHALL be the last resort after tiers 1 and 2. A phone tap SHALL follow the tap rules in `swing-phone-aim`.

#### Scenario: First person, crosshair on a building
- **WHEN** the player is in first person and the crosshair rests on a building 40 m away and 15 m above the chest
- **THEN** the lock-on ring sits on the crosshair point
- **AND** the swing input attaches the rope within 8 m of the crosshair point

#### Scenario: First person, crosshair on the roof
- **WHEN** the player is in first person and the crosshair rests on the roof at the hero's feet
- **THEN** the swing input attaches the rope to the auto target, a building more than 5 m above the roof

#### Scenario: Third person looks at a building
- **WHEN** the camera looks level at a building 40 m ahead in third person and tiers 1 and 2 find nothing
- **THEN** the swing input attaches the rope to the point the centre ray hits

#### Scenario: Third person, hero's feet
- **WHEN** the camera looks down at the hero in third person and the player presses the swing input
- **THEN** the rope goes to the auto target and never to the roof at the hero's feet

### Requirement: The opening keeps its aim
In the opening, the picker, the hand choice, the kick, the hop and the lock-on ring SHALL be off. The aim SHALL be the exact ray through the screen centre. The crack SHALL take a rope from a real press.

#### Scenario: Hit the crack with the mouse
- **WHEN** the opening runs, the crosshair rests on the crack, and the player holds the left mouse button
- **THEN** the rope attaches to the crack
- **WHEN** the player presses F
- **THEN** the crack takes a pump

#### Scenario: Hit the crack with a pad
- **WHEN** the opening runs, the crosshair rests on the crack, and the player holds the right trigger
- **THEN** the rope attaches to the crack
- **WHEN** the player presses the right bumper
- **THEN** the crack takes a pump

#### Scenario: The crosshair is on the sky
- **WHEN** the opening runs and the crosshair rests on the sky
- **THEN** the swing input does not bend the aim toward a building

### Requirement: A marker shows the next target
In play, a marker SHALL show the point the next swing will use. The marker SHALL show while a rope is attached too, and then it SHALL mark the next building and not the one the rope holds. It SHALL hide when both ropes are out, in the opening, when paused, and when there is no target. The marker SHALL be a world reticle on the surface and a lock-on ring in screen space. The ring SHALL stay inside a safe window that excludes the score pills, the top buttons, the spoken line, the SWING panel and the climb pad. When the projected target lies outside the safe window, the ring SHALL become an arrow on the border of the window, pointing at the target. A target behind the camera SHALL show an arrow on the bottom border, pointing down. A catch SHALL pop the ring for 120 ms.

#### Scenario: Computer, target on screen
- **WHEN** a target exists inside the safe window at 960 by 540
- **THEN** the lock-on ring is 44 px across and its centre is within 3 px of the projected target
- **AND** the world reticle of `rope.js` sits on the same point

#### Scenario: Game pad
- **WHEN** a pad is the device in use and a target exists
- **THEN** the lock-on ring and the world reticle show as for the mouse

#### Scenario: Phone
- **WHEN** a target exists inside the safe window on a phone
- **THEN** the lock-on ring is 56 px across and its centre is within 3 px of the projected target
- **AND** the SWING button is not dimmed

#### Scenario: Target above the screen
- **WHEN** the best target is above the top edge of the screen
- **THEN** an arrow sits on the top border of the safe window at the target's side and points at the target
- **AND** the arrow overlaps no score pill, no top button and no spoken line, at 390 by 844, 844 by 390 and 960 by 540

#### Scenario: Target behind the camera
- **WHEN** the target lies behind the camera plane, as on a wall in third person
- **THEN** an arrow sits on the bottom border of the safe window and points down
- **AND** no other part of the screen covers the arrow, also the training card at 960 by 540 and 1280 by 720

#### Scenario: A rope is attached
- **WHEN** the right rope holds building A and a second target exists
- **THEN** the marker shows the second target
- **WHEN** both ropes are attached
- **THEN** no marker shows

#### Scenario: The catch pop
- **WHEN** a rope attaches, a yank fires or a pump fires
- **THEN** the ring pops for 120 ms
- **WHEN** the player prefers reduced motion
- **THEN** the ring does not change size and flips to its brighter colour for 120 ms

### Requirement: A cue tells the player when to let go
On a computer or a pad, while a rope is attached to a building and the swing is in its release window, the ring SHALL pulse and a caption SHALL read LET GO. The window SHALL open when the body is in the air, rising and moving away from the point under the anchor, 25 to 60 degrees from straight down. It SHALL also open when the body is on a roof or a street and has dragged along it for 0.5 s with the rope attached. The drag time SHALL start again from 0 whenever the body is off the ground, and the drag case SHALL hold only on the ground. The cue SHALL NOT show on a clog, a pipe or the crack, on a phone, or in a headset. The player SHALL be able to turn it off in the Comfort menu.

#### Scenario: Past the bottom of the arc
- **WHEN** a rope holds a building and the body rises 40 degrees past straight down, moving away from the anchor
- **THEN** the caption LET GO shows and the ring pulses

#### Scenario: Before the bottom of the arc
- **WHEN** the body is 10 degrees from straight down and falling
- **THEN** no cue shows

#### Scenario: Dragged along a roof
- **WHEN** the rope holds a building and the body drags along a roof for 0.6 s
- **THEN** the cue shows

#### Scenario: Off the roof
- **WHEN** the rope drags the body along a roof so that the cue shows, and the body then walks off the edge
- **THEN** the cue is gone on the first frame in the air, unless the swing window is open

#### Scenario: Cue off
- **WHEN** the Release cue setting is Off
- **THEN** no cue shows in the same states

#### Scenario: The caption stays on the screen
- **WHEN** the cue shows with the marker (ring or arrow) at any place from NDC x -1.2 to 1.2 at 640 by 360, 960 by 540 or 1280 by 720
- **THEN** the whole LET GO caption lies inside the screen
- **AND** it is centred on the marker wherever it fits there

### Requirement: No target is clear to the player
When no target exists, no marker SHALL show. A swing input SHALL wait 0.3 s for a target and then dry-fire: the cup flies 6 m along the view and drops. A computer or a pad player SHALL read the line "No building to swing from here. Face the city, or step off the edge." at most once every 10 s. A phone SHALL dim the SWING button and show its hint line.

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
A player who holds a wall and uses the swing input SHALL get a target away from the wall. The picker SHALL use the view bearing when the view faces away from the wall. Otherwise it SHALL use the outward normal of the wall, and it SHALL NOT limit the target to the screen. The marker SHALL show for a target behind the camera.

#### Scenario: Swing off a wall
- **WHEN** a player holds a wall in third person with the view toward the wall and presses the swing input
- **THEN** the marker shows an arrow on the bottom border before the press
- **AND** the rope attaches to a building on the side the wall faces, more than 9 m away
- **AND** the player leaves the wall and the view turns to face the swing

#### Scenario: Look away from the wall
- **WHEN** the player turns the view away from the wall and presses the swing input
- **THEN** the target lies within 35 degrees of the new view bearing, if a building qualifies

### Requirement: The picker is never narrower than the old phone assist
Tier 2 SHALL port the old phone assist. It SHALL use the 28 directions of the old assist, in the old order. The yaw offsets are 0, -22, 22, -45, 45, -75 and 75 degrees from the velocity heading (above 4 m/s) or the view yaw. Each has the pitches 28, 42, 56 and 16 degrees. For each direction it SHALL cast the exact ray. When that ray misses or hits beyond 88 m, it SHALL also cast the 24-ray cone of 24 degrees that `rope.js` casts. Take a state where the old assist found a building 9 to 88 m away, more than 3 m above the chest and more than 2 m ahead, and not a roof, a floor or an antenna. That state SHALL give a target.

#### Scenario: Compare with the old assist and its cone
- **WHEN** 5,000 sampled states run through a reference copy of the old assist (with the cone) and through the picker, in views that differ from the velocity heading as well as views that match it
- **THEN** no state exists where the reference finds a point that meets the tier 2 bounds and the picker finds none

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
In a VR or AR session no picker SHALL run, and no lock-on ring, cue, hint strip or pad rumble SHALL show or play.

#### Scenario: Quest session
- **WHEN** the player enters VR on a Quest or its emulator
- **THEN** the aim, the ropes and the controls work as before
- **AND** `G.test.target().on` is false and the page has no `#lockRing` and no `#keyHints` in view
