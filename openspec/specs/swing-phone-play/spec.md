# swing-phone-play Specification

## Purpose
In Full Swing on a phone, how taps swing, plunge and read on a small screen.

## Requirements

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

### Requirement: Every tap swings on
On a phone, every press of SWING and every tap on the city SHALL shoot a rope. With a rope out, the press SHALL move the rope
to the next building ahead (or the tapped one) with no let-go between. SWING SHALL NOT let go of a rope. A press while the
cup still flies SHALL do nothing, so the rope that is coming lands.

#### Scenario: A second press of SWING
- **WHEN** the player presses SWING, the rope catches, and the player presses SWING again
- **THEN** a new rope shoots at once, the button still shows SWING ("Again: the next building"), and the speed stays over 10 m/s

#### Scenario: A steady beat of taps
- **WHEN** the player presses SWING every 0.5, 0.8 or 1.2 s for 12 s from the start roof, with no steering
- **THEN** for each beat the average speed is at least 17 m/s, the player covers at least 120 m, the feet are under 8 m for at most 2.5 s, and the player is on the ground for at most 1.5 s (before this change: 11 to 16 m/s and 5.6 to 7.3 s under 8 m)

#### Scenario: Only the held building is in reach
- **WHEN** the player presses SWING with a rope out and no other building qualifies
- **THEN** the rope stays and the hint says the rope is kept

### Requirement: A phone rope keeps the speed and the height
On a phone, a rope on a building that catches SHALL keep the player's speed: the part that flies away from the anchor SHALL
turn into swing toward where the player looks. The rope SHALL shorten so the lowest point of its arc stays 6 m over the
street, unless the anchor is too low for that. The phone marker SHALL prefer a point at least 22 m up and 8 m over the chest.

#### Scenario: A catch while falling
- **WHEN** the player falls toward the street and a new rope catches a high building ahead
- **THEN** the speed after the catch is not lower than before it, and the rope pulls the player up so the swing passes over the street

#### Scenario: On or just over a street
- **WHEN** the phone marker searches from 600 sampled spots on a street, or 10 to 20 m over one and falling
- **THEN** it takes a point at least 22 m up and 8 m over the chest at no fewer than 78 % of the spots and at 10 % more spots than the plain marker (measured: 497 against 404), and never a low point where the plain marker has a high one
