## Requirements
### Requirement: Reuse goal projection layout inputs
Goal projection SHALL reuse private layout inputs while preserving fresh placement results and current viewport dimensions.
#### Scenario: Phone and desktop layout
- **WHEN** projection switches between phone and desktop or the viewport resizes
- **THEN** the original safe-area padding and current viewport dimensions are supplied on every projection
