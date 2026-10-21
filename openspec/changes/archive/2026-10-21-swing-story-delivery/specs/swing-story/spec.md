## MODIFIED Requirements

### Requirement: A scene for each mission
A short scene SHALL play the first time the player comes within 150 m of a district's clogs (after the training), when Missions 2, 3, 4 and 5 begin, when the King wakes, and at the finale ("All clear"). Each scene SHALL play once per save. The King scene SHALL NOT call itself Mission 2 or Mission 3.

#### Scenario: A district briefing
- **WHEN** the player first comes near a district's clogs
- **THEN** a panel names the district, its clogs left and a line about it

#### Scenario: Seen once
- **WHEN** the player comes near the same district again
- **THEN** no scene plays

### Requirement: Mission card
In flat play a mission card in the score row SHALL show the current mission and what to do next. While the story route is not the current mission, the card SHALL show the clogs flushed out of twelve and the district and distance of the nearest clog. While Mission 2, 3, 4 or 5 is current, the card SHALL name that mission and SHALL NOT say to flush the clogs. When the King is awake the card SHALL show the pipes ripped out of three. After the finale it SHALL say "ALL CLEAR". It SHALL hide during a trial.

#### Scenario: Mission 1
- **WHEN** the player has flushed one clog and the story route is not the current mission
- **THEN** the card in the score row says "FLUSH THE CLOGS 1/12" and "Next: <district> clog, <distance> m" on one line

#### Scenario: Mission 2 is not a clog
- **WHEN** Mission 2 has started
- **THEN** the card names the purse snatcher and does not say FLUSH THE CLOGS

#### Scenario: Mission card on a phone or a small window
- **WHEN** the player plays on a phone, or in a window under 820 by 520 pixels, after the training
- **THEN** the score row shows a short label (the district of the next clog, or the pipes left) and stays one row
