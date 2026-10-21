## ADDED Requirements

### Requirement: A missing crew rig plays the casual walk
When the crew body is missing and the casual skeleton, its idle, and its walk all load, the player mesh SHALL stay visible and play that walk while moving on foot. The idle SHALL play when nearly still. The static clothed stand SHALL remain the fallback when those assets are missing, and that stand SHALL NOT step. The body rock, the opening pitch of −16, and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: Walking plays the casual stride
- **WHEN** the crew body is missing, the casual walk clip is loaded, and planar speed is above a walk
- **THEN** the mesh plays the casual walk and the feet are apart at the stride

#### Scenario: Standing plays the casual idle
- **WHEN** the crew body is missing, the casual idle clip is loaded, and planar speed is at most 5 cm/s
- **THEN** the mesh plays the casual idle and the feet stay together

#### Scenario: A missing casual clip keeps the stand
- **WHEN** the crew body is missing and the casual skeleton or its clips do not load
- **THEN** the static clothed stand is shown and the skeletal mesh is hidden

#### Scenario: The camera and the rock stay
- **WHEN** the casual walk is playing
- **THEN** the walking socket, the −16 opening pitch, and the sway amplitudes are unchanged
