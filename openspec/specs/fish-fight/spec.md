# fish-fight Specification

## Purpose
The fight in Reel It In: the drag, jumps and tail walks, slack line, the fight prompts and toasts, the gauge, the loss lines that teach the move that would have saved the fish, and an easy first fish.

## Requirements

### Requirement: The drag gives before the line breaks
When the spool starts to slip, the crank's extra pull SHALL drop to nothing and build back over 0.6 s, so a player who stops reeling in that time does not snap the line by cranking. A run SHALL start with a ratchet click and a buzz, so the player has time to stop.

#### Scenario: Cranking into a run
- **WHEN** a player cranks steadily and a fish starts a run
- **THEN** the median time from the first slip to a snap is 0.5 s or more, and a player who keeps cranking through the run still snaps the line.

### Requirement: Fair jumps in Easy mode
In Easy mode, a jump SHALL take 0.2 s longer to rise, so a player who lowers the rod on the cue keeps the fish. Hard mode and legends keep today's timing.

#### Scenario: Casual player at Cedar River
- **WHEN** the casual scripted player fights steelhead in Easy mode
- **THEN** it lands 70% or more, and a player who keeps the rod high through a jump still loses most jumpers.

### Requirement: A beaten fish does not trick the player
When a fish is beaten in its last stage, it SHALL NOT start a jump, a tail walk, a charge, a shake, or a thrash, and a long slack SHALL throw the hook less often.

#### Scenario: Legend at the end
- **WHEN** a legend shows TIRED in its last stage
- **THEN** it makes no new trick move before it comes in.

### Requirement: Jump words through a tail walk
During a tail walk the prompt SHALL say "It jumps again and again!" from the first leap until the walk ends, also in the dash between two leaps. A jump at the hook set SHALL end the "Fish on!" banner, so the jump words show at once. A hook set with no jump SHALL keep the banner.

#### Scenario: A legend's opening walk
- **WHEN** a legend starts a tail walk at the hook set, and the line goes slack between two leaps
- **THEN** the prompt says "It jumps again and again!" with "Drag the rod down." from the hook set until the walk ends, and never "Slack line! Reel it in." or "Pump and reel." in between.

### Requirement: Slack shows
The gauge SHALL show SLACK when the line has been slack for 0.3 s. During a head shake with slack line, the prompt SHALL say "Slack line! Reel it in." When a beaten fish makes the line slack, the prompt SHALL stay green and ask the player to reel a little faster.

#### Scenario: Tired fish swims in
- **WHEN** a beaten fish swims in faster than the crank and the line goes slack
- **THEN** the prompt stays green and says "It is tired. Reel a little faster." with "Keep the line tight.", not the red slack prompt, and the guide caption and the rod cue say "Reel a little faster."

#### Scenario: Shake with slack
- **WHEN** a fish shakes its head and the line goes slack
- **THEN** the prompt says "Slack line! Reel it in." with the sub "It shakes its head. Keep the rod up."

### Requirement: Steady prompts and toasts
A fight prompt SHALL stay up for at least 0.35 s before a new one replaces it, unless the new one is more urgent. Toasts in the reel SHALL show away from the crank, and a new toast SHALL wait for the last one to show for at least 1.2 s.

#### Scenario: Busy fight
- **WHEN** a real fight is logged from strike to landing
- **THEN** no prompt changes within 0.35 s unless the new prompt is a strike, a snap risk, or a jump, and no toast overlaps the crank box.

### Requirement: Readable gauge
The gauge state word SHALL be at least 12 px and its labels at least 10 px on a 360 px wide phone. Each tension zone, the rub band, and the stamina bar SHALL differ by pattern or label as well as by colour.

#### Scenario: Colour-blind view
- **WHEN** the gauge is shown at 390x844 under a deuteranopia filter
- **THEN** the player can still tell the safe zone, the danger zone, the rub band, and the stamina bar apart.

### Requirement: Each loss teaches
The loss screen SHALL show for at least 3.2 s and SHALL name the one move that would have saved the fish. A lost legend SHALL get its own line.

#### Scenario: Lost to the weeds
- **WHEN** a fish wraps the line in the weeds in touch mode
- **THEN** the loss line names the weeds and says to drag the rod sideways to steer.

#### Scenario: Lost to the weeds with the keys
- **WHEN** a fish wraps the line in the weeds on a computer and the player used the keys last
- **THEN** the loss line says "Hold A or D to steer it.", the keys that the fight named.

### Requirement: Each reel starts with the rod at the same angle
In touch, mouse, and keys play, each reel SHALL start with the rod at 55 degrees, whatever angle the last fight left it at.

#### Scenario: After a fish is lifted out
- **WHEN** the player drags the rod up to lift a fish out, and makes the next cast
- **THEN** the next reel starts with the rod at 55 degrees.

### Requirement: Easy first fish
A brand-new player's first cast that lands in water SHALL bring a sure bite from a small, simple fish. Later casts use normal odds. A fish under 0.4 kg SHALL come in twice as fast for each turn of the crank, and a fish from 0.4 to 0.6 kg a little faster, so a small fish hooked far out is no long crank. A fish that runs for cover at its place SHALL keep its normal pace.

#### Scenario: Fresh save
- **WHEN** a fresh save makes its first water cast
- **THEN** a small pumpkinseed or perch strikes, and the scripted player lands it within 25 s.

#### Scenario: Good first cast
- **WHEN** the first water cast lands 40 to 55 m out and the player cranks at 1 turn a second
- **THEN** the first fish is landed within 25 s of the splash.
