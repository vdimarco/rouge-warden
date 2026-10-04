## ADDED Requirements

### Requirement: Stops, tables and targets
A run SHALL have 8 stops of 3 tables, and the third table of each stop SHALL have a host. The first table target SHALL be the stop base, the second SHALL be 1.5 times the base and the host table SHALL be 2 times the base times that host's scale.

#### Scenario: Stop 1 targets
- **WHEN** a run starts and stop 1 has The Purist, whose scale is 0.18
- **THEN** stop 1 asks for 150, then 225, then 54

#### Scenario: Next host
- **WHEN** a stop starts
- **THEN** the game shows the stop number and the rule of the host who waits at its third table

#### Scenario: Win
- **WHEN** the player clears the host table of stop 8
- **THEN** the run end screen shows a win

### Requirement: Tuned targets
The base targets and host scales SHALL let a simulated player with no charms and no redraws, who plays the best chain for each hand, clear stop 1 on at least 90% of seeds and stop 2 on about half of them.

#### Scenario: Simulator report
- **WHEN** `npm run simulate` plays 1,000 seeds
- **THEN** the report shows at least 90% of seeds clearing stop 1 and between 40% and 60% clearing stop 2

### Requirement: Hosts
A host table SHALL add the host's limit on top of the follow rules, and a card SHALL pass both. The seed SHALL pick the hosts, and no host SHALL appear twice until all 5 have appeared.

#### Scenario: The Purist
- **WHEN** at The Purist's table the chain ends with K♠ and the hand holds K♥ and an 8
- **THEN** K♥ is dimmed, and the 8 picker offers only spades

#### Scenario: The Zebra
- **WHEN** at The Zebra's table the chain ends with K♠
- **THEN** K♥ rises and K♣ is dimmed

#### Scenario: The Climber
- **WHEN** at The Climber's table the chain ends with 9♠
- **THEN** J♠ rises, and 4♠ and every 8 are dimmed

#### Scenario: The Miser
- **WHEN** at The Miser's table the chain ends with K♠
- **THEN** 8♠ rises, 8♦ is dimmed and no 8 picker opens

#### Scenario: The Jeweler
- **WHEN** at The Jeweler's table the player plays a chain that is not a ring
- **THEN** the chain scores 0

#### Scenario: No early repeats
- **WHEN** a run reaches stop 5
- **THEN** stops 1 to 5 have had 5 different hosts

### Requirement: Money
A run SHALL start with $4. A cleared table SHALL pay $3, $4 or $5 for the first, second or host table, $1 for each unused chain, and $1 for each power of ten that the total beats the target by.

#### Scenario: Fast clear
- **WHEN** the player clears a first table with the first chain at 1,600 against a target of 150
- **THEN** the player earns $3 + $2 + $1, which is $6

### Requirement: Shop
The shop SHALL open after each cleared table except the last one. It SHALL offer 2 charms and 2 stamps picked with the seed, with charm rarity weights common 60, uncommon 30 and rare 10, and never a charm the player owns. Prices SHALL be $4, $6 and $8 for charms and $3 for stamps. A reroll SHALL cost $2 plus $1 for each earlier reroll in the same shop. A charm SHALL sell for half its price, rounded down.

#### Scenario: Reroll costs rise
- **WHEN** the player rerolls 3 times in one shop
- **THEN** the rerolls cost $2, $3 and $4

#### Scenario: Sell
- **WHEN** the player sells an uncommon charm
- **THEN** the player gets $3 and the slot is empty

#### Scenario: Not enough money
- **WHEN** an offer costs more than the player has
- **THEN** its buy button is disabled

### Requirement: Charm slots
The player SHALL have 4 suit slots and 1 table slot. A suit charm SHALL fire only for cards of its slot's suit. In the shop the player SHALL be able to move suit charms between suit slots. To buy a charm for a full slot, the player SHALL first sell the old charm.

#### Scenario: Move a charm
- **WHEN** in the shop the player moves Lantern from the spades slot to the hearts slot
- **THEN** Lantern fires for hearts cards on the next table

#### Scenario: Full table slot
- **WHEN** the table slot is full and the shop offers a table charm
- **THEN** the offer asks the player to sell the old charm first

### Requirement: Charms
Each charm SHALL have the effect in the brief's charm table.

#### Scenario: Lantern
- **WHEN** Lantern is in the hearts slot and the player plays 5♥ 9♥
- **THEN** the chain scores Value 22

#### Scenario: Crown
- **WHEN** Crown is in the spades slot and the player plays K♠ Q♠ 4♠
- **THEN** the chain scores Value 40

#### Scenario: Pawnbroker
- **WHEN** Pawnbroker is in the hearts slot and a chain switches into hearts twice
- **THEN** the player earns $2

#### Scenario: Hinge
- **WHEN** Hinge is in the hearts slot and a chain switches from spades into hearts
- **THEN** that switch adds 2 Mult

#### Scenario: Lucky Eight
- **WHEN** Lucky Eight is in the table slot and a chain holds two 8s
- **THEN** the chain gains 6 Mult

#### Scenario: Long Haul
- **WHEN** Long Haul is in the table slot and the player plays a 7-card chain
- **THEN** the chain gains 2 Mult

#### Scenario: Pocket
- **WHEN** Pocket is in the table slot and the player plays 3 cards from a hand of 8
- **THEN** the chain gains 30 Value

#### Scenario: Turncoat
- **WHEN** Turncoat is in the table slot and the chain ends with 5♥
- **THEN** 9♦ rises, and after it joins the chain no other card can follow by color

#### Scenario: Bridge
- **WHEN** Bridge is in the table slot and the chain ends with 5♥
- **THEN** A♣ rises, and after it joins the chain no other A can follow that way

#### Scenario: Tidy
- **WHEN** Tidy is in the table slot and a chain uses every card in hand
- **THEN** Mult is multiplied by 3

#### Scenario: Ledger
- **WHEN** Ledger is in the table slot and the player plays a 6-card chain
- **THEN** the player earns $2

#### Scenario: Knot
- **WHEN** Knot is in the table slot and the player plays a ring
- **THEN** the ring multiplies Mult by 3

#### Scenario: Spiral
- **WHEN** Spiral is in the table slot and the player has played 2 rings
- **THEN** every later chain gains 2 Mult

### Requirement: Stamps
A bought stamp SHALL apply at once to a card in the deck through a deck picker.

#### Scenario: Suit Stamp
- **WHEN** the player stamps 4♣ and picks hearts
- **THEN** the deck holds 4♥ in place of 4♣

#### Scenario: Copy Stamp
- **WHEN** the player picks K♠ and then 3♦
- **THEN** the deck holds K♦ in place of 3♦ and still holds K♠

#### Scenario: Eight Stamp
- **WHEN** the player picks diamonds
- **THEN** the deck holds one more card, a new 8♦

#### Scenario: Burn Stamp
- **WHEN** the deck holds 20 cards
- **THEN** the Burn Stamp cannot remove a card

### Requirement: Deck view
The deck view SHALL show every card in the run deck, grouped by suit. The player SHALL open it from the table screen and from the shop.

#### Scenario: After a stamp
- **WHEN** the player opens the deck view after an Eight Stamp in diamonds
- **THEN** it shows 53 cards with the new 8 in the diamonds group

### Requirement: Run end and seeds
The run SHALL show its seed while it runs. The player SHALL be able to start a run from a seed. The run end screen SHALL show win or loss, the stop reached, the best chain score, the seed and a New run button.

#### Scenario: Replay a seed
- **WHEN** the player starts a run from the seed of an earlier run
- **THEN** the first table deals the same hand as before

#### Scenario: Loss
- **WHEN** the run ends at stop 3
- **THEN** the run end screen shows the loss, stop 3, the best chain score and the seed
