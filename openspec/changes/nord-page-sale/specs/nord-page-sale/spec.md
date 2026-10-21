## ADDED Requirements

### Requirement: The last page can be sold
On the last page, the player SHALL be able to leave it blank or sell it. Leaving it blank SHALL bank the chain. Selling it SHALL end the page, pay 200, and SHALL NOT bank the chain. 200 SHALL be less than the blank page's chain base. A sale before the last page SHALL NOT end the page. The card SHALL keep marking the blank page.

#### Scenario: Leave it blank
- **WHEN** the player uses the blank page
- **THEN** the page ends and the chain banks

#### Scenario: Sell it
- **WHEN** the player takes the curator's offer
- **THEN** the page ends, the player is paid 200, and the chain does not bank

#### Scenario: Second sale
- **WHEN** the offer has already been taken
- **THEN** it pays nothing more

#### Scenario: Too early
- **WHEN** the player is still on a gate
- **THEN** the sale does not end the page

#### Scenario: The spot
- **WHEN** the offer is placed
- **THEN** it sits southeast of the blank page, clear of the gates, the recover posts, and the QA anchors
