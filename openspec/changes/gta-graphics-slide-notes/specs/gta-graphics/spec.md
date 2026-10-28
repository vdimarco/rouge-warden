# gta-graphics

## ADDED Requirements

### Requirement: The slide pay plays two rising notes

When a held handbrake slide earns its SLIDE banner, the driver hears two quick rising notes on the same frame. A slide that does not pay stays quiet. The lock chirp still plays on the catch. The notes do not sound like the rank pitches, the city tones, the dent thud, or the loss sting.

#### Scenario: A held slide is heard

- **WHEN** the player holds gas for 3 seconds, then holds the handbrake and steers
- **THEN** the lock chirp plays on the catch, and two rising notes play with the SLIDE banner

#### Scenario: A tap stays quiet

- **WHEN** the player releases the handbrake before the shove has held for 0.35 s
- **THEN** the lock chirp can play, and the two notes do not

#### Scenario: Only the driver hears it

- **WHEN** a second player is in the city and the driver earns a slide
- **THEN** the notes play on the driver's client only
