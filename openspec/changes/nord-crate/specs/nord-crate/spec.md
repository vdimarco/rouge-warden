## ADDED Requirements

### Requirement: The caisse is walked, then pedaled
A person on foot at the Sherbrooke caisse SHALL be remembered. Only that person, on the park bike, SHALL finish at Parc Persillier-Lachapelle. The purse SHALL be 260 session cash, paid once. A driver SHALL NOT take the caisse. A walker SHALL NOT drop it. A later place SHALL NOT skip the caisse.

#### Scenario: The sidewalk
- **WHEN** a walker reaches the caisse
- **THEN** the run remembers that person and does not pay

#### Scenario: Someone else
- **WHEN** a different rider reaches Persillier
- **THEN** the run stays where it is and does not pay

#### Scenario: The park
- **WHEN** the same person reaches Persillier on the bike
- **THEN** the run is done and that person is paid 260 once

### Requirement: The two posts stay off the other doors
The caisse SHALL sit outside Chez Lise, the atelier, the portes, the bike marks, and the pickups. Persillier SHALL sit more than 50 m away, on the dry east side.

#### Scenario: The gaps
- **WHEN** the caisse and Persillier are measured against those doors
- **THEN** each door is outside the caisse reach, and the park is more than 50 m from the sidewalk
