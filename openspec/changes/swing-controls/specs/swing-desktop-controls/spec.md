## ADDED Requirements

### Requirement: Swing with the left mouse button or E
In flat play with a mouse and keyboard, holding the left mouse button or E SHALL fire one rope at the auto target and keep it. Letting go of the button or the key SHALL let go of that rope. The hand SHALL be chosen as the auto target spec says.

#### Scenario: Hold the left mouse button
- **WHEN** a player holds the left mouse button with a target in view
- **THEN** a rope attaches to the target within 0.6 s and stays while the button is down
- **WHEN** the player lets go of the button
- **THEN** the rope lets go and the body keeps its speed

#### Scenario: Hold E
- **WHEN** a player holds E with a target in view
- **THEN** the same rope fires and stays while E is down

#### Scenario: Both ropes out
- **WHEN** both ropes are attached and the player presses the left mouse button again
- **THEN** nothing fires and no dry fire shows

### Requirement: A second rope with the right mouse button or Q
With both ropes idle, the right mouse button or Q SHALL fire the right hand at the target. With one rope out, a new press of either swing input SHALL fire the idle hand at the next target. Each input SHALL let go of its own rope only.

#### Scenario: Right button alone
- **WHEN** both ropes are idle and the player holds the right mouse button
- **THEN** the right rope fires at the target

#### Scenario: Two ropes
- **WHEN** the left button holds a rope and the player presses the right button
- **THEN** the idle hand fires at a different building when one qualifies
- **WHEN** the player lets go of the right button
- **THEN** the second rope lets go and the first rope stays

### Requirement: Space has one job in each state
Space SHALL jump on the ground, jump off a wall, and yank every attached rope in the air. In the air with no rope, Space SHALL do nothing.

#### Scenario: On the ground
- **WHEN** the player stands on a roof and presses Space
- **THEN** the body leaves the ground at about 5.2 m/s upward

#### Scenario: On a wall
- **WHEN** the player holds a wall and presses Space
- **THEN** the player leaves the wall at 6 m/s out and 6 m/s up

#### Scenario: In the air with a rope
- **WHEN** a rope is attached in the air and the player presses Space
- **THEN** a yank event fires on that rope

#### Scenario: In the air with no rope
- **WHEN** the body is in the air with no rope and the player presses Space
- **THEN** nothing happens

### Requirement: F yanks, Shift and the wheel reel
F SHALL yank every attached rope. Shift or one notch of the mouse wheel SHALL reel in. Three yanks on a clog SHALL flush it.

#### Scenario: Yank
- **WHEN** a rope is attached to a building and the player presses F
- **THEN** a yank event fires and the body gains speed toward the anchor

#### Scenario: Pump a clog
- **WHEN** a rope is attached to a clog and the player presses F three times, at least 0.35 s apart
- **THEN** the clog flushes

#### Scenario: Reel
- **WHEN** a rope is attached and the player holds Shift for 0.5 s
- **THEN** the rope is shorter, and a wheel notch shortens it for 0.15 s

### Requirement: Move and climb with W A S D or the arrows
W A S D and the arrow keys SHALL walk on the ground and steer in the air. On a wall, W and S SHALL climb up and down, and A and D SHALL move along the wall toward the view's left and right.

#### Scenario: Walk
- **WHEN** the player holds W on a roof
- **THEN** the hero walks the way the camera looks

#### Scenario: Climb
- **WHEN** the player holds a wall and holds W for 0.5 s, then D for 0.5 s
- **THEN** the player climbs 3 m and then moves 3 m to the right along the wall

### Requirement: V, Tab or M, and Esc
V SHALL switch the view. Tab or M SHALL open the map, and the same key SHALL close it. Esc SHALL pause.

#### Scenario: View
- **WHEN** the player presses V, and holds it so that the key repeats
- **THEN** the view switches once

#### Scenario: Map
- **WHEN** the player presses M
- **THEN** the map opens
- **WHEN** the player presses M again
- **THEN** the map closes and play goes on

### Requirement: Keys with a modifier do nothing
A key pressed with Ctrl, Meta or Alt held SHALL NOT swing, yank, jump, move, reel, switch the view or open the map.

#### Scenario: Browser shortcuts
- **WHEN** the player presses Ctrl+F or Cmd+W while a rope is attached
- **THEN** no yank event fires and the hero does not move

### Requirement: Flat play always holds the rope
The "Rope trigger: Toggle" setting of a headset save SHALL NOT change flat play. In flat play a rope lasts while its swing input is down.

#### Scenario: A headset save with Toggle
- **WHEN** the save has `hold: "toggle"` and a flat player presses and lets go of the left mouse button
- **THEN** the rope lets go when the button goes up

### Requirement: A real swing gets a hop and a kick
A rope that a real swing input fired (left or right mouse button, E, Q, RT, LT) SHALL get two assists. From the ground the body SHALL hop off and gain 5 m/s toward the target. On attach the body SHALL gain speed across the rope toward the view until that speed is 10 m/s. A clog, a pipe or the crack SHALL get neither assist. The kick SHALL NOT apply when the anchor is straight ahead or when the other rope is attached. A rope that a test hook fired SHALL get neither.

#### Scenario: Swing from the start roof
- **WHEN** a player on the roof holds the left mouse button
- **THEN** a `hop` event shows, and the body leaves the ground within 0.2 s
- **AND** a `kick` event shows when the rope attaches, unless the anchor is straight ahead

#### Scenario: Swing in the air
- **WHEN** a body falls at 5 m/s with a target ahead and the player holds the left mouse button
- **THEN** no `hop` event shows
- **AND** the speed across the rope toward the view is at least 10 m/s one frame after the attach, as the `attachKick` check in Node also shows

#### Scenario: Two ropes
- **WHEN** one rope is attached and the second rope attaches
- **THEN** no `kick` event shows for the second rope

#### Scenario: Plunge a clog
- **WHEN** the target is a clog on the same roof and the player holds the left mouse button
- **THEN** no `hop` event shows and the hero stays on the roof

#### Scenario: A test hook
- **WHEN** `G.test.press` fires a rope on the ground
- **THEN** no `hop` event and no `kick` event show

### Requirement: A hint strip for the first minute
For the first 60 s of play in a session that starts with an unfinished tutorial, a comic caption strip SHALL show at the bottom of the screen. For a mouse it SHALL read: HOLD LEFT MOUSE: SWING. W: STEER. F: YANK. SPACE: JUMP. For a pad it SHALL name RT, the left stick, RB and A. The strip SHALL be at most 36 px high. It SHALL NOT cover the subtitle, the toast or the score pills. It SHALL NOT show in a session with a finished tutorial, in the intro, when paused, or in a headset.

#### Scenario: First run
- **WHEN** a player starts play with an unfinished tutorial
- **THEN** the strip shows with the four mouse items
- **WHEN** 61 s of play time have passed
- **THEN** the strip is gone

#### Scenario: Returning player
- **WHEN** the tutorial is finished in the save
- **THEN** the strip does not show

#### Scenario: No overlap
- **WHEN** the strip and a subtitle show at 640 by 360, 960 by 540 or 1280 by 720
- **THEN** the boxes of the strip, the subtitle and the score pills do not overlap

#### Scenario: A pad player
- **WHEN** the player presses a pad button while the strip shows
- **THEN** the strip names RT, the left stick, RB and A

### Requirement: A first-time player crosses three buildings in 30 seconds
A player who uses only the swing input and W SHALL attach to three different buildings within 30 s of game time, with no respawn. The check SHALL use the bot described in `design.md`.

#### Scenario: The bot in Node
- **WHEN** the bot plays 30 s from seven start views (the start yaw plus -30 to +30 degrees in steps of 10) with `physics.js`, `city.js` and `target.js`
- **THEN** the start views of 0, +10 and -10 degrees pass, and at least 6 of 7 pass

#### Scenario: The bot in the browser
- **WHEN** the bot plays 30 s with real mouse and key events from the start views of -10, 0 and +10 degrees
- **THEN** all three pass

### Requirement: The tutorial speaks of the mouse
The tutorial and the clog lines for a mouse SHALL name the left mouse button, Shift and F, and SHALL tell the player to look at the target. The lines SHALL NOT name a pad button.

#### Scenario: First tutorial line
- **WHEN** the tutorial starts with a mouse
- **THEN** the first line reads "Look at the gold ring. Hold the left mouse button."

#### Scenario: Clog line
- **WHEN** the player first sees a clog with a mouse
- **THEN** the line reads "That's a clog. Look at it and swing."
