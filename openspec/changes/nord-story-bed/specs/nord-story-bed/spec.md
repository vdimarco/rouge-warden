## ADDED Requirements

### Requirement: An open story beat plays a third bed
While a story beat is open and the race is not running, the city SHALL play the story bed. The race SHALL keep the race bed even if a beat is also open. With no beat and no race, the city SHALL keep the neighborhood bed.

#### Scenario: Open beat
- **WHEN** a story beat is open and the race is not running
- **THEN** the bed is the story loop

#### Scenario: Race wins
- **WHEN** the race is running and a story beat is also open
- **THEN** the bed is the race loop

#### Scenario: City at rest
- **WHEN** no story beat is open and the race is not running
- **THEN** the bed is the neighborhood loop

### Requirement: The loop meets itself
The story loop SHALL be four bars at 84. The sample at the start and the sample at the wrap SHALL both be silent, so a restart meets the downbeat. The loop SHALL have energy, stay inside a peak under full scale, and differ between the two channels.

#### Scenario: Wrap
- **WHEN** the first frame and the frame at the loop length are sampled
- **THEN** both are silent, and the frame just before the wrap is nearly silent

#### Scenario: It is a loop, not a click
- **WHEN** the loop is scanned
- **THEN** it has energy, its peak stays under full scale, the channels differ, and the lead moves across the bars
