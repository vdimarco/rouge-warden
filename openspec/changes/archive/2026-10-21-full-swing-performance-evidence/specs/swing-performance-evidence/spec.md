## ADDED Requirements

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
