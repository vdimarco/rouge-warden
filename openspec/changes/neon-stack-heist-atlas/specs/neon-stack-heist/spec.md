# neon-stack-heist

## Requirement: Heist block

The playable block is a street of atlas tiles with buildings, signs, props, and a skyline quad. The runner is about 1.5 tiles tall.

### Scenario: Runner height at 390

Given the game at 390x844, tilt 55, yaw 0, seed 4
When the idle runner is measured with runnerRect
Then the visible height divided by one ground tile is between 1.3 and 1.7

### Scenario: Signs off

Given every sign is off
When the frame is read
Then saturated neon remains only on the runner outline
