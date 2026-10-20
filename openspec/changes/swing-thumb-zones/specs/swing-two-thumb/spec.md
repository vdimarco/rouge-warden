## MODIFIED Requirements

### Requirement: Each half of the screen throws its own plunger
On a phone in play, the left half of the city SHALL move the hero and SHALL throw no plunger. The right half SHALL throw the
plungers. A finger that lands on the left half SHALL put a move stick under it. A drag of 46 px or more SHALL be a full push, and a
push past 90 percent SHALL run. The stick SHALL walk on the ground, steer in the air, climb a wall and drive a car. A tap or hold on
the right half SHALL throw the free plunger (the other one while the plunger thrown last still holds), aimed through the tapped
point. Each right finger SHALL count on its own, so two right fingers down together SHALL throw both plungers. Before play (the
opening), a tap on either half SHALL throw.

#### Scenario: The left thumb walks
- **WHEN** a phone player puts a thumb on the left half of the city and drags it 30 px up
- **THEN** a stick shows under the thumb, the hero walks, and no plunger flies

#### Scenario: The left thumb runs and stops
- **WHEN** the player drags the left thumb to the edge of the stick, then lifts it
- **THEN** the hero runs, and stops when the thumb lifts

#### Scenario: The left thumb drives
- **WHEN** the player is in a car and drags the left thumb 60 px up
- **THEN** the car drives forward at more than 4 m/s

#### Scenario: Taps on the right chain
- **WHEN** the player taps the right half, and taps it again while the first rope holds
- **THEN** the first tap throws one plunger, and the second tap throws the other

#### Scenario: Two right fingers
- **WHEN** two fingers go down on the right half at the same time and lift
- **THEN** both plungers fly in the same frame

#### Scenario: Left and right
- **WHEN** a phone player in play taps a building on the left half of the screen, then taps a building on the right half
- **THEN** the left tap throws no plunger, and the right tap throws one plunger to its building

#### Scenario: Two thumbs
- **WHEN** the player drags the left thumb up and taps the right half with the right thumb at the same time
- **THEN** the hero walks and one plunger flies in that frame

#### Scenario: A drag beside a tap
- **WHEN** one finger drags on the right half to look while another finger taps the right half
- **THEN** the view turns and only one plunger flies

### Requirement: Two thumbs work on a real phone
The city SHALL start no pinch, zoom or other browser gesture. A finger that the browser cancels within 0.5 s, before it moved
12 px, SHALL throw its plunger as a tap. A finger that rocks less than 12 px while the other finger lands SHALL still tap and SHALL
not turn the view. A finger lifted anywhere on the page SHALL end its tap.

#### Scenario: The browser cancels the first thumb
- **WHEN** the player puts two fingers down on the right half, one after the other, and the browser cancels the first touch
- **THEN** both plungers fly

#### Scenario: Two thumbs pressed a moment apart
- **WHEN** one finger goes down on the right half, a second finger goes down there 30 ms later, and they lift 40 ms apart
- **THEN** both plungers fly and both hold their buildings

#### Scenario: A thumb that rocks
- **WHEN** a finger on the right half moves 3 to 6 px while a second finger lands there, and both lift
- **THEN** both plungers fly and the view does not turn

### Requirement: The swing hands over from one plunger to the other
When a phone plunger catches a building while the other plunger holds a building, the other plunger SHALL let go 0.12 s later with
no fling. Two plungers thrown within 0.3 s of each other SHALL hold together. Each plunger SHALL let go by itself past the bottom of
its arc; while the other one still holds, that let-go SHALL add no fling.

#### Scenario: A hand-off
- **WHEN** one plunger holds a building and the player taps a building on the right half more than 0.3 s later
- **THEN** the other plunger catches, and the first plunger lets go within 0.2 s of that catch

#### Scenario: A double swing
- **WHEN** the player puts two fingers on the right half together
- **THEN** both plungers hold their buildings at the same time

#### Scenario: A steady beat on alternate sides
- **WHEN** a player taps the right half every 0.5, 0.8 or 1.2 s from the start roof toward the gold ring, so that the plungers take turns
- **THEN** over 12 s the mean speed is at least 17 m/s, the hero covers at least 120 m, and spends at most 2.5 s under 8 m

### Requirement: No SWING button
The phone panel SHALL have no SWING button and no plunger badges. A faint move stick, which takes no taps, SHALL show at the bottom
left, marked MOVE (CLIMB on a wall). On a wall the panel SHALL show only a JUMP button, on the right, and the left thumb SHALL climb.
In a car the panel SHALL show no drive buttons. The lock-on ring SHALL keep clear of the JUMP button.

#### Scenario: On a wall
- **WHEN** the hero holds a wall on a phone
- **THEN** a JUMP button shows on the right, no climb arrows show, and the left thumb pushed up climbs 3 m in 0.5 s

#### Scenario: A badge lights
- **WHEN** the left plunger holds a building on a phone
- **THEN** no L or R badge shows and no SWING button shows

### Requirement: The words say left and right
The touch note, How to play, the gesture card, the phone tutorial and the phone hint SHALL say that the left thumb moves and the
right thumb swings, and SHALL NOT name a SWING button. The resting phone hint SHALL say "Left thumb moves. Right thumb swings."

#### Scenario: The first tutorial line
- **WHEN** a phone player starts play
- **THEN** the first tutorial line is "Tap right to swing at the gold ring."

#### Scenario: The gesture card
- **WHEN** a player starts phone play on a new save
- **THEN** the card shows LEFT "Drag to walk, climb and drive." and RIGHT "Tap to swing. Hold to keep the rope. Drag to look."
