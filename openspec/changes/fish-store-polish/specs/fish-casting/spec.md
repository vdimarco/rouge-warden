## ADDED Requirements

### Requirement: Touch and mouse release at the finger
A touch or mouse cast SHALL be graded at the point where the finger lifts. The time between the last move and the lift SHALL NOT change the result.

#### Scenario: Same flick, different lift gap
- **WHEN** the same flick ends with a gap of 0, 40, 80, or 120 ms before the finger lifts
- **THEN** each cast gets the same verdict, and the release angle stays within 2 degrees of the angle at the finger.

### Requirement: A natural flick is forgiven
A touch flick that ends above the press point SHALL still cast well. A lift below the press point SHALL still grade high, so the skill stays.

#### Scenario: Overshoot
- **WHEN** a touch flick at 1000 to 2000 px/s lifts 10 to 130 px above the press point
- **THEN** the lure lands at 25 m or more.

#### Scenario: Lift too soon
- **WHEN** the finger lifts 30 px below the press point
- **THEN** the cast grades high.

### Requirement: Touch area covers what the player sees
In touch mode before a cast, a press on the rod, the reel, or the lower half of the lake SHALL start a cast when the drag is mostly up and down, and SHALL aim when the drag is mostly sideways. The bail SHALL open only when the drag is up and down.

#### Scenario: Press the visible reel
- **WHEN** a touch player at 390x844 or 360x640 presses the reel, drags down, and flicks up
- **THEN** the lure flies.

#### Scenario: Aim on the lake
- **WHEN** a touch player drags sideways on the lake
- **THEN** the aim turns and the bail stays shut.

### Requirement: Smooth motion window
For a motion cast, the distance SHALL change smoothly with the release time. Two release times 10 ms apart SHALL NOT differ by more than 10 m. A thumb held down through the whole swing SHALL cast shorter than a lift that is 170 ms late.

#### Scenario: Release table
- **WHEN** the cast simulation steps the release from 200 ms early to 200 ms late at a normal swing
- **THEN** no neighbouring steps differ by more than 10 m, and the held thumb casts less far than the late lift.

### Requirement: Cast feedback
The game SHALL say how the release went the moment the lure leaves, and the aim line SHALL show about how far the cast will go.

#### Scenario: Sweet release
- **WHEN** the player releases in the sweet window
- **THEN** a short "Sweet!" cue and a sound play at the release, before the lure lands.

#### Scenario: No back swing
- **WHEN** a motion cast has no back swing
- **THEN** the report says to tip the phone back further, not to swing faster.

### Requirement: Sensors that stop
When motion samples stop for 3 s after the player said yes to motion, the game SHALL offer touch play.

#### Scenario: Sensor stall
- **WHEN** no motion sample arrives for 3 s in the cast phase
- **THEN** the game says "The motion sensors stopped. Play with touch?" and a tap switches to touch.
