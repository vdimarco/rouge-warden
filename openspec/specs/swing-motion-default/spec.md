# swing-motion-default Specification

## Purpose
Choose an appropriate initial comic motion mode while retaining player choices.

## Requirements

### Requirement: System preference supplies the comic motion default
When there is no valid saved comic motion setting, the game SHALL select Calm when prefers-reduced-motion is reduce and Full otherwise. A valid saved Full, Calm or Off choice SHALL take precedence. The Comfort menu SHALL reflect the selected setting. This selection SHALL reuse the existing motion modes without changing controls or progress.

#### Scenario: New player requests reduced motion
- **WHEN** a new player loads the game with reduced motion enabled
- **THEN** Comic motion is Calm, the Comfort menu selects Calm, and the camera disables bank and shake

#### Scenario: Ordinary default
- **WHEN** a new player loads without a reduced-motion preference
- **THEN** Comic motion remains Full

#### Scenario: Saved choice
- **WHEN** a player saves Full or Off and reloads with reduced motion enabled
- **THEN** the saved choice is retained

#### Scenario: Legacy save
- **WHEN** a player loads a save without a comic motion field with reduced motion enabled
- **THEN** Comic motion defaults to Calm without erasing the save
