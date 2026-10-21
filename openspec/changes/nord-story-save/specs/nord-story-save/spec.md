## ADDED Requirements

### Requirement: A race save still loads
A version-1 slot SHALL load when completed missions are 0, 1, or 2 and the story tail is empty. Loading it SHALL leave the pond, the court, the show, the rescue, the convoy, the blank page, the tour, and the home beat at their start. Completed missions SHALL stay the stored count, and SHALL stay at most 2.

#### Scenario: An old finished race
- **WHEN** a version-1 slot with completed missions 2 is loaded
- **THEN** the race stays finished and the pond is offered from its first step

#### Scenario: Missions past the race
- **WHEN** a slot claims completed missions 3
- **THEN** the slot is rejected and is not overwritten

### Requirement: The day after the race is stored
A version-3 slot SHALL store completed missions 0–2 and the eight story steps. Each step SHALL be inside that beat's banked range. A later beat SHALL be stored above its start only when every earlier beat is banked. A story step above its start SHALL be stored only when completed missions are 2. Loading that slot SHALL resume those steps. The chain, the hold clocks, the court misses, cash, and the side errands SHALL NOT be fields in the slot.

#### Scenario: Mid-pond
- **WHEN** a version-3 slot has completed missions 2, the pond on a middle step, and every later beat at its start
- **THEN** the pond resumes on that step and the court stays closed

#### Scenario: The day is home
- **WHEN** a version-3 slot has every story beat banked and completed missions 2
- **THEN** no story beat is open and completed missions are still 2

#### Scenario: A skipped beat
- **WHEN** a version-3 slot moves the court before the pond is banked
- **THEN** the slot is rejected and is not overwritten

#### Scenario: Story before the race
- **WHEN** a version-3 slot has completed missions 1 and a pond step
- **THEN** the slot is rejected and is not overwritten

### Requirement: The planted future fixture stays planted
Version 2 SHALL stay unsupported. The game SHALL NOT write version 2. An unsupported slot SHALL stay byte-identical after a session tries to save.

#### Scenario: The fixture
- **WHEN** the isolated slot is version 2 with completed missions 1
- **THEN** the session starts at the opening, warns that the save is unreadable, and leaves those bytes in place
