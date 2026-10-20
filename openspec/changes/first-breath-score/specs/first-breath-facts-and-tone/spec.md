## MODIFIED Requirements

### Requirement: The Sources screen
The Sources screen SHALL list every fact in the game with its clock label and its source links. The run result's "What was real" SHALL list every fact shown in that run in the same way, and with them each played stage's "What was real" facts: those the stage has no room to show whole in real time. The Sources screen SHALL end with a music credit naming the instrument samples, their makers and their licenses, with links.

#### Scenario: Open Sources
- **WHEN** the player opens Sources from the title
- **THEN** every fact shows once with its label and a link that opens its source
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

#### Scenario: The music credit
- **GIVEN** the title at 390 × 844
- **WHEN** the player opens Sources and scrolls to the end
- **THEN** a plain line credits the instrument sounds, FluidR3_GM by Frank Wen from gleitz/midi-js-soundfonts, with their licenses and working links, and it has no banned word and no em dash
- **CHECK** `qa/first-breath/screens.e2e.mjs`, `qa/first-breath/text.test.mjs`
