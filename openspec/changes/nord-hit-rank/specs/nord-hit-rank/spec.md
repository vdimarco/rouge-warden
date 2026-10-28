## ADDED Requirements

### Requirement: A bank names its rank
A spoiled bank SHALL read SCRAPE. A clean bank SHALL read CLEAN when the chain it leaves is 1, CHAIN when that chain is 2 or 3, HEAT when that chain is 4, 5, or 6, and MAX when that chain is 7. The pay SHALL stay the amount the chain already paid.

#### Scenario: Fresh bank
- **WHEN** the terrace banks clean from a chain of zero
- **THEN** the word is CLEAN and the pay is the terrace base

#### Scenario: Heat
- **WHEN** the pond banks clean from a chain of three
- **THEN** the word is HEAT and the pay is four times the pond base

#### Scenario: Spoil
- **WHEN** a bank was spoiled
- **THEN** the word is SCRAPE

#### Scenario: Cap
- **WHEN** a job pays on a chain that is already at seven
- **THEN** the word is MAX and the pay stays seven times the reward
