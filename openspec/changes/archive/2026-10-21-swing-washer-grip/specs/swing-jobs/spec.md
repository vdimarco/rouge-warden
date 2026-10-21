## MODIFIED Requirements

### Requirement: Rescue jobs
Catch!: someone SHALL slip off a tall roof; reaching them (or roping them) before they hit the street catches them, and a landing
sets them down. Window Washer: an odd-job washer SHALL hang on a tower face for 60 s; reaching him picks him up, and the street sets
him down. The washer that starts on the eighth flush SHALL hang for 36 s when the tower is within a swing, and for longer, up to
that same 60 s, only when the tower is farther.

#### Scenario: Catch!
- **WHEN** the hero is within 2.8 m of the falling person before they reach the street, and then lands
- **THEN** the person is set down beside the hero and the job pays 30 Loonies

#### Scenario: Missed
- **WHEN** the falling person reaches the street
- **THEN** a toast says a dumpster broke the fall, and the job fails with no reward

#### Scenario: The later carry is tighter
- **WHEN** the eighth flush starts a washer on a tower within a swing
- **THEN** the card counts down from 36 s

#### Scenario: An odd-job washer keeps the minute
- **WHEN** the player takes a window washer marker
- **THEN** he hangs for 60 s

### Requirement: Clog beats
While the King is still asleep, the fourth flush SHALL start a balloon to bring back, and the eighth flush SHALL start a washer to carry down. Each of those jobs SHALL take the mission card, and that card SHALL NOT say to flush the clogs. The flushes between them SHALL keep the clog card, counting toward twelve. When the beat ends, the clog card SHALL return. One flush SHALL NOT start a beat. Flushing all twelve SHALL still wake the King. A beat SHALL wait while a story mission is the current job. The washer on the eighth flush SHALL give less time than an odd-job washer when he hangs within a swing.

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

#### Scenario: The eighth flush is a shorter hang
- **WHEN** the eighth flush starts that washer within a swing
- **THEN** the card counts from 36 s, not from a minute
