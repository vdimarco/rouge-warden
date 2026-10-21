## MODIFIED Requirements

### Requirement: Clog beats
While the King is still asleep, the second flush SHALL start a falling rescue, the fourth flush SHALL start a balloon to bring back, the fifth flush SHALL start a purse snatcher to run down, the sixth flush SHALL start a pizza to deliver to a roof, the seventh flush SHALL start a mugging to clear, the eighth flush SHALL start a washer to carry down, the ninth flush SHALL start a getaway car to rope, the tenth flush SHALL start a rooftop brawl, and the eleventh flush SHALL start a lid to stand on until it seats. Each of those jobs SHALL take the mission card, and that card SHALL NOT say to flush the clogs. Standing on the ground within 4 m of that lid SHALL fill a 6 s hold. Leaving the lid, or leaving the ground, SHALL slip that hold at twice the rate. Filling the hold SHALL end the job seated. The clock SHALL be 24 s, and running it out SHALL miss as popped. The first and the third flushes SHALL keep the clog card, counting toward twelve. When a beat ends, the clog card SHALL return. Flushing all twelve SHALL still wake the King. The second, the fifth, the seventh, the ninth, the tenth, and the eleventh flushes SHALL NOT wake him. A beat SHALL wait while a story mission is the current job. A beat SHALL NOT move the story route. The washer on the eighth flush SHALL give less time than an odd-job washer when he hangs within a swing. The King SHALL still roar only on the fourth and the eighth flush. The falling rescue SHALL keep its fall rate.

#### Scenario: One flush
- **WHEN** one clog is flushed and no story mission is running
- **THEN** the card says FLUSH THE CLOGS 1/12

#### Scenario: The second flush
- **WHEN** the second clog is flushed
- **THEN** the card names a person to catch and does not say to flush the clogs, and the King is still asleep

#### Scenario: After the rescue
- **WHEN** that person is set down
- **THEN** the card says FLUSH THE CLOGS 2/12

#### Scenario: Three flushes
- **WHEN** three clogs are flushed and no story mission is running
- **THEN** the card says FLUSH THE CLOGS 3/12

#### Scenario: The fourth flush
- **WHEN** the fourth clog is flushed
- **THEN** the card names a balloon to bring back and does not say to flush the clogs

#### Scenario: The beat ends
- **WHEN** that balloon is brought back
- **THEN** the clog card returns

#### Scenario: The fifth flush
- **WHEN** the fifth clog is flushed
- **THEN** the card names a purse snatcher and does not say to flush the clogs, and the King is still asleep

#### Scenario: After the chase
- **WHEN** that chase ends
- **THEN** the card says FLUSH THE CLOGS 5/12

#### Scenario: The sixth flush
- **WHEN** the sixth clog is flushed
- **THEN** the card names a pizza to deliver to a roof and does not say to flush the clogs

#### Scenario: The seventh flush
- **WHEN** the seventh clog is flushed
- **THEN** the card names a mugging and does not say to flush the clogs, and the King is still asleep

#### Scenario: After the alley
- **WHEN** that mugging is cleared
- **THEN** the card says FLUSH THE CLOGS 7/12

#### Scenario: The eighth flush
- **WHEN** the eighth clog is flushed
- **THEN** the card names a washer to carry down, and it is not the balloon

#### Scenario: The eighth flush is a shorter hang
- **WHEN** the eighth flush starts that washer within a swing
- **THEN** the card counts from 36 s, not from a minute

#### Scenario: After the washer
- **WHEN** that washer is set down
- **THEN** the card says FLUSH THE CLOGS 8/12

#### Scenario: The ninth flush
- **WHEN** the ninth clog is flushed
- **THEN** the card names a getaway car to rope and does not say to flush the clogs, and the King is still asleep

#### Scenario: After the car
- **WHEN** that car is stopped
- **THEN** the card says FLUSH THE CLOGS 9/12

#### Scenario: The tenth flush
- **WHEN** the tenth clog is flushed
- **THEN** the card names a rooftop brawl and does not say to flush the clogs, and the King is still asleep

#### Scenario: The eleventh flush
- **WHEN** the eleventh clog is flushed and the brawl has ended
- **THEN** the card names a lid to stand on and does not say to flush the clogs, and the King is still asleep

#### Scenario: On the lid
- **WHEN** the hero stands on the ground within 4 m of that lid
- **THEN** the card says to stay on the lid and the hold climbs

#### Scenario: Off the lid
- **WHEN** the hero leaves that lid or leaves the ground before the hold is full
- **THEN** the hold slips

#### Scenario: The lid seats
- **WHEN** the hold reaches 6 s
- **THEN** the job ends seated

#### Scenario: The lid pops
- **WHEN** the 24 s clock runs out first
- **THEN** the lesson card says the lid popped and to stay on it

#### Scenario: After the lid
- **WHEN** that lid has seated
- **THEN** the card says FLUSH THE CLOGS 11/12 and the King is still asleep

