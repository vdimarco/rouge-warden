## ADDED Requirements

### Requirement: Move, auto-fire and dash
In an action moment the live gesture SHALL be `move`: a drag anywhere SHALL move you through the floating stick, and lifting the finger SHALL let you ease to a stop. Firing SHALL be automatic at the nearest foe in range. Any press SHALL dash, or use the stage's special (grapple, kick or tuck), the way you move or last moved. Stage 1 SHALL use the press to drift or use items, and stage 2 SHALL keep its arc. No dash SHALL need two fingers at once.

#### Scenario: One thumb in portrait
- **GIVEN** stage 3 at 390 × 844 with touch
- **WHEN** the player drags up from a touch-down near the bottom of the screen, lifts, and taps
- **THEN** you move up while the drag lasts, ease to a stop after the lift, and the tap dashes up
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Two thumbs in landscape
- **GIVEN** stage 7 at 844 × 390 with touch
- **WHEN** the player drags with the left thumb and taps with the right
- **THEN** the left thumb moves you and the right thumb's tap kicks, and the steering does not change
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Keys alone
- **GIVEN** stage 5 at 1440 × 900 with no mouse events
- **WHEN** the player holds W and D, then presses Space
- **THEN** you move up and right and dash, and your sparks fire by themselves
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Dash cooldown
- **WHEN** the player presses twice 0.3 s apart in stage 3
- **THEN** the first press dashes, and the second waits in the 0.12 s buffer and is dropped because the 1.0 s cooldown has not passed
- **CHECK** `qa/first-breath/stage-split.test.mjs`

### Requirement: The dash press and its prompt
A dash press SHALL be a quick second tap, a tap with another finger, or Space, Enter or Z on keydown. The prompt line SHALL read "Drag to move. Tap to dash." with the stage's special word in place of dash, and on desktop "WASD to move. Space to dash."

#### Scenario: The prompt in each layout
- **GIVEN** stage 7 at 390 × 844 with touch, and at 1440 × 900 with keys
- **WHEN** the waves start
- **THEN** the prompt line reads "Drag to move. Tap to kick." on the phone and "WASD to move. Space to kick." on desktop, with the move icon
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: Drift and items in the race
In stage 1 a press while the stick points at least 25° off your heading SHALL start a drift toward that side, and the drift SHALL end, giving its boost, when the stick comes within 10° of your heading, the finger lifts, or the player presses again. A press while you swim straight SHALL use the item you hold. On desktop, Space held while turning SHALL drift and its keyup SHALL give the boost, and E or Shift (or Space while straight) SHALL use the item.

#### Scenario: The drift prompt
- **GIVEN** stage 1 at 390 × 844 with touch, and at 1440 × 900 with keys
- **WHEN** the cell nears the first bend, and later takes its first item
- **THEN** the prompt line reads "Tap while you turn to drift." and then "Tap to use it." on the phone, and "Hold Space while you turn to drift." and "Press E to use it." on desktop
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Drift on a phone
- **GIVEN** stage 1 at 390 × 844 with touch, in a bend
- **WHEN** the player drags to turn, taps with the same thumb, keeps turning, then straightens the drag
- **THEN** the tap starts a drift, the drift charges while the turn lasts, and straightening gives its boost
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: An item with keys
- **GIVEN** stage 1 at 1440 × 900 holding a Rush, swimming straight
- **WHEN** the player presses E
- **THEN** the Rush is used, and nothing drifts
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Lanes
Stages 6 and 8 SHALL use three lanes. A drag left or right SHALL move you between lanes (in stage 6 one lane per 24 px from the touch-down point, sticky after the lift; in stage 8 sideways at 70 u/s by the stick, settling on the nearest lane), and on desktop the left and right arrows or A and D SHALL move one lane per keydown. In stage 6 an arrow keydown SHALL also count as the kick, in the new lane, the up and down arrows SHALL kick where you are, a touch-down SHALL put you in the lane whose column it lands in (anywhere down the column, so a thumb low on the screen can tap a lane), and a kick SHALL count in the lane you are in at the press or 0.12 s after it.

#### Scenario: Tap a lane
- **GIVEN** stage 6 at 390 × 844 with a note in the left lane
- **WHEN** the player taps low in the left lane's column on the beat
- **THEN** you move to the left lane and the tap counts there, In time
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/stage-answer.test.mjs`

#### Scenario: A flick on the beat
- **GIVEN** stage 6 at 390 × 844 with a note in the right lane
- **WHEN** the player touches down on the beat and drags right past 24 px within 0.12 s
- **THEN** the kick is judged at its touch-down time and counts in the right lane
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Runner lanes on desktop
- **GIVEN** stage 8 at 1440 × 900
- **WHEN** the player presses A once
- **THEN** you move exactly one lane left and stay there
- **CHECK** `qa/first-breath/input.e2e.mjs`

## MODIFIED Requirements

### Requirement: One live gesture at a time
Each moment SHALL have exactly one live gesture (`move`, `drag`, `tap`, `hold` or `none`), and the prompt line SHALL name it with an icon. Input that does not match the live gesture SHALL be ignored with no penalty. No stage SHALL declare more than two feel families: an action stage SHALL declare steer and tap (the move and the dash, or in stage 1 the drift and the item), stage 2 rotate and tap (the arc and the seal), and stage 6 tap and steer (the kicks and the lanes).

#### Scenario: A tap moment ignores drags
- **GIVEN** a kick moment in stage 6
- **WHEN** the player presses and drags 10 px
- **THEN** the press is judged at its touch-down time, and the drag changes nothing
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The prompt names the gesture
- **WHEN** stage 7 moves from the waves to the turn
- **THEN** the prompt line changes from "Drag to move. Tap to kick." to "Drag down to turn head-down." with an arrow icon
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Families per stage
- **WHEN** the stage table is checked
- **THEN** no stage declares more than two families
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Presses count at touch-down
Tap, kick and dash presses SHALL be read at their touch-down time, whether or not the finger then moves. The classified taps (a short press with little movement) SHALL be used only by menus, never by a stage.

#### Scenario: A press that drags
- **GIVEN** a kick target in stage 6
- **WHEN** the player touches down on the beat and drags 30 px before lifting
- **THEN** the kick is graded at its touch-down time, with no 220 ms wait
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Only the first pointer counts
Only the first pointer SHALL steer, in portrait and landscape. Another pointer's touch-down SHALL count only as a press: a dash in a move moment, a seal charge in stage 2's guard, and nothing in any other moment. No mechanic SHALL need two pointers at once.

#### Scenario: A second thumb in landscape
- **GIVEN** a drag in stage 1 at 844 × 390
- **WHEN** a second finger taps the screen
- **THEN** the steering does not change, and the tap drifts if the drag is turning, or uses the item if it is straight
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: A second thumb in stage 6
- **GIVEN** a lane drag in stage 6 at 844 × 390
- **WHEN** a second finger taps between notes
- **THEN** the lane does not change and nothing is graded
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Desktop with keys only
On desktop, the arrows or WASD SHALL move (8 directions, smoothed over 0.12 s), and Space, Enter or Z SHALL press on keydown and release on keyup: a dash in a move moment, a drift or an item in stage 1, a seal charge or the seal in stage 2, a kick in stage 6. In stage 2's guard the left and right arrows or A and D SHALL turn the arc, as before. Key repeats SHALL be ignored. Esc or P SHALL pause, M SHALL mute and C SHALL toggle captions. Tab and Enter SHALL move through every menu with a visible focus ring. No moment SHALL need the mouse. The left mouse button SHALL act as the pointer.

#### Scenario: A whole run with keys
- **GIVEN** 1440 × 900 with no mouse events
- **WHEN** a scripted key player plays every stage
- **THEN** every stage can be played and every menu reached with keys alone
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: One-button mode
One-button mode SHALL let every stage be played with one key or tap. In a move moment, while the button is held the run SHALL set the move vector and the dash (in stage 1 the drift and the item) from the stage's `botSteer` at full skill, and when it is let go you SHALL stand still while auto-fire goes on. In stage 2's guard the arc SHALL track by itself only while the button is held, as before, and the bot SHALL release the seal charge. In stage 6 the run SHALL put you in the next note's lane, so the button only kicks on the beat. It SHALL be in Settings and through `?one=1`.

#### Scenario: One button through the steering stages
- **GIVEN** one-button mode
- **WHEN** the player plays stages 1 to 5, 7 and 8 with Space held
- **THEN** each stage completes with no knock-out, stage 1 reaches the meeting place in the top 3, and in stage 2 the arc tracks only while Space is held
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/sim.test.mjs`

#### Scenario: Let go to rest
- **GIVEN** one-button mode in stage 1
- **WHEN** the player lets go of the button
- **THEN** the move vector is zero and the cell coasts
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: One button in the rhythm stage
- **GIVEN** one-button mode in stage 6
- **WHEN** the player presses only on the beats
- **THEN** each press is in the note's lane, and the stage reaches Great with presses In time
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

### Requirement: Assist
Assist SHALL ease every stage as the design lists: in stage 1 a weaker current, a wider racing line, shorter spin-outs, bigger gate quotas and a slower tide; in the action stages more hp, foe bullets slower (×0.75), fewer foes (×0.75) and a shorter dash cooldown; in stage 6 windows 1.6 times wider (Close capped at 0.4 P) and any lane counting; in stage 8 slower surges and wider gaps. A run with Assist SHALL show an Assist mark and still count.

#### Scenario: Wider windows
- **GIVEN** Assist on
- **WHEN** the player kicks 100 ms late at P = 0.769 s in the wrong lane in stage 6
- **THEN** the kick is In time
- **CHECK** `qa/first-breath/judge.test.mjs`, `qa/first-breath/stage-answer.test.mjs`

#### Scenario: More hp
- **GIVEN** Assist on
- **WHEN** stage 2 starts
- **THEN** the shell has 9 pips, the arc is 50° wide each side, and foe sparks fly at 0.75 of their speed
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: A hold needs a fresh press
When the live gesture becomes `hold`, or the stage 2 seal asks for a press, a pointer, key or one-button press that is already down SHALL NOT count, and its release SHALL be ignored. The next touch-down or keydown SHALL be the press. This SHALL hold for the stage 2 seal and for the first breath.

#### Scenario: A thumb held into the seal
- **GIVEN** stage 2 at 390 × 844 with the thumb still down from the guard drag when the seal prompt shows
- **WHEN** the player lifts the thumb, then taps again
- **THEN** the first lift does nothing, and the tap seals the shell
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: One button held into the seal
- **GIVEN** one-button mode at 1440 × 900 with Space held from the guard when the seal prompt shows
- **WHEN** the player lets go of Space, then presses it again
- **THEN** the first release does nothing, and the new press seals the shell
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: A thumb held into the first breath
- **GIVEN** the end of stage 8 at 390 × 844 with the thumb still down from a lane drag when "Breathe." shows
- **WHEN** the player lifts the thumb, then presses and lets go again
- **THEN** the first lift does nothing, and the second press starts the breath
- **CHECK** `qa/first-breath/input.e2e.mjs`

## REMOVED Requirements

### Requirement: Keys in a drag-and-hold moment
**Reason**: Stage 8 is a runner with lanes and a tuck; no moment uses drag and hold.
**Migration**: Lanes, and Move, auto-fire and dash.
