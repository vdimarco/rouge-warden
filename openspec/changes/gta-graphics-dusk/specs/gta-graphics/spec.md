## ADDED Requirements

### Requirement: The opening shot can show the model's sunset
The opening shade SHALL be able to draw the avenue at the clear-day sunset the sky model already computes, with the street lamps on when that model turns them on. The spawn weather SHALL stay clear. The opening pitch of −16, the avenue aim, and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: The avenue reads as sunset
- **WHEN** the opening walk camera looks down the avenue at the model's clear-day sunset
- **THEN** upward faces are darker than the afternoon shade, and the street lamps along the avenue are lit

#### Scenario: The camera and the spawn weather stay
- **WHEN** that sunset is drawn
- **THEN** the pitch, the aim, the socket, and the clear spawn weather are unchanged
