## ADDED Requirements

### Requirement: A finished side job names the result in English

When a side job ends, the result plate uses one language. Success says MISSION DONE, the cash, and the English reason. Failure says MISSION FAILED and the English reason. A failure that can still be restarted adds R restarts on a keyboard and Menu · Recover on touch. The words do not include French accents. The retry window, the reward, and the job rules stay as they were.

#### Scenario: A keyboard failure offers the English restart

- **GIVEN** a side job has just failed and the restart window is open
- **WHEN** the result plate is shown on a keyboard
- **THEN** the head is MISSION FAILED
- **AND** the line names the English reason and R restarts

#### Scenario: A touch failure names the menu

- **GIVEN** a side job has just failed and the restart window is open
- **WHEN** the result plate is shown on touch
- **THEN** the line ends with Menu · Recover

#### Scenario: A success names the cash

- **GIVEN** a side job has just succeeded
- **WHEN** the result plate is shown
- **THEN** the head is MISSION DONE
- **AND** the line starts with the cash amount and the English reason

### Requirement: The play shell can show the plate with no host

The play page has a job plate. A page script can fill it without a running game. An empty head hides it. A touch page swaps R restarts for Menu · Recover.

#### Scenario: An offline frame shows the failure

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given MISSION FAILED and a line that ends with R restarts
- **THEN** the plate is visible
- **AND** the head and the line are the words that were given

#### Scenario: Touch swaps only the retry

- **GIVEN** the page is in touch mode
- **WHEN** the line ends with R restarts
- **THEN** that ending becomes Menu · Recover
- **AND** the reason before it stays
