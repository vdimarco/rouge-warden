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

### Requirement: No SWING button
The phone panel SHALL have no SWING button and no plunger badges. A faint move stick, which takes no taps, SHALL show at the bottom
left, marked MOVE (CLIMB on a wall). On a wall the panel SHALL show only a JUMP button, on the right, and the left thumb SHALL climb.
In a car the panel SHALL show no drive buttons. The lock-on ring SHALL keep clear of the JUMP button.

#### Scenario: On a wall
- **WHEN** the hero holds a wall on a phone
- **THEN** a JUMP button shows on the right, no climb arrows show, and the left thumb pushed up climbs 3 m in 0.5 s

### Requirement: The words say left and right
The touch note, How to play, the gesture card, the phone tutorial and the phone hint SHALL say that the left thumb moves and the
right thumb swings, and SHALL NOT name a SWING button. The resting phone hint SHALL say "Left thumb moves. Right thumb swings."

#### Scenario: The first tutorial line
- **WHEN** a phone player starts play
- **THEN** the first tutorial line is "Tap right to swing at the gold ring."

#### Scenario: The gesture card
- **WHEN** a player starts phone play on a new save
- **THEN** the card shows LEFT "Drag to walk, climb and drive." and RIGHT "Tap to swing. Hold to keep the rope. Drag to look."
