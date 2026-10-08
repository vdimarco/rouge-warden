## RENAMED Requirements

- FROM: `### Requirement: Higgsfield living title scene`
- TO: `### Requirement: Character-led title artwork`

## MODIFIED Requirements

### Requirement: Character-led title artwork
The title screen SHALL display local illustrated jungle-rafting key art inspired by the supplied adult character, with long dark hair, a brown wrap and wooden raft in rapids. The illustration SHALL contain no phone overlay or baked-in title text. Responsive crops SHALL retain the character's face and readable live title, Start, map, Help, Leaderboard and arcade controls. The previous title video SHALL NOT cover this artwork.

#### Scenario: View the title across layouts
- **WHEN** the player opens the title at 1365×900, 390×844 or 844×390
- **THEN** the hero is undistorted, his face and the full Start button are initially visible, and all menu actions are reachable without artwork intercepting input

#### Scenario: Use the title actions
- **WHEN** the player starts a ready run or opens and closes Help or Leaderboard
- **THEN** the existing action works and returning to the title restores its artwork and controls

#### Scenario: Art unavailable or motion reduced
- **WHEN** the hero image fails to load or the player prefers reduced motion
- **THEN** readable live menu actions remain usable on a stable dark background without waiting for the title artwork
