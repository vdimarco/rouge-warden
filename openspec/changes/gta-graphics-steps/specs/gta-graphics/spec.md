# gta-graphics

## ADDED Requirements

### Requirement: Walking plants a footfall

On foot, a moving player plants a step once per stride. A sprint covers that stride sooner, so the plants come faster. Standing still, falling, swimming, and riding stay quiet. The tap is not the impact thud. The opening look and the night hour stay.

#### Scenario: A walk and a sprint over eight seconds

- **WHEN** the player walks at 450 cm/s for eight seconds
- **THEN** the feet plant 18 steps
- **WHEN** the player sprints at 800 cm/s for eight seconds
- **THEN** the feet plant 32 steps

#### Scenario: Still, falling, and riding stay quiet

- **WHEN** speed stays under 5 cm/s, or the player is falling, swimming, or in a car
- **THEN** no step plays

#### Scenario: The opening stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16, the socket is (0, 70, 110), and the opening hour stays 22:00
