## MODIFIED Requirements

### Requirement: A chase pulls away
While the purse snatcher is still running, his speed SHALL stay at 6.3 m/s while the hero is within 28 m, and SHALL rise toward 9.2 m/s while the hero is farther than 28 m. While the Sludge Run runner is still running, his speed SHALL stay at 5.4 m/s while the hero is within 46 m, and SHALL rise toward 7.4 m/s while the hero is farther than 46 m. Coming back inside that distance SHALL bring the speed back toward the jog. The card SHALL say he is pulling away once that rise is most of the way there, and the card itself SHALL turn hot (a warm fill and a magenta edge) for as long as that line is up. Closing the gap SHALL bring the ink pill back with the jog line. While Mission 1 is waiting for the first swing, the runner SHALL stay stopped.

#### Scenario: Falling behind the thief
- **WHEN** the hero stays farther than 28 m from the purse snatcher
- **THEN** his speed rises above the jog, the card says he is pulling away, and the card turns hot

#### Scenario: Staying close
- **WHEN** the hero comes back within 28 m
- **THEN** his speed falls back to the jog, the card says to run him down, and the card is the ink pill again

#### Scenario: The first lesson
- **WHEN** Mission 1 is waiting for the first swing and the hero is far from the runner
- **THEN** the runner stays where he is
