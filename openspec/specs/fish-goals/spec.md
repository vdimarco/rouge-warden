# fish-goals Specification

## Purpose
What a Reel It In player aims for: six goals at each place, a goal for each day with a run of days, the next goal and the next rank, help for a player who casts short, and the sweet-cast streak.

## Requirements

### Requirement: Place goals
Each place SHALL have six goals that reward the skills the game teaches. The Places card SHALL show "Goals: N of 6" and the goal list. Finishing a goal SHALL play the record sting and toast "Goal done: <goal>." The toast with the news of a catch SHALL wait in the toast queue until it shows. A cast that finishes a goal SHALL show its toast after the cast report goes, where the report covers the toast. Newer toasts SHALL NOT push it out, and slow frames that hold the queue up SHALL NOT make it stale. The save SHALL keep the goals as a small number for each place, and a bad value SHALL be cleaned to none.

#### Scenario: Turn a fish from cover
- **WHEN** at Stump Bay the player steers a fish away from the stumps and lands it
- **THEN** the toast says "Goal done: Turn a fish from the stumps." and the Stump Bay card shows one more goal checked.

#### Scenario: Slow frame at the catch
- **WHEN** the player lands a fish that finishes a goal while another toast is up, and the frame that lands it takes 3.5 s
- **THEN** the toast still says "Goal done: <goal>." after the toast before it, and the record sting plays.

#### Scenario: A cast finishes a goal
- **WHEN** a motion player at 390x844 lands a cast 55 m out at Loon Lake, and "Cast 40 m." is not done
- **THEN** the cast report shows first, and then the toast says "Goal done: Cast 40 m." in full for its whole time, with the record sting.

#### Scenario: Broken save
- **WHEN** a save has a goal value that is not a whole number from 0 to 63
- **THEN** the game loads with no goals done at that place and no error.

### Requirement: Today's goal
The title SHALL show one goal for each local day, picked from the date and the open places. The goal SHALL name only a fish that lives at an open place and bites during that place's hours. A done goal SHALL add to a run of days; a missed day ends the run and takes nothing else away. The first fish of a day SHALL toast "Your first fish today." The first fish of a new player SHALL toast "Your first fish!" in place of that line. When one catch brings several pieces of news (the first fish of the day, goals, today's goal), they SHALL show together in one toast, so none is lost. A beginner SHALL be able to finish each daily goal in about 20 casts.

#### Scenario: Same day, same goal
- **WHEN** the game opens twice on the same day
- **THEN** the title shows the same goal and the same progress both times.

#### Scenario: Goal done
- **WHEN** the player lands the fifth fish for "Today: land 5 fish at Loon Lake."
- **THEN** the record sting plays and the toast says "Today's goal is done. 2 days in a row." when yesterday was also done.

#### Scenario: First fish ever
- **WHEN** a new player lands a fish for the first time
- **THEN** the toast says "Your first fish!" and not "Your first fish today."

#### Scenario: First fish of a new day
- **WHEN** a player who has landed fish before lands the first fish of a day
- **THEN** the toast says "Your first fish today."

### Requirement: Next goal and rank ladder
The title and the pause card SHALL name the next thing to aim for. The derby results SHALL show the next rank and its weight, and the old best on a new best.

#### Scenario: All places open
- **WHEN** every place is open and the player has two legends left
- **THEN** the title names the next legend and where to look for it.

#### Scenario: Derby end
- **WHEN** a derby ends below the top rank
- **THEN** the results show "Next rank: <name> at <kg> kg."

### Requirement: Help for short casters
A player who casts short SHALL get help to the first new place. While a place goal to open the next place is not met, a short cast SHALL sometimes say "Big fish live far out." After 20 water casts in free fishing with that goal open, the next rising ring within 25 m SHALL carry a big fish, and the game SHALL say so once. The help SHALL come back after a lost fish or a ring that fades, until the player lands a big ring's fish.

#### Scenario: Short-casting beginner
- **WHEN** the journey simulation runs a beginner who casts 8 to 25 m at Loon Lake
- **THEN** the median number of casts to open Stump Bay is 25 or fewer, and 9 in 10 open it in 70 or fewer.

### Requirement: Sweet-cast streak
Three sweet casts in a row in free fishing SHALL light up the report and make the next water cast more likely to bring a bigger fish. A cast that is not sweet SHALL end the streak. The journal SHALL show the best streak.

#### Scenario: Three sweet casts
- **WHEN** the player makes three sweet casts in a row in free fishing
- **THEN** the report says "Three sweet casts! A big fish is near."

### Requirement: Derby unlock on the catch card
A derby catch that opens a place SHALL say so on the catch card.

#### Scenario: Unlock in a derby
- **WHEN** a derby catch opens Stump Bay
- **THEN** the catch card's first badge is NEW PLACE and it says "It opens Stump Bay."
