## ADDED Requirements

### Requirement: A paying bank plays its rank
A bank that pays SHALL play a short pitch for the rank it names. A spoiled bank SHALL play the scrape pitch. A clean bank SHALL play clean when the chain it leaves is under 2, chain when that chain is 2 or 3, heat when that chain is 4, 5, or 6, and max when that chain is 7. The five pitches SHALL differ. None of them SHALL be the pond tick, the court whistle, the court rasp, or the theatre page.

#### Scenario: Spoil
- **WHEN** a bank was spoiled, including one that leaves a chain of 4
- **THEN** the pitch is the scrape pitch

#### Scenario: Fresh bank
- **WHEN** a clean bank leaves a chain of 1
- **THEN** the pitch is the clean pitch

#### Scenario: Heat
- **WHEN** a clean bank leaves a chain of 4, 5, or 6
- **THEN** the pitch is the heat pitch

#### Scenario: Cap
- **WHEN** a clean bank leaves a chain of 7
- **THEN** the pitch is the max pitch

#### Scenario: Neighbors
- **WHEN** the five rank pitches are compared with the pond tick, the court whistle, the court rasp, and the theatre page
- **THEN** none of the rank pitches matches those tones, and each rank pitch differs from the others
