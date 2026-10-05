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
