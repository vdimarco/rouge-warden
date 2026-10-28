## ADDED Requirements

### Requirement: The horizon is hazier than a steep view
The comic post process SHALL fade a distant surface toward the afternoon sky more strongly when the view ray lies near the horizon than when the ray is steep at the same depth. A surface nearer than 25 m SHALL keep its colour. The sky pixel SHALL not take this fade.

#### Scenario: Look down a long street
- **WHEN** the aerial fade is applied from the walking camera to a street that runs past 140 m
- **THEN** the vanishing point is closer to the sky colour than the same distance seen on a steep ray, and the near street matches the unhazed colour
