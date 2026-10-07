## MODIFIED Requirements

### Requirement: The rope lets go by itself
On a phone, an attached rope SHALL let go by itself and fling the player on when the swing passes the bottom of its arc. It SHALL let go without a fling when the player lands on a roof or hangs still. While a finger holds the rope down (a hold, in swing-two-thumb), it SHALL NOT let go past the bottom of the arc or while it hangs still. It SHALL let go when that finger lifts.

#### Scenario: Past the bottom of the arc
- **WHEN** the player swings up past 32 degrees from straight down, moving away from the anchor, after a tap
- **THEN** the rope lets go, the player gains forward and upward speed, the view widens for a moment, and the button shows SWING again

#### Scenario: Reeled into a wall
- **WHEN** the reel pulls the player within 5 m of the anchor
- **THEN** the rope lets go and the player vaults up and over

#### Scenario: A held rope
- **WHEN** the player swings past the bottom of the arc with the finger that threw the rope still down
- **THEN** the rope holds until the finger lifts
