## MODIFIED Requirements

### Requirement: Clog beats
While the King is still asleep, the fourth flush SHALL start a balloon to bring back, the sixth flush SHALL start a pizza to deliver to a roof, and the eighth flush SHALL start a washer to carry down. Each of those jobs SHALL take the mission card, and that card SHALL NOT say to flush the clogs. The fifth and the seventh flushes SHALL keep the clog card, counting toward twelve. When a beat ends, the clog card SHALL return. One flush SHALL NOT start a beat. Flushing all twelve SHALL still wake the King. A beat SHALL wait while a story mission is the current job. The washer on the eighth flush SHALL give less time than an odd-job washer when he hangs within a swing. The King SHALL still roar only on the fourth and the eighth flush.

#### Scenario: Three flushes
- **WHEN** three clogs are flushed and no story mission is running
- **THEN** the card says FLUSH THE CLOGS 3/12

#### Scenario: The fourth flush
- **WHEN** the fourth clog is flushed
- **THEN** the card names a balloon to bring back and does not say to flush the clogs

#### Scenario: The beat ends
- **WHEN** that balloon is brought back
- **THEN** the clog card returns

#### Scenario: Five flushes
- **WHEN** five clogs are flushed and the balloon beat has ended
- **THEN** the card says FLUSH THE CLOGS 5/12

#### Scenario: The sixth flush
- **WHEN** the sixth clog is flushed
- **THEN** the card names a pizza to deliver to a roof and does not say to flush the clogs

#### Scenario: The eighth flush
- **WHEN** the eighth clog is flushed
- **THEN** the card names a washer to carry down, and it is not the balloon

#### Scenario: The eighth flush is a shorter hang
- **WHEN** the eighth flush starts that washer within a swing
- **THEN** the card counts from 36 s, not from a minute
