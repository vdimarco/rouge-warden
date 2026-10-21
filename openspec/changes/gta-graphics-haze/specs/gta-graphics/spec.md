## ADDED Requirements

### Requirement: Distant surfaces fade toward the sky
The comic post process SHALL fade a surface toward the afternoon sky as its depth increases, and SHALL leave a near surface and the sky pixel without that fade.

#### Scenario: Read a near wall and a far wall
- **WHEN** the aerial fade is applied to a wall near the camera and a wall far down the street
- **THEN** the far wall is closer to the sky colour than the near wall, and the near wall keeps its colour
