## ADDED Requirements

### Requirement: Opening scene tells the story
In flat play, after the cottage hand-off on a first run, a comic scene SHALL tell why the Porcelain King sits on the Needle and give the first mission. Its panels SHALL say that the Needle is the city's water tower, that the King sits in its tank, that he has backed up twelve rooftop drains, and SHALL end on a "Mission 1" title card.

#### Scenario: First run on desktop
- **WHEN** a new player finishes the cottage opening in flat play
- **THEN** the opening scene plays over the live city in an inked frame
- **AND** the HUD hides and the hero holds still
- **AND** the scene ends with the "Mission 1: Flush the twelve clogs" card and play goes on with the HUD back

#### Scenario: A balloon stays on screen
- **WHEN** a panel shows a speech balloon on a desktop or a phone screen
- **THEN** the balloon sits inside the screen with its tail toward its speaker

### Requirement: A scene for each mission
A short scene SHALL play the first time the player comes within 150 m of a district's clogs (after the training), when the King wakes ("Mission 2"), and at the finale ("All clear"). Each scene SHALL play once per save.

#### Scenario: A district briefing
- **WHEN** the player first comes near a district's clogs
- **THEN** a panel names the district, its clogs left and a line about it

#### Scenario: Seen once
- **WHEN** the player comes near the same district again
- **THEN** no scene plays

### Requirement: Skip a scene
A click, a tap, Space, Enter or Esc SHALL skip a scene, except in its first half second.

#### Scenario: Skip with Space
- **WHEN** the player presses Space one second into a scene
- **THEN** the scene ends and play goes on

#### Scenario: The start press does not skip
- **WHEN** the press that started play reaches the scene in its first half second
- **THEN** the scene goes on

### Requirement: Headset shows a toast
In a headset no scene SHALL play. The mission scenes SHALL show their mission as a toast.

#### Scenario: King wakes in a headset
- **WHEN** the King wakes in immersive play
- **THEN** a toast says "Mission 2: rip off the King's three pipes, then flush him."

### Requirement: Mission card
In flat play a mission card in the score row SHALL show the current mission and what to do next: in Mission 1 the clogs flushed out of twelve and the district and distance of the nearest clog; in Mission 2 the pipes ripped out of three; after the finale "ALL CLEAR". It SHALL hide during a trial.

#### Scenario: Mission 1
- **WHEN** the player has flushed one clog
- **THEN** the card in the score row says "FLUSH THE CLOGS 1/12" and "Next: <district> clog, <distance> m" on one line

#### Scenario: Mission card on a phone or a small window
- **WHEN** the player plays on a phone, or in a window under 760 by 520 pixels, after the training
- **THEN** the score row shows a short label (the district of the next clog, or the pipes left) and stays one row
