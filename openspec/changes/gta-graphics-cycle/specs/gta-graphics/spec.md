## ADDED Requirements

### Requirement: The hoodie walk reads as a cycle
The walk sheet SHALL sample the prepared hoodie walk at six times across its cycle, and those poses SHALL differ. The feet SHALL trade places and the arms SHALL swing between the first sample and a later one. The opening pitch of −16, the walking socket at Y 70 and Z 110, and the sway amplitudes SHALL stay. A sprint SHALL keep playing this walk while no run clip is imported.

#### Scenario: Six poses are not one pose
- **WHEN** the hoodie walk is sampled at six even times across its 1.333 s cycle
- **THEN** the upper leg and the upper arm have each turned by more than 30 degrees from the first sample

#### Scenario: The camera and the sprint stay
- **WHEN** that sheet is drawn
- **THEN** the opening pitch, the socket, and the sway are unchanged, and the hoodie block still leaves the run empty
