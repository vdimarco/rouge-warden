## ADDED Requirements

### Requirement: The Gauntlet's roof and marker
After Mission 1, the Gauntlet's marker SHALL always be offered, on the same open roof near the start (at least 16 m across, 14 to
60 m up, no roof props, no antenna and nothing else on it). The roof SHALL show a painted hazard ring. Walking or swinging into the
marker SHALL start the Gauntlet. The page with `?gauntlet` SHALL start play on that roof in the Gauntlet.

#### Scenario: Start from the link
- **WHEN** the player opens In Full Swing with `?gauntlet` and starts flat play
- **THEN** the hero is on the Gauntlet's roof, the ring on the roof lights up, and the ROUND 1 banner shows with three goons

#### Scenario: The marker
- **WHEN** a player who has done Mission 1 is near the start roof
- **THEN** a Gauntlet marker stands on the arena roof among the job offers

### Requirement: Round after round
Round n SHALL bring 2 + n goons (at most 8). From round 3 it SHALL bring a brute, two from round 6. Each round the gang SHALL walk
5 % faster (at most 35 %) and wind up 4 % shorter (never under 0.32 s). A round SHALL end when its gang is down: a CLEARED! stamp
shows, the hero gets two hearts back, and after 4 s the next round starts with its banner. The training checklist SHALL fold away
and say nothing while the Gauntlet runs, and come back after it.

#### Scenario: A round cleared
- **WHEN** the player beats every goon of round 1
- **THEN** the stamp says CLEARED!, two hearts come back, and 4 s later the ROUND 2 banner shows with four goons

#### Scenario: The brute comes
- **WHEN** the player clears round 2
- **THEN** round 3 brings five goons and one brute, and the banner says so

### Requirement: The end and the best
A knock-out SHALL end the Gauntlet. It SHALL pay 5 × n Loonies for each round n cleared, show a banner with the rounds and the best,
and keep the best round on the device. A knock-out with no round cleared SHALL pay nothing.

#### Scenario: Knocked out in round 4
- **WHEN** the hero is knocked out with three rounds cleared
- **THEN** the Gauntlet ends, 30 Loonies are paid, and the banner says 3 ROUNDS
