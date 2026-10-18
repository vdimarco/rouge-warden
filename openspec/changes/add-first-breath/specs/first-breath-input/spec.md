## ADDED Requirements

### Requirement: One live gesture at a time
Each moment SHALL have exactly one live gesture (drag, tap, hold, drag and hold, or none), and the prompt line SHALL name it with an icon. Input that does not match the live gesture SHALL be ignored with no penalty. No stage SHALL use more than two feel families, except stage 2, which uses three (beat tap, rotate and hold-release). The run SHALL use at least three (analog steer, beat tap, hold-release, rotate).

#### Scenario: A tap moment ignores drags
- **GIVEN** a tap moment in stage 2
- **WHEN** the player presses and drags 40 px
- **THEN** the press is judged at its touch-down time, and the drag changes nothing
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The prompt names the gesture
- **WHEN** stage 7 moves from the breaths to the turn
- **THEN** the prompt line changes from "Hold. Let go." with a ring icon to "Drag to turn. Turn when it is roomy." with an arrow icon
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Families per stage
- **WHEN** the stage table is checked
- **THEN** no stage but stage 2 declares more than two families, stage 2 declares three, and the run declares four
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Presses count at touch-down
Tap and press targets SHALL read every press at its touch-down time, whether or not the finger then moves. The classified taps (a short press with little movement) SHALL be used only by menus, never by a stage.

#### Scenario: A press that drags
- **GIVEN** a tap target in stage 3
- **WHEN** the player touches down on the beat and drags 30 px before lifting
- **THEN** the press is graded at its touch-down time, with no 220 ms wait
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Drag anywhere to steer
Steering SHALL use a floating stick: its origin SHALL be the touch-down point anywhere on the screen, with a dead zone of 8 px, full deflection at 56 px, and an origin that trails the finger past 80 px. No moment SHALL ask the player to tap toward a place on the screen. In portrait the subject SHALL stay above 60% of the screen height.

#### Scenario: Thumb at the bottom in portrait
- **GIVEN** stage 4 roots at 390 × 844
- **WHEN** the player touches down at the bottom of the screen and drags 56 px up
- **THEN** the tip grows forward at full speed, and the embryo stays above 60% of the screen height
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Lift to coast
- **WHEN** the player lifts the finger in stage 1
- **THEN** the cell coasts and slows, and a new touch-down anywhere sets a new stick origin
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Only the first pointer counts
The game SHALL read only the first pointer and SHALL ignore any other pointer, in portrait and landscape. No mechanic SHALL need two pointers at once.

#### Scenario: A second thumb in landscape
- **GIVEN** a drag in stage 1 at 844 × 390
- **WHEN** a second finger taps the screen
- **THEN** the steering does not change and no tap is judged
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Desktop with keys only
On desktop, the arrows or WASD SHALL steer (8 directions, smoothed over 0.12 s), and Space, Enter or Z SHALL press on keydown and release on keyup. Key repeats SHALL be ignored. Esc or P SHALL pause, M SHALL mute and C SHALL toggle captions. Tab and Enter SHALL move through every menu with a visible focus ring. No moment SHALL need the mouse. The left mouse button SHALL act as the pointer.

#### Scenario: A whole run with keys
- **GIVEN** 1440 × 900 with no mouse events
- **WHEN** a scripted key player plays every stage
- **THEN** every stage can be played and every menu reached with keys alone
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Aiming the arc on desktop
In stage 2's guard on desktop, a mouse over the page with no button down SHALL aim the arc at the pointer once it has moved more than 4 px, and the left and right arrows or A and D SHALL turn it anticlockwise and clockwise as seen. A drag with the left button SHALL steer it like a stick. Clockwise on screen SHALL stay clockwise in every layout.

#### Scenario: The guard with keys alone
- **GIVEN** stage 2's guard at 1440 × 900 with no mouse events
- **WHEN** the player holds the left arrow, then D
- **THEN** the arc turns anticlockwise, then clockwise, as seen on screen
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The mouse aims the arc
- **GIVEN** stage 2's guard at 1440 × 900
- **WHEN** the mouse moves to the left of the egg with no button down
- **THEN** the arc turns to face it, within 10°
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Turn keys keep up and keep their place
In the guard the turn keys SHALL turn the arc at 540° a second (720° with Assist), fast enough to keep up with the waves. Any steer or turn key SHALL clear the mouse aim until the mouse moves more than 4 px again, so a cursor resting over the page never pulls the arc back. W, S and the up and down arrows SHALL do nothing in the guard.

#### Scenario: A parked cursor
- **GIVEN** stage 2's guard at 1440 × 900 with the cursor resting over the page since Play was clicked
- **WHEN** the player turns the arc with D and lets go
- **THEN** the arc stays where D left it, and W or the up arrow does not move it
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Keys keep up
- **WHEN** a bot that aims only through the turn keys guards 20 seeds
- **THEN** it reaches Great in at least 18 of them, with a mean guard credit within 0.15 of the reference bot's
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: A hold needs a fresh press
When the live gesture becomes hold or drag and hold, a pointer, key or one-button press that is already down SHALL NOT start a hold, and its release SHALL be ignored. The next touch-down or keydown SHALL be the press.

#### Scenario: A thumb held into the seal
- **GIVEN** stage 2 at 390 × 844 with the thumb still down from the guard drag when the seal prompt shows
- **WHEN** the player lifts the thumb, then presses and lets go again on the glowing beat
- **THEN** the first lift does nothing, and the second release is graded
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: One button held into the seal
- **GIVEN** one-button mode at 1440 × 900 with Space held from the guard when the seal prompt shows
- **WHEN** the player lets go of Space, then presses and lets go again
- **THEN** the first release does nothing, and the second is graded
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Keys in a drag-and-hold moment
In a drag-and-hold moment, an arrow or WASD keydown SHALL count as a press with its direction, and its keyup as the release. Space, Enter or Z alone SHALL count as a plain hold with no direction.

#### Scenario: An arrow in a drag-and-hold moment
- **GIVEN** the Tuck wave of stage 8 at 1440 × 900
- **WHEN** the player holds the down arrow through the swell and lets go
- **THEN** the keydown is a press with the direction down, the keyup is the release, and the move counts as matched
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Space in a drag-and-hold moment
- **GIVEN** the Tuck wave of stage 8 at 1440 × 900
- **WHEN** the player holds Space through the swell
- **THEN** it counts as a plain hold with no direction: the wave's overlap counts, and the prompt move does not
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: A fair timing judge
Each press SHALL be judged on its own event timestamp, mapped to the stage's own clock with sub-step precision, at touch-down for taps and presses and at release for releases. Every target SHALL carry its spacing P: the time since the previous target, or the beat period of its heart for the first target, floored at 0.5 s. Windows SHALL be In time ±min(70 ms, 0.12 P) and Close ±min(170 ms, 0.28 P).

#### Scenario: Windows
- **WHEN** the judge grades errors at P = 0.706 s
- **THEN** 60 ms is In time, 150 ms is Close, and 260 ms is Off
- **CHECK** `qa/first-breath/judge.test.mjs`

#### Scenario: Sub-step timing
- **GIVEN** two targets 0.5 s apart
- **WHEN** one press lands 5 ms after the first target and another 12 ms after the second, each at a different point inside its 16.7 ms step
- **THEN** each is graded on its own time, with errors of 5 ms and 12 ms, not on the step
- **CHECK** `qa/first-breath/judge.test.mjs`

#### Scenario: The stage clock
- **WHEN** a press arrives at the core time of the stage start plus a target's time
- **THEN** it is graded In time
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Misses wait for late events
A target SHALL count as missed only when the stage time passes its Close window plus a 50 ms grace, because a pointer event can reach the page a frame after its time stamp.

#### Scenario: A late event
- **WHEN** a press stamped 160 ms after a target at P = 0.706 s reaches the game one step later
- **THEN** it is graded Close, not a miss
- **CHECK** `qa/first-breath/judge.test.mjs`

### Requirement: Targets are spaced and shown ahead
Timed targets SHALL be at least 0.5 s apart in every stage, and each SHALL be visible at least max(2 beats of its heart, 1.2 s) before its time. Taps between targets SHALL be free. Sounds SHALL be scheduled early by the output latency, so the heard beat lands on the drawn beat, and the drawn beat SHALL be the one that is judged.

#### Scenario: Free taps
- **WHEN** the player taps halfway between two targets
- **THEN** nothing is graded and nothing changes
- **CHECK** `qa/first-breath/track.test.mjs`

#### Scenario: Spacing and preview
- **WHEN** every stage's targets are listed for 20 seeds
- **THEN** no two are closer than 0.5 s, each carries its P, and each enters view at least max(2 beats, 1.2 s) ahead
- **CHECK** `qa/first-breath/track.test.mjs`

#### Scenario: Heard on the drawn beat
- **WHEN** a beat is scheduled with an output latency of 40 ms
- **THEN** its sound is scheduled 40 ms before the drawn beat time
- **CHECK** `qa/first-breath/sound.e2e.mjs`

### Requirement: Timing calibration
Settings SHALL offer a Tap test of 8 taps that sets the timing offset to their median error, and a manual offset from −150 to +150 ms in 10 ms steps. The offset SHALL shift the judge. Every judge event SHALL keep both the error after the offset and the raw error before it. Automatic adjustment of the offset is not part of this change.

#### Scenario: Tap test on a phone
- **GIVEN** Settings at 390 × 844
- **WHEN** the player runs the Tap test and taps 8 times about 40 ms late
- **THEN** the offset reads about +40 ms
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The offset moves the judge
- **GIVEN** an offset of +90 ms
- **WHEN** a simulated player taps every target 90 ms late
- **THEN** the taps are In time, and each judge event shows a raw error near 90 ms and an error near 0
- **CHECK** `qa/first-breath/track.test.mjs`

### Requirement: One-button mode
One-button mode SHALL let every stage be played with one key or tap: any input presses and releases. The run SHALL set the steering and the direction for every stage from that stage's own steering policy at full skill, and SHALL steer only while the button is held. It SHALL be in Settings and through `?one=1`.

#### Scenario: One button through the steering stages
- **GIVEN** one-button mode
- **WHEN** the player plays stages 1, 2, 4, 5, 7 and 8 with Space alone
- **THEN** each stage reaches its goal, stage 1 reaches the meeting place in the top 3 before its cap, and in stage 2 the arc tracks only while Space is held
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Let go to rest
- **GIVEN** one-button mode in stage 1
- **WHEN** the player lets go of the button
- **THEN** the steering is zero and the cell coasts
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Assist
Assist SHALL widen windows 1.6 times (Close capped at 0.4 P) and SHALL ease each stage as listed in the design (a weaker current and softer bumps in stage 1, a wider arc in stage 2, larger pools in stage 4, a wider move cone in stage 5, longer roomy moments in stage 7). A run with Assist SHALL show an Assist mark and still count.

#### Scenario: Wider windows
- **GIVEN** Assist on
- **WHEN** the player taps 100 ms late at P = 0.833 s
- **THEN** the tap is In time
- **CHECK** `qa/first-breath/judge.test.mjs`
