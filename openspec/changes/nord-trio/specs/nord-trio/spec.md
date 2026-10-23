## ADDED Requirements

### Requirement: The posts are walked in order by one person
A person on foot who reaches porte 1 SHALL move the walk to the second post and SHALL NOT be paid yet. That same person at porte 2 SHALL move it to the third post and SHALL NOT be paid yet. That same person at porte 3 SHALL finish the walk and pay 240 session cash once. A later post SHALL NOT skip an earlier one. A different person SHALL NOT advance a walk someone else started. A driver SHALL NOT move the walk. A second pass SHALL NOT pay.

#### Scenario: In order
- **WHEN** one person on foot reaches porte 1, then porte 2, then porte 3
- **THEN** the walk is done and the purse is 240

#### Scenario: A skip
- **WHEN** porte 1 is tagged and that person reaches porte 3 before porte 2
- **THEN** the walk stays on porte 2 and the purse is 0

#### Scenario: A bystander
- **WHEN** one person has tagged porte 1 and a different person reaches porte 2
- **THEN** the walk stays where it is and the purse is 0

#### Scenario: A driver
- **WHEN** a driver reaches porte 1
- **THEN** the walk stays at the start and the purse is 0

#### Scenario: A second time
- **WHEN** the walk is already done
- **THEN** it stays done and the purse is 0

### Requirement: The posts are a walk apart
Each pair of posts SHALL be more than 100 m apart.

#### Scenario: The legs
- **WHEN** the three posts are measured
- **THEN** every pair is more than 100 m apart and the reaches do not overlap
