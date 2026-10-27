## ADDED Requirements

### Requirement: The play shell hears a puff more than once

The shell state poll is a tenth of a second. It is not a half second. Five samples fit inside the 0.7 second puff life.

#### Scenario: The old poll cannot return

- **GIVEN** the shell state poll
- **WHEN** its interval is read
- **THEN** it is 0.1 seconds
- **AND** it is not 0.5 seconds
