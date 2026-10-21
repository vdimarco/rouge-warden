## ADDED Requirements

### Requirement: The bike tags the lawn, then the allée, then the stand
A bike at the lawn SHALL remember its rider and advance. Only that rider, still on the bike, SHALL advance at the allée, and only that rider SHALL finish at the stand. The purse SHALL be 180 session cash, paid once. A car SHALL NOT advance the loop. A later mark SHALL NOT skip an earlier one.

#### Scenario: The lawn
- **WHEN** a bike reaches the lawn
- **THEN** the loop remembers that rider and does not pay

#### Scenario: Someone else
- **WHEN** a different rider reaches the allée or the stand
- **THEN** the loop stays where it is and does not pay

#### Scenario: The stand
- **WHEN** the same rider returns to the stand after the allée
- **THEN** the loop is done and that rider is paid 180 once

### Requirement: The marks are a ride apart
The lawn and the allée SHALL each sit more than 50 m from the stand, and more than 50 m from each other.

#### Scenario: The gaps
- **WHEN** the three points are measured
- **THEN** each pair is longer than 50 m
