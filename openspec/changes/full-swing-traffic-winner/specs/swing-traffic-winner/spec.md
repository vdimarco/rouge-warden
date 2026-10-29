## ADDED Requirements

### Requirement: Materialize only the winning traffic result
#### Scenario: Choosing or hitting a street car
- WHEN a standing player selects traffic or a driven car queries traffic ahead
- THEN the same closest eligible body is selected with the same distance, lane motion, paint and first-in-scan tie rule
- AND discarded nearer candidates do not create result records or paint arrays.

#### Scenario: Independent snapshots and unavailable traffic
- WHEN traffic changes or another query runs after a result was returned
- THEN the earlier result and its paint array remain independent
- AND missing traffic, hidden cars, expressway cars, lane-end fades and exact reach boundaries retain their existing results.

#### Scenario: Visible car behavior
- WHEN the selected street car is stolen and rendered at desktop or portrait size
- THEN the car state, events and nonblank rendered image match the original query without reducing quality.
