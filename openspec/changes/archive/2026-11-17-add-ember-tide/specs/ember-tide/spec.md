## ADDED Requirements

### Requirement: Sorties and stages
The campaign SHALL have twelve sorties in three acts, opened in order: a sortie opens when the one before it has at least one star. Each sortie SHALL run its stages one after another and SHALL show the current stage's label, its progress, the time, and the jets left. A stage with a time limit SHALL fail the sortie when the limit passes.

#### Scenario: Fly the first sortie
- **WHEN** a new player launches First Light and flies through the five green rings, holds the jet under 30 for six seconds, then flies the three low rings
- **THEN** the game shows "Sortie complete" and a debrief with one to three stars, and Live Fire opens on the flight line

#### Scenario: Out of time
- **WHEN** the clock of Milk Run passes 95 seconds before the eighth gate
- **THEN** the game shows "Sortie failed" with "Out of time" and offers to fly it again

### Requirement: Jets, stars and the hangar
Losing a jet SHALL bring a spare while the sortie has one, and SHALL fail the sortie when it has none. A won sortie SHALL give one star, a second for losing no jet, and a third for its bonus (a par time or a number of kills). Stars SHALL buy hangar upgrades at two stars a step, three steps each, and SHALL open paint schemes at 8, 18 and 30 stars. Stars, best times, upgrades, paint and seen cutscenes SHALL be kept in the browser.

#### Scenario: Buy an upgrade
- **WHEN** a player with three unspent stars presses + on Armour
- **THEN** Armour shows one step, one star is left to spend, and the next sortie starts with a hull of 8

#### Scenario: Come back later
- **WHEN** a player who has won four sorties closes the page and opens it again
- **THEN** the title offers Continue, and the flight line shows the same stars with the fifth sortie marked next

### Requirement: The ace
Two sorties SHALL end with an ace that has its own health bar at the top of the screen. A single missile SHALL NOT shoot the ace down; a counter-attack SHALL hit it four times as hard as a missile.

#### Scenario: Cinder appears
- **WHEN** the player shoots down both escorts in the sortie Cinder
- **THEN** the stage reads "Shoot down Cinder", a bar named CINDER appears, and the bar shortens as the ace is hit

### Requirement: Cutscenes
The campaign SHALL play a cutscene on Begin campaign, before the first briefing of sorties 5, 8, 9 and 12, after the first win of sortie 8, and as the epilogue. A cutscene SHALL show the scene between two black bars with the speaker's name, a portrait where the speaker has one, and the line typed out. Click, Space or Enter SHALL finish the line or move to the next; Escape or Skip SHALL end the cutscene. A cutscene SHALL play once by itself, and every seen cutscene SHALL be listed under Film reel on the flight line.

#### Scenario: Opening
- **WHEN** a new player presses Begin campaign on a 390 px wide phone
- **THEN** the title card "Ember Tide" shows over the islands, the lines of the narrator, Marrow, Pip and Lantern follow inside the lower bar without leaving the screen, and the flight line opens when it ends

#### Scenario: Skip
- **WHEN** the player presses Escape during a cutscene
- **THEN** the cutscene ends at once, the game goes on to what follows it, and the cutscene is listed under Film reel

#### Scenario: Reduced motion
- **WHEN** the player's system asks for reduced motion
- **THEN** each line appears whole and the bars do not slide

### Requirement: Pause and the arcade
P or the Pause button SHALL stop the sortie and offer Resume, Restart sortie, Abort to flight line and Switch game; a hidden page SHALL pause a sortie in flight. The title, the flight line and the pause menu SHALL each have a Switch game button that opens the arcade's list of games, and the campaign SHALL ignore keys while that list is open. The page SHALL load no script or stylesheet from another site.

#### Scenario: Switch from the pause menu
- **WHEN** the player presses P in flight and then Switch game
- **THEN** the arcade's list opens over the paused sortie, and Escape closes the list with the sortie still paused
