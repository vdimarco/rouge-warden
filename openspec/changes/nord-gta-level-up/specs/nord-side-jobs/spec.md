## ADDED Requirements

### Requirement: Side jobs from map markers
The Montréal map SHALL offer GTA-style side jobs that start from yellow markers and run beside the campaign without changing it.

#### Scenario: Start a job
- **WHEN** a player presses E at a yellow job marker while no job is running
- **THEN** the job starts for both players, the HUD shows its title, objective and timer, and the radar shows its target

#### Scenario: Delivery
- **WHEN** the players run "Livraison chaude"
- **THEN** they collect an order and deliver it to three doors before the timer ends, and success pays cash

#### Scenario: Car thief
- **WHEN** the players run "Voleur de char"
- **THEN** a thief car flees along the streets, and the job succeeds when ramming wrecks it

#### Scenario: Ink goons
- **WHEN** the players run "L'encre déborde"
- **THEN** three waves of the Curator's goons attack at the Théâtre de Verdure, a player without a gun receives a pistol, and the job succeeds when every wave is down

#### Scenario: Escape
- **WHEN** the players run "Cinq étoiles"
- **THEN** the player gets three stars, and the job succeeds if the stars clear or the player reaches the garage within three minutes

#### Scenario: Fail and retry
- **WHEN** the timer ends, a player is knocked out or arrested, or a required car is wrecked
- **THEN** the HUD shows MISSION RATÉE, spawned job actors are removed, and R restarts the job rather than the campaign encounter

### Requirement: The campaign is unchanged
Side jobs SHALL not change the campaign, its save file or its checks.

#### Scenario: Story checks
- **WHEN** the host runs the story-slice suite and the legacy smoke suite
- **THEN** every existing check passes, the campaign save stays version 1, and the race does not start from gate 0 while a side job is active

#### Scenario: Marker placement
- **WHEN** the markers spawn
- **THEN** each is at least 15 m from every QA anchor and campaign location, and none spawn in Toronto or under `-NordNoCampaign`
