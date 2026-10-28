## ADDED Requirements

### Requirement: A job win has its own sting
A won job SHALL play a short sting that matches the job, and SHALL NOT play the ring-trial fanfare. A flush, the Sludge Run or the Sludge Tanker, SHALL play a wet sting. A fight, the Rooftop Brawl or a Mugging, SHALL play a hit. A chase or a delivery, Stop, Thief!, Pizza Rush, the Getaway Car, or Taxi!, SHALL play a dash. A rescue, Catch!, the Window Washer, or the Balloon Chase, SHALL play a lift. Each of those stings SHALL be quiet after seven tenths of a second, while the ring-trial fanfare SHALL still be sounding then. The four stings SHALL NOT be the same shape. A failed job SHALL play none of them. A finished ring trial SHALL still play the fanfare. Each sting's voice SHALL last through its longest note.

#### Scenario: The purse snatcher
- **WHEN** Stop, Thief! is won
- **THEN** the dash plays and the ring-trial fanfare does not

#### Scenario: The falling rescue
- **WHEN** Catch! is won
- **THEN** the lift plays and the dash does not

#### Scenario: The roof fight
- **WHEN** the Rooftop Brawl is won
- **THEN** the hit plays and the ring-trial fanfare does not

#### Scenario: The sludge run
- **WHEN** the Sludge Run is won
- **THEN** the wet sting plays and the ring-trial fanfare does not

#### Scenario: A miss
- **WHEN** a job fails
- **THEN** none of the four win stings play and the ring-trial fanfare does not

#### Scenario: The four stings and the fanfare
- **WHEN** the four stings and the ring-trial fanfare are rendered
- **THEN** each sting is quiet after seven tenths of a second, the fanfare is still sounding, and the four stings are not the same shape
