## ADDED Requirements

### Requirement: A standard pad plays every flat action
Once play has started, a pad with the "standard" mapping SHALL play every flat action that does not need a pointer. The right trigger (RT, R2) SHALL swing and the left trigger (LT, L2) SHALL add a second rope, as the mouse buttons do. The left bumper (LB, L1) SHALL reel. The right bumper (RB, R1) or X (Square) SHALL yank. A (Cross) SHALL jump, with the same three states as Space. The left stick SHALL walk, steer in the air and climb. The right stick SHALL look. Y (Triangle) SHALL switch the view. Start (Options) SHALL open the pause menu, and SHALL close it. B (Circle), Back (Share), the stick buttons and the D-pad SHALL do nothing.

#### Scenario: Swing with RT
- **WHEN** a pad player holds RT with a target in view
- **THEN** a rope attaches and stays while RT is down
- **WHEN** the player lets go of RT
- **THEN** the rope lets go

#### Scenario: A quick tap of RT
- **WHEN** a pad player taps RT for 80 ms with a target 40 m away
- **THEN** the cup lands and the rope attaches, and the rope lets go on the first frame after the attach

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

#### Scenario: Start
- **WHEN** the player presses Start in play
- **THEN** the pause menu opens
- **WHEN** the player presses Start again
- **THEN** the menu closes and play goes on

#### Scenario: Buttons with no action
- **WHEN** the player presses B, Back, a stick button and each D-pad direction
- **THEN** no action fires, and the view, the map and the pause do not change

### Requirement: The pad does not need a pointer to play, and the game says so
The title and the pause menu are pages with buttons. They SHALL need a mouse, a key or a tap. A pad press SHALL NOT start the game, because a pad press is not a reliable user gesture for the audio. The title note SHALL say that a pad works after PLAY. The pad SHALL NOT need the pointer lock.

#### Scenario: Title note
- **WHEN** the title shows on a device with no touch point
- **THEN** the desktop note says that a game pad works after the player presses PLAY

#### Scenario: Play with no lock
- **WHEN** the pointer lock is not granted and a pad player uses the sticks and RT
- **THEN** the view turns and the rope fires

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
When the pad in use has a `vibrationActuator`, the game SHALL play a "dual-rumble" effect in flat play. On attach it SHALL use 0.3 for 30 ms. On a yank it SHALL use 0.4 for 40 ms. On a pump it SHALL use 0.6 for 60 ms. A pad with no actuator SHALL cause no error. In a headset session the game SHALL NOT rumble a pad.

#### Scenario: Attach and yank
- **WHEN** a rope attaches and then a yank fires with a pad that has an actuator
- **THEN** `playEffect` is called with those values

#### Scenario: No actuator
- **WHEN** the pad has no actuator and a rope attaches
- **THEN** no error shows

#### Scenario: A headset session
- **WHEN** a headset session runs with a pad connected
- **THEN** `playEffect` is never called

### Requirement: The input kind follows the device
The input kind SHALL be "pad" once a button is pressed or a stick moves out of its dead zone. It SHALL return to "mouse" on a key press or a mouse event. The hint strip and the tutorial lines SHALL follow the kind. Pad lines SHALL say "right trigger", "right bumper", "left bumper", "left stick", "right stick" and "the bottom button", so that one line fits an Xbox pad and a PlayStation pad.

#### Scenario: Use the pad, then the keyboard
- **WHEN** the player presses a pad button
- **THEN** the kind is "pad", the hint strip names the right trigger, and the tutorial lines come from `LINES_PAD`
- **WHEN** the player presses a key
- **THEN** the kind is "mouse" and the mouse words return

#### Scenario: Pad words
- **WHEN** a pad player reads the tutorial
- **THEN** no line names Shift, F, a mouse button, RT or A
- **AND** the line to reel reads "Hold the left bumper to reel in."

#### Scenario: Pad first line
- **WHEN** a pad player starts the tutorial
- **THEN** the first line reads "Look at the gold ring. Hold the left stick up and the right trigger."
- **AND** the hint strip reads HOLD LEFT STICK UP AND RIGHT TRIGGER: SWING. LET GO WHEN THE RING SAYS GO. RIGHT STICK: LOOK.
- **AND** from the start roof, holding the left stick up and RT puts the hero in the air within 4 s (measured: 3.1 to 3.3 s)

#### Scenario: Pad wall line
- **WHEN** a pad player first holds a wall
- **THEN** the line reads "On the wall. Push the left stick to climb. Press the bottom button to jump off."

### Requirement: Only standard pads play
A pad whose mapping is not "standard" SHALL be ignored.

#### Scenario: A pad with another mapping
- **WHEN** a connected pad reports an empty mapping and the player presses its buttons
- **THEN** no action fires and the kind stays "mouse"
