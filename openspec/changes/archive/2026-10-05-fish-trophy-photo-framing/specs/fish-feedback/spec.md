## ADDED Requirements

### Requirement: Trophy photo framing
The photo beat of a trophy, a legend or a fish that opens a place SHALL show the fish in the middle of the part of the view that the catch card leaves free when the flash comes. The card SHALL then come up beside the fish, not over it. This SHALL hold right after a jump, and when frames take longer than 50 ms.

#### Scenario: Trophy landed during a jump's zoom on slow frames
- **WHEN** a trophy is landed while a jump's zoom is still on, and every frame takes 150 ms
- **THEN** at the flash the fish's middle is within 3% of the view's size from the middle of the free part, at 390x844, 360x640 and 844x390

#### Scenario: The card comes up
- **WHEN** the card of that trophy has come up
- **THEN** the fish and its ruler are inside the view, above the card on a tall view and to its left on a wide view
