## ADDED Requirements

### Requirement: Mouse play on a computer
On a computer with a mouse, a press anywhere on the lake SHALL take the rod in a fight, as a press on the drawn rod does: a drag up or down SHALL move the rod, and a drag sideways SHALL steer from where the press began. A press on the crank, the drag buttons, the HUD or another control SHALL keep its own job. The mouse wheel SHALL be the crank, and the game SHALL say so: the fight words for the mouse SHALL name the wheel, the action card SHALL show a mouse with its wheel rolling for the reel move, and the crank's hint SHALL say SCROLL / TO REEL.

#### Scenario: A press away from the rod
- **WHEN** a fish is on at 1280x800 and the player presses the mouse on the lake left of the middle and drags up, then sideways
- **THEN** the rod rises and steers to that side.

#### Scenario: The wheel is the crank
- **WHEN** the bail is open in the retrieve on a computer after a mouse press
- **THEN** the card says "Scroll the mouse wheel to reel." with the wheel rolling, and the crank's hint says SCROLL.

#### Scenario: A fish on the bottom
- **WHEN** a fish sulks on a computer after a mouse press
- **THEN** the rod cue says "Drag up. Scroll as it comes down."
