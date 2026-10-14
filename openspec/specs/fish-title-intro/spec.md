# fish-title-intro Specification

## Purpose
The painted title sequence on the Reel It In title at Loon Lake: a short film in the logo's space that does not block the menu.

## Requirements

### Requirement: Painted title sequence
On the title, in the Painted style, at Loon Lake, the game SHALL show the painted title sequence in the logo's space. A portrait screen SHALL use the vertical film. A landscape screen SHALL use the horizontal film. The clip SHALL start muted, inline, and on its own. The menu SHALL stay visible and usable while it plays, including Go fishing.

#### Scenario: Phone title
- **WHEN** a player opens Reel It In at 390x844 in the Painted style at Loon Lake
- **THEN** the vertical title sequence plays muted above the menu, and Go fishing still starts free fishing.

#### Scenario: Desktop title
- **WHEN** a player opens the title in a landscape window
- **THEN** the horizontal title sequence plays in the logo's space, and the menu stays usable.

#### Scenario: Another place or the Original style
- **WHEN** the title opens in the Original style, or at a place other than Loon Lake
- **THEN** the title sequence does not play.

### Requirement: Skip, Play, and sound
The sequence SHALL have a control that says Skip while the film is playing and Play while it is not, and a control that turns its sound on and off. Skip, the film ending, and leaving the title to fish SHALL put the sequence away. Opening Settings, How to play, the Journal, or Places SHALL pause it and show it again when the player returns to the title.

#### Scenario: Skip
- **WHEN** the player presses Skip during the sequence
- **THEN** the sequence closes and the title menu is still there.

#### Scenario: Unmute
- **WHEN** the player presses Unmute
- **THEN** the sequence's sound turns on, and Mute turns it off again.

#### Scenario: Go fishing
- **WHEN** the player presses Go fishing while the sequence is up
- **THEN** fishing starts and the sequence does not come back over the cast.

### Requirement: Reduced motion
With reduced motion, or with Calm effects on, the title SHALL show a still poster of the sequence and SHALL NOT play the film until the player presses Play or Unmute.

#### Scenario: Reduced motion
- **WHEN** the title opens with reduced motion requested
- **THEN** the poster shows, the film is not playing, and the control says Play.

#### Scenario: Play anyway
- **WHEN** the player presses Play on that poster
- **THEN** the film plays, and Skip closes it.
