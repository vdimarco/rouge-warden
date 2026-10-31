# gta-graphics

## ADDED Requirements

### Requirement: The slide pay plays two rising notes and the chain is heard

When a slide earns its graded banner, the driver hears two quick rising notes on the same frame. Each link of a chain after the first adds one short repeat of the high note, up to four. A slide that does not pay plays no notes. The notes do not sound like the rank pitches, the city tones, the lock chirp, the dent thud, the loss sting, or the tire scream.

#### Scenario: A single slide

- **WHEN** the banner shows a grade with no count
- **THEN** the driver hears the two rising notes and no repeat

#### Scenario: A chain of three

- **WHEN** the banner shows x3
- **THEN** the driver hears the two rising notes, then two short repeats of the high note

#### Scenario: A voided slide stays quiet

- **WHEN** a failsafe stop ends the slide
- **THEN** no banner shows and no notes play

#### Scenario: Only the driver hears it

- **WHEN** a second player is in the city and the driver earns a slide
- **THEN** the notes play on the driver's client only
