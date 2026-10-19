## ADDED Requirements

### Requirement: Side jobs from map markers
The Montréal map SHALL offer GTA-style side jobs that start from yellow markers and run beside the campaign without changing it.

#### Scenario: Start a job
- **WHEN** a player presses E at a yellow job marker while no job is running
- **THEN** the job starts for both players, the HUD shows its title, objective and timer, and the radar shows its target
- **AND** when no job runs, the radar shows a job marker only within 100 m and a pickup only within 60 m

#### Scenario: Delivery
- **WHEN** the players run "Livraison chaude"
- **THEN** they collect an order and deliver it to three doors before the timer ends, and success pays cash

#### Scenario: Car thief
- **WHEN** the players run "Voleur de char"
- **THEN** a thief car flees along the streets, and the job succeeds when ramming wrecks it
- **AND** ramming the thief car adds no heat

#### Scenario: Ink goons
- **WHEN** the players run "L'encre déborde"
- **THEN** three waves of the Curator's goons attack at the Théâtre de Verdure, a player without a gun receives a pistol, and the job succeeds when every wave is down

#### Scenario: Escape
- **WHEN** the players run "Cinq étoiles"
- **THEN** the player has at least three stars, and the job succeeds when the stars clear within three minutes, by losing the police or by driving into the garage while no unit sees the car

#### Scenario: Fail and retry
- **WHEN** the timer ends, a player is knocked out or arrested, or a required car is wrecked
- **THEN** the HUD shows MISSION RATÉE, after the K.-O. or ARRÊTÉ! screen when a player is down
- **AND** goons are removed at once, and job cars are removed when no player can see them
- **AND** for 30 s, R restarts the failed job from its marker; after that, R runs the campaign recovery again

### Requirement: The campaign is unchanged
Side jobs SHALL not change the campaign, its save file or its checks.

#### Scenario: Story checks
- **WHEN** the host runs the story-slice suite and the legacy smoke suite
- **THEN** every existing check passes, the campaign save stays version 1, and the race does not start from gate 0 while a side job is active

#### Scenario: Marker placement
- **WHEN** the markers spawn
- **THEN** each is at least 15 m from every QA anchor and campaign location, and none spawn in Toronto or under `-NordNoCampaign`
