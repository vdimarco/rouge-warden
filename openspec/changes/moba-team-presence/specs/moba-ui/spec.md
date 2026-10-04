## ADDED Requirements

### Requirement: Visible hero draft
After Play, a draft board SHALL show both teams of three. Bots SHALL pick one at a time with their handle, hero art, name and role. The player's chosen hero SHALL lock in its turn. The finished draft SHALL be the lineup of the match.

#### Scenario: Watch the picks
- **WHEN** the player presses Play
- **THEN** the board shows each bot considering and then locking a hero, with no duplicate hero, and a teammate chat line for teammate picks.

#### Scenario: Skip the draft
- **WHEN** the player presses Enter or the start button during the draft
- **THEN** all remaining picks lock at once and the match starts with that lineup.

#### Scenario: Match the lineup
- **WHEN** the match starts
- **THEN** each hero on the battlefield has the identity shown on the board.

### Requirement: Team presence on the map
The minimap and tactical map SHALL show allied heroes at all times as hero-coloured markers with an initial. Enemy heroes SHALL show when visible and as a faded last-seen marker for eight seconds after they leave sight. Team pings and structures under attack SHALL pulse at their positions.

#### Scenario: Track a teammate
- **WHEN** a teammate fights in another lane
- **THEN** their marker and a fight ping appear at that position on the minimap.

#### Scenario: Lose sight of an enemy
- **WHEN** a visible enemy hero walks into fog
- **THEN** a faded marker stays at its last seen position for eight seconds and then clears.

### Requirement: Team voice in the HUD
The HUD SHALL show a short team chat feed and a kill feed that fade after a few seconds and do not block controls at 1440x900, 390x844 and 844x390.

#### Scenario: Teammates talk
- **WHEN** a teammate rotates to a fight, retreats, or the Wild Hunt spawns
- **THEN** a chat line names the teammate's handle and hero.

### Requirement: Hold the match when the player leaves
The match SHALL pause when the mouse leaves the window, the window loses focus or the tab hides. A returning mouse SHALL resume it. On touch, a tap SHALL resume it.

#### Scenario: Mouse leaves and returns
- **WHEN** the mouse leaves the window during a match and later returns
- **THEN** the clock holds while it is outside and the match continues when it returns.

### Requirement: Readable skill icons
Each HUD skill button SHALL show its painted art for all sixteen heroes. Unlearned and level-gated skills SHALL keep readable art with a small lock tag.

#### Scenario: Start a match
- **WHEN** a match starts with any hero
- **THEN** all four skill buttons show their art at full button size.

### Requirement: Desktop camera control
With a mouse, pushing the pointer to a screen edge SHALL scroll the view in that direction. A left click or drag on the minimap SHALL move the view there; a right click SHALL move the hero there. Space and a "Back to hero" button SHALL return the view to the hero. Touch players SHALL keep the tactical map on a minimap tap. Play SHALL enter full screen when the browser allows it, with a setting to turn this off.

#### Scenario: Scroll to the left
- **WHEN** the mouse rests at the left edge during a match
- **THEN** the view scrolls left and "Back to hero" appears; Space returns the view to the hero.

#### Scenario: Look through the minimap
- **WHEN** the player clicks the top of the minimap
- **THEN** the view moves to the enemy base and the tactical map does not open.

### Requirement: Compact skill cluster
The three skills SHALL sit on a tight arc around the ultimate at 1440x900, 390x844 and 844x390, with upgrade buttons beside their skills.
