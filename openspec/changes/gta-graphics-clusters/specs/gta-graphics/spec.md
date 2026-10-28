# gta-graphics

## ADDED Requirements

### Requirement: A Sherbrooke crown is a clustered canopy

A broadleaf tree in the Sherbrooke frame uses `Canopy{style}_{variant}.obj`. That mesh contains Leaf0, Leaf1 and Leaf2. The scaled crown's top is the tree height and its width is the crown radius. The falling-leaf count stays at ten. The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: The crown file has three leaf masses

- **WHEN** a broadleaf tree is drawn
- **THEN** its canopy file contains Leaf0, Leaf1 and Leaf2, and the scaled top sits on the tree height

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)
