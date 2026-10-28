## ADDED Requirements

### Requirement: Reusable traffic paint samples
Traffic sampling SHALL reuse paint storage for repeated calls with a reused output, while preserving positions, headings and colors and independent fresh outputs.

#### Scenario: Reused samples
- **WHEN** traffic indices, times, directions and optional colors vary
- **THEN** sampled values match the reference and one paint array is reused

#### Scenario: Independent results
- **WHEN** another output or the fallback palette is sampled
- **THEN** earlier independent samples and shared palette values remain unchanged
