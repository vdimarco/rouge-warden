## MODIFIED Requirements

### Requirement: A fast opening
In flat play, a first run SHALL start with a comic of about 20 s that tells who the Porcelain King is (Royce Flushmore, the
plumbing baron who flushed himself and came back a toilet god) and that his Sludge Gang has a clog bomb, ending on the card
"Mission 1: Sludge Run". The cottage room SHALL follow, then Mission 1 at once. After Mission 1 the story SHALL be Mission 2
(stop a purse snatcher), Mission 3 (catch a person falling), Mission 4 (clear a roof) and Mission 5 (deliver a pizza to a roof). The twelve clogs SHALL stay in the
city and SHALL still wake the King, and they SHALL NOT be Mission 2. A press skips the comic. A headset does not play it.

#### Scenario: A first run
- **WHEN** a player with no save starts flat play
- **THEN** the King's comic plays first, then the cottage room, then the Sludge Run starts with its card and timer

### Requirement: The story after Mission 1
After the Sludge Run is won, the story SHALL be four missions in order: Stop, Thief! (a street chase), Catch! (a falling rescue), a rooftop brawl, and a pizza delivery. Each SHALL start on its own near the hero when the one before it is won. A failed one SHALL show its lesson card and SHALL start again after that card. While one of them is the current mission, the mission card SHALL name that mission and SHALL NOT say to flush the clogs, and odd-job markers SHALL wait. The Catch SHALL give time to swing to the roof. The pizza delivery SHALL name a roof to deliver to, closer than an odd-job pizza. When the four are done, the card SHALL return to the clogs, and flushing all twelve SHALL still wake the King.

#### Scenario: Four different missions
- **WHEN** the Sludge Run is won
- **THEN** the next mission is a purse snatcher, then a falling rescue, then a roof fight, then a pizza delivery
- **AND** none of those cards says to flush a clog

#### Scenario: The delivery is not a chase
- **WHEN** Mission 5 starts
- **THEN** the card says to deliver the pizza to a roof
- **AND** the card does not say to flush the clogs

#### Scenario: A miss tries again
- **WHEN** the purse snatcher gets away
- **THEN** a lesson card names the miss, the same mission starts again after that card, and the card still does not say to flush the clogs

### Requirement: Job markers
After Mission 1, except while a story mission after the bomb is the current mission, up to four job markers (a light beam and a ring, coloured by job) SHALL wait 90 to 420 m from the player.
Walking or swinging into a marker SHALL start its job, with a card, a timer where there is one, and the compass on its goal. A job
done SHALL pay Loonies. A failed job SHALL say what happened in a cartoon way, with no one hurt. Going 700 m away SHALL drop it.

#### Scenario: A marker
- **WHEN** the player walks into a Pizza Rush marker
- **THEN** the card shows PIZZA RUSH with the time left, and the compass points at the drop roof
