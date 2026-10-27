## ADDED Requirements
### Requirement: Blocked goon movement preserves its slide behavior
The game SHALL retain the existing straight attempt, four side-aware retries, collision/surface checks and remembered successful direction while preparing fixed turn rotations once.

#### Scenario: A post blocks a chasing or returning goon
- **GIVEN** the straight step is blocked and the goon remembers either side or has no side
- **WHEN** the goon attempts to move
- **THEN** each attempted point and the first successful position/side exactly match the previous implementation, including complete blockage
- **AND** no fixed-angle sine/cosine is recalculated during retries

#### Scenario: A clear step follows blocked movement
- **GIVEN** a goon previously slid and its next straight step is clear
- **WHEN** it moves again using desktop, phone or XR simulation
- **THEN** it takes the unchanged straight step without changing its remembered side or recalculating retry rotations
