## ADDED Requirements

### Requirement: A standard pad plays every flat action
A pad with the "standard" mapping SHALL play every flat action. RT SHALL swing and LT SHALL add a second rope, as the mouse buttons do. LB SHALL reel. RB or X SHALL yank. A SHALL jump, with the same three states as Space. The left stick SHALL walk, steer in the air and climb. The right stick SHALL look. Y SHALL switch the view. Back SHALL open the map and close it. Start SHALL pause, and SHALL close the pause menu or the map. B SHALL do nothing.

#### Scenario: Swing with RT
- **WHEN** a pad player holds RT with a target in view
- **THEN** a rope attaches and stays while RT is down
- **WHEN** the player lets go of RT
- **THEN** the rope lets go

#### Scenario: Second rope with LT
- **WHEN** RT holds a rope and the player holds LT
- **THEN** the idle hand fires at a different building when one qualifies

#### Scenario: Reel with LB
- **WHEN** a rope is attached and the player holds LB for 0.5 s
- **THEN** the rope is shorter
- **AND** RB does not reel

#### Scenario: Yank with RB or X
- **WHEN** a rope is attached and the player presses RB, and later X
- **THEN** each press fires one yank event

#### Scenario: Jump with A
- **WHEN** the player stands on a roof and presses A
- **THEN** the body jumps
- **WHEN** the player holds a wall and presses A
- **THEN** the player jumps off the wall
- **WHEN** a rope is attached in the air and the player presses A
- **THEN** a yank event fires

#### Scenario: Left stick
- **WHEN** the player pushes the left stick fully up on a roof, then on a wall for 0.5 s
- **THEN** the hero walks forward on the roof, and climbs 3 m on the wall
- **WHEN** the player pushes the left stick right on the wall for 0.5 s
- **THEN** the player moves 3 m to the right along the wall

#### Scenario: Right stick
- **WHEN** the player pushes the right stick fully right for 0.5 s
- **THEN** the view turns right by `PAD.lookRate` (radians a second) times 0.5 s, within 1 percent

#### Scenario: Y switches the view
- **WHEN** the player presses Y
- **THEN** the view switches once, and a held Y does not switch it again

#### Scenario: Back opens and closes the map
- **WHEN** the player presses Back
- **THEN** the map opens
- **WHEN** the player presses Back again
- **THEN** the map closes and play goes on

#### Scenario: Start
- **WHEN** the player presses Start in play
- **THEN** the pause menu opens
- **WHEN** the player presses Start again, or presses Start with the map open
- **THEN** the menu or the map closes

#### Scenario: B
- **WHEN** the player presses B
- **THEN** no action fires

### Requirement: Sticks have a radial dead zone and a look curve
Each stick SHALL use a radial dead zone of `PAD.dead` (0.15). Inside it the output SHALL be zero. Outside it the magnitude SHALL start at zero and reach one at full deflection. The look stick SHALL apply the curve `PAD.curve` to that magnitude and turn at up to `PAD.lookRate`.

#### Scenario: Small push
- **WHEN** the left stick sits at (0.1, 0.1)
- **THEN** the move input is zero

#### Scenario: Diagonal
- **WHEN** the left stick sits at (0.14, 0.9)
- **THEN** the move direction keeps its angle of 8.8 degrees from straight ahead, within 1 degree
- **AND** it does not snap to the axis

#### Scenario: Curve
- **WHEN** the right stick sits at 0.5 on its x axis
- **THEN** the turn in one frame equals `PAD.lookRate` times `((0.5 - dead) / (1 - dead)) ^ curve` times the frame time, within 1 percent

### Requirement: Triggers do not flutter
A trigger SHALL go down at a value of 0.5 and go up below 0.3. A value between the two SHALL keep the state it had.

#### Scenario: A trigger near the threshold
- **WHEN** RT holds a rope and its value moves between 0.45 and 0.6 for 30 frames
- **THEN** the rope stays attached
- **WHEN** RT falls below 0.3
- **THEN** the rope lets go

### Requirement: The pad rumbles
When the pad in use has a `vibrationActuator`, the game SHALL play a "dual-rumble" effect. On attach it SHALL use 0.3 for 30 ms. On a yank it SHALL use 0.4 for 40 ms. On a pump it SHALL use 0.6 for 60 ms. A pad with no actuator SHALL cause no error.

#### Scenario: Attach and yank
- **WHEN** a rope attaches and then a yank fires with a pad that has an actuator
- **THEN** `playEffect` is called with those values

#### Scenario: No actuator
- **WHEN** the pad has no actuator and a rope attaches
- **THEN** no error shows

### Requirement: The input kind follows the device
The input kind SHALL be "pad" once a button is pressed or a stick moves out of its dead zone. It SHALL return to "mouse" on a key press or a mouse event. The hint strip and the tutorial lines SHALL follow the kind.

#### Scenario: Use the pad, then the keyboard
- **WHEN** the player presses a pad button
- **THEN** the kind is "pad", the hint strip names RT and RB, and the tutorial lines come from `LINES_PAD`
- **WHEN** the player presses a key
- **THEN** the kind is "mouse" and the mouse words return

#### Scenario: Pad words
- **WHEN** a pad player reads the tutorial
- **THEN** no line names Shift, F or a mouse button
- **AND** the line to reel reads "Hold LB to reel in."

### Requirement: Only standard pads play
A pad whose mapping is not "standard" SHALL be ignored.

#### Scenario: A pad with another mapping
- **WHEN** a connected pad reports an empty mapping and the player presses its buttons
- **THEN** no action fires and the kind stays "mouse"
