## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Brief spoken action hints
When Voice hints and Sound are enabled and speech synthesis is available, the game SHALL speak a brief hint at a nibble and at a hook-set moment. It SHALL avoid repeated or queued speech, give the hook-set hint priority, and stop speech when play pauses, the page hides, or either setting is disabled. Visual, haptic, sound, and screen-reader feedback SHALL continue without speech synthesis.

#### Scenario: Nibble followed by strike
- **WHEN** a fish nibbles and then strikes while Voice hints and Sound are enabled
- **THEN** the player hears a brief hold-steady hint, followed by a prompt to set the hook; the strike may interrupt the nibble speech.

#### Scenario: Repeated nibble
- **WHEN** repeated nibble events arrive within a short interval
- **THEN** the game does not queue or speak the same instruction for every event.

#### Scenario: Speech disabled or interrupted
- **WHEN** the player turns off Voice hints or Sound, pauses, or leaves the page while a hint is speaking
- **THEN** the speech stops, while the on-screen cue and screen-reader instruction remain available.

#### Scenario: No speech support
- **WHEN** speech synthesis is unavailable on a device
- **THEN** gameplay proceeds without an error and the other cues still communicate what to do.
