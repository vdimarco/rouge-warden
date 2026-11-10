# eleven-wells Specification

## Purpose
Eleven falling-block prototypes, each crossed with another genre and given its own personality, served as one Lab machine.

## Requirements
### Requirement: Eleven Wells collection
The arcade SHALL serve Eleven Wells at `/eleven-wells/`: a hub of eleven playable falling-block prototypes, each with its own look, sound and copy, opened from a card and returned from with a back button.
#### Scenario: Open a prototype
- **WHEN** a player picks a card on the Eleven Wells hub
- **THEN** that prototype starts in its own theme and the back button returns to the hub
#### Scenario: Phone width
- **WHEN** the page is 390 pixels wide
- **THEN** the hub and every prototype fit without horizontal scrolling and show touch buttons on touch screens

### Requirement: Eleven Wells machine
The arcade hall SHALL show an Eleven Wells cabinet at the end of the Lab group, and the shared switcher SHALL list it as a Lab-only game.
#### Scenario: Start from the hall
- **WHEN** a player opens the Lab group and starts the Eleven Wells cabinet
- **THEN** `/eleven-wells/` loads

### Requirement: Quiet when hidden
The Eleven Wells page SHALL load `/arcade/quiet.js` before any other script.
#### Scenario: Hidden page
- **WHEN** the page is hidden while a prototype plays sound
- **THEN** its sound stops
