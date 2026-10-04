## ADDED Requirements

### Requirement: SWING and a tap use the auto target, and a ring marks it
On a phone, the SWING button SHALL fire the right rope at the auto target. A tap on a building SHALL fire at that exact building, as the one-tap scheme of `swing-phone-play` says. While a target exists, a lock-on ring 56 px across SHALL sit on it. While no target exists, the SWING button SHALL be dimmed but SHALL still work. With a rope idle, the hand rays SHALL point at the target on every frame, so the ring and the reticle stay on it. The one-tap behaviour (the rope lets go by itself, the speed kick, the plunge of a clog) SHALL NOT change.

#### Scenario: Press SWING at the start
- **WHEN** a phone player presses SWING on the start roof in the chase view
- **THEN** the rope attaches to a building at least 5 m above the roof, the hero leaves the roof, and 0.6 s later the hero moves at more than 10 m/s

#### Scenario: The ring on the target
- **WHEN** a target exists inside the safe window
- **THEN** the ring is 56 px across, and its centre is within 3 px of the projected target

#### Scenario: The aim before any press
- **WHEN** a phone player stands on the start roof and has pressed nothing
- **THEN** the aim of the right hand is valid, and it is not the roof under the hero

#### Scenario: A clog
- **WHEN** the target is a clog
- **THEN** the ring is sludge green with points
- **AND** a tap on the clog plunges it with no yank

#### Scenario: A clog on a lower roof
- **WHEN** a clog sits on a lower roof 30 degrees below the camera forward and the player taps the pixel of the clog
- **THEN** the rope attaches to the clog and the clog takes three pumps

#### Scenario: No target
- **WHEN** no target exists
- **THEN** the ring is hidden and the SWING button has the class `no-target`
- **WHEN** the player presses SWING
- **THEN** the hero stays on the roof and the button shows SWING

#### Scenario: The only building holds the rope
- **WHEN** a rope holds the only building in reach and the player taps the sky
- **THEN** the rope stays attached, it is not fired again, and the hint says the rope is kept

### Requirement: The ring and the arrow stay clear of the HUD
The ring and the arrow SHALL stay inside a safe window. The window SHALL start below the top buttons and the score pills. It SHALL end above the SWING panel and the spoken line. It SHALL keep 8 px from the safe-area insets and exclude the climb pad while it shows. When the projected centre of the target lies outside the window, the marker SHALL become an arrow on the border of the window, pointing at the target. A target behind the camera SHALL show an arrow on the bottom border, pointing down. The window SHALL be at least 55 percent of the screen height at 390 by 844 and 45 percent at 844 by 390.

#### Scenario: A target above the screen
- **WHEN** the target lies above the top edge of the screen at 390 by 844 or 844 by 390
- **THEN** an arrow shows on the top border of the safe window at the target's side
- **AND** the arrow overlaps no top button, no score pill, no spoken line, no SWING panel and no climb pad

#### Scenario: Every height
- **WHEN** a test sets a target at screen heights from NDC 0.3 to 1.5 in steps of 0.1, at both sizes, with a spoken line showing
- **THEN** the ring or the arrow never overlaps a top button, a score pill, the spoken line, the SWING panel or the climb pad

#### Scenario: On a wall
- **WHEN** the player holds a wall at 390 by 844
- **THEN** the climb pad shows on the left, and the ring or the arrow keeps clear of it

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

### Requirement: The phone shows a catch, with or without vibration
Where `navigator.vibrate` exists, the phone SHALL vibrate for 15 ms on attach, 25 ms on a yank and 40 ms on a pump. It SHALL vibrate at most once every 40 ms and SHALL NOT vibrate while the page is hidden. On every device the ring SHALL pop for 120 ms on attach, yank and pump. A phone with no `vibrate`, such as an iPhone, SHALL cause no error and SHALL still show the pop.

#### Scenario: Attach
- **WHEN** a rope attaches on a phone
- **THEN** `navigator.vibrate` is called once with 15, and the ring pops

#### Scenario: Pump a clog
- **WHEN** a rope pumps a clog by itself
- **THEN** `navigator.vibrate` is called with 40

#### Scenario: No vibration support
- **WHEN** `navigator.vibrate` is missing and a rope attaches
- **THEN** no error shows and the ring pops

#### Scenario: The disabled stub
- **WHEN** the page loads on a computer with no touch point and a rope attaches
- **THEN** no error shows in the console, because the stub has `marker`, `pop` and `buzz`

### Requirement: Buttons are big enough for a thumb and match the comic style
Every touch area of a visible phone button SHALL be at least 48 by 48 CSS px. The top-row buttons SHALL have boxes 46 px high with a hit area of at least 48 px: a touch 1 px outside any side of such a box SHALL still hit the button. Every other button box SHALL be 48 by 48 px or larger. The buttons SHALL use the comic caption style of the HUD: a thick ink border, a hard shadow and Bangers lettering. They SHALL keep clear of the safe areas. The page SHALL NOT scroll sideways. The top row SHALL hold up to four buttons (MOTION, CENTER, VIEW and PAUSE), SHALL NOT wrap and SHALL NOT overflow. Motion aim is on from PLAY on Android and after Allow on iOS, so the row SHALL fit four buttons. The top buttons SHALL NOT cover the score pills, and the spoken line SHALL NOT cover the SWING panel. The tail of the spoken line hangs 27 px under its box, so the tail SHALL NOT cover the SWING panel either, and each line the hint over SWING can say SHALL fit on one line of a 360 px phone.

#### Scenario: Portrait with motion aim on
- **WHEN** the phone is 390 by 844, the sensors are granted so that all four top buttons show, and a spoken line shows
- **THEN** every visible button has a touch area of 48 by 48 px or more
- **AND** the top buttons are 46 px high, a touch 1 px outside any side of one still hits it, and every other button box is 48 by 48 px or more
- **AND** the top row is one line, inside the viewport
- **AND** the top buttons do not overlap the score pills, the line and its tail do not overlap the SWING panel, and the page does not scroll sideways

#### Scenario: Portrait with motion aim off
- **WHEN** the phone is 390 by 844 and the sensors are denied, so that three buttons show
- **THEN** the same checks hold

#### Scenario: The narrowest phone
- **WHEN** the phone is 360 by 740 with all four top buttons
- **THEN** the top row is one line, inside the viewport
- **AND** with a spoken line showing, each line the hint over SWING can say, except the wall line, fits on one line, and the tail of the spoken line clears the SWING panel

#### Scenario: Landscape
- **WHEN** the phone is 844 by 390 and shows a spoken line
- **THEN** the same checks hold

### Requirement: Both orientations play, with no turn card
The phone SHALL play in portrait and in landscape. The game SHALL NOT show a card that asks the player to turn the phone.

#### Scenario: Portrait start
- **WHEN** a player starts play at 390 by 844
- **THEN** the chase view shows and SWING works

#### Scenario: Turn during play
- **WHEN** the viewport changes from 390 by 844 to 844 by 390 during play
- **THEN** play goes on, the camera aspect updates, and no card shows

### Requirement: Phone words and help
The phone SHALL show phone words and never mouse, key, trigger, pinch or grip words. The tutorial's first line SHALL read "Tap SWING to swing at the gold ring." The title SHALL read PLAY WITH TOUCH on a touch device. A touch device with a fine pointer SHALL show PLAY WITH MOUSE AND KEYBOARD as a second button. A device with no touch point SHALL read PLAY ON THIS SCREEN. How to play SHALL have sections for headset controllers, hands, keyboard and mouse, a game pad, and the phone. The section for the device in use SHALL come first. The title SHALL show one note for the device in use.

#### Scenario: Tutorial on a phone
- **WHEN** the tutorial starts on a phone
- **THEN** the first line is "Tap SWING to swing at the gold ring."
- **AND** no phone line names a mouse, Shift, a key, a trigger, a pinch or a grip

#### Scenario: Title on a touch device
- **WHEN** the title shows on a touch device with no fine pointer
- **THEN** the play button reads PLAY WITH TOUCH and the touch note shows

#### Scenario: Title on a computer
- **WHEN** the title shows on a computer with no touch point
- **THEN** the play button reads PLAY ON THIS SCREEN and the desktop note names the left mouse button, W and the game pad

#### Scenario: How to play
- **WHEN** the player opens How to play
- **THEN** the dialog has sections for headset controllers, hands, keyboard and mouse, game pad and phone
- **AND** the keyboard section names Shift, F, Space, E, Q, V, Tab and M, and the dialog still contains the words "pinch" and "Shift"
- **AND** the section titled "Headset controllers" holds the old controller text, and the keyboard section no longer says "A game pad works too"

#### Scenario: The device in use first
- **WHEN** the player opens How to play at 390 by 844 on a touch device
- **THEN** the first heading in the dialog is the phone section
- **WHEN** a pad is the device in use on a computer
- **THEN** the first heading is the game pad section

### Requirement: Motion aim stays optional
The phone SHALL play with touch only. Motion aim SHALL stay optional. The Center button SHALL show only while motion aim is on.

#### Scenario: Touch only
- **WHEN** the sensors are denied
- **THEN** play works with taps and drags, and the Center button is hidden

#### Scenario: Motion aim on
- **WHEN** the player turns motion aim on, or the browser grants the sensors at PLAY
- **THEN** the Center button shows, and it sets the aim straight again

### Requirement: A first-time phone player crosses three buildings in 30 seconds
A phone player who only taps (the SWING button and taps on the city) SHALL attach to three different buildings within 30 s of game time, with no respawn.

#### Scenario: Taps only
- **WHEN** a bot taps every 10 frames while the rope is idle, for 30 s from the start roof facing the gold ring at -10, 0 and +10 degrees
- **THEN** it attaches to three different buildings (by the `bid` of the collider) and the hero never respawns, in all three runs
