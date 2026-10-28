## ADDED Requirements

### Requirement: A job about to slip turns the card hot
A job whose opening clock is at least 12 seconds SHALL turn the card hot once 8 seconds remain or a quarter of that opening clock remains, whichever is less. The card SHALL use the same warm fill and magenta edge as a chase that is pulling away. Putting time back above that line SHALL bring the ink pill back. A clock that opened under 12 seconds SHALL NOT turn hot from time alone. When the Sludge Run's crew arrives, that stretch's opening clock SHALL be the longer of the clock the job opened with and the time now on it. A falling person who has not been caught SHALL turn the card hot. A free balloon at or above 140 m SHALL turn the card hot. A won job's card and a clog card SHALL stay the ink pill.

#### Scenario: A long fight still has time
- **WHEN** the rooftop brawl has most of its two minutes left
- **THEN** the card is the ink pill

#### Scenario: The clock is about to run out
- **WHEN** that brawl has 7 seconds left
- **THEN** the card turns hot, with a warm fill and a magenta edge

#### Scenario: Time comes back
- **WHEN** that brawl is given 30 seconds again
- **THEN** the card is the ink pill

#### Scenario: The payoff is not a warning
- **WHEN** that brawl is won
- **THEN** the card says GOT IT and is the ink pill

#### Scenario: A short edge does not heat from the clock
- **WHEN** the falling rescue still has someone on the edge and under 12 seconds were given
- **THEN** the card is the ink pill

#### Scenario: They are falling
- **WHEN** that person is falling and has not been caught
- **THEN** the card turns hot

#### Scenario: The balloon is still low
- **WHEN** the balloon has slipped and is still under 140 m
- **THEN** the card is the ink pill

#### Scenario: The balloon is getting away
- **WHEN** that balloon is free and at least 140 m up
- **THEN** the card turns hot

#### Scenario: The crew gets a fresh clock
- **WHEN** the runner is down and the crew's clock has just been raised to 40 seconds
- **THEN** the card is the ink pill
