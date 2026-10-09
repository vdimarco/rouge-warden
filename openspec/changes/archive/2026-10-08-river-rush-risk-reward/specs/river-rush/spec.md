## ADDED Requirements

### Requirement: Tactical coin decisions
After the tutorial, eligible partial-action or moving-enemy stations SHALL offer a modest ordinary-coin bypass and a richer guarded coin route together. Guarded coins SHALL be visually distinct and pay twice the base points of ordinary coins under the same streak and Gold Boost. A protected collision SHALL NOT earn the existing perfect-action reward. Choices SHALL vary their lanes and required jump or duck action. Later maps and later course sections SHALL introduce harder entry or exit commitments with enough physical steering and action time. Both strategies SHALL be playable without protection; untaken alternatives SHALL remain uncollected. Tutorial beats, full-river mandatory action walls, promised wave chains and finish runway SHALL retain their existing behavior. Choice metadata, visual cues and scoring SHALL describe the same routes and actual values within bounded entity and render pools.

#### Scenario: Choose safety or a richer enemy route
- **GIVEN** an approaching decision station with a safe bypass and guarded premium coins
- **WHEN** the player takes the bypass or enters the guarded route and times the required action
- **THEN** the bypass yields a smaller coin payout without contacting its guard, while the guarded route pays double-value touched coins and the existing unprotected perfect-action reward
- **AND** coins beside the raft and untaken alternatives remain uncollected

#### Scenario: Commit or bail out
- **WHEN** the player reads a guarded route ahead, then commits or changes to the shown safe alternative before its pickups
- **THEN** each route remains physically attainable at the current speed, late returns are not required to collect mutually exclusive payouts, and the action exposure matches the displayed warning

#### Scenario: Grab partial treasure and escape
- **WHEN** the player touches an approach coin on a duck route and physically leaves its guard before contact
- **THEN** only touched tokens pay, missed tokens remain uncollected, and no perfect-action reward is granted for bypassing the guard

#### Scenario: Harder later decisions
- **WHEN** the player reaches later maps or later sections
- **THEN** guarded routes vary their required action, approach lane or reachable exit rather than merely adding more equally safe coins
- **AND** mandatory wave chains, calm recovery opportunities and finite finishes remain attainable

#### Scenario: Read choices on supported screens
- **WHEN** a decision approaches on desktop, portrait, short landscape or the fallback renderer
- **THEN** ordinary and guarded rewards are distinguishable, the route action and payoff are readable before contact, and cues do not block the main river or input gestures

## MODIFIED Requirements

### Requirement: Reachable action reward routes
Generated log rewards SHALL form a speed-aware coin arc that a single well-timed .66-second jump can collect while clearing its log. A separate safe bypass MAY offer ground coins in another clear lane as a mutually exclusive choice. Within the selected jump route, low coins SHALL NOT compete with that jump or demand a near-instant lane change; subsequent low ribbons and finish gold SHALL be reachable after landing, including earned Rush. WebGL and fallback SHALL render the shared generated heights. Physical lateral pickup tolerance, missed-coin behavior, powers and accepted action timings SHALL remain unchanged.

#### Scenario: Collect a jump reward path
- **WHEN** a player follows a generated log route at normal early or late jump timing on any map
- **THEN** one jump clears the log and collects the arc with no incompatible low coin hidden beneath the airborne raft; subsequent low gold remains reachable after landing

#### Scenario: Preserve physical pickup
- **WHEN** the raft passes beside an arc or beneath raised gold without jumping, including powered play
- **THEN** only actual compatible height and lateral contact reward once, and a missed coin passes silently

### Requirement: Coins streaks and power-ups
Coin trails and successful actions SHALL reward points and Rush charge. Streaks SHALL increase the multiplier and expire after a collection gap. Physically contacted coins SHALL add one coin and advance the streak once. Ordinary coins SHALL award ten base points and guarded premium coins SHALL award twenty base points, multiplied by the current streak multiplier and contacted Gold Boost. The eight-second coin power SHALL boost rewards for physically collected coins, with a clear name and HUD feedback, and SHALL NOT attract adjacent coins. Shield SHALL absorb one impact. Rush SHALL grant four seconds of faster invulnerable riding, SHALL NOT collect remote coins or recharge itself, and SHALL use Shift or its touch control. Perfect-action points SHALL remain separate from coin values and SHALL NOT be awarded for protected impacts.

#### Scenario: Use the contact coin boost
- **WHEN** a raft acquires the timed coin power by actual overlap
- **THEN** touched coins earn a clearly communicated bonus for eight seconds while adjacent coins remain missed

#### Scenario: Use Rush
- **WHEN** a player activates full Rush charge
- **THEN** charge spends once, speed/protection activate and expire normally, and coins continue to require contact

#### Scenario: Compare coin values under the same boost
- **WHEN** ordinary and guarded coins are physically touched at the same streak multiplier and Gold Boost state
- **THEN** guarded coins pay twice the coin points while each advances coin count, streak and charge only once

#### Scenario: Miss or protect a guarded route
- **WHEN** the raft passes beside guarded gold or uses protection to collide with its hazard
- **THEN** adjacent gold remains uncollected and protected impacts do not receive perfect-action points
