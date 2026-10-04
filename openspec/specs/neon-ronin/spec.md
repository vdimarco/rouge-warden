# neon-ronin Specification

## Purpose
Neon Ronin is a sword duel with touch, gyro or a mouse, where every attack starts in view and warns before it lands.

## Requirements

### Requirement: The ronin attacks where the player can see it
Neon Ronin SHALL start an attack only when the attacker is in reach and on screen.

#### Scenario: A windup starts on screen
- **WHEN** a ronin starts an attack
- **THEN** the ronin is in reach and on screen, and on a touch screen the view turns toward the attacker during its windup

#### Scenario: A ronin out of view
- **WHEN** a ronin is out of view
- **THEN** an arrow at the screen edge points to it, and the arrow pulses red during its attack

### Requirement: Every attack warns in sight, sound and touch
Neon Ronin SHALL warn of every blow at least 0.3 s before it lands.

#### Scenario: A windup
- **WHEN** a ronin winds up
- **THEN** a tone rises until the impact, the screen edge pulses red (amber for a sweep), and the phone buzzes

### Requirement: The parry is the key move
Neon Ronin SHALL make a parry the fastest way to open a guard.

#### Scenario: Parry
- **WHEN** the player guards in the last 0.6 s before the blade lands
- **THEN** the guard opens at once, time stops for 80 ms and then runs slow for 0.5 s, and a metal ring sounds

#### Scenario: Block or dodge
- **WHEN** the player blocks or dodges instead
- **THEN** the guard bar fills by 1 for a block or 2 for a dodge, and only a full bar opens the guard

### Requirement: A menu that fits a phone
Neon Ronin SHALL show the way to play on the first screen of a phone.

#### Scenario: The first screen
- **WHEN** the game opens on a 390×844 screen
- **THEN** the title, one line and both PLAY buttons are on the first screen, and the rest of the help waits behind "How to play"

#### Scenario: Hints for the controls you have
- **WHEN** the player plays with touch
- **THEN** no hint mentions Space, and the guard hint says "HOLD GUARD AS THE BLADE FALLS"

### Requirement: A daily duel, and an end card that shows how close you came
Neon Ronin SHALL give the crew the same duel each day and show how close a run came.

#### Scenario: Today's duel
- **WHEN** two players open the game on the same day with no seed in the link
- **THEN** they meet the same attacks and the same circuits

#### Scenario: The end card
- **WHEN** a run ends
- **THEN** the card shows the round, how much health the last opponent had left, and today's best round, with a line to copy

### Requirement: Gyro survives a short stall
Neon Ronin SHALL keep gyro control through a short stall of the motion sensor.

#### Scenario: A short stall
- **WHEN** the motion sensor stalls for a moment in gyro mode
- **THEN** gyro control stays on

#### Scenario: No signal at all
- **WHEN** no motion signal comes at all
- **THEN** the game pauses and says why
