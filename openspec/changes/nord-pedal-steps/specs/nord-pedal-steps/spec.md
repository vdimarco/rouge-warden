## ADDED Requirements

### Requirement: The driving pedal has three steps
A short push SHALL send a third of gas. A longer push SHALL send two thirds. The edge of the wheel SHALL stay full gas on W. Brake SHALL use the same three steps, and its edge SHALL stay full brake on S. A short brake SHALL drop auto gas. Full gas from the button or from Auto SHALL win over a lighter wheel step. WASD and the arrow keys SHALL stay full lock.

#### Scenario: Short push
- **WHEN** the thumb is past the first edge and short of the second
- **THEN** the wheel sends a third of gas and does not send W

#### Scenario: Full push
- **WHEN** the thumb reaches the outer edge
- **THEN** the wheel sends W

#### Scenario: Short brake
- **WHEN** auto gas is held and the thumb pulls a short way down
- **THEN** auto gas drops and the wheel sends a third of brake

#### Scenario: Full gas held
- **WHEN** the gas button is held and the wheel is only on the first step
- **THEN** the car receives full gas and not the lighter step as well
