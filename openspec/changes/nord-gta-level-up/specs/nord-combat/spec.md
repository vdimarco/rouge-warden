## ADDED Requirements

### Requirement: Weapons and pickups
Players SHALL fight with fists and pick up a hockey stick, a pistol, an SMG and a shotgun, plus health and armour, at fixed points.

#### Scenario: Pick up a weapon
- **WHEN** a walking player reaches a weapon pickup
- **THEN** the weapon and its ammo are added, a banner names it, and the pickup returns 60 s later

#### Scenario: Switch weapons
- **WHEN** the player presses Q, scrolls the mouse wheel or taps WEAPON on a phone
- **THEN** the next owned weapon becomes current and the HUD shows it with its ammo

### Requirement: Shooting and melee that work over the stream
Combat SHALL stay playable with 80–200 ms of stream delay and touch input.

#### Scenario: Fire at a target in front
- **WHEN** the player holds Fire (left mouse, F or FIRE on a phone) with a person or car within 25° of the aim direction and within weapon range
- **THEN** the server locks the nearest such target, keeps the lock for up to 4 s while it stays within 35°, and hits it when no wall is between them
- **AND** a tracer, a muzzle flash, a comic word (PAN!, RA-TA-TA!, BOUM!) and a shot sound play on both peers

#### Scenario: Melee
- **WHEN** the player attacks with fists or the hockey stick near a target
- **THEN** the player turns up to 90° toward the target and hits it with POW! or CLAC!

#### Scenario: Not while driving or down
- **WHEN** the player is driving, swimming, knocked down or arrested
- **THEN** Fire does nothing
- **AND** a Fire or Aim button held while the player gets into a car is released, so the player does not fire or aim on getting out

### Requirement: Health, armour and K.-O.
Players SHALL have health and armour, and a knocked-out player SHALL return at the hospital.

#### Scenario: Take damage
- **WHEN** a player takes damage
- **THEN** armour absorbs it first, then health drops, and the HUD bars show the change

#### Scenario: Shot while driving
- **WHEN** a player is shot or hit while driving
- **THEN** the driver loses half of the damage and the car takes body damage
- **AND** at zero health the driver lands beside the car and is knocked out

#### Scenario: K.-O.
- **WHEN** a player's health reaches zero
- **THEN** the player falls and the HUD shows K.-O.; after 4 s the player stands at the Hôpital Notre-Dame stop with full health, the same cash, no stars and only fists
- **AND** the pawn is never destroyed, and the campaign state is unchanged

### Requirement: Readable combat HUD
The HUD SHALL show stars, health, armour, weapon, ammo, cash and the aim lock without covering the radar, captions or touch controls.

#### Scenario: Phone and desktop layouts
- **WHEN** the HUD renders at 667×375 and 800×360 landscape, 390×844 portrait, 1280×720 and 1920×1080
- **THEN** the status column fits on screen, does not overlap the radar, the mission captions or the touch buttons, and its text is readable
