# gta-graphics

## ADDED Requirements

### Requirement: The sun throws a soft shadow and the view occludes contacts

The directional light uses a three-degree source angle and a 45 cm world-space contact shadow. The view's ambient occlusion intensity is 0.65. The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: A tall blocker softens at the far edge

- **WHEN** a pole throws a shadow
- **THEN** the penumbra at a tall gap is wider than the penumbra at the contact, and the contact is darker than open ground

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)
