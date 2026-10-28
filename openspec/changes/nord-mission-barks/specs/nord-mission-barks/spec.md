## ADDED Requirements

### Requirement: A mission giver speaks their line
Pressing E on a park resident SHALL play that resident's spoken line. The words SHALL be the resident's caption line. A style outside the eleven givers SHALL use the nearest end of the list. Other dialogue cues SHALL keep the cooked sting.

#### Scenario: Named giver
- **WHEN** the player talks to Madame Poutine
- **THEN** the spoken words are "Stay cheesy, Montreal. The fries are counting on you."

#### Scenario: Clamp
- **WHEN** a style below the first giver or past the last giver is asked for
- **THEN** it uses the first or the last line

### Requirement: The takes are speech and they differ
Each line SHALL last more than a second and less than six. It SHALL have energy, a peak inside the sample range, a speech-like rate of zero crossings, and a quiet start and end. No two givers SHALL share a take.

#### Scenario: A take
- **WHEN** a giver's samples are decoded
- **THEN** the line has energy, stays inside the sample range, crosses zero like speech, and fades at both ends

#### Scenario: Distinct givers
- **WHEN** every take is hashed
- **THEN** no two hashes match
