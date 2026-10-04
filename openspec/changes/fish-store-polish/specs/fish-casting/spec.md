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
In touch mode before a cast, a press anywhere outside the HUD, the menus, and the drag bar SHALL start a cast when the drag is mostly up and down, and SHALL aim when the drag is mostly sideways. The bail SHALL open only when the drag is up and down.

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

### Requirement: The rail before the guide
While a finger holds the line in touch play, the rail beside the finger SHALL show with its LOAD and LET GO marks on every phone size. The animated guide SHALL move, go small, or hide so that it does not cover the rail or its words.

#### Scenario: Small phone with the guide on
- **WHEN** a new player at 360x640 or 375x667 presses the rod and drags down
- **THEN** the rail, LOAD, and LET GO show beside the finger, clear of the guide.

### Requirement: Sensors that stop
When motion samples stop for 3 s after the player said yes to motion, the game SHALL offer touch play.

#### Scenario: Sensor stall
- **WHEN** no motion sample arrives for 3 s in the cast phase
- **THEN** the game says "The motion sensors stopped. Play with touch?" and a tap switches to touch.

### Requirement: Quick turnaround to the next cast
The next cast SHALL be ready soon after the lure comes home, lands on the shore, or loses a fish. "Nothing this time" SHALL wait about 1 s and a cast onto the shore about 0.9 s. A cast input SHALL skip any of these beats after a short minimum, and the same press SHALL go on into the next cast. After 3 s of an empty retrieve (no fish coming), the lure SHALL skip home: each crank turn SHALL wind in at least 4 times as much line, and any turn of the crank SHALL bring the lure home in about 3 s, however far out it is. A crank faster than 1.5 turns a second SHALL shorten the 3 s wait to as little as 1 s. After the short minimum, a press on the crank or the gauge SHALL end the beat and SHALL NOT cast. After a lost fish, a press on the drawn rod SHALL do the same. After "Nothing this time", a press on the drawn rod SHALL go on into the next cast, as a press on the lake does.

#### Scenario: Lure home with nothing
- **WHEN** the lure comes home with no fish and the player does nothing
- **THEN** the next cast is ready in about 1.3 s or less.

#### Scenario: Nothing is biting far out
- **WHEN** "Nothing is biting here." shows on a 53 m cast and the player cranks at 1 turn a second
- **THEN** the lure is home in under 4 s.

#### Scenario: Skip the beat
- **WHEN** the player presses to cast 0.4 s after "Nothing this time." shows
- **THEN** the beat ends at once and the same press takes the line for the next cast.

#### Scenario: Press the rod after an empty retrieve
- **WHEN** a touch player presses the drawn rod 0.5 s after "Nothing this time." shows, drags down, and flicks up
- **THEN** the beat ends and the lure flies, with no second press.

#### Scenario: One more pump after a lost fish
- **WHEN** a touch player pumps the rod once more 0.9 s after a fish got away
- **THEN** the beat ends, and no cast flies and no derby cast is used.

### Requirement: Easy mouse cast
On a computer, holding the mouse button SHALL cast the same way as holding Space: the rod tips back by itself, then swings forward, and letting go in the green casts, graded at the rod angle. Moving the mouse sideways while holding SHALL aim. A quick vertical drag SHALL still flick as before. A press on a button, a menu, or during the reel SHALL never start a cast.

#### Scenario: Hold cast
- **WHEN** a desktop player at 1280x800 holds the mouse button and lets go as the rod passes the green
- **THEN** the cast grades sweet and flies 25 m or more.

#### Scenario: Aim while holding
- **WHEN** the player moves the mouse to the left while holding
- **THEN** the aim turns left before the cast.
