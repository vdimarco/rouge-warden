# gta-graphics

## ADDED Requirements

### Requirement: The curb frame holds a walker and a car

The curb look stays where the bag pile and the hydrant are. A walker on the sidewalk and a car in the near lane both project inside that frame. The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: The walker and the car are in the frame

- **WHEN** the curb look is drawn
- **THEN** the walker, the car, the bag pile, and the hydrant are all in front of the eye and inside the horizontal field

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)
