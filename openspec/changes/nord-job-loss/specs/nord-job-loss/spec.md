## ADDED Requirements

### Requirement: A failed side job plays a sting
A side job that ends in failure SHALL ask for one sting. A side job that ends in success SHALL NOT ask for that sting.

#### Scenario: The miss
- **WHEN** a side job ends without success
- **THEN** the sting is asked for

#### Scenario: The success
- **WHEN** a side job ends with success
- **THEN** the sting is not asked for

### Requirement: The sting is not an existing cue
The sting wave SHALL stay off the rank pitches, the lock chirp, the pond tick, the court whistle, the court rasp, the theatre page, and the dent thud.

#### Scenario: The other cues
- **WHEN** the sting wave is compared with those cues
- **THEN** the loudest sample gap is greater than 0.05
