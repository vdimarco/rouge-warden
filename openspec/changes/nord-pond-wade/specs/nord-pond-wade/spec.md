## ADDED Requirements

### Requirement: A swimmer tags the float before the bank pays
A person on foot who reaches the south-pond float SHALL move the wade from the bank to the float, remember that person, and SHALL NOT be paid yet. That same person, on foot at the bank, SHALL finish the wade and pay 80 session cash once. A different person waiting on the bank SHALL NOT finish it or be paid. A later visit SHALL NOT pay again. A driver SHALL NOT move the wade. Reaching the bank before the float SHALL NOT finish the wade.

#### Scenario: Out and back
- **WHEN** a swimmer reaches the float and then the bank
- **THEN** the wade is done and the purse is 80

#### Scenario: The bank first
- **WHEN** a person on foot is at the bank before they have reached the float
- **THEN** the wade stays at the bank and the purse is 0

#### Scenario: A driver
- **WHEN** a driver reaches the float or the bank
- **THEN** the wade does not move and the purse is 0

#### Scenario: A bystander
- **WHEN** one player has tagged the float and a different player is on the bank
- **THEN** the wade stays on the float and the purse is 0

#### Scenario: A second time
- **WHEN** the wade is already done
- **THEN** it stays done and the purse is 0

### Requirement: The float is out in the south pond
The float SHALL sit on the south-pond swim point, 21 m from the dry bank.

#### Scenario: The gap
- **WHEN** the float is measured from the bank
- **THEN** the gap is 21 m and the two reaches do not overlap
