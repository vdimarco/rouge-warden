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
The match SHALL pause when the window loses focus or the tab hides, and SHALL resume when the player comes back or clicks. The mouse leaving the window SHALL NOT pause the match, because the mouse pushes the view toward the screen edges. On touch, a tap SHALL resume it.

#### Scenario: Switch to another window
- **WHEN** the player switches to another window during a match and later clicks back into the game
- **THEN** the clock holds while the game is in the background and the match continues after the click.

#### Scenario: Mouse leaves the window
- **WHEN** the mouse leaves the window at the right edge during a match
- **THEN** the clock keeps running and the view stays pushed to the right.

### Requirement: Readable skill icons
Each HUD skill button SHALL show its painted art for all sixteen heroes. Unlearned and level-gated skills SHALL keep readable art with a small lock tag.

#### Scenario: Start a match
- **WHEN** a match starts with any hero
- **THEN** all four skill buttons show their art at full button size.

### Requirement: Desktop camera control
The view SHALL follow the hero at all times. With a mouse, the pointer's horizontal position SHALL push the view toward that side, up to about a third of the screen width at the edge, with a small dead zone at the centre. The push SHALL ease in and out and SHALL hold when the mouse leaves the window. A left click or drag on the minimap SHALL move the view there; a right click SHALL move the hero there. Space and a "Back to hero" button SHALL return the view to the hero. Touch players SHALL keep the tactical map on a minimap tap. Play SHALL enter full screen when the browser allows it, with a setting to turn this off.

#### Scenario: Push the view to the right
- **WHEN** the mouse moves to the right side of the screen during a match
- **THEN** the view slides right of the hero, keeps following the hero as it moves, and "Back to hero" does not appear.

#### Scenario: Centre the mouse
- **WHEN** the mouse returns to the centre of the screen
- **THEN** the view eases back until the hero is centred.

#### Scenario: Look through the minimap
- **WHEN** the player clicks the top of the minimap
- **THEN** the view moves to the enemy base and the tactical map does not open.

### Requirement: Menu and sound in the top left
During a match, the top left SHALL show a Menu button with a menu icon, the word "Menu" and the Esc key, and a speaker button beside it. Esc and the Menu button SHALL open the menu and pause; Esc or Keep playing SHALL close it. The same Esc press SHALL NOT close the menu it opened. In full screen, Esc SHALL reach the game where the browser supports keyboard lock; elsewhere, leaving full screen SHALL open the menu, and the next click in the match SHALL return to full screen. On phones the button SHALL show the icon only.

#### Scenario: Open the menu with Esc
- **WHEN** the player presses Esc during a match
- **THEN** the menu opens and stays open, and the clock holds; a second Esc closes it.

#### Scenario: Find the menu
- **WHEN** a match starts at 1440x900, 390x844 or 844x390
- **THEN** the Menu button and the speaker button are visible in the top left and do not cover the score or the objective.

### Requirement: Sound that is easy to check and recover
The speaker button SHALL show whether sound is on and SHALL turn it on or off. A match that starts with sound off SHALL say so. Any click or key SHALL wake an audio context that the browser or system stopped.

#### Scenario: Start with sound off
- **WHEN** a match starts with sound saved as off
- **THEN** a notice says sound is off and the speaker button shows it crossed out.

#### Scenario: Hear the match
- **WHEN** a match runs with sound on
- **THEN** the game's output is audible (RMS over 0.01 at the output in the browser check).

### Requirement: Smooth on large screens
The battlefield SHALL draw at most 2560x1440 backing pixels, whatever the screen size and pixel density. When frames fall well behind the screen's refresh rate, the backing resolution SHALL step down, and SHALL step back up when frames recover, with a hold that prevents flicker.

#### Scenario: Ultra-wide full screen
- **WHEN** the match runs at 3440x1440
- **THEN** the canvas has at most 2560x1440 backing pixels and the browser scales it to the screen.

### Requirement: Compact skill cluster
The three skills SHALL sit on a tight arc around the ultimate at 1440x900, 390x844 and 844x390, with upgrade buttons beside their skills.
