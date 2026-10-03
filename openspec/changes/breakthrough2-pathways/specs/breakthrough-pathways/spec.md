## ADDED Requirements

### Requirement: Technology pathways
The play screen SHALL offer six pathways the player can invest in, one step a turn, using the same limited resources as cards.
#### Scenario: Six tracks
- **WHEN** a run is in an action phase
- **THEN** aviation fuels, shipping fuels, heavy industry, long-duration storage, grids, and carbon removal are listed
- **AND** each shows research, pilot, and scale
- **AND** an unaffordable invest control is dimmed
#### Scenario: Stall and cap
- **WHEN** the player invests
- **THEN** progress either advances one step or stalls after the cost is paid
- **AND** progress never passes scale
#### Scenario: Dependency
- **WHEN** only storage or only grids is underway
- **THEN** the clean-power serve factor stays at the base
- **WHEN** both are through pilot
- **THEN** more owned clean supply counts and curtailment falls

### Requirement: Breakthrough moment
Completing scale SHALL show a breakthrough moment and apply a bounded effect the trajectory can see.
#### Scenario: Moment
- **WHEN** a pathway reaches scale
- **THEN** the screen names that pathway and a short effect line
- **AND** reduced motion or `fast=1` still shows the words without the tween
#### Scenario: Removal cools the forward line
- **WHEN** carbon removal has reached scale
- **THEN** the hold path ends cooler than the same state with that progress removed

### Requirement: Energy race
The play screen SHALL show demand growth against clean additions plus efficiency, and whether fossil generation is rising or falling.
#### Scenario: Same numbers in node and the page
- **WHEN** the browser and the headless model share a state
- **THEN** the race summary matches
#### Scenario: Context is not a score
- **WHEN** the race or the ending is on screen
- **THEN** the Ember, UNEP, and IPCC sentences are labeled as real-world context
- **AND** they are not computed from the meters

### Requirement: Ending tone
Endings SHALL describe the run, and the real-world risk statement SHALL stay separate from the score.
#### Scenario: No fatalistic close
- **WHEN** the title, help, or ending is read
- **THEN** it does not say the outcome is already war or that children are doomed
- **AND** bad endings describe interacting stress
#### Scenario: Sources
- **WHEN** the ending screen is shown
- **THEN** it cites the UNEP Emissions Gap report and IPCC AR6 WGII as context
- **AND** it says the conflict link is medium confidence and not automatic

### Requirement: Ending mix
Pathway play SHALL not make any ending the only result, and play that never invests SHALL keep the previous random ending counts.
#### Scenario: Focused investment
- **WHEN** a policy pushes one pathway, then plays the greedy-clean cards, for seeds 1 to 200
- **THEN** that pathway reaches scale in at least 70 percent of runs
- **AND** no single ending is above 80 percent
- **AND** at least four endings appear
- **AND** across the six policies every ending still appears
