# gta-graphics

## ADDED Requirements

### Requirement: Quick slides chain on the graded banner

When a slide pays within 5 s of the last slide pay, the banner adds the count to the grade: for example BIG SLIDE x2, then BIG SLIDE x3, up to x9. A slide after a longer gap shows its grade alone.

#### Scenario: Three quick slides

- **WHEN** the player makes three full handbrake turns and goes straight back to the gas after each one
- **THEN** the banners read BIG SLIDE, BIG SLIDE x2, and BIG SLIDE x3

#### Scenario: A pause starts over

- **WHEN** the player coasts for 2 s between two slides
- **THEN** the second banner shows its grade with no count

#### Scenario: The count stops at nine

- **WHEN** the player chains more than nine slides
- **THEN** each banner after the ninth still shows x9
