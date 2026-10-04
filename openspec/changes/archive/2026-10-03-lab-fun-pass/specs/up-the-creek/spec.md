## ADDED Requirements

### Requirement: A warning before every capsize
Up the Creek SHALL warn the paddler at least 0.3 s before a capsize that a brace can stop.

#### Scenario: A capsize ahead
- **WHEN** the canoe will capsize unless the paddler braces
- **THEN** a rising whoop, ticks, a buzz, a red edge and "Brace ▶" on the low side come at least 0.3 s before

#### Scenario: After a swim
- **WHEN** the paddler swims
- **THEN** the paddler gets back in a few metres upstream of the swim, in open water

### Requirement: Eddies the paddler can read and leave
Up the Creek SHALL show the progress of an eddy catch and never trap the canoe in an eddy.

#### Scenario: Hold a catch
- **WHEN** the canoe sits in a target eddy
- **THEN** a ring fills with rising notes while the catch holds, and a hint says what the catch still needs, for example "Face upstream"

#### Scenario: Peel out
- **WHEN** the paddler strokes with the bow downstream in an eddy
- **THEN** the canoe leaves the eddy

### Requirement: No lost or stuck runs
Up the Creek SHALL keep every run on the river and give the paddler a way to restart and to share.

#### Scenario: Paddle upstream
- **WHEN** the paddler heads upstream from the put-in
- **THEN** a log jam stops the canoe, and an arrow points downstream

#### Scenario: Restart and share
- **WHEN** the paddler presses Restart or Share
- **THEN** the river starts again in under 2 s, or a link with the river's seed (`#s=`) is copied, and the cards say "Today's river"

### Requirement: Thumbs turn the way you press
Up the Creek SHALL turn the canoe toward the side that the player presses with a thumb or a key.

#### Scenario: Drag on one side
- **WHEN** the player drags down on one side of the screen, or presses A or D
- **THEN** the canoe turns toward that side

#### Scenario: The phone as a paddle
- **WHEN** the player strokes with the phone
- **THEN** a stroke on the right turns the canoe left, as a real paddle does

### Requirement: The ledge
Up the Creek SHALL end the rapid with a ledge that rewards a straight, fast line.

#### Scenario: A boof
- **WHEN** the canoe runs the ledge straight and fast
- **THEN** it boofs with 1.2 s of slow motion through mist and a rainbow

#### Scenario: A crooked line
- **WHEN** the canoe reaches the ledge 60° off its line and the paddler does not brace
- **THEN** the paddler swims
