## ADDED Requirements

### Requirement: A chase pulls away
While the purse snatcher is still running, his speed SHALL stay at 6.3 m/s while the hero is within 28 m, and SHALL rise toward 9.2 m/s while the hero is farther than 28 m. While the Sludge Run runner is still running, his speed SHALL stay at 5.4 m/s while the hero is within 46 m, and SHALL rise toward 7.4 m/s while the hero is farther than 46 m. Coming back inside that distance SHALL bring the speed back toward the jog. The card SHALL say he is pulling away once that rise is most of the way there. While Mission 1 is waiting for the first swing, the runner SHALL stay stopped.

#### Scenario: Falling behind the thief
- **WHEN** the hero stays farther than 28 m from the purse snatcher
- **THEN** his speed rises above the jog, and the card says he is pulling away

#### Scenario: Staying close
- **WHEN** the hero comes back within 28 m
- **THEN** his speed falls back to the jog, and the card says to run him down

#### Scenario: The first lesson
- **WHEN** Mission 1 is waiting for the first swing and the hero is far from the runner
- **THEN** the runner stays where he is

### Requirement: A miss teaches the retry
A failed job SHALL show a lesson card that names the miss and one thing to do next, and SHALL NOT show a payoff word. A toast MAY still say what happened. The card SHALL stay up long enough to read. The Sludge Run and the current story mission SHALL start again only after that card. Any other failed job SHALL NOT start again on its own.

#### Scenario: The purse snatcher gets away
- **WHEN** the purse snatcher gets away
- **THEN** the card says he got away and to stay close with a swing
- **AND** no payoff word shows
- **AND** Stop, Thief! starts again after that card

#### Scenario: The drain blows
- **WHEN** the runner reaches the drain
- **THEN** the card says to catch him before the drain
- **AND** the Sludge Run starts again after that card

## MODIFIED Requirements

### Requirement: Mission 1 ends
Beating the runner's crew SHALL defuse the bomb, pay 50 Loonies and play the "Mission 2" card. That card SHALL name the purse snatcher. If the runner reaches the drain or the time runs out, the drain blows (no one is hurt), a toast says so, a lesson card says to catch him before the drain, and the mission starts again after that card. A returning save that has not won it SHALL get it too.

#### Scenario: Caught in time
- **WHEN** the hero knocks the runner down and beats his crew
- **THEN** the job ends "defused", the bank grows by 50 and the Mission 2 card names the purse snatcher

#### Scenario: Too slow
- **WHEN** the runner reaches the drain
- **THEN** the drain blows, a toast says so, the lesson card says to catch him before the drain, and the Sludge Run starts again after that card

### Requirement: The story after Mission 1
After the Sludge Run is won, the story SHALL be three missions in order: Stop, Thief! (a street chase), Catch! (a falling rescue) and a rooftop brawl. Each SHALL start on its own near the hero when the one before it is won. A failed one SHALL show its lesson card and SHALL start again after that card. While one of them is the current mission, the mission card SHALL name that mission and SHALL NOT say to flush the clogs, and odd-job markers SHALL wait. The Catch SHALL give time to swing to the roof. When the three are done, the card SHALL return to the clogs, and flushing all twelve SHALL still wake the King.

#### Scenario: Three different missions
- **WHEN** the Sludge Run is won
- **THEN** the next mission is a purse snatcher, then a falling rescue, then a roof fight
- **AND** none of those cards says to flush a clog

#### Scenario: A miss tries again
- **WHEN** the purse snatcher gets away
- **THEN** a lesson card names the miss, the same mission starts again after that card, and the card still does not say to flush the clogs

### Requirement: A win pays off
A won job SHALL show a comic word wider than a finisher, play a cheer, and hold a short slow moment in play. The Sludge Run's word SHALL be FLUSH. Every other won job's word SHALL be KASPLASH. The next mission card SHALL NOT open during that moment. A failed job SHALL NOT show a payoff word. After the moment, the next story mission SHALL start as before.

#### Scenario: Stop, Thief! pays off
- **WHEN** the player catches the purse snatcher
- **THEN** a KASPLASH wider than a finisher shows, the world hangs for a moment, and the Mission 3 card does not show yet

#### Scenario: The next mission follows
- **WHEN** that moment ends
- **THEN** Mission 3 starts

#### Scenario: A miss is not a win
- **WHEN** the purse snatcher gets away
- **THEN** no payoff word shows
