## ADDED Requirements

### Requirement: The mission card matches this frame
In flat play the score-row card SHALL show the objective written in that same frame. A clock that just changed, and whether the card is hot, SHALL already be on the pill after one frame.

#### Scenario: Seven seconds on that frame
- **WHEN** a fight's clock is set to seven seconds and one frame passes
- **THEN** the card already says 7 s and uses the hot card
- **AND** that text matches the objective from this frame, not the time from the frame before
