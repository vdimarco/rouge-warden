## ADDED Requirements

### Requirement: A played swing reports its software frame
A flat swing on the software renderer SHALL record a play window after a warmup. In that window the input-to-submit p95 SHALL be at or under 32 ms and the frame p95 SHALL be at or under 80 ms. The report SHALL say that submission is not display latency. A hardware present measurement SHALL stay a separate gate and SHALL NOT be filled in from this window.

#### Scenario: The swing is underway
- **WHEN** the player swings in flat play and the play window is recorded
- **THEN** presses and frame intervals in that window stay inside those floors

#### Scenario: The warmup stall
- **WHEN** a stall falls in the warmup before the play window
- **THEN** that stall is not the play window

#### Scenario: What the number is
- **WHEN** the window is reported
- **THEN** the report does not call input-to-submit a display latency
