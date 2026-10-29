# gta-graphics

## ADDED Requirements

### Requirement: A handbrake slide screams while it lasts

A driver who holds the handbrake through a turn at speed hears a tire scream. It starts when the shove passes 180 cm/s sideways at 450 cm/s or faster, which is the SLIDE banner's line. It gets louder and higher as the shove grows. It fades in about 0.3 s once the car drops under 450 cm/s, the shove drops under 180 cm/s, or the handbrake is released. Only the driver hears it.

#### Scenario: Gas, then a held slide

- **WHEN** the player holds gas for 3 seconds, then holds the handbrake and steers
- **THEN** the scream is loud inside 0.1 s of the shove and is still loud when the SLIDE banner fires

#### Scenario: The slide ends

- **WHEN** the car drops under 450 cm/s during the slide
- **THEN** the scream is quiet inside 0.3 s

#### Scenario: Grip is quiet

- **WHEN** the player turns at speed without the handbrake
- **THEN** there is no scream, and only the drive loop's tire hiss plays

#### Scenario: A straight stop is a chirp only

- **WHEN** the player holds the handbrake with the wheel straight
- **THEN** the lock chirp plays and there is no scream
