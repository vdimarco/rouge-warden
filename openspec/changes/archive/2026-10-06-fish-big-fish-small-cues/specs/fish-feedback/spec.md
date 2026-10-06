## ADDED Requirements

### Requirement: Action card in the corner
In play, the prompt SHALL be a small card in the top corner opposite the gauge: the top right, or the top left when the reel is on the left in motion play. It SHALL be at most 210 px wide. Its picture SHALL move as the player must move: tip back, flick forward, raise, lower, steer, hold upright, or turn the crank. A pulse SHALL show the other actions. With reduced motion or Calm effects the picture SHALL be still. The how-to line under the card SHALL hide when the rod cue over the reel shows the same words. The card SHALL hide while the cast report is up, and it SHALL move down under the pull meter while that shows. The gauge SHALL be at most 190 x 120 px (220 x 140 px with Larger text), and its words SHALL not overlap.

#### Scenario: A jump in motion play
- **WHEN** a fish jumps in a fight at 360x640 in motion play
- **THEN** the card in the top right says to lower the rod, its phone picture moves down and up, and the card is clear of the gauge and the HUD.

#### Scenario: The reel on the left
- **WHEN** the reel is on the left in motion play at 412x915
- **THEN** the gauge is in the top right and the card is in the top left.

## MODIFIED Requirements

### Requirement: Messages clear of the lure
In play, no message SHALL cover the lure on the water: the prompt and its sub, the cast report, the "Fish on!" banner, and a toast each SHALL keep at least 22 px from the lure's place on the screen. In the tall reel the cast report SHALL stand beside the gauge, a toast SHALL stand under the gauge, and a toast SHALL wait while the report is up. In the wide reel the cast report SHALL stand at the top, opposite the gauge, and a toast SHALL stand at the top between the gauge and the card.

#### Scenario: A long cast in motion play
- **WHEN** a cast lands 15, 35 or 55 m out in motion play at 360x640, 390x844, 412x915 or 430x932, with the reel on either side
- **THEN** while the report is up and after it, no message is within 22 px of the lure, and the report is on the screen, clear of the gauge, the HUD and the prompt.

#### Scenario: Touch play on a wide screen
- **WHEN** a cast lands 15, 35 or 55 m out in touch play at 844x390 or 640x360
- **THEN** the report stands at the top right, and no message is within 22 px of the lure.

#### Scenario: Larger text
- **WHEN** a cast lands at 360x640 in motion play or at 844x390 in touch play with Larger text on
- **THEN** no message is within 22 px of the lure, and the card is clear of the gauge and the HUD.
