# fish-feedback Specification

## Purpose
How Reel It In shows and tells the player what happened: the hook-set hit, jumps and splashes they can see, stingers that grow with the catch, the results count-up, and buzz patterns that each have one meaning.

## Requirements

### Requirement: Hook-set hit
Setting the hook SHALL be the strongest moment of the fight: a short freeze, a camera punch, a whip of the rod tip, a "Fish on!" banner in the prompt slot, a thump in the sound, and a strong buzz. Reduced motion SHALL skip the freeze and the punch.

#### Scenario: Hook set
- **WHEN** the player sets the hook
- **THEN** the hook-set sound is at least as loud as the strike sound, the banner shows for about 0.9 s, and the buzz is longer than the strike buzz.

### Requirement: Jumps you can see
During a jump, the reel camera SHALL zoom in on the fish so that it is at least 20 px wide on a 390 px wide phone.

#### Scenario: Smallmouth jumps
- **WHEN** a smallmouth jumps 30 m out
- **THEN** the fish's box on the screen is at least 20 px wide, and the camera eases back after the jump.

#### Scenario: Jump on a wide screen
- **WHEN** a fish jumps 30 to 50 m out at 844x390 or 1280x800
- **THEN** the leap shows below the prompt and the HUD, inside the view, and the rod stays drawn.

### Requirement: Tiered stingers
Each kind of catch SHALL have its own sound: a fish, a new species, a new record, a trophy, a legend, a new place, and a derby end. A legend's stage change SHALL NOT play the victory fanfare.

#### Scenario: Routine catch
- **WHEN** the player lands a fish that is neither new nor a record
- **THEN** only the landed sound plays.

#### Scenario: New place
- **WHEN** the unlock card shows
- **THEN** a horn call and the new place's sound play, the card rises in, and the phone buzzes.

### Requirement: Results count up
The derby total SHALL count up from zero, and a close sound SHALL play at the end of every derby.

#### Scenario: Derby end
- **WHEN** the results show
- **THEN** the total counts up over about 1 s, then the rank shows.

### Requirement: Visible splashes
The lure landing and fish splashes SHALL grow with distance so that they show at normal cast range.

#### Scenario: Long cast
- **WHEN** a lure lands 45 m out
- **THEN** its splash is at least 12 px tall on a 390x844 screen.

### Requirement: Native haptics
In the iPhone app, every buzz SHALL use the native haptics plugin, with the same mute, priority, and rate rules as the web buzz. On Android the web buzz stays.

#### Scenario: Strike in the iPhone app
- **WHEN** a fish strikes in the iPhone app
- **THEN** the plugin gets two heavy impacts, and turning "Buzz and taps" off stops all calls.

### Requirement: Correct buzz meanings
The last-run warning SHALL NOT use the line-snap buzz and SHALL NOT mute the drag buzz. Every legend SHALL glitter in the catch view.

#### Scenario: Last run
- **WHEN** a fish makes its last run
- **THEN** the drag buzz keeps going and the warning buzz differs from the snap buzz.

### Requirement: Trophy photo framing
The photo beat of a trophy, a legend or a fish that opens a place SHALL show the fish in the middle of the part of the view that the catch card leaves free when the flash comes. The card SHALL then come up beside the fish, not over it. This SHALL hold right after a jump, and when frames take longer than 50 ms. The flash SHALL wait for a frame that shows the fish in the photo's position, also when no frame comes until after the time of the flash.

#### Scenario: Trophy landed during a jump's zoom on slow frames
- **WHEN** a trophy is landed while a jump's zoom is still on, every frame takes 150 ms, and no frame comes for 1.5 s after the landing
- **THEN** at the flash the fish's middle is within 3% of the view's size from the middle of the free part, at 390x844, 360x640 and 844x390

#### Scenario: The card comes up
- **WHEN** the card of that trophy has come up
- **THEN** the fish and its ruler are inside the view, above the card on a tall view and to its left on a wide view

### Requirement: Messages clear of the lure
In play, no message SHALL cover the lure on the water: the prompt and its sub, the cast report, the "Fish on!" banner, and a toast each SHALL keep at least 22 px from the lure's place on the screen. In the tall reel the cast report SHALL stand beside the gauge, a toast SHALL stand under the gauge, and a toast SHALL wait while the report is up. In the wide reel the cast report SHALL stand at the top, opposite the gauge, and a toast SHALL stand at the top between the gauge and the card.

#### Scenario: A long cast in motion play
- **WHEN** a cast lands 15, 35 or 55 m out in motion play at 360x640, 390x844, 412x915 or 430x932, with the reel on either side
- **THEN** while the report is up and after it, no message is within 22 px of the lure, and the report is on the screen, clear of the gauge, the HUD and the prompt.

#### Scenario: Touch play on a wide screen
- **WHEN** a cast lands 15, 35 or 55 m out in touch play at 844x390 or 640x360
- **THEN** the report stands at the top right, and no message is within 22 px of the lure.

#### Scenario: Larger text
- **WHEN** a cast lands at 360x640 in motion play or at 844x390 in touch play with Larger text on
- **THEN** no message is within 22 px of the lure, and the card is clear of the gauge and the HUD.

### Requirement: Action card in the corner
In play, the top-corner action card opposite the gauge SHALL illustrate the active input and next move with a pose, direction mark, and animation. It SHALL show a short action label and MAY add a brief pace, direction, or timing qualifier. Pace and urgency SHALL have marks beyond color. The full instruction SHALL stay available to assistive technology and the optional guide. Calm and reduced-motion settings SHALL keep a readable still pose. The card SHALL clear controls and the lure.

#### Scenario: Cast, nibble, and strike on a phone
- **WHEN** a touch player at 390x844 loads and releases a cast, then a fish nibbles and strikes
- **THEN** the top-right card changes from a downward load gesture to an upward release gesture, then a wait or nibble picture, then an urgent upward hook-set gesture; it shows short action labels rather than instruction sentences.

#### Scenario: Reel and fight moves
- **WHEN** a player reels, pumps, steers, lets a running fish go, or lifts a fish out, using touch, motion, the mouse, or keys
- **THEN** the card demonstrates that move with the active input method, shows the reel pace or urgency with non-color marks, and is no more than 176 px wide.

#### Scenario: A jump in motion play
- **WHEN** a fish jumps in a fight at 360x640 in motion play
- **THEN** the card in the top right shows the phone lowering with a downward direction marker and a short action label, stays clear of the gauge and HUD, and its full words and screen-reader announcement instruct the player to lower the rod.

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
- **THEN** animation stops and the static gesture, direction marker, and brief label still show which way to move.

#### Scenario: Narrow portrait phone
- **WHEN** a player uses a 320px or 360px wide phone during a fight
- **THEN** the gesture and brief label remain visible within the screen and clear of the gauge, HUD, rod cue, and controls.

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

### Requirement: Brief spoken action hints
When Voice hints and Sound are enabled and speech synthesis is available, the game SHALL speak brief nibble and hook-set hints in a measured British wildlife-narrator style. It SHALL prefer an installed British English voice, fall back when unavailable, avoid repeated or queued speech, prioritize the hook-set hint, and stop when play pauses, the page hides, or either setting is disabled. Visual, haptic, sound, and screen-reader feedback SHALL remain available without speech synthesis.

#### Scenario: Nibble followed by strike
- **WHEN** a fish nibbles and then strikes while Voice hints and Sound are enabled and a British English voice is installed
- **THEN** the game uses that voice with measured pacing for a brief hold-steady hint and a short hook-set command; the command can interrupt the nibble hint.

#### Scenario: Repeated nibble
- **WHEN** repeated nibble events arrive within a short interval
- **THEN** the game does not queue or speak the same instruction for every event.

#### Scenario: Speech disabled or interrupted
- **WHEN** the player turns off Voice hints or Sound, pauses, or leaves the page while a hint is speaking
- **THEN** the speech stops, while the on-screen cue and screen-reader instruction remain available.

#### Scenario: No speech support
- **WHEN** speech synthesis is unavailable on a device
- **THEN** gameplay proceeds without an error and the other cues still communicate what to do.

#### Scenario: Voices load after play begins
- **WHEN** the speech engine first reports no British English voice but adds one later
- **THEN** subsequent hints can use the newly available voice without restarting the game.

#### Scenario: No British voice
- **WHEN** no British English voice is installed but speech synthesis is available
- **THEN** the game uses an understandable available voice for the same short hints.
