## ADDED Requirements

### Requirement: A held chain lengthens the taught windows
The court ink and the convoy beam SHALL last longer while a chain is held. Chain 0 SHALL keep the taught danger. A full chain SHALL still leave a clear gap above 0.35 seconds, and the danger SHALL not cover the warning. The taught court sample SHALL bank at chain 0 and miss at chain 6, and the ink mark SHALL follow. The convoy pull at 1.5 seconds SHALL bank at chain 0 and miss at chain 4, and the beam mark SHALL follow.

#### Scenario: Taught court sample
- **WHEN** the chain is zero and the ball is on the taught bank sample
- **THEN** the bank lands and the ink mark is clear

#### Scenario: Full court chain
- **WHEN** the chain is six and the ball is on that same sample
- **THEN** the bank misses and the ink mark is up

#### Scenario: Taught convoy pull
- **WHEN** the chain is zero and the feeder is pulled at 1.5 seconds
- **THEN** the feed stalls and the beam mark is clear

#### Scenario: Held convoy chain
- **WHEN** the chain is four and the feeder is pulled at 1.5 seconds
- **THEN** the feed stays and the beam mark is up
