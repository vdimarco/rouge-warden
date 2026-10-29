# gta-graphics

## ADDED Requirements

### Requirement: The slide chain is heard

When a slide pays as part of a chain, the driver hears the two slide notes, then one short repeat of the high note for each link after the first, up to four repeats. A single slide plays only the two notes.

#### Scenario: A single slide

- **WHEN** the banner reads SLIDE
- **THEN** the driver hears the two rising notes and no repeat

#### Scenario: A chain of three

- **WHEN** the banner reads SLIDE x3
- **THEN** the driver hears the two rising notes, then two short repeats of the high note

#### Scenario: A long chain

- **WHEN** the banner reads SLIDE x5 or more
- **THEN** the driver hears the two rising notes, then four short repeats
