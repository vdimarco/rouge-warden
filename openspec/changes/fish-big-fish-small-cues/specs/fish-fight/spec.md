## ADDED Requirements

### Requirement: Heavy fish look heavy
Out in the water, a hooked fish and a fish that follows the lure SHALL be drawn bigger than their true length: at least 1.6 times, growing with the weight (2 times at 1 kg, 2.7 times at 5 kg), and at most 3.2 times. From 9 m in to 2.5 m from the rod, a fish SHALL shrink back to its true length. The catch photo, the measuring board and the journal SHALL keep the true length. Junk SHALL keep its true size.

#### Scenario: A light fish and a heavy fish
- **WHEN** a 0.2 kg fish and a 5 kg fish swim 15 m out
- **THEN** the 0.2 kg fish is drawn about 1.7 times its length and the 5 kg fish about 2.7 times its length.

#### Scenario: The fish at the rod
- **WHEN** a fish is drawn 2 m from the rod, or lies on the measuring board
- **THEN** it is drawn at its true length.
