## ADDED Requirements

### Requirement: Swing with the left mouse button or E
In flat play with a mouse and keyboard, holding the left mouse button or E SHALL fire one rope at the auto target and keep it. Letting go of the button or the key SHALL let go of that rope, once the cup has landed. A press shorter than the flight of the cup SHALL still land the cup and attach the rope, and the rope SHALL let go on the first frame after the attach. The hand SHALL be chosen as the auto target spec says.

#### Scenario: Hold the left mouse button
- **WHEN** a player holds the left mouse button with a target in view
- **THEN** a rope attaches to the target within 0.6 s and stays while the button is down
- **WHEN** the player lets go of the button
- **THEN** the rope lets go and the body keeps its speed

#### Scenario: Hold E
- **WHEN** a player holds E with a target in view
- **THEN** the same rope fires and stays while E is down

#### Scenario: A quick click
- **WHEN** a player clicks the left mouse button for 80 ms with a target 40 m away
- **THEN** the cup lands and the rope attaches
- **AND** the rope lets go on the first frame after the attach

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
F SHALL yank every attached rope. Shift or one notch of the mouse wheel SHALL reel in. A wheel event with Ctrl or Meta held SHALL do nothing. A stream of wheel events SHALL reel at most 0.3 s in any 0.5 s. Three yanks on a clog SHALL flush it.

#### Scenario: Yank
- **WHEN** a rope is attached to a building and the player presses F
- **THEN** a yank event fires and the body gains speed toward the anchor

#### Scenario: Pump a clog
- **WHEN** a rope is attached to a clog and the player presses F three times, at least 0.35 s apart
- **THEN** the clog flushes

#### Scenario: Reel
- **WHEN** a rope is attached and the player holds Shift for 0.5 s
- **THEN** the rope is shorter, and a wheel notch shortens it for 0.15 s

#### Scenario: Pinch and scroll
- **WHEN** a rope is attached and the player sends a wheel event with Ctrl held, then 60 wheel events in 1 s
- **THEN** the Ctrl event reels nothing
- **AND** the stream reels the rope for at most 0.6 s in total

### Requirement: Move and climb with W A S D or the arrows
W A S D and the arrow keys SHALL walk on the ground and steer in the air. On a wall, W and S SHALL climb up and down, and A and D SHALL move along the wall toward the view's left and right.

#### Scenario: Walk
- **WHEN** the player holds W on a roof
- **THEN** the hero walks the way the camera looks

#### Scenario: Climb
- **WHEN** the player holds a wall and holds W for 0.5 s, then D for 0.5 s
- **THEN** the player climbs 3 m and then moves 3 m to the right along the wall

### Requirement: V, Tab and Esc
V SHALL switch the view. Tab SHALL open the map, and Tab SHALL close it. M SHALL stay the mute key of `full-swing-rings-map-sound`. Esc SHALL pause, and SHALL close the pause or the map. Tab SHALL ask for the pointer lock again when it closes the map. Esc SHALL NOT, because a browser may refuse a lock request after Esc until the next click. While the game is paused, or while a dialog has focus, Tab, Space and the arrow keys SHALL keep their page meaning.

#### Scenario: View
- **WHEN** the player presses V, and holds it so that the key repeats
- **THEN** the view switches once

#### Scenario: Map
- **WHEN** the player presses Tab
- **THEN** the map opens
- **WHEN** the player presses Tab again
- **THEN** the map closes and play goes on, and the pointer is locked
- **WHEN** the player presses M during play
- **THEN** the sound turns off, and the map does not open

#### Scenario: Tab twice
- **WHEN** the player presses Tab twice
- **THEN** `G.desktop.locked` is true after the second press, and the mouse still turns the view

#### Scenario: Keys in a pause
- **WHEN** the game is paused and the player presses Tab, Space and the down arrow
- **THEN** the browser moves the focus and presses the focused menu button as it does on any page

### Requirement: Keys with a modifier do nothing
A key pressed with Ctrl, Meta or Alt held SHALL NOT swing, yank, jump, move, reel, switch the view or open the map.

#### Scenario: Browser shortcuts
- **WHEN** the player presses Ctrl+F or Cmd+W while a rope is attached
- **THEN** no yank event fires and the hero does not move

### Requirement: The Rope trigger setting works in flat play
The "Rope trigger" setting SHALL work in flat play on a computer and a pad. With "Hold", a rope lasts while its swing input is down. With "Toggle", a press fires the rope and the next press of that input lets go. E, Q and the triggers SHALL follow the setting. The flat Comfort menu SHALL show the row for a mouse and a pad. The phone SHALL ignore the setting, so its Comfort page SHALL show neither the Rope trigger row nor the Release cue row.

#### Scenario: Toggle
- **WHEN** the setting is Toggle and a flat player presses and lets go of the left mouse button
- **THEN** the rope stays
- **WHEN** the player presses the left mouse button again
- **THEN** the rope lets go

#### Scenario: Hold
- **WHEN** the setting is Hold and a flat player presses and lets go of the left mouse button
- **THEN** the rope lets go when the button goes up

#### Scenario: The menu shows the row
- **WHEN** a mouse or pad player opens Comfort in flat play
- **THEN** the page shows the Rope trigger row and the Release cue row

#### Scenario: A phone has no such rows
- **WHEN** a phone player opens Comfort
- **THEN** the page shows Aim assist and no Rope trigger row and no Release cue row

### Requirement: A click that resumes or locks starts no swing
A click that resumes play from a pause, and a click that asks for the pointer lock, SHALL start no swing and SHALL fire no rope. The next press SHALL work. A mouse button that is already down when the lock starts SHALL do nothing until it goes up.

#### Scenario: Resume with a click
- **WHEN** the game is paused and the player clicks the city to resume
- **THEN** play goes on, both ropes are idle, the hero is on the roof, and the pointer is locked
- **WHEN** the player then presses the left mouse button
- **THEN** a rope fires

#### Scenario: Lost lock
- **WHEN** the pointer lock is lost and the player clicks the city
- **THEN** the lock returns and no rope fires

### Requirement: A real swing gets a kick, and a hop only when tuned
A rope that a real swing input fired (left or right mouse button, E, Q, RT, LT) SHALL get a kick on attach. The body SHALL gain speed across the rope toward the view until that speed is `DESKTOP.attachSpeed`, which starts at 10 m/s. The kick SHALL NOT apply when the anchor is straight ahead, when the other rope is attached, or on a clog, a pipe or the crack. From the ground the body SHALL hop toward the target at `DESKTOP.hop` m/s, which starts at 0. A clog, a pipe or the crack SHALL never get a hop. A rope that a test hook fired SHALL get neither.

#### Scenario: Swing from the start roof
- **WHEN** a player on the start roof holds W and the left mouse button
- **THEN** no `hop` event shows, a rope attaches, and the hero is in the air within 4 s (measured: 3.1 to 3.3 s)
- **AND** a `kick` event shows when the rope attaches, unless the anchor is straight ahead
- **AND** while the rope drags the hero along the roof the LET GO caption shows, and the first frame in the air gives none

#### Scenario: Swing from the start roof with the button alone
- **WHEN** a player on the start roof holds the left mouse button and does not hold W
- **THEN** the rope attaches and the kick slides the hero across the roof, and friction stops the hero on it (measured: still on the roof after 6 s)
- **AND** this is why the first tutorial line and the hint strip tell the player to hold W with the button

#### Scenario: Swing in the air
- **WHEN** a body falls at 5 m/s with a target ahead and the player holds the left mouse button
- **THEN** the speed across the rope toward the view is at least 10 m/s one frame after the attach, as the `kick` check in Node also shows

#### Scenario: Two ropes
- **WHEN** one rope is attached and the second rope attaches
- **THEN** no `kick` event shows for the second rope

#### Scenario: A delayed attach
- **WHEN** the player presses the left mouse button, and the cup attaches 0.2 s later
- **THEN** the `kick` event shows at the attach, because the press was real

#### Scenario: Plunge a clog
- **WHEN** the target is a clog on the same roof and the player holds the left mouse button
- **THEN** no `hop` event and no `kick` event show

#### Scenario: A test hook
- **WHEN** `G.test.press` fires a rope on the ground
- **THEN** no `hop` event and no `kick` event show

### Requirement: A hint strip for the first minute
For the first 60 s of play in a session that starts with an unfinished tutorial, a comic caption strip SHALL show at the bottom of the screen, for a mouse or a pad. For a mouse it SHALL read: HOLD W AND LEFT MOUSE (OR E): SWING. LET GO WHEN THE RING SAYS GO. MOUSE: LOOK. For a pad it SHALL read: HOLD LEFT STICK UP AND RIGHT TRIGGER: SWING. LET GO WHEN THE RING SAYS GO. RIGHT STICK: LOOK. The text SHALL fit inside the strip. The strip SHALL be at most 36 px high. While it shows, the spoken line SHALL move up so that its box and its tail clear the strip. The strip SHALL NOT cover the toast or the score pills. It SHALL NOT show in a session with a finished tutorial, in the opening, when paused, on a touch device, or in a headset.

#### Scenario: First run
- **WHEN** a player starts play with an unfinished tutorial and a mouse
- **THEN** the strip shows with the three mouse items
- **WHEN** 61 s of play time have passed
- **THEN** the strip is gone

#### Scenario: Returning player
- **WHEN** the tutorial is finished in the save
- **THEN** the strip does not show

#### Scenario: No overlap
- **WHEN** the strip and a spoken line show at 640 by 360, 960 by 540 or 1280 by 720
- **THEN** the strip does not overlap the spoken line, its tail, the toast or the score pills

#### Scenario: A pad player
- **WHEN** the player presses a pad button while the strip shows
- **THEN** the strip names the right trigger, the right stick and the left stick

#### Scenario: A phone
- **WHEN** a phone player starts play with an unfinished tutorial
- **THEN** `#keyHints` is not visible at 390 by 844 or 844 by 390

### Requirement: A touch device with a fine pointer chooses its scheme
A device that reports touch points and has a fine pointer SHALL show two buttons on the title: PLAY WITH TOUCH and PLAY WITH MOUSE AND KEYBOARD. PLAY WITH MOUSE AND KEYBOARD SHALL start the mouse and pad scheme for the session: the pointer lock, the mouse buttons and the pad work, and the phone panel stays hidden. A device with touch points and no fine pointer SHALL show PLAY WITH TOUCH only. A device with no touch point SHALL show PLAY ON THIS SCREEN.

#### Scenario: A touch laptop
- **WHEN** the title loads with `maxTouchPoints` of 5 and a fine pointer
- **THEN** both buttons show
- **WHEN** the player presses PLAY WITH MOUSE AND KEYBOARD
- **THEN** `G.test.input().kind` is "mouse", the phone panel is hidden, and a fake pad press moves the kind to "pad"

#### Scenario: A touch laptop, touch chosen
- **WHEN** the same title loads and the player presses PLAY WITH TOUCH
- **THEN** the phone panel shows and the kind is "touch"

#### Scenario: Mouse chosen, then touch
- **WHEN** a player pressed PLAY WITH MOUSE AND KEYBOARD, leaves to the title with Exit, and presses PLAY WITH TOUCH
- **THEN** `G.test.input().kind` is "touch", the phone panel shows and `body[data-device]` is "touch"

#### Scenario: A computer
- **WHEN** the title loads on a device with no touch point
- **THEN** the play button reads PLAY ON THIS SCREEN and the desktop note shows

### Requirement: A first-time player crosses three buildings in 30 seconds
A player who uses only the swing input and W SHALL attach to three different buildings within 30 s of game time, with no respawn. The check SHALL use the two bots described in `design.md`. They use the physics of flat play (rope and wall climbing) and a camera model. Their release is jittered by 25 degrees and delayed by 0.2 to 0.4 s. They play from many starts.

#### Scenario: The bots in Node
- **WHEN** each bot plays 30 s from the start roof at headings of -10, 0 and +10 degrees (6 seeds each) with `physics.js`, `city.js` and `target.js`
- **THEN** at least 17 of the 18 runs pass for each bot
- **WHEN** each bot plays from the 25 safe roofs with 6 random headings each
- **THEN** at least 120 of the 150 runs pass for each bot, and the median time of the passing runs is 15 s or less

#### Scenario: The bot in the browser
- **WHEN** the bot plays 30 s with real mouse and key events from the start views of -10, 0 and +10 degrees
- **THEN** all three pass

### Requirement: The tutorial speaks of the mouse
The tutorial and the clog lines for a mouse SHALL name W, the left mouse button, Shift and F. They SHALL tell the player to look at the target and to let go when the ring says GO. The lines SHALL NOT name a pad button.

#### Scenario: First tutorial line
- **WHEN** the tutorial starts with a mouse
- **THEN** the first line reads "Look at the gold ring. Hold W and the left mouse button."

#### Scenario: Release line
- **WHEN** the tutorial reaches step 1 with a mouse
- **THEN** the line reads "Swing out. Let go when the ring says GO."

#### Scenario: Clog line
- **WHEN** the player first sees a clog with a mouse
- **THEN** the line reads "That's a clog. Look at it and swing."
