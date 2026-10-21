## ADDED Requirements

### Requirement: A missing crew rig prefers the hoodie
When the crew body is missing and the hoodie skeleton, its idle, and its walk all load, the player mesh SHALL stay visible, keep the imported cloth colours, and play that walk while moving on foot. The idle SHALL play when nearly still. A sprint SHALL keep the walk. The casual walk SHALL remain the fallback when the hoodie assets are missing, and the static stand SHALL remain after that. The body rock, the opening pitch of −16, and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: Walking plays the hoodie
- **WHEN** the crew body is missing, the hoodie walk clip is loaded, and planar speed is above a walk
- **THEN** the mesh plays the hoodie walk and the back of the figure shows a hood, sleeve cuffs, and a hem

#### Scenario: The player keeps the cloth colours
- **WHEN** the hoodie mesh is shown on the player
- **THEN** the imported material slots stay, including the bare calves, and the mesh is not repainted one colour

#### Scenario: A missing hoodie keeps the casual walk
- **WHEN** the crew body is missing and the hoodie skeleton or its clips do not load
- **THEN** the casual walk path remains, and the static stand remains when that path is missing too

#### Scenario: The camera and the rock stay
- **WHEN** the hoodie walk is playing
- **THEN** the walking socket, the −16 opening pitch, and the sway amplitudes are unchanged
