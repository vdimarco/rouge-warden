## ADDED Requirements

### Requirement: The opening asphalt can show the existing wet ground
The opening shade SHALL paint the surveyed asphalt with the existing wet-ground material at full wetness: the base colour halved, splash rings, and the puddle mask. The centre dashes SHALL stay dry. The opening pitch of −16, the avenue aim, and the walking socket at Y 70 and Z 110 SHALL stay. The spawn weather SHALL stay clear.

#### Scenario: The road reads wet
- **WHEN** the opening walk camera looks down the avenue and the shade uses the wet-ground material at full wetness
- **THEN** the asphalt is darker than the dry shade and carries puddle patches, and the yellow centre dashes stay

#### Scenario: The camera and the spawn weather stay
- **WHEN** that wet road is drawn
- **THEN** the pitch, the aim, the socket, and the clear spawn weather are unchanged
