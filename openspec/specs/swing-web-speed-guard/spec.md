## Requirements
### Requirement: Skip unused web speed calculation
#### Scenario: Release fade
- WHEN only fading web lines remain
- THEN player speed is not computed for speed lines and web fade/pixels remain unchanged.
#### Scenario: Attached or resumed rope
- WHEN a rope is attached again
- THEN speed and peak tracking use current velocity with unchanged speed-line thresholds.
