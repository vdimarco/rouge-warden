## ADDED Requirements

### Requirement: Tap, hold and drag on a phone
On a phone, each finger on the city SHALL do one of three things, and SHALL show which one at once:
- A finger that lifts within 12 px of where it went down SHALL be a tap. It SHALL throw its side's plunger, and that rope SHALL let go by itself, as before.
- A finger that stays within 12 px for 0.12 s SHALL throw its side's plunger while it is still down. The rope SHALL then not let go by itself while the finger stays down: not past the bottom of the arc, not while it hangs still, and not by a hand-over. A finger lifted 0.35 s or more after it went down SHALL let go of the rope, with the fling of the arc's let-go when the hero is in the air. A holding finger that moves SHALL turn the view and SHALL keep the rope.
- A finger that moves more than 12 px within 0.12 s SHALL look around and SHALL throw nothing, however long it stays down.

The rope of a held finger SHALL still let go after the hero has spent the roof time on a roof. A finger that the browser cancels SHALL leave its rope to let go by itself.

#### Scenario: A tap
- **WHEN** a phone player taps a building on the right half of the screen while falling past the start roof
- **THEN** the right plunger catches, and the rope later lets go by itself with a fling

#### Scenario: A hold keeps the rope
- **WHEN** a phone player holds a finger still on the right half of the screen for 0.2 s while falling past the start roof
- **THEN** the right plunger flies before the finger lifts, and after 3.7 s of swinging with the finger still down the rope still holds

#### Scenario: The lift lets go
- **WHEN** the player lifts a finger that has held its rope for more than 0.35 s, in the air
- **THEN** the rope lets go in that frame and the hero is flung on

#### Scenario: A drag looks
- **WHEN** a finger moves 25 px within 0.12 s and then stays down for 0.4 s
- **THEN** the view turns and no plunger flies

#### Scenario: Two held thumbs
- **WHEN** both thumbs go down together, stay still, and then the left one lifts after 0.4 s
- **THEN** both plungers fly and hold, and only the left rope lets go

### Requirement: Touch feedback and the gesture card
On a phone, a ring SHALL show under each finger on the city: grey while it waits, yellow with L or R once its plunger flies, and blue with LOOK while it looks. When the player has held a rope for 0.35 s, the hint SHALL say "Holding on. Lift your thumb to let go." When phone play starts for the first time on a save, a card SHALL show the four gestures (TAP, HOLD, DRAG, STICK). It SHALL take no touches. It SHALL go away at the first touch on the city or after 10 s, and the save SHALL remember that it was seen.

#### Scenario: The first phone play
- **WHEN** a player starts phone play on a new save
- **THEN** the gesture card shows TAP, HOLD and DRAG, and the first touch on the city puts it away and still throws

#### Scenario: A ring under a held finger
- **WHEN** a finger on the right half has held still for 0.2 s
- **THEN** a yellow ring with R shows under it

## MODIFIED Requirements

### Requirement: The words say left and right
The touch note, How to play, the phone tutorial and the phone hint SHALL tell the player to tap left or right and to use both
thumbs, and SHALL NOT name a SWING button. The touch note and How to play SHALL also say that a held thumb keeps the rope and that
lifting it lets go. The resting phone hint SHALL say "Tap left or right to swing. Drag to look."

#### Scenario: The first tutorial line
- **WHEN** a phone player starts play
- **THEN** the first tutorial line is "Tap left or right to swing at the gold ring."
