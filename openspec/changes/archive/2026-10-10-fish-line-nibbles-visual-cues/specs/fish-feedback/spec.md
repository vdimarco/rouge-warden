## ADDED Requirements

### Requirement: Feel a fish nibble
When a fish tests the lure, a phone that supports haptics and has Buzz and taps enabled SHALL give a light nibble pattern distinct from a reel tick and the stronger strike pattern. Repeated nibbles SHALL remain perceptible without a continuous buzz, and a nibble SHALL NOT suppress a strike or an urgent warning. With vibration disabled or unavailable, the existing visual and sound nibble cues SHALL still play.

#### Scenario: Nibble before strike
- **WHEN** a fish nibbles and then strikes on an iPhone app or a vibrating Android phone
- **THEN** the player feels the light nibble cue before the stronger strike cue, once for each simulation event within the haptic rate rules.

#### Scenario: Buzz and taps is off
- **WHEN** Buzz and taps is off and a fish nibbles
- **THEN** no haptic call occurs, while the rod-tip movement and nibble sound still occur.

### Requirement: Tactile feedback through the fishing loop
On a supported phone with Buzz and taps enabled, meaningful controls and gameplay beats SHALL have brief, distinct tactile cues through navigation, casting, retrieving, fish action, and outcomes. Routine feedback SHALL feel lighter than danger or a notable catch. All cues SHALL obey the shared mute, priority, and rate rules so repeated inputs do not mask an urgent event or become a continuous buzz. The game SHALL remain understandable through visuals and sound when haptics are unavailable.

#### Scenario: Ordinary cast and empty return
- **WHEN** a player makes a non-sweet water cast, reels in with no fish, and prepares to cast again
- **THEN** the release has a short tug, the splash has a separate brief cue, and the empty return has a quiet settling cue without a victory pattern.

#### Scenario: A fish refuses the lure
- **WHEN** a following fish turns away or a hook set misses
- **THEN** a short descending non-success cue marks the failed chance; the stronger strike and hook-set patterns remain distinct.

#### Scenario: Dry landing
- **WHEN** a cast hits the shore instead of the water
- **THEN** a brief descending failure cue plays, distinct from the water splash and the catch cue.

#### Scenario: Navigate the game
- **WHEN** a player chooses a mode, opens or closes a menu, changes a setting, or continues from a catch card
- **THEN** the accepted action gives a light control cue once, weaker than fish events, without buzzing continuously while the menu is open.

#### Scenario: Pause during a fight
- **WHEN** a player pauses while the line is under tension
- **THEN** the tension train stops before a single light pause tap, with no continuing fight buzz under the menu.

#### Scenario: Drag at its limit
- **WHEN** the drag is already at minimum or maximum and the player presses the same direction again
- **THEN** the drag setting does not change and no adjustment tick plays.

#### Scenario: Haptics unavailable
- **WHEN** Buzz and taps is off, or the game runs on a device without working haptics
- **THEN** these new cues make no haptic call and the controls and game outcomes remain visually and audibly understandable.

## MODIFIED Requirements

### Requirement: Action card in the corner
In play, the prompt SHALL be a visual action card in the top corner opposite the gauge. Its illustrated pose, direction marker, and animation SHALL show the active input and next move without visible instruction prose. Pace and urgency SHALL have non-color marks. Instruction words SHALL remain available to assistive technology and the optional guide. Calm and reduced-motion settings SHALL show a meaningful still pose. The card SHALL stay clear of controls and the lure.

#### Scenario: Cast, nibble, and strike on a phone
- **WHEN** a touch player at 390x844 loads and releases a cast, then a fish nibbles and strikes
- **THEN** the top-right card changes from a downward load gesture to an upward release gesture, then a wait or nibble picture, then an urgent upward hook-set gesture; no visible instruction sentence appears in the card.

#### Scenario: Reel and fight moves
- **WHEN** a player reels, pumps, steers, lets a running fish go, or lifts a fish out, using touch, motion, the mouse, or keys
- **THEN** the card demonstrates that move with the active input method, shows the reel pace or urgency with non-color marks, and is no more than 210 px wide.

#### Scenario: A jump in motion play
- **WHEN** a fish jumps in a fight at 360x640 in motion play
- **THEN** the card in the top right shows the phone lowering with a downward direction marker, stays clear of the gauge and HUD, and its hidden words and screen-reader announcement instruct the player to lower the rod.

#### Scenario: The reel on the left
- **WHEN** the reel is on the left in motion play at 412x915
- **THEN** the gauge is in the top right and the visual card is in the top left.

#### Scenario: A toast while the pull meter shows
- **WHEN** a toast shows in a fight in motion play at 360x640 or 390x844, with the reel on either side, while the pull meter shows
- **THEN** the toast stands under the gauge and under the card, and it is clear of the crank, the gauge, the rod cue, the card, the drag bar and the pull meter.

#### Scenario: A slow frame in motion play
- **WHEN** a frame of a fight in motion play comes 4 s late while the pull meter shows
- **THEN** the pull meter stays up and keeps its pull, and the card stays under it.

#### Scenario: Report, pull meter, and gauge
- **WHEN** a cast report shows, or the motion pull meter shows during a fight
- **THEN** the card hides during the report and sits under the pull meter during the fight. The gauge is at most 190 x 120 px, or 220 x 140 px with Larger text, with no overlapping words.

#### Scenario: Motion samples stop
- **WHEN** motion samples stop for 0.4 s while the pull meter is visible
- **THEN** the pull meter hides and the card returns to its usual corner position.

#### Scenario: Reel on the left and a wide phone
- **WHEN** motion play puts the reel on the left at 412x915, or the game is played at 844x390
- **THEN** the action card stays in the corner opposite the gauge, within the view and clear of the other controls and lure.

#### Scenario: Still cues
- **WHEN** Calm effects or reduced motion is enabled while the game asks the player to steer or lower the rod
- **THEN** animation stops and the static gesture and direction marker still show which way to move.
