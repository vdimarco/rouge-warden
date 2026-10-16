## ADDED Requirements

### Requirement: New and updated catalog order
The All Games catalog on `/` SHALL offer New and Updated in the existing rank row. New SHALL list the visible games newest first by the first committer date of each game's deployed folder. Updated SHALL list them by the last committer date of that folder, most recent first. Equal dates SHALL keep catalog order. Games that stand only in the Lab SHALL stay off this list. Featured SHALL remain the order when no sort is stored. Plays, Views, Likes, and Time SHALL keep their current ranking. The chosen sort SHALL be stored under `cottage-catalog-sort` and applied again after reload. Each visible card SHALL show one date label of the form "Added Sep 12" or "Updated Oct 10": Added for every sort except Updated, and Updated while that sort is selected. The day SHALL be the calendar day in the committer timestamp. The dates SHALL be loaded from `public/arcade/game-dates.json`, produced by `qa/arcade/game-dates.mjs` from git. The Lab page, the games, and the switcher inside a game SHALL be unchanged.

#### Scenario: Newest first
- **WHEN** a visitor selects New on All Games
- **THEN** the cards are ordered by first commit date, newest first, and each card reads Added plus that day

#### Scenario: Recently updated
- **WHEN** a visitor selects Updated on All Games
- **THEN** the cards are ordered by last commit date, most recent first, and each card reads Updated plus that day

#### Scenario: Default order
- **WHEN** a visitor opens `/` with no stored sort
- **THEN** Featured is selected and the order matches the existing Featured ranking

#### Scenario: The choice persists
- **WHEN** a visitor selects Updated and reloads the page
- **THEN** Updated is still selected and the card order is the same

#### Scenario: A failed date read can be tried again
- **WHEN** the date file fails to load, and the visitor selects New or Updated
- **THEN** the page reads the file again, sharing one read while that request is in flight, and a failure leaves the next selection free to try once more

#### Scenario: Phone width
- **WHEN** All Games is open at 390×844
- **THEN** New and Updated are on screen, each at least 44px on the shorter side, and the page does not scroll sideways
