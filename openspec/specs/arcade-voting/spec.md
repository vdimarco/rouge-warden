# Arcade voting

## Requirements

### Requirement: Public voting links
The arcade SHALL provide accessible public VibeTopList vote links for Reel It In, Shore of the Ancients, Breath of the Lake, In Full Swing, Crimson Rogue, and River Rush.

#### Scenario: Vote from All Games
- **WHEN** a player views one of the six game cards
- **THEN** a separate Vote on VibeTopList link opens the matching documented vote route in a new tab
- **AND** the game launch link remains available

#### Scenario: Vote from a game menu
- **WHEN** a player opens the shared game menu in one of the six games
- **THEN** the footer offers a vote link for the current game
- **AND** Keep playing still closes the menu

#### Scenario: Keyboard and mobile use
- **WHEN** a player uses keyboard navigation or a 320px, 390px, or 1280px viewport
- **THEN** the vote link has visible focus, a descriptive accessible name, and a target at least 44px tall without horizontal overflow

#### Scenario: Other games
- **WHEN** a player views a game without a confirmed listing
- **THEN** no VibeTopList vote link is shown for that game
