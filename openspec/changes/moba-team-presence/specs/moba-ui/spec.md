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
The view SHALL follow the hero at all times. With a mouse, the pointer's horizontal position SHALL push the view toward that side, up to about a third of the screen width, with a small dead zone at the centre and the full push at 90% of the way to the edge. The push and the move-order lead together SHALL keep the hero inside the middle two thirds of the screen. The push SHALL ease in and out and SHALL hold when the mouse leaves the window. Holding Space SHALL centre the view on the hero; pressing Space SHALL also stop the hero. Holding the left button on the minimap SHALL show that place, and releasing it SHALL return the view to the hero; a right click SHALL move the hero there. Touch players SHALL keep the tactical map on a minimap tap. Play SHALL enter full screen when the browser allows it, with a setting to turn this off.

#### Scenario: Push the view to the right
- **WHEN** the mouse moves to the right side of the screen during a match
- **THEN** the view slides right of the hero, keeps following the hero as it moves, and "Back to hero" does not appear.

#### Scenario: Centre the mouse
- **WHEN** the mouse returns to the centre of the screen, or the player holds Space
- **THEN** the view eases back until the hero is centred.

#### Scenario: Look through the minimap
- **WHEN** the player holds the left button on the top of the minimap
- **THEN** the view shows the enemy base and the tactical map does not open.

#### Scenario: Let go of the minimap
- **WHEN** the player releases the minimap and walks
- **THEN** the view follows the hero again and the hero stays on screen.

### Requirement: Menu and sound in the top left
During a match, the top left SHALL show a Menu button with a menu icon, the word "Menu" and the Esc key, and a speaker button beside it. Esc and the Menu button SHALL open the menu and pause; Esc or Keep playing SHALL close it. The same Esc press SHALL NOT close the menu it opened, and a held Esc (key repeat) SHALL count once. In full screen, Esc SHALL reach the game where the browser supports keyboard lock. When full screen ends during play, the menu SHALL open with "Back to full screen" and "Keep playing windowed"; nothing SHALL return to full screen without that choice. The menu SHALL offer "Play windowed" or "Play full screen", and the choice SHALL be saved for the next match. A resize SHALL keep the hero's order and held movement keys. On phones the button SHALL show the icon only.

#### Scenario: Open the menu with Esc
- **WHEN** the player presses Esc during a match
- **THEN** the menu opens and stays open, and the clock holds; a second Esc closes it.

#### Scenario: Hold Esc
- **WHEN** the player holds Esc for two seconds during a match
- **THEN** the menu opens once and stays open.

#### Scenario: Leave full screen
- **WHEN** full screen ends during a match and the player chooses "Keep playing windowed", then clicks the battlefield
- **THEN** the game stays windowed, the clicks order the hero, and the windowed choice is saved.

#### Scenario: Find the menu
- **WHEN** a match starts at 1440x900, 390x844 or 844x390
- **THEN** the Menu button and the speaker button are visible in the top left and do not cover the score or the objective.

### Requirement: Sound that is easy to check and recover
Sound controls SHALL name their action ("Mute all sound", "Sound is off · Turn it on"), so a player who hears nothing and presses one does not mute the game. While sound is saved off, a "Sound is off · Turn on" chip SHALL show on hero select and in the match HUD, and one click SHALL turn sound on with a confirmation sound. A click on the speaker that only wakes a stopped audio context SHALL NOT also mute it. "Test sound" in the menu and in Game settings SHALL play a chime, measure the game's own output, and say either that the game is making sound (with where to look outside the game: the tab's mute, the site's sound setting, the system mixer, the output device) or why it cannot. Any click or key SHALL wake an audio context that the browser or system stopped, retry music the browser refused, and rebuild audio after a lost output device. The first gesture SHALL allow every music track to start later from a timer.

#### Scenario: Start with sound off
- **WHEN** hero select or a match opens with sound saved as off
- **THEN** the "Sound is off" chip shows, and one click on it makes the game audible and saves sound on.

#### Scenario: Hear the match
- **WHEN** a match is started with one real click on Play, with no other activation of the page
- **THEN** the draft and the match are audible (RMS over 0.01 at the output) and no music track is refused.

#### Scenario: Test the sound
- **WHEN** the player presses "Test sound" in the menu
- **THEN** a chime plays and the menu shows the measured level and the outside-the-game checklist.

### Requirement: Smooth on large screens
The battlefield SHALL draw at most 2560x1440 backing pixels, whatever the screen size and pixel density. Units and missiles SHALL be drawn between their last two simulation positions, so they move smoothly on 100-175 Hz screens. When frames fall well behind the screen's refresh rate and fewer pixels make them faster, the backing resolution SHALL step down (not below half the budget), and SHALL step back up when frames recover; a step-down that does not help SHALL be undone. Creature art SHALL stay loaded and decode off the main thread. A performance readout (with ?perf or a menu row) SHALL show frame timing, canvas size and the graphics renderer, and the HUD SHALL say when the browser draws without the graphics card.

#### Scenario: Ultra-wide full screen
- **WHEN** the match runs at 3440x1440
- **THEN** the canvas has at most 2560x1440 backing pixels and the browser scales it to the screen.

#### Scenario: High-refresh screen
- **WHEN** frames arrive at 144 Hz while the hero walks
- **THEN** the hero's screen position changes smoothly (high-pass jitter under 0.3 px per frame in the browser check).

#### Scenario: Slow frames that pixels cannot fix
- **WHEN** frames stay at 30 ms whatever the resolution
- **THEN** the resolution returns to full after a failed step-down and stays there most of the time.

### Requirement: Compact skill cluster
The three skills SHALL sit on a tight arc around the ultimate at 1440x900, 390x844 and 844x390, with upgrade buttons beside their skills.
