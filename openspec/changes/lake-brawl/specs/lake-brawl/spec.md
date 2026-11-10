# Lake Brawl

## ADDED Requirements

### Requirement: A fight is decided by health or the clock

Two fighters start with full health and one meter stock. A punch, a kick and a special each have a wind-up, an active window and a recovery. A blocked hit does one fifth of its damage. A special costs one meter stock.

#### Scenario: Knock-out

- GIVEN a fight is under way
- WHEN a fighter's health reaches zero
- THEN that fighter is launched off screen, "K.O." shows, and the other fighter is named the winner

#### Scenario: Time runs out

- GIVEN a fight is under way
- WHEN the timer reaches zero
- THEN the fighter with more health wins

### Requirement: The campaign has five chapters

A campaign is one chosen leader against four random rivals and then a final rival, one per stage, in a fixed stage order. A story card shows before each fight. Each chapter's opponent hits harder, decides faster and blocks more often than the last.

#### Scenario: Winning a chapter

- GIVEN the player wins a campaign fight that is not the last
- WHEN the player continues
- THEN the next chapter's story card shows on the next stage, and the chapter is saved in the browser

#### Scenario: Losing a chapter

- GIVEN the player loses a campaign fight
- WHEN the player chooses to retry
- THEN the same chapter starts again with both fighters at full health

#### Scenario: Finishing the campaign

- GIVEN the player wins the fifth chapter
- WHEN the player continues
- THEN the epilogue shows, the leader is marked as cleared on the leader select screen, and the saved campaign is removed

#### Scenario: Coming back later

- GIVEN a campaign was left part way through
- WHEN the player opens the game again
- THEN the title menu offers to continue it at the saved chapter

### Requirement: The game plays on a phone

On a touch screen the fight shows a slide bar for left and right, a block button, and jump, special, punch and kick buttons. Menus answer to taps. The game fits the screen in landscape and in portrait.

#### Scenario: Portrait

- GIVEN a phone held upright
- WHEN a fight starts
- THEN the game sits at the top of the screen and the controls sit below it

### Requirement: The game has an arcade cabinet

The Cottage Arcade has a Lake Brawl cabinet that opens `/lake-brawl/`, and the Switch game list includes it.

#### Scenario: Cabinet line

- GIVEN at least one leader has finished the campaign in this browser
- WHEN the arcade loads
- THEN the cabinet screen reads "CAMPAIGN CLEARED n/14"
