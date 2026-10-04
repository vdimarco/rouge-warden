## ADDED Requirements

### Requirement: SWING and a tap use the auto target, and a ring marks it
On a phone, the SWING button SHALL fire the right rope at the auto target. A tap on a building SHALL fire at that exact building, as the one-tap scheme of `swing-phone-play` says. While a target exists, a lock-on ring 56 px across SHALL sit on it. While no target exists, the SWING button SHALL be dimmed but SHALL still work. The one-tap behaviour (the rope lets go by itself, the speed kick, the plunge of a clog) SHALL NOT change.

#### Scenario: Press SWING at the start
- **WHEN** a phone player presses SWING on the start roof in the chase view
- **THEN** the rope attaches to a building at least 5 m above the roof, the hero leaves the roof, and 0.6 s later the hero moves at more than 10 m/s

#### Scenario: The ring on the target
- **WHEN** a target exists inside the screen
- **THEN** the ring is 56 px across, and its centre is within 3 px of the projected target

#### Scenario: A ring that is above the screen
- **WHEN** the target lies above the top edge of the screen
- **THEN** an arrow shows on the top edge at the target's horizontal position
- **AND** the arrow does not overlap a top button or the SWING panel, at 390 by 844 and at 844 by 390

#### Scenario: A clog
- **WHEN** the target is a clog
- **THEN** the ring is sludge green with points
- **AND** a tap on the clog plunges it with no yank

#### Scenario: No target
- **WHEN** no target exists
- **THEN** the ring is hidden and the SWING button has the class `no-target`
- **WHEN** the player presses SWING
- **THEN** the hero stays on the roof and the button shows SWING

### Requirement: A VIEW button switches the view
The phone SHALL show a VIEW button in its top row. One press SHALL switch between third and first person, once. The centre ring SHALL show only in first person.

#### Scenario: Press VIEW
- **WHEN** the player presses VIEW in the chase view
- **THEN** the camera moves to the hero's eyes in about 0.5 s and the hero hides
- **WHEN** the player presses VIEW again
- **THEN** the chase view returns

#### Scenario: One press, one switch
- **WHEN** the player presses VIEW and a pad Y press or the V key falls in the same frame
- **THEN** the view switches once

#### Scenario: The centre ring
- **WHEN** the view is third person
- **THEN** the centre ring is hidden
- **WHEN** the view is first person
- **THEN** the centre ring shows

### Requirement: The phone vibrates on a rope event
Where `navigator.vibrate` exists, the phone SHALL vibrate for 15 ms on attach, 25 ms on a yank and 40 ms on a pump. It SHALL vibrate at most once every 40 ms and SHALL NOT vibrate while the page is hidden. A phone with no `vibrate` SHALL cause no error.

#### Scenario: Attach
- **WHEN** a rope attaches on a phone
- **THEN** `navigator.vibrate` is called once with 15

#### Scenario: Pump a clog
- **WHEN** a rope pumps a clog by itself
- **THEN** `navigator.vibrate` is called with 40

#### Scenario: No vibration support
- **WHEN** `navigator.vibrate` is missing and a rope attaches
- **THEN** no error shows

### Requirement: Buttons are big enough for a thumb and match the comic style
Every visible phone button SHALL be at least 48 by 48 CSS px. The buttons SHALL use the comic caption style of the HUD: a thick ink border, a hard shadow and Bangers lettering. They SHALL keep clear of the safe areas. The page SHALL NOT scroll sideways. The top buttons SHALL NOT cover the score pills, and the spoken line SHALL NOT cover the SWING panel.

#### Scenario: Portrait
- **WHEN** the phone is 390 by 844 and shows a spoken line
- **THEN** every visible button is 48 by 48 px or larger
- **AND** the top buttons do not overlap the score pills, the line does not overlap the SWING panel, and the page does not scroll sideways

#### Scenario: Landscape
- **WHEN** the phone is 844 by 390 and shows a spoken line
- **THEN** the same checks hold

#### Scenario: On a wall
- **WHEN** the player holds a wall at 390 by 844
- **THEN** the climb pad shows on the left, clear of the SWING panel and the ring arrow

### Requirement: Both orientations play, with no turn card
The phone SHALL play in portrait and in landscape. The game SHALL NOT show a card that asks the player to turn the phone.

#### Scenario: Portrait start
- **WHEN** a player starts play at 390 by 844
- **THEN** the chase view shows and SWING works

#### Scenario: Turn during play
- **WHEN** the viewport changes from 390 by 844 to 844 by 390 during play
- **THEN** play goes on, the camera aspect updates, and no card shows

### Requirement: Phone words and help
The phone SHALL show phone words and never mouse, key, trigger, pinch or grip words. The tutorial's first line SHALL read "Tap SWING to swing at the gold ring." The title SHALL read PLAY WITH TOUCH on a touch device and PLAY ON THIS SCREEN otherwise. How to play SHALL have a section for the keyboard and mouse, a section for a game pad and a section for the phone, each with its own controls. The title SHALL show a note for the device in use.

#### Scenario: Tutorial on a phone
- **WHEN** the tutorial starts on a phone
- **THEN** the first line is "Tap SWING to swing at the gold ring."
- **AND** no phone line names a mouse, Shift, a key, a trigger, a pinch or a grip

#### Scenario: Title on a touch device
- **WHEN** the title shows on a touch device
- **THEN** the play button reads PLAY WITH TOUCH and the touch note shows

#### Scenario: Title on a computer
- **WHEN** the title shows on a computer with no touch point
- **THEN** the play button reads PLAY ON THIS SCREEN and the note names the left mouse button and W

#### Scenario: How to play
- **WHEN** the player opens How to play
- **THEN** the dialog has sections for controllers, hands, keyboard and mouse, game pad and phone
- **AND** the keyboard section names Shift, F, Space, E, Q, V, Tab and M, and the dialog still contains the words "pinch" and "Shift"

### Requirement: Motion aim stays optional
The phone SHALL play with touch only. Motion aim SHALL stay optional. The Center button SHALL show only while motion aim is on.

#### Scenario: Touch only
- **WHEN** the sensors are denied
- **THEN** play works with taps and drags, and the Center button is hidden

#### Scenario: Motion aim on
- **WHEN** the player turns motion aim on
- **THEN** the Center button shows, and it sets the aim straight again

### Requirement: A first-time phone player crosses three buildings in 30 seconds
A phone player who only taps (the SWING button and taps on the city) SHALL attach to three different buildings within 30 s of game time, with no respawn.

#### Scenario: Taps only
- **WHEN** a bot taps every 10 frames while the rope is idle, for 30 s from the start roof
- **THEN** it attaches to three different buildings (by the `bid` of the collider) and the hero never respawns
