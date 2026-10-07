## ADDED Requirements

### Requirement: One tap swings on a phone
On a touch screen, a tap on the city or on SWING SHALL shoot a rope and start a swing. The player SHALL NOT need a second tap to let go.

#### Scenario: Tap a building from a roof
- **WHEN** the player stands on a roof and taps a building in reach
- **THEN** the rope catches, the player jumps off the roof and swings at more than 10 m/s within 0.6 s

#### Scenario: Taps alone
- **WHEN** the player plays 12 s from the start roof with taps only (no LET GO, no steering)
- **THEN** the average speed is at least 15 m/s and the player covers at least 140 m (before this change: 8 m/s and 80 m)

#### Scenario: Tap at the sky
- **WHEN** the player taps where no building is in reach
- **THEN** the rope catches the best building ahead of and above the player, if one is in reach

#### Scenario: Nothing in reach
- **WHEN** no building is in reach in any direction
- **THEN** the tap is a dry fire, the player stays on the roof, and the button shows SWING

### Requirement: The rope lets go by itself
On a phone, an attached rope SHALL let go by itself and fling the player on when the swing passes the bottom of its arc. It SHALL let go without a fling when the player lands on a roof or hangs still.

#### Scenario: Past the bottom of the arc
- **WHEN** the player swings up past 32 degrees from straight down, moving away from the anchor
- **THEN** the rope lets go, the player gains forward and upward speed, the view widens for a moment, and the button shows SWING again

#### Scenario: Reeled into a wall
- **WHEN** the reel pulls the player within 5 m of the anchor
- **THEN** the rope lets go and the player vaults up and over

### Requirement: Speed feels fast on a phone
Phone play SHALL use a speed cap of 48 m/s, and the view SHALL widen and comic speed lines SHALL show at the screen edges as speed grows. The camera SHALL turn toward the direction of flight when the player has not dragged to look for 0.7 s.

#### Scenario: Flying fast
- **WHEN** the player flies faster than 28 m/s
- **THEN** the vertical field of view is more than 85 degrees and the speed lines show at more than half strength

### Requirement: A tap plunges a clog
On a phone, a rope on a clog or a King's pipe SHALL pump by itself, once per yank cooldown, with no motion sensor.

#### Scenario: Tap a clog
- **WHEN** the player taps a clog in reach
- **THEN** the clog takes three pumps and flushes

### Requirement: Phone words and layout
The phone SHALL show phone instructions, never mouse or keyboard ones. Its buttons SHALL NOT cover the score pills or the spoken lines, in portrait or landscape.

#### Scenario: Tutorial on a phone
- **WHEN** a tutorial line plays on a phone
- **THEN** it speaks of taps, not of the mouse, Shift, F or a trigger

#### Scenario: Portrait and landscape
- **WHEN** the phone shows a spoken line in portrait (390 × 844) or landscape (844 × 390)
- **THEN** the top buttons do not overlap the score pills, the spoken line does not overlap the SWING panel, and the page does not scroll sideways
