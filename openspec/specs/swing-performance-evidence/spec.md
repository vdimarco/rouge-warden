# Full Swing performance evidence

## Requirements

### Requirement: Quantitative performance evidence
Full Swing rounds SHALL report measured average FPS, p95/p99 frame time, frames over 50 ms, and input delay evidence alongside rubric v1 responsiveness and stability. Unmeasured hardware results SHALL be marked unverified and SHALL NOT inherit a passing hardware score from software-rendered functional checks.

#### Scenario: Slow Chrome gameplay
- **WHEN** a player runs gameplay with ?debug
- **THEN** the overlay shows bounded real frame pacing and input-to-submit timing samples
- **AND** pause, hidden-tab time and manually held simulation do not contaminate gameplay samples
- **AND** input-to-submit timing is not described as physical input-to-display latency

#### Scenario: Release comparison
- **WHEN** a graphics or gameplay round is considered for merge
- **THEN** its report identifies workload, viewport, browser, renderer, sample duration and sample count
- **AND** comparable verified regressions block release or are reverted
- **AND** missing hardware evidence remains an explicit open gate

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
