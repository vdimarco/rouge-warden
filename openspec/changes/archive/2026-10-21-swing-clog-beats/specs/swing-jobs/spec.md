## ADDED Requirements

### Requirement: Clog beats
While the King is still asleep, the fourth flush SHALL start a balloon to bring back, and the eighth flush SHALL start a washer to carry down. Each of those jobs SHALL take the mission card, and that card SHALL NOT say to flush the clogs. The flushes between them SHALL keep the clog card, counting toward twelve. When the beat ends, the clog card SHALL return. One flush SHALL NOT start a beat. Flushing all twelve SHALL still wake the King. A beat SHALL wait while a story mission is the current job.

#### Scenario: Three flushes
- **WHEN** three clogs are flushed and no story mission is running
- **THEN** the card says FLUSH THE CLOGS 3/12

#### Scenario: The fourth flush
- **WHEN** the fourth clog is flushed
- **THEN** the card names a balloon to bring back and does not say to flush the clogs

#### Scenario: The beat ends
- **WHEN** that balloon is brought back
- **THEN** the clog card returns

#### Scenario: The eighth flush
- **WHEN** the eighth clog is flushed
- **THEN** the card names a washer to carry down, and it is not the balloon
