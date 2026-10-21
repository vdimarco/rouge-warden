## MODIFIED Requirements

### Requirement: A fast opening
In flat play, a first run SHALL start with a comic of about 20 s that tells who the Porcelain King is (Royce Flushmore, the
plumbing baron who flushed himself and came back a toilet god) and that his Sludge Gang has a clog bomb, ending on the card
"Mission 1: Sludge Run". The cottage room SHALL follow, then Mission 1 at once. After Mission 1 the story SHALL be Mission 2
(stop a purse snatcher), Mission 3 (catch a person falling) and Mission 4 (clear a roof). The twelve clogs SHALL stay in the
city and SHALL still wake the King, and they SHALL NOT be Mission 2. A press skips the comic. A headset does not play it.

#### Scenario: A first run
- **WHEN** a player with no save starts flat play
- **THEN** the King's comic plays first, then the cottage room, then the Sludge Run starts with its card and timer

### Requirement: Mission 1 ends
Beating the runner's crew SHALL defuse the bomb, pay 50 Loonies and play the "Mission 2" card. That card SHALL name the purse
snatcher. If the runner reaches the drain or the time runs out, the drain blows (no one is hurt) and the mission starts again
after 3.5 s. A returning save that has not won it SHALL get it too.

#### Scenario: Caught in time
- **WHEN** the hero knocks the runner down and beats his crew
- **THEN** the job ends "defused", the bank grows by 50 and the Mission 2 card names the purse snatcher

#### Scenario: Too slow
- **WHEN** the runner reaches the drain
- **THEN** the drain blows, a toast says so, and the Sludge Run starts again

### Requirement: Job markers
After Mission 1, except while Mission 2, 3 or 4 is the current story mission, up to four job markers (a light beam and a ring, coloured by job) SHALL wait 90 to 420 m from the player.
Walking or swinging into a marker SHALL start its job, with a card, a timer where there is one, and the compass on its goal. A job
done SHALL pay Loonies. A failed job SHALL say what happened in a cartoon way, with no one hurt. Going 700 m away SHALL drop it.

#### Scenario: A marker
- **WHEN** the player walks into a Pizza Rush marker
- **THEN** the card shows PIZZA RUSH with the time left, and the compass points at the drop roof

## ADDED Requirements

### Requirement: The story after Mission 1
After the Sludge Run is won, the story SHALL be three missions in order: Stop, Thief! (a street chase), Catch! (a falling rescue)
and a rooftop brawl. Each SHALL start on its own near the hero when the one before it is won. A failed one SHALL start again
after a few seconds. While one of them is the current mission, the mission card SHALL name that mission and SHALL NOT say to
flush the clogs, and odd-job markers SHALL wait. The Catch SHALL give time to swing to the roof. When the three are done, the
card SHALL return to the clogs, and flushing all twelve SHALL still wake the King.

#### Scenario: Three different missions
- **WHEN** the Sludge Run is won
- **THEN** the next mission is a purse snatcher, then a falling rescue, then a roof fight
- **AND** none of those cards says to flush a clog

#### Scenario: A miss tries again
- **WHEN** the purse snatcher gets away
- **THEN** the same mission starts again and the card still does not say to flush the clogs
