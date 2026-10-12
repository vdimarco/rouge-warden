## ADDED Requirements
### Requirement: Water perspective
Objects SHALL enter on each crossing’s water horizon and approach along diverging water lanes, growing and accelerating toward the foreground. Rendering and collisions SHALL share projected positions. The boat SHALL scale with its position on the water, and objects SHALL have subtle water contact marks in the scene dot grid.
#### Scenario: Approach from the horizon
- **WHEN** a light or rock enters a crossing
- **THEN** it starts small at that scene’s water horizon, moves down and outward along its lane, and grows toward the player
#### Scenario: Depth and collision agree
- **WHEN** an approaching object reaches the boat
- **THEN** collection or damage uses its visible projected position and depth-scaled bounds
#### Scenario: Water contact
- **WHEN** viewed at desktop or phone sizes
- **THEN** boat and object silhouettes, wakes and reflections remain aligned to the scene’s dot grid without covering the horizon with large sprites
