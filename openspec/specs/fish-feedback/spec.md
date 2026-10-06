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
The photo beat of a trophy, a legend or a fish that opens a place SHALL show the fish in the middle of the part of the view that the catch card leaves free when the flash comes. The card SHALL then come up beside the fish, not over it. This SHALL hold right after a jump, and when frames take longer than 50 ms.

#### Scenario: Trophy landed during a jump's zoom on slow frames
- **WHEN** a trophy is landed while a jump's zoom is still on, and every frame takes 150 ms
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
In play, the prompt SHALL be a small card in the top corner opposite the gauge: the top right, or the top left when the reel is on the left in motion play. It SHALL be at most 210 px wide. Its picture SHALL move as the player must move: tip back, flick forward, raise, lower, steer, hold upright, or turn the crank. A pulse SHALL show the other actions. With reduced motion or Calm effects the picture SHALL be still. The how-to line under the card SHALL hide when the rod cue over the reel shows the same words. The card SHALL hide while the cast report is up, and it SHALL move down under the pull meter while that shows. In the tall reel a toast SHALL then stand under the card as well as under the gauge. The pull meter SHALL hide when the motion sensors send no sample for 0.4 s. A slow frame that holds the samples back SHALL NOT hide it or start its pull again. The gauge SHALL be at most 190 x 120 px (220 x 140 px with Larger text), and its words SHALL not overlap.

#### Scenario: A jump in motion play
- **WHEN** a fish jumps in a fight at 360x640 in motion play
- **THEN** the card in the top right says to lower the rod, its phone picture moves down and up, and the card is clear of the gauge and the HUD.

#### Scenario: The reel on the left
- **WHEN** the reel is on the left in motion play at 412x915
- **THEN** the gauge is in the top right and the card is in the top left.

#### Scenario: A toast while the pull meter shows
- **WHEN** a toast shows in a fight in motion play at 360x640 or 390x844, with the reel on either side, while the pull meter shows
- **THEN** the toast stands under the gauge and under the card, and it is clear of the crank, the gauge, the rod cue, the card, the drag bar and the pull meter.

#### Scenario: A slow frame in motion play
- **WHEN** a frame of a fight in motion play comes 4 s late while the pull meter shows
- **THEN** the pull meter stays up and keeps its pull, and the card stays under it.
