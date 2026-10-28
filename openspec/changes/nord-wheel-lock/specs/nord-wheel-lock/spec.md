## ADDED Requirements

### Requirement: The phone can lock the wheels
While driving, the player SHALL be able to hold a Lock control that sends Space, and Space SHALL lift when that hold ends. That hold SHALL NOT cancel auto gas. The brake control SHALL keep sending S while driving and SHALL keep sending Space on foot. Lock SHALL be hidden on foot. Leaving the car SHALL lift Space.

#### Scenario: Hold the lock
- **WHEN** the player is driving and holds Lock
- **THEN** Space stays down until the hold ends

#### Scenario: Slide
- **WHEN** auto gas is on and the player holds Lock
- **THEN** gas stays down with Space

#### Scenario: Brake
- **WHEN** the player brakes while driving
- **THEN** the brake control sends S and auto gas drops

#### Scenario: On foot
- **WHEN** the player is walking
- **THEN** Lock is hidden and Jump sends Space

#### Scenario: Leave the car
- **WHEN** the player leaves the car while holding Lock
- **THEN** Space lifts
