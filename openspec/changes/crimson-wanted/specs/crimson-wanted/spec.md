## ADDED Requirements

### Requirement: Street fights and patrol vehicle theft
Ambient civilians SHALL take light and heavy melee hits with visible reactions. Police and sheriff units SHALL stop, dismount and pursue an on-foot suspect as combat opponents. Vacated patrol vehicles SHALL be stealable using the existing vehicle interaction.

#### Scenario: Fight an officer
- **WHEN** the player exits a vehicle near a pursuing patrol
- **THEN** the patrol brakes before its officer exits at the driver door and approaches on foot
- **AND** light/heavy attacks can hurt and knock out the officer, who can fight back using existing block/dodge rules
- **AND** attacking an officer increases wanted heat

#### Scenario: Steal a patrol vehicle
- **WHEN** the player uses the driver-door interaction of a stationary, vacated patrol vehicle
- **THEN** the player gains driving control and vehicle theft raises wanted heat once
- **AND** police AI does not take over or delete the stolen vehicle when pursuit ends
- **WHEN** a suspect drives away in another vehicle
- **THEN** a living officer returns to their unoccupied patrol vehicle before resuming the chase

#### Scenario: Shared controls and cleanup
- **WHEN** using keyboard or touch combat and vehicle interaction controls
- **THEN** civilians and officers can be attacked and vacated patrol vehicles entered without new buttons
- **WHEN** restarting the session
- **THEN** officers and retained stolen patrol vehicles are cleaned up

### Requirement: Ambient pedestrian impacts
The game SHALL allow the player to strike ambient pedestrians with vehicles or melee while preserving named story characters' protection.

#### Scenario: Vehicle contact
- **WHEN** a player-driven vehicle contacts a pedestrian at road speed, forwards or in reverse
- **THEN** the pedestrian takes damage once per contact cooldown, may die, tumbles with momentum and ground bounces, and triggers a wanted response
- **AND** a stationary car, a car on a different elevation, or a distant near miss does not kill them

#### Scenario: Melee and witnesses
- **WHEN** a swing reaches an ambient pedestrian within its arc
- **THEN** that pedestrian takes at most one hit per swing and nearby living pedestrians flee

### Requirement: Reactive, more lifelike civilians
Civilian faces SHALL have shaded features and distinct eyes, with varied idle timing, walking and panic behavior. Deaths SHALL visibly launch, tumble and settle, with bounded lifetime and no continuing idle animation.

#### Scenario: Visual verification
- **WHEN** representative civilians and an impact are rendered at desktop and touch viewport sizes
- **THEN** facial detail, articulated impact poses and visible ground contact can be inspected in screenshots without page errors

### Requirement: Escalating law enforcement
Crimes SHALL produce up to five wanted stars, a dispatch delay, road-aware police chases, sheriff reinforcements and helicopter support at three stars.

#### Scenario: Pursuit and escalation
- **WHEN** the player attacks or kills pedestrians repeatedly
- **THEN** police SUVs pursue, higher levels add cowboy-hatted sheriff deputies, and a helicopter tracks with a searchlight
- **AND** at most four ground units and one helicopter are active

#### Scenario: Escape and arrest
- **WHEN** the player breaks all units' line of sight
- **THEN** units search the last known position and wanted status expires after an uninterrupted search countdown
- **WHEN** a nearby visible ground unit holds a stopped player for six seconds
- **THEN** an arrest ends the pursuit and briefly locks movement

#### Scenario: Controls and lifecycle
- **WHEN** playing with keyboard, gamepad or existing touch driving controls
- **THEN** the same collision and pursuit rules apply without new required buttons, and the wanted HUD remains inside desktop and phone layouts
- **WHEN** paused or in a cinematic
- **THEN** pursuit gameplay does not advance
- **WHEN** leaving or restarting the session
- **THEN** wanted status, units, effects and audio are cleared
