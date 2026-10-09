## ADDED Requirements

### Requirement: Textured cottage crew
The eight supplied cottage characters SHALL use complete textured skeletal models with recognizable face, hair, clothing and accessories, in the established comic art direction.

#### Scenario: Inspect the crew
- **WHEN** the eight residents are viewed at conversation distance and in the 1600 by 900 lineup
- **THEN** all eight render with textured complete bodies and distinct reference outfits, correctly grounded and without missing materials
- **AND** source models and generation provenance are retained

#### Scenario: Walk and talk online
- **WHEN** a client joins a host and approaches a crew member with E
- **THEN** the resident walks using the imported animation, movement replicates and only the interacting player sees the existing caption
- **AND** existing car controls and mission state are preserved

#### Scenario: Revised skull-shirt likeness
- **WHEN** the skull-shirt resident is viewed in the saved face close-up
- **THEN** his short tousled hair, short beard and moustache, broad smile and facial proportions follow the newly supplied face illustration
- **AND** his black graphic shirt, teal palm shorts and bare feet remain recognizable

## MODIFIED Requirements

### Requirement: Original park residents
The game SHALL include goofy original park residents with readable silhouettes and short original dialogue, including the eight user-supplied cottage crew designs with temporary descriptive names and complete textured skeletal bodies.

#### Scenario: Meet a resident
- **WHEN** a walking player approaches a resident and presses E
- **THEN** the player receives the resident's dialogue
- **AND** two connected players see the same resident placement and movement
- **AND** only the interacting player receives the dialogue, without changing completed mission progress
