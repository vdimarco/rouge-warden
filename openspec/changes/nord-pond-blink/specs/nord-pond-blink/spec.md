## ADDED Requirements

### Requirement: The postcard blink is audible
While the player is tagging beams, a tick SHALL sound when the decoy beams change state. The steady beam SHALL not add a second tick. A wrong tag SHALL play the dialogue cue.

#### Scenario: Decoys change
- **WHEN** the tag step is open and the decoy beams go from lit to dark, or from dark to lit
- **THEN** the local player hears one tick

#### Scenario: Steady half
- **WHEN** the tag step is open and the decoys stay lit or stay dark
- **THEN** no tick is played

#### Scenario: Wrong beam
- **WHEN** the player tags a blinking beam
- **THEN** the dialogue cue plays
- **AND** the step stays on tag

#### Scenario: Other steps
- **WHEN** the pond step is not the tag step
- **THEN** the blink tick stays silent
