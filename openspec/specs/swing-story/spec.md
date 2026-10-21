# swing-story Specification

## Purpose
In Full Swing, the comic scenes that tell the story, the mission card and how a scene is skipped.

## Requirements

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
A short scene SHALL play the first time the player comes within 150 m of a district's clogs (after the training), when Missions 2, 3, 4 and 5 begin, when the King wakes, and at the finale ("All clear"). Each scene SHALL play once per save. The King scene SHALL NOT call itself Mission 2 or Mission 3.

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
- **THEN** a toast says "The King: rip off his three pipes, then flush him."

### Requirement: Mission card
In flat play a mission card in the score row SHALL show the current mission and what to do next. It SHALL show the objective written in that same frame, including a clock that just changed and whether the card is hot. While the story route is not the current mission, the card SHALL show the clogs flushed out of twelve and the district and distance of the nearest clog. While Mission 2, 3, 4 or 5 is current, the card SHALL name that mission and SHALL NOT say to flush the clogs. When the King is awake the card SHALL show the pipes ripped out of three. After the finale it SHALL say "ALL CLEAR". It SHALL hide during a trial.

#### Scenario: Mission 1
- **WHEN** the player has flushed one clog and the story route is not the current mission
- **THEN** the card in the score row says "FLUSH THE CLOGS 1/12" and "Next: <district> clog, <distance> m" on one line

#### Scenario: Mission 2 is not a clog
- **WHEN** Mission 2 has started
- **THEN** the card names the purse snatcher and does not say FLUSH THE CLOGS

#### Scenario: Mission card on a phone or a small window
- **WHEN** the player plays on a phone, or in a window under 820 by 520 pixels, after the training
- **THEN** the score row shows a short label (the district of the next clog, or the pipes left) and stays one row

#### Scenario: The card matches this frame
- **WHEN** a fight's clock is set to seven seconds and one frame passes
- **THEN** the card in the score row already says 7 s and uses the hot card
- **AND** that text matches the objective from this frame, not the time from the frame before

### Requirement: Painted scene panels
The opening, the King waking and the finale SHALL show painted pictures of the game's city, King and hero in their panels. A
picture SHALL fill the inked frame, cropped so its subject stays in view on a wide screen and on a phone held upright, with
no live city showing round the frame. A balloon SHALL point at the speaker's face in the picture, and no balloon SHALL cover
the caption.

#### Scenario: Opening on desktop
- **WHEN** a new player finishes the cottage opening in flat play
- **THEN** the five opening panels show the city and the Needle, the King asleep, the clogs, the hero with the plunger, and the swing behind the Mission 1 card

#### Scenario: Opening on a phone
- **WHEN** the opening plays on a phone held upright
- **THEN** each picture fills the frame around its subject, and its caption and balloon sit inside the screen, clear of each other and of the SKIP button

### Requirement: Live shot when a picture is missing
A panel whose picture has not loaded when the panel starts SHALL show the live city shot instead, with the same words.

#### Scenario: Offline before the cache
- **WHEN** a picture cannot load
- **THEN** its panel shows the live shot and the scene plays on
