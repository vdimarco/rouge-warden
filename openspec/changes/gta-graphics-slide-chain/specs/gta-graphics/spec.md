# gta-graphics

## ADDED Requirements

### Requirement: Quick slides chain on the banner

When a slide pays within 5 s of the last slide pay, the banner shows the count: SLIDE x2, SLIDE x3, and up to SLIDE x9. A slide after a longer gap shows SLIDE again.

#### Scenario: Three quick slides

- **WHEN** the player slides, goes straight back to the gas, and slides again, three times
- **THEN** the banners read SLIDE, SLIDE x2, and SLIDE x3

#### Scenario: A pause starts over

- **WHEN** the player coasts for 2 s between two slides
- **THEN** the second banner reads SLIDE

#### Scenario: The count stops at nine

- **WHEN** the player chains more than nine slides
- **THEN** each banner after the ninth still reads SLIDE x9
