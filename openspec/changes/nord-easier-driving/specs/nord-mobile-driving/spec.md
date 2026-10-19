## ADDED Requirements

### Requirement: Forgiving default driving
NORD SHALL make keyboard and touch driving easier through predictable steering, speed buildup and slowing while preserving authoritative collision and existing input safety.

#### Scenario: Start, steer and release
- **WHEN** a player holds forward Gas from rest, makes a brief correction, or releases steering
- **THEN** useful road speed builds progressively, a brief correction avoids an abrupt full turn, and steering returns promptly to neutral
- **AND** full held steering remains useful for low-speed corners, top speed remains bounded, and 30/120 Hz motion stays consistent

#### Scenario: Lift off or enter a tight corner
- **WHEN** the player releases Gas at road speed, or holds Gas and substantial steering into a corner
- **THEN** lift-off from 2,000 cm/s slows the car to 1,000–1,200 cm/s after two seconds while travelling 2,800–3,250 cm
- **AND** forward Gas with steering above 0.2 applies bounded deceleration toward a soft corner target as steering increases, without instantaneously clamping speed
- **AND** the gentler acceleration applies to reverse while retaining its existing speed cap, service braking stops before reverse, intentional handbrake slides remain available, and traffic/impact/curb/wall behavior is preserved

### Requirement: Stable camera while using driving buttons
The browser SHALL reserve camera dragging for deliberate look actions while driving.

#### Scenario: Thumb drifts on a pedal
- **WHEN** a driving player holds and drags Gas, Brake or Exit
- **THEN** the intended key remains held until release without sending camera mouse movement
- **AND** walking action-look, floating first-finger horizontal/vertical driving, deliberate second-finger look, gyro, brake priority and interruption release remain intact
