## ADDED Requirements

### Requirement: Standard deck and card points
Each run SHALL start with a standard 52-card deck. Cards 2 to 10 SHALL count their number, J, Q and K SHALL count 10, and an A SHALL count 11. Rank order SHALL run from 2 low to A high. Hearts and diamonds SHALL be red, and spades and clubs SHALL be black.

#### Scenario: Card points
- **WHEN** the player builds a chain of 7♠ then A♠
- **THEN** the chain area shows Value 18

### Requirement: Follow rules
The first card of a chain SHALL be any card. Each later card SHALL follow the card before it: it has the current suit, it has the same rank as the previous card, or it is an 8.

#### Scenario: Legal cards rise
- **WHEN** the chain ends with K♠ and the hand holds 4♠, K♥, 8♦ and 5♥
- **THEN** 4♠, K♥ and 8♦ are raised and 5♥ is dimmed

#### Scenario: Illegal tap
- **WHEN** the chain ends with K♠ and the player taps 5♥
- **THEN** 5♥ stays in the hand and the chain does not change

### Requirement: 8s name the current suit
When the player adds an 8, the game SHALL show 4 suit buttons. The named suit SHALL become the current suit.

#### Scenario: Name hearts
- **WHEN** the player adds 8♦ after K♠ and taps hearts
- **THEN** the 8 shows a hearts badge and hearts cards and 8s rise in the hand

### Requirement: Switches add Mult
A switch SHALL happen each time the current suit changes. The first card SHALL never cause a switch. Each switch SHALL add 1 to Mult.

#### Scenario: Two switches
- **WHEN** the player builds 7♠ K♠ K♥ 4♥ 4♣
- **THEN** the chain area shows Value 35 and Mult 3

#### Scenario: An 8 that keeps the suit
- **WHEN** the chain ends with a spade and the player adds 8♥ and names spades
- **THEN** Mult does not change

### Requirement: Rings
A chain SHALL close into a ring when it has 4 or more cards and its last card shares a printed suit or a printed rank with its first card. A ring SHALL multiply Mult by 2.

#### Scenario: The 252 chain
- **WHEN** the player plays 7♠ K♠ K♥ 4♥ 4♣ 7♣ with no charms
- **THEN** the chain scores Value 42 times Mult 6, which is 252

#### Scenario: Too short
- **WHEN** the player builds 7♠ 9♠ 2♠
- **THEN** the ring marker stays off

#### Scenario: Named suits do not close rings
- **WHEN** the player builds 5♥ 9♥ 9♠ 8♣ and names hearts for the 8
- **THEN** the ring marker stays off

### Requirement: Undo
The player SHALL be able to undo the last card of the chain before playing it.

#### Scenario: Undo an 8
- **WHEN** the player adds 8♦ after K♠, names hearts and taps Undo
- **THEN** 8♦ returns to the hand and spades cards rise again

### Requirement: Scoring order
A played chain SHALL score in this order: Value 0 and Mult 1; then for each card its points, its suit charm, its switch and its per-card table effects; then end-of-chain additions; then Mult multipliers, including the ring; then Value times Mult, rounded down.

#### Scenario: Switch Mult comes before the ring
- **WHEN** a ring chain with 2 switches is played with no charms
- **THEN** its Mult is (1 + 2) times 2, which is 6

### Requirement: Table flow
At the start of a table the game SHALL shuffle the deck into a draw pile and deal a hand of 8. Each table SHALL give 3 chains and 2 redraws. The chain total SHALL add to the table total, and the table SHALL clear at once when its total reaches the target.

#### Scenario: Play a chain
- **WHEN** the player plays a 3-card chain
- **THEN** the 3 cards go to the discard pile, the hand refills to 8, the table total rises by the chain score and Chains left drops by 1

#### Scenario: Redraw
- **WHEN** the player taps Redraw, selects 3 cards and taps Confirm
- **THEN** the 3 cards go to the discard pile, the hand refills to 8 and Redraws left drops by 1

#### Scenario: Cancel a redraw
- **WHEN** the player taps Redraw, selects cards and taps Cancel
- **THEN** the hand and Redraws left do not change

#### Scenario: Clear at once
- **WHEN** a chain brings the table total to the target or above with chains left
- **THEN** the table is cleared

#### Scenario: Out of chains
- **WHEN** the player plays the third chain and the total stays below the target
- **THEN** the run ends with a loss

#### Scenario: Draw pile runs out
- **WHEN** the draw pile holds fewer cards than the hand needs
- **THEN** the hand takes what is left and stays smaller than 8

### Requirement: One seeded generator
Every random choice SHALL come from one seeded generator, and the run state SHALL store the seed and the generator state.

#### Scenario: Same seed, same game
- **WHEN** two runs start from the same seed and the player takes the same actions
- **THEN** both runs deal the same cards and give the same scores
